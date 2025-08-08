import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ProfileQuestion, ProfileSection, Program, Subscription, University, User, UserApplication, UserProfileSchema } from '@org/models';
import { S3Service } from '../../../../libs/s3/s3.service';
import { AppModule as AuthAppModule } from '../../../auth/src/app/app.module'; // Adjust path as needed
import { ApplicationDeadlineService } from './application-deadline.service';
import { ApplicationInvalidationService } from './application-invalidation.service';
import { ApplicationService } from './application.service';
import { EmailService } from './email.service';
import { PersonalProfileService } from './personal-profile.service';
import { ProfileCompletionService } from './profile-completion.service';
import { ProfileFileService } from './profile-file.service';
import { ResumeTextService } from './resume-text.service';
import { SubscriptionService } from './subscription.service';
import { UserApplicationAiService } from './user-application-ai.service';
import { UserApplicationService } from './user-application.service';
import { UserProfileService } from './user-profile.service';
import { UserController } from './user.controller';

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
      { name: 'University', schema: University.schema },
      { name: 'UserProfile', schema: UserProfileSchema },
      { name: 'User', schema: User.schema },
      { name: 'Subscription', schema: Subscription.schema },
    ]),
    AuthAppModule,
    
  ],
  controllers: [UserController],
  providers: [
    UserProfileService,
    S3Service,
    ProfileFileService,
    PersonalProfileService,
    ResumeTextService,
    ProfileCompletionService,
    EmailService,
    ApplicationService,
    SubscriptionService,
    UserApplicationService,
    ApplicationInvalidationService,
    ApplicationDeadlineService,
    UserApplicationAiService,
    
  ],
  exports: [
    UserProfileService,
    S3Service,
    ProfileFileService,
    PersonalProfileService,
    ResumeTextService,
    ProfileCompletionService,
    EmailService,
    ApplicationService,
    SubscriptionService,
    UserApplicationService,
    ApplicationInvalidationService,
    ApplicationDeadlineService,
    UserApplicationAiService,
    
  ],
})
export class AppModule {}
