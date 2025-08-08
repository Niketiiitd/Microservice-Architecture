import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

@Injectable()
export class ProfileCompletionService {
  constructor(
    @InjectModel('ProfileQuestion') private profileQuestionModel: Model<any>
  ) {}

  async calculateProfileCompletionScore(userProfile: any): Promise<number> {
    let totalPossibleScore = 0;
    let completedScore = 0;

    // Personal Info Fields
    const personalInfoFields = ['firstName', 'lastName', 'email', 'country'];
    const personalInfoFieldWeight = 5;
    totalPossibleScore += personalInfoFields.length * personalInfoFieldWeight;

    personalInfoFields.forEach((field) => {
      const value = userProfile.personalInfo.get(field);
      if (value && value.trim() !== '') {
        completedScore += personalInfoFieldWeight;
      }
    });

    // Education Background
    const educationWeight = 10;
    totalPossibleScore += educationWeight;
    if (userProfile.education && userProfile.education.length > 0) {
      completedScore += educationWeight;
    }

    // Professional Experience
    const experienceWeight = 10;
    totalPossibleScore += experienceWeight;
    if (userProfile.workExperience && userProfile.workExperience.length > 0) {
      completedScore += experienceWeight;
    }

    // Test Scores
    const testScoreFields = [
      'gmatScore',
      'gmatQuantScore',
      'gmatVerbalScore',
      'greScore',
      'greQuantScore',
      'greVerbalScore',
      'toeflScore',
      'ieltsScore',
    ];
    const testScoreFieldWeight = 2;
    totalPossibleScore += testScoreFields.length * testScoreFieldWeight;

    testScoreFields.forEach((field) => {
      const value = userProfile.personalInfo.get(field);
      if (value && value.trim() !== '') {
        completedScore += testScoreFieldWeight;
      }
    });

    // Brainstorm Questions
    const brainstormQuestionWeight = 15;
    const brainstormQuestions = await this.profileQuestionModel.find({
      type: 'BrainStorm',
    }).exec();
    const totalBrainstormQuestions = brainstormQuestions.length;
    totalPossibleScore += totalBrainstormQuestions * brainstormQuestionWeight;

    let answeredBrainstormQuestions = 0;
    if (userProfile.questionaire && userProfile.questionaire.size > 0) {
      brainstormQuestions.forEach((question) => {
        const answer = userProfile.questionaire.get(question._id.toString());
        if (answer && answer.trim() !== '') {
          answeredBrainstormQuestions += 1;
        }
      });
    }

    completedScore += answeredBrainstormQuestions * brainstormQuestionWeight;

    const completionPercentage = (completedScore / totalPossibleScore) * 100;
    return Math.round(completionPercentage * 100) / 100;
  }
}
