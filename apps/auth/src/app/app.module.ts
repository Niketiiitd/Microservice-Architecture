import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { EmailService } from './email.service';
import { ForgotPasswordService } from './forgot-password.service';
import { User, UserSchema } from './models/user.model';
import { UserProfile, UserProfileSchema } from './models/userProfile.model';
import { RegisterService } from './register.service';
import { resetPasswordService } from './reset-password.service';
import { VerifyEmailService } from './verifymail.service';
@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: '../../../../.env', // Ensure this path is correct
      isGlobal: true, // Makes the configuration globally available
    }),
    MongooseModule.forRoot(process.env.MONGODB_URI!), // Connect to MongoDB
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema }, // Register User model
      { name: UserProfile.name, schema: UserProfileSchema }, // Register UserProfile model
    ]),
  ],
  controllers: [AppController, AuthController],
  providers: [
    AppService,
    AuthService,
    resetPasswordService,
    ForgotPasswordService,
    EmailService,
    RegisterService,
    VerifyEmailService
  ],
  exports: [
    AuthService, // <-- Add this line
  ],
})
export class AppModule {}
