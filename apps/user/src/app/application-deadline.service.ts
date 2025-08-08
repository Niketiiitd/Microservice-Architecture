import { BadRequestException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

@Injectable()
export class ApplicationDeadlineService {
  constructor(
    @InjectModel('UserApplication') private readonly userApplicationModel: Model<any>,
    @InjectModel('Program') private readonly programModel: Model<any>,
  ) {}

  async updateDeadline(applicationId: string, userEmail: string, deadlineData: any) {
    const application = await this.userApplicationModel.findById(applicationId);
    if (!application) throw new NotFoundException('Application not found');
    if (application.user !== userEmail) throw new UnauthorizedException('Unauthorized');

    if (!deadlineData) throw new BadRequestException('Deadline data is required');

    // Use existing program deadline
    if (deadlineData.originalDeadlineId) {
      const program = await this.programModel.findById(application.program);
      if (!program) throw new NotFoundException('Program not found');
      const programDeadline = program.deadlines.find(
        (d: any) => d._id.toString() === deadlineData.originalDeadlineId
      );
      if (!programDeadline) throw new BadRequestException('Invalid deadline selected for this program');
      application.deadline = {
        name: programDeadline.deadlineName,
        date: programDeadline.deadlineDate,
        isCustom: false,
        originalDeadlineId: deadlineData.originalDeadlineId
      };
    }
    // Use custom deadline
    else if (deadlineData.name && deadlineData.date) {
      application.deadline = {
        name: deadlineData.name,
        date: new Date(deadlineData.date),
        isCustom: true,
        originalDeadlineId: null
      };
    } else {
      throw new BadRequestException('Invalid deadline data. Either provide originalDeadlineId or both name and date');
    }

    await application.save();
    return application;
  }

  async removeDeadline(applicationId: string, userEmail: string) {
    const application = await this.userApplicationModel.findById(applicationId);
    if (!application) throw new NotFoundException('Application not found');
    if (application.user !== userEmail) throw new UnauthorizedException('Unauthorized');
    application.deadline = undefined;
    await application.save();
    return { message: 'Deadline removed successfully' };
  }
}
