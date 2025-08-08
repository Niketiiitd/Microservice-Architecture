import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

@Injectable()
export class PersonalProfileService {
  constructor(
    @InjectModel('UserProfile') private userProfileModel: Model<any>,
    @InjectModel('User') private userModel: Model<any>,
  ) {}

  async getPersonalProfile(email: string) {
    let userProfile = await this.userProfileModel.findOne({ email });
    if (!userProfile) {
      userProfile = await this.userProfileModel.create({ email });
    }
    return {
      personalInfo: userProfile.personalInfo,
      education: userProfile.education,
      workExperience: userProfile.workExperience,
    };
  }

  async updatePersonalProfile(email: string, data: any, calculateProfileCompletionScore: (profile: any) => Promise<number>) {
    let userProfile = await this.userProfileModel.findOne({ email });
    if (!userProfile) {
      userProfile = await this.userProfileModel.create({ email });
    }

    let isNameUpdated = false;
    let isAddressUpdated = false;

    if (data.personalInfo) {
      for (const [key, value] of Object.entries(data.personalInfo)) {
        if (value != null && value !== '') {
          if (key === 'firstName' || key === 'lastName') {
            isNameUpdated = true;
          } else if (key === 'address') {
            isAddressUpdated = true;
          }
        }
      }
    }

    if (isAddressUpdated) {
      const user = await this.userProfileModel.findOne({ email });
      const Address = data.personalInfo.address;
      if (Address.country) user.personalInfo.set('country', Address.country);
      if (Address.streetAddress) user.personalInfo.set('streetAddress', Address.streetAddress);
      if (Address.city) user.personalInfo.set('city', Address.city);
      if (Address.state) user.personalInfo.set('region', Address.state);
      if (Address.zipCode) user.personalInfo.set('postalCode', Address.zipCode);
      await user.save();
    }

    if (isNameUpdated) {
      const user = await this.userModel.findOne({ email });
      if (user) {
        user.name = `${data.personalInfo.firstName} ${data.personalInfo.lastName}`;
        await user.save();
      }
    }

    if (Array.isArray(data.education)) {
      userProfile.education = data.education
        .filter((edu: any) => edu.universityName && edu.universityName.trim())
        .map((edu: any) => ({
          universityName: edu.universityName.trim(),
          degreeType: edu.degreeType || '',
          gpa: edu.gpa || 0,
          major: edu.major || '',
          startDate: edu.startDate || '',
          endDate: edu.endDate || '',
          coursesDone: Array.isArray(edu.coursesDone) ? edu.coursesDone : [],
        }));
    }

    if (Array.isArray(data.workExperience)) {
      userProfile.workExperience = data.workExperience
        .filter((exp: any) => exp.company && exp.company.trim())
        .map((exp: any) => ({
          company: exp.company.trim(),
          role: exp.role && exp.role.trim() !== '' ? exp.role.trim() : 'N/A',
          location: exp.location || '',
          startDate: exp.startDate || '',
          endDate: exp.endDate || '',
          description: exp.description || '',
        }));
    }

    userProfile.profileCompletionScore = await calculateProfileCompletionScore(userProfile);
    await userProfile.save();

    return { success: true };
  }
}
