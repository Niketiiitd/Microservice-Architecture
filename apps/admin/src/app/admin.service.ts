import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
// Removed static import of node-fetch, using dynamic import instead.
import { S3Service } from '../../../../libs/s3/s3.service';
@Injectable()
export class AdminService {
  constructor(
    @InjectModel('University') private universityModel: Model<any>,
    @InjectModel('Program') private programModel: Model<any>,
    @InjectModel('UserApplication') private userApplicationModel: Model<any>,
    private readonly s3Service: S3Service,
  ) {}

  async getUniversities(params: { id?: string; name?: string }) {
    const { id, name } = params;
    try {
      if (id) {
        const university = await this.universityModel.findById(id);
        if (!university) {
          return { error: 'University not found', status: 404 };
        }
        const logoUrl = university.logo
          ? await this.s3Service.getObjectSignedUrl(university.logo)
          : null;
        return { ...university.toObject(), logoUrl };
      }

      if (name) {
        const university = await this.universityModel.findOne({ name });
        if (!university) {
          return { error: 'University not found', status: 404 };
        }
        const logoUrl = university.logo
          ? await this.s3Service.getObjectSignedUrl(university.logo)
          : null;
        return { ...university.toObject(), logoUrl };
      }

      const universities = await this.universityModel.find({});
      const universitiesWithLogo = await Promise.all(
        universities.map(async (university) => {
          const logoUrl = university.logo
            ? await this.s3Service.getObjectSignedUrl(university.logo)
            : null;
          return { ...university.toObject(), logoUrl };
        })
      );
      return universitiesWithLogo;
    } catch (error) {
      return { error: 'Internal server error', status: 500 };
    }
  }

  async getPrograms(params: { id?: string; universityId?: string }) {
    const { id: userApplicationId, universityId } = params;
    try {
      let programs;

      if (userApplicationId) {
        const userApplication = await this.userApplicationModel
          .findById(userApplicationId)
          .populate('program');
        if (!userApplication) {
          return { error: 'UserApplication not found', status: 404 };
        }
        const programId = userApplication.program._id;
        programs = await this.programModel.findById(programId).populate('university');
        if (!programs) {
          return { error: 'Program not found', status: 404 };
        }
      } else if (universityId) {
        programs = await this.programModel.find({ university: universityId }).populate('university');
      } else {
        programs = await this.programModel.find({}).populate('university');
      }

      return programs;
    } catch (error) {
      return { error: 'Internal server error', status: 500 };
    }
  }

  async createScenarioAndSaveSessionId(body: any) {
    try {
      const { default: fetch } = await import('node-fetch');
      const response = await fetch('https://api.toughtongueai.com/api/public/scenarios', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer R4f4yhtqhhCdtLJi99TiLPuou2oDECVfJzWAt6cYwmg',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        return { error: `HTTP error! status: ${response.status}`, status: response.status };
      }

      const data = await response.json() as { id: string };
      const userApplicationId = body.applicationId;
      const scenarioId = data.id;

      const userApplication = await this.userApplicationModel
        .findById(userApplicationId)
        .populate('program');
      if (!userApplication) {
        return { error: 'UserApplication not found', status: 404 };
      }

      const programId = userApplication.program._id;
      const program = await this.programModel.findById(programId);
      if (program) {
        program.sessionId = scenarioId;
        await program.save();
      } else {
        return { error: `Program with ID ${programId} not found`, status: 404 };
      }

      return data;
    } catch (error) {
      return { error: 'Failed to fetch or save scenario', status: 500 };
    }
  }
}
