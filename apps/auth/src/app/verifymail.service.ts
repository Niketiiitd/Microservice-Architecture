import { User } from './models/user.model';
import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import mongoose from 'mongoose';
import crypto from 'crypto';
import nodemailer from 'nodemailer';
@Injectable()
export class VerifyEmailService {
    private transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT),
        secure: false, // true for 465, false for other ports
        auth: {
          user: process.env.SMTP_EMAIL,
          pass: process.env.SMTP_PASSWORD,
        },
      });
  async verifyEmail(email: string): Promise<{ message: string }> {
    if (!email) {
        throw new HttpException('Email is required.', HttpStatus.BAD_REQUEST);
    }
    await mongoose.connect(process.env.MONGODB_URI!);
    const emailVerificationToken = crypto.randomBytes(32).toString('hex');

  // get user with email
  const user = await User.findOne({ email: email }).exec();

  // is user exists
  if (!user) {
    throw new HttpException('User not found', HttpStatus.BAD_REQUEST);
  }

  // update user with email verification token
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

    return { message: 'Verification email sent successfully.' };
  } catch (err) {
    console.error('Error sending email:', err);
    return { message: 'Failed to send verification email.' };
  }
  }
}
      

      
