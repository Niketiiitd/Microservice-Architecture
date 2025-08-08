import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import bcrypt from 'bcrypt';
import mongoose from 'mongoose';
import { User } from './models/user.model';

@Injectable()
export class resetPasswordService {
  async resetPassword(token: string, newPassword: string): Promise<{ message: string }> {
    try {
      // Connect to MongoDB
      await mongoose.connect(process.env.MONGODB_URI!);

      // Find user by reset token and ensure token is not expired
      const user = await User.findOne({
        resetPasswordToken: token,
        resetPasswordExpires: { $gt: Date.now() },
      });

      if (!user) {
        throw new HttpException('Invalid or expired reset token', HttpStatus.BAD_REQUEST);
      }

      // Hash new password
      const hashedPassword = await bcrypt.hash(newPassword, 12);

      // Update user password and clear reset token
      (user as any).password = hashedPassword;
      (user as any).resetPasswordToken = undefined;
      (user as any).resetPasswordExpires = undefined;
      await user.save();

      return { message: 'Password reset successful' };
    } catch (error) {
      console.error('Reset password error:', error);
      throw new HttpException('Error resetting password', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}