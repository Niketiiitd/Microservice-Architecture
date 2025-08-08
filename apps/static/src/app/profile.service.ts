import { Injectable, NotFoundException } from "@nestjs/common";
import mongoose from 'mongoose';
import { ProfileQuestion, ProfileSection } from './models/profilequestion.model';

@Injectable()
export class ProfileQuestionsService {
    constructor() {
    }

    async getAllProfileQuestions(id?: string): Promise<any> {
        mongoose.connect(process.env.MONGODB_URI!);
        if (id) {
            const question = await ProfileQuestion.findById(id);
            if (!question) {
                throw new NotFoundException('Profile question not found');
            }
            return question;
        }
        const questions = await ProfileQuestion.find({});
        return questions;
    }

    async getProfileSections(): Promise<any> {
        mongoose.connect(process.env.MONGODB_URI!);
        try {
            const sections = await ProfileSection.find({}).sort({ name: 1 }).exec();
            return sections;
        } catch (error) {
            console.error('Error fetching profile sections:', error);
            throw new NotFoundException('Internal server error');
        }
    }
}
