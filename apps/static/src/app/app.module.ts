import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ProfileQuestion, ProfileSection, Program, University, UserApplication } from '@org/models';
import { AppModule as AuthAppModule } from '../../../auth/src/app/app.module'; // Adjust path as needed
import { AiExtractLlamaService } from './ai-extract-llma.service';
import { AiExtractService } from './ai-extract.service';
import { ContactService } from './contact.service';
import { MockInterviewService } from './mock-interview.service';
import { PdfExtractService } from './pdf-extract.service';
import { ProfileQuestionsService } from './profile.service';
import { ProgramService } from './program.service';
import { RecommendationService } from './recommendation.service';
import { ResumeParseService } from './resume-parse.service';
import { S3Service } from './s3.service';
import { ScenarioService } from './scenario.service';
import { StaticController } from './static.controller';
import { UniversityService } from './university.service'; // Import the UniversityService

@Module({
  imports: [
    ConfigModule.forRoot({
        envFilePath: '../../../../.env', // Ensure this path is correct
        isGlobal: true, // Makes the configuration globally available
    }),
    MongooseModule.forRoot(process.env.MONGODB_URI!),
    MongooseModule.forFeature([
      { name: 'Program', schema: Program.schema },
      { name: 'UserApplication', schema: UserApplication.schema },
      { name: 'ProfileQuestion', schema: ProfileQuestion.schema },
      { name: 'ProfileSection', schema: ProfileSection.schema },
      { name: 'University', schema: University.schema }, // Register the University model
    ]),
    AuthAppModule, // <-- Add this line
  ],
  controllers: [StaticController],
  providers: [
    ContactService,
    ProfileQuestionsService,
    ProgramService,
    S3Service,
    UniversityService,
    RecommendationService, // <-- Add this
    MockInterviewService,
    PdfExtractService,
    AiExtractService,
    ResumeParseService,
    ScenarioService, // <-- Register ScenarioService here
    AiExtractLlamaService,
  ],
  exports: [
    ContactService,
    ProfileQuestionsService,
    ProgramService,
    S3Service,
    UniversityService,
    RecommendationService, // <-- Add this
    MockInterviewService,
    PdfExtractService,
    AiExtractService,
    ResumeParseService,
    ScenarioService // <-- And export it if needed
  ],
})
export class AppModule {}
