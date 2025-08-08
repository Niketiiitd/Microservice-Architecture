import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { S3Service } from '../../../../libs/s3/s3.service';

@Injectable()
export class UserProfileService {
  constructor(
    @InjectModel('UserProfile') private userProfileModel: Model<any>,
    private readonly s3Service: S3Service
  ) {}

  async updateProfileAnswer(email: string, questionId: string, answer: any, calculateProfileCompletionScore: (profile: any) => Promise<number>) {

    let userProfile = await this.userProfileModel.findOne({ email });
    if (!userProfile) {
      userProfile = await this.userProfileModel.create({ email });
    }

    userProfile.questionaire.set(questionId, answer);
    userProfile.profileCompletionScore = await calculateProfileCompletionScore(userProfile);

    await userProfile.save();
    return { status: 'ok' };
  }

  async getProfile(email: string) {

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
    userProfileObject.files = userProfile.files.map((file: any) => ({
      ...file.toObject(),
    }));
    userProfileObject.profilePicture = profilePictureUrl;
    userProfileObject.cvUrlSigned = cvUrlSigned;

    return userProfileObject;
  }
}
