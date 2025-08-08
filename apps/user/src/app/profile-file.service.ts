import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { S3Service } from '../../../../libs/s3/s3.service';

const MAX_FILES = 10;
const MAX_ADDITIONAL_DOCUMENTS = 5;
const ACCEPTED_FILE_TYPES = ['image/jpeg', 'image/png', 'application/pdf'];
const DOCUMENT_TYPES = [
  'Profile Picture',
  'CV',
  'Transcript',
  'Degree Certificate',
  'Additional Document',
];

@Injectable()
export class ProfileFileService {
  constructor(
    @InjectModel('UserProfile') private userProfileModel: Model<any>,
    private readonly s3Service: S3Service
  ) {}

  async uploadUserFile(email: string, file: Express.Multer.File, meta: any) {
    if (!file) {
      throw new BadRequestException('No file uploaded.');
    }
    const { fileName, documentType, originalFileName, mimeType } = meta;
    const actualMimeType = file.mimetype || mimeType;
    if (!ACCEPTED_FILE_TYPES.includes(actualMimeType)) {
      throw new BadRequestException(
        `Unsupported file type. Allowed types: ${ACCEPTED_FILE_TYPES.join(', ')}`
      );
    }
    if (!DOCUMENT_TYPES.includes(documentType)) {
      throw new BadRequestException(
        `Invalid document type. Allowed types: ${DOCUMENT_TYPES.join(', ')}`
      );
    }
    const generatedFileName = this.generateFileName();
    await this.s3Service.uploadFile(file.buffer, generatedFileName, actualMimeType);

    let userProfile = await this.userProfileModel.findOne({ email });
    if (!userProfile) {
      userProfile = await this.userProfileModel.create({ email });
    }

    if (userProfile.files.length >= MAX_FILES) {
      throw new BadRequestException(`You can upload a maximum of ${MAX_FILES} files.`);
    }
    if (
      documentType === 'Additional Document' &&
      userProfile.files.filter((file: any) => file.documentType === 'Additional Document').length >= MAX_ADDITIONAL_DOCUMENTS
    ) {
      throw new BadRequestException(`You can upload a maximum of ${MAX_ADDITIONAL_DOCUMENTS} additional documents.`);
    }

    const fileExtension = (file.originalname || '').split('.').pop();
    const existingFileIndex = userProfile.files.findIndex(
      (f: any) => f.documentType === documentType
    );
    if (existingFileIndex !== -1) {
      userProfile.files.splice(existingFileIndex, 1);
    }

    userProfile.files.push({
      fileName,
      originalFileName,
      documentType,
      mimeType: actualMimeType,
      fileSize: file.size,
      fileExtension,
      s3FileName: generatedFileName,
      uploadedAt: new Date(),
    });
    await userProfile.save();

    const url = await this.s3Service.getObjectSignedUrl(generatedFileName);
    return { url };
  }

  async getUserFiles(email: string) {
    const userProfile = await this.userProfileModel.findOne({ email });
    if (!userProfile) {
      throw new NotFoundException('User profile not found');
    }

    // Find the profile picture in the files array
    const profilePicture = userProfile.files.find(
      (file: any) => file.documentType === 'Profile Picture'
    );
    const cvUrl = userProfile.files.find(
      (file: any) => file.documentType === 'CV'
    );
    let cvUrlSigned = null;
    if (cvUrl) {
      cvUrlSigned = await this.s3Service.getObjectSignedUrl(cvUrl.s3FileName);
    }

    let profilePictureUrl = null;
    if (profilePicture) {
      profilePictureUrl = await this.s3Service.getObjectSignedUrl(profilePicture.s3FileName);
    }

    const userProfileObject = userProfile.toObject();
    userProfileObject.personalInfo = Object.fromEntries(userProfile.personalInfo);
    userProfileObject.questionaire = Object.fromEntries(userProfile.questionaire);
    userProfileObject.files = await Promise.all(
      userProfile.files.map(async (file: any) => ({
        ...file.toObject(),
        s3FileName: await this.s3Service.getObjectSignedUrl(file.s3FileName),
      }))
    );
    userProfileObject.profilePicture = profilePictureUrl;
    userProfileObject.cvUrlSigned = cvUrlSigned;

    return userProfileObject;
  }

  private generateFileName(bytes = 32) {
    // Use crypto for secure random file names
    // Use require to avoid top-level import if not needed elsewhere
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const crypto = require('crypto');
    return crypto.randomBytes(bytes).toString('hex');
  }
}
