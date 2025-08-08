import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import * as jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { User } from './models/user.model';
import { UserProfile } from './models/userProfile.model';

@Injectable()
export class AuthService {
  constructor(private readonly configService: ConfigService) {}

  async googleLogin(profile: any): Promise<any> {
    try {
      await mongoose.connect(process.env.MONGODB_URI!);

      // Check if user exists
      let user = await User.findOne({ email: profile.email });

      if (!user) {
        // Create a new user if not found
        user = await User.create({
          email: profile.email,
          name: profile.name,
          isEmailVerified: true,
          provider: 'google',
        });

        // Create a UserProfile for the new user
        await UserProfile.create({
          email: profile.email,
          personalInfo: {
            firstName: profile.firstname,
            lastName: profile.lastname,
          },
        });
      }

      return {
        id: user.id,
        email: user.email,
        role: user.role || 'user',
        name: user.name,
      };
    } catch (error) {
      console.error('Google login error:', error);
      throw new HttpException('Error during Google login', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async credentialsLogin(email: string, password: string): Promise<any> {
    try {
      if (!email || !password) {
        throw new HttpException('Email and password are required.', HttpStatus.BAD_REQUEST);
      }

      await mongoose.connect(process.env.MONGODB_URI!);

      const user = await User.findOne({ email });

      if (!user) {
        throw new HttpException('No user found.', HttpStatus.UNAUTHORIZED);
      }

      if (!user.password) {
        throw new HttpException('User does not have a password set.', HttpStatus.BAD_REQUEST);
      }
      const passwordOk = bcrypt.compareSync(password, user.password);
      if (!passwordOk) {
        throw new HttpException('Invalid credentials.', HttpStatus.UNAUTHORIZED);
      }

      return {
        id: user.id,
        email: user.email,
        role: user.role,
        name: user.name,
      };
    } catch (error) {
      console.error('Credentials login error:', error);
      throw new HttpException('Error during login', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async generateJwt(user: any): Promise<string> {
    const secret = this.configService.get<string>('SECRET');
    console.log('SECRET:', secret); // Debug log
    if (!secret) {
      throw new Error('SECRET is not defined in the environment variables');
    }

    const payload = { id: user.id, email: user.email, role: user.role };
    return jwt.sign(payload, secret, { expiresIn: '1h' });
  }

  async validateJwt(token: string): Promise<any> {
    try {
      const secret = this.configService.get<string>('SECRET');
      console.log('Validating JWT with secret:', secret ? 'SECRET_PRESENT' : 'SECRET_MISSING'); // Debug log
      
      if (!secret) {
        throw new Error('SECRET is not defined in the environment variables');
      }
      
      const decoded = jwt.verify(token, secret);
      console.log('JWT validation successful, decoded payload:', decoded); // Debug log
      return decoded;
    } catch (error) {
      console.error('JWT validation failed:', error.message); // Debug log
      throw new HttpException('Invalid token', HttpStatus.UNAUTHORIZED);
    }
  }

  async getSecret(): Promise<string> {
    const secret = this.configService.get<string>('SECRET');
    if (!secret) {
      throw new Error('SECRET is not defined in configuration');
    }
    return secret;
  }
}
