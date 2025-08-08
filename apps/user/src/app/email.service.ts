import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import * as crypto from 'crypto';
import { Model } from 'mongoose';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  private transporter: nodemailer.Transporter;

  constructor(
    @InjectModel('User') private userModel: Model<any>
  ) {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: false,
      auth: {
        user: process.env.SMTP_EMAIL,
        pass: process.env.SMTP_PASSWORD,
      },
    });
  }

  async sendVerificationEmail(email: string): Promise<boolean> {
    const emailVerificationToken = crypto.randomBytes(32).toString('hex');
    const user = await this.userModel.findOne({ email }).exec();
    if (!user) return false;

    user.emailVerificationToken = emailVerificationToken;
    user.isEmailVerified = false;
    const verificationUrl = `${process.env.NEXTAUTH_URL}/verify-email/${emailVerificationToken}`;
    await user.save();

    try {
      await this.transporter.sendMail({
        from: `"MyAdmitAI" <${process.env.SMTP_EMAIL}>`,
        to: email,
        subject: 'Verify your email',
        html: `
          <h1>Email Verification</h1>
          <p>Please verify your email by clicking the link below:</p>
          <a href="${verificationUrl}">Verify Email</a>
        `,
      });
      return true;
    } catch (err) {
      console.error('Error sending email:', err);
      return false;
    }
  }

  async sendPasswordResetEmail(email: string, resetToken: string): Promise<boolean> {
    try {
      const resetUrl = `${process.env.NEXTAUTH_URL}/reset-password?token=${resetToken}`;
      await this.transporter.sendMail({
        from: `"MyAdmitAI" <${process.env.SMTP_EMAIL}>`,
        to: email,
        subject: 'Reset Your Password',
        html: `
          <h1>Password Reset Request</h1>
          <p>You requested to reset your password. Click the link below to set a new password:</p>
          <a href="${resetUrl}" style="display: inline-block; background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin: 16px 0;">Reset Password</a>
          <p>This link will expire in 1 hour.</p>
          <p>If you didn't request this password reset, you can safely ignore this email.</p>
        `,
      });
      return true;
    } catch (err) {
      console.error('Error sending password reset email:', err);
      return false;
    }
  }
}
