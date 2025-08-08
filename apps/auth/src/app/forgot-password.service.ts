import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import crypto from 'crypto';
import mongoose from 'mongoose';
import { EmailService } from './email.service'; // Use the EmailService
import { User } from './models/user.model';
@Injectable()
export class ForgotPasswordService {
  constructor(
    private readonly emailService: EmailService 
  ) {}

  async forgotpassword(email: string): Promise<{ message: string }> {
    try {
      if (!email) {
        throw new HttpException('Email is required.', HttpStatus.BAD_REQUEST);
      }

      // Connect to MongoDB
      await mongoose.connect(process.env.MONGODB_URI!);

      const user = await User.findOne({ email });

      if (!user) {
        throw new HttpException('User not found', HttpStatus.NOT_FOUND);
      }

      // Generate reset token
      const resetToken = crypto.randomBytes(32).toString('hex');
      const resetTokenExpiry = Date.now() + 3600000; // Token valid for 1 hour

      // Save reset token to user
      (user as any).resetPasswordToken = resetToken;
      (user as any).resetPasswordExpires = resetTokenExpiry;
      await user.save();

      // Send reset email
      const emailSent = await this.emailService.sendPasswordResetEmail(email, resetToken);

      if (!emailSent) {
        throw new HttpException('Error sending reset email', HttpStatus.INTERNAL_SERVER_ERROR);
      }

      return { message: 'Password reset email sent' };
    } catch (error) {
      console.error('Password reset error:', error);
      throw new HttpException('Error sending reset email', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}