import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import mongoose from 'mongoose';
import { University } from './models/university.model';
import { S3Service } from './s3.service';

@Injectable()
export class UniversityService {
    constructor(private readonly s3Service: S3Service) {}

    async getAllUniversities(id?: string, name?: string): Promise<any> {
        await mongoose.connect(process.env.MONGODB_URI!);
        try {
            if (id) {
                const university = await University.findById(id);
                if (!university) {
                    throw new NotFoundException('University not found');
                }
                const logoUrl = university.logo
                    ? await this.s3Service.getObjectSignedUrl(university.logo)
                    : null;
                return { ...university.toObject(), logoUrl };
            }

            if (name) {
                const university = await University.findOne({ name: name });
                if (!university) {
                    throw new NotFoundException('University not found');
                }
                const logoUrl = university.logo
                    ? await this.s3Service.getObjectSignedUrl(university.logo)
                    : null;
                return { ...university.toObject(), logoUrl };
            }

            const universities = await University.find({});
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
            console.error('Error fetching universities:', error);
            throw new InternalServerErrorException('Internal server error');
        }
    }
}
