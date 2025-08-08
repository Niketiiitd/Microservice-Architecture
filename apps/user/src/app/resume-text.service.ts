import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

@Injectable()
export class ResumeTextService {
  constructor(
    @InjectModel('UserProfile') private userProfileModel: Model<any>
  ) {}

  async getResumeText(email: string) {
    const userProfile = await this.userProfileModel.findOne({ email });
    if (!userProfile || !userProfile.resumeText) {
      return { resumeText: null };
    }
    return { resumeText: userProfile.resumeText };
  }
}
