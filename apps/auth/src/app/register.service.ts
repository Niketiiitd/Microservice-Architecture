import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import bcrypt from 'bcrypt';
import mongoose from 'mongoose';
import { User } from './models/user.model';
import { UserProfile } from './models/userProfile.model';
import { VerifyEmailService } from './verifymail.service';

@Injectable()
export class RegisterService {
  constructor(private readonly verifyEmailService: VerifyEmailService) {}

  async register(body: {
    firstName: string;
    lastName: string;
    email: string;
    password: string;
  }): Promise<{ message: string }> {
    try {
      // Connect to MongoDB
      await mongoose.connect(process.env.MONGODB_URI!);

      const { firstName, lastName, email, password } = body;

      if (!password || password.length < 5) {
        throw new HttpException(
          'Password must be at least 5 characters',
          HttpStatus.BAD_REQUEST
        );
      }

      const notHashedPassword = password;
      const salt = bcrypt.genSaltSync(10);
      const hashedPassword = bcrypt.hashSync(notHashedPassword, salt);

      const name = `${firstName} ${lastName}`;

      let user = await User.findOne({ email });

      if (user && user.isEmailVerified) {
        throw new HttpException(
          'User with this email already exists',
          HttpStatus.BAD_REQUEST
        );
      }

      // Delete the user if it exists but is not verified
      if (user) {
        await User.deleteOne({ _id: user._id });

        // Also delete the user profile
        await UserProfile.deleteOne({ email });
      }

      let createdUser;
      try {
        createdUser = await User.create({
          firstName,
          lastName,
          email,
          password: hashedPassword,
          name,
        });
      } catch (error) {
        throw new HttpException(
          'Unable to create user',
          HttpStatus.INTERNAL_SERVER_ERROR
        );
      }

      // Create user profile
      const userProfile = new UserProfile({ email });
      userProfile.personalInfo.set('firstName', firstName);
      userProfile.personalInfo.set('lastName', lastName);
      await userProfile.save();
      console.log('mail sent');
      // Send verification email
      const mailStatus = await this.verifyEmailService.verifyEmail(email);
      if (!mailStatus) {
        // Delete the user created and return an error
        await User.deleteOne({ _id: createdUser._id });
        throw new HttpException(
          'Could not send verification email',
          HttpStatus.INTERNAL_SERVER_ERROR
        );
      }

      return { message: 'User registered successfully.' };
    } catch (error) {
      console.error('Registration error:', error);
      throw new HttpException(
        'Error during registration',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }
}
