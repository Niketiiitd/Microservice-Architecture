import { BadRequestException, Injectable, InternalServerErrorException } from '@nestjs/common';
import mammoth from 'mammoth';
import mongoose from 'mongoose';
import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.entry';
import { UserProfile } from './models/userProfile.model';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

@Injectable()
export class ResumeParseService {
  async connectToDatabase() {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_URI!, {
        // @ts-ignore
        useNewUrlParser: true,
        useUnifiedTopology: true,
      });
    }
  }

  async parseResume(buffer: Buffer, fileType: string): Promise<string> {
    try {
      if (fileType === 'application/pdf') {
        const uint8Array = new Uint8Array(buffer);
        const loadingTask = pdfjsLib.getDocument({ data: uint8Array });
        const pdf = await loadingTask.promise;
        let fullText = '';
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          const pageText = textContent.items.map((item: any) => item.str).join(' ');
          fullText += pageText + '\n';
        }
        return fullText;
      } else if (fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        const { value } = await mammoth.extractRawText({ buffer });
        return value;
      } else {
        throw new BadRequestException('Unsupported file type for parsing.');
      }
    } catch (error: any) {
      console.error('Error parsing resume:', error);
      throw new InternalServerErrorException('Failed to parse resume file: ' + error.message);
    }
  }

  async findUserProfileByEmail(email: string) {
    await this.connectToDatabase();
    return UserProfile.findOne({ email });
  }

  async saveParsedResumeToProfile(userProfileId: string, resumeText: string) {
    await this.connectToDatabase();
    console.log('Saving parsed resume to user profile:', userProfileId);
    const userProfile = await UserProfile.findOneAndUpdate(
      { _id: userProfileId },
      { $set: { resumeText } },
      { new: true, upsert: true }
    );
    return userProfile;
  }
}
