import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

@Injectable()
export class ApplicationService {
  constructor(
    @InjectModel('User') private userModel: Model<any>,
    @InjectModel('UserApplication') private userApplicationModel: Model<any>
  ) {}

  async invalidateApplication(email: string): Promise<void> {
    const user = await this.userModel.findOne({ email }).populate('subscription');
    if (!user) return;

    const subscription = user.subscription;
    let applicationLimit = Number(process.env.NEXT_PUBLIC_FREE_APPLICATION_LIMIT) || Infinity;
    if (subscription?.subscriptionType === 'Standard') applicationLimit = 3;
    else if (subscription?.subscriptionType === 'Pro') applicationLimit = 7;
    else if (subscription?.subscriptionType === 'Elite') applicationLimit = 12;

    const userApplications = await this.userApplicationModel.find({
      user: email,
    })
      .populate({
        path: 'program',
        populate: {
          path: 'university',
          model: 'University',
        },
      })
      .sort({ createdAt: 1 });

    if (applicationLimit !== Infinity) {
      for (let i = 0; i < userApplications.length; i++) {
        userApplications[i].isActive = i < applicationLimit;
        await userApplications[i].save();
      }
    }
  }
}
