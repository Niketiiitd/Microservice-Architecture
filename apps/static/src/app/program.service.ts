import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import mongoose from 'mongoose';
import { Program } from './models/program.model';
import { UserApplication } from './models/userapplication.model';

@Injectable()
export class ProgramService {
  constructor() {}

  async getAllPrograms(
    userApplicationId?: string,
    universityId?: string
  ): Promise<any> {
    try {
      await mongoose.connect(process.env.MONGODB_URI!);

      let programs;

      if (userApplicationId) {
        // Fetch the UserApplication to get the associated Program ID
        const userApplication = await UserApplication.findById(userApplicationId).populate('program');
        if (!userApplication) {
          throw new NotFoundException('UserApplication not found');
        }
        const programId = userApplication.program._id;
        // Fetch the Program details using the Program ID
        programs = await Program.findById(programId).populate('university');
        if (!programs) {
          throw new NotFoundException('Program not found');
        }
      } else if (universityId) {
        // Fetch programs by university ID
        programs = await Program.find({ university: universityId }).populate('university');
      } else {
        // Fetch all programs
        programs = await Program.find({}).populate('university');
      }

      return programs;
    } catch (error) {
      console.error('Error fetching programs:', error);
      throw new InternalServerErrorException('Internal server error');
    }
  }
}

