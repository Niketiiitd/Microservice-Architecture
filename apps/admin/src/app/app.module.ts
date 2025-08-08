import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ProfileQuestion, ProfileSection, Program, Subscription, University, User, UserApplication, UserProfileSchema } from '@org/models';
import { S3Service } from '../../../../libs/s3/s3.service';
import { AppModule as AuthAppModule } from '../../../auth/src/app/app.module'; // Adjust path as needed
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

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
  controllers: [AdminController],
  providers: [
    AdminService,
    S3Service,
    
  ],
  exports: [
   
    
  ],
})
export class AppModule {}
