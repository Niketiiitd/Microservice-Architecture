import { Body, Controller, Get, Post } from '@nestjs/common';
import { AppService } from './app.service';
import { AuthService } from './auth.service';
import { EmailService } from './email.service';
import { ForgotPasswordService } from './forgot-password.service';
import { RegisterService } from './register.service';
import { resetPasswordService } from './reset-password.service';
import { VerifyEmailService } from './verifymail.service';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly resetPasswordService: resetPasswordService,
    private readonly forgotPasswordService: ForgotPasswordService,
    private readonly emailService: EmailService,
    private readonly verifyEmailService: VerifyEmailService,
    private readonly registerService: RegisterService,
    private readonly appService: AppService
  ) {}

  @Get()
  getData(): any {
    return this.appService.getData();
  }

  @Get('google-config')
  async getGoogleConfig() {
    return {
      googleClientId: process.env.GOOGLE_CLIENT_ID,
    };
  }

  @Post('google-login')
  async googleLogin(@Body() profile: any) {
    const user = await this.authService.googleLogin(profile);
    const token = await this.authService.generateJwt(user);
    return { user, token };
  }

  @Post('login')
  async credentialsLogin(@Body('email') email: string, @Body('password') password: string) {
    console.log('Login request received:', { email, password: !!password });
    const user = await this.authService.credentialsLogin(email, password);
    const token = await this.authService.generateJwt(user);
    return { user, token };
  }

  @Post('validate-token')
  async validateToken(@Body('token') token: string) {
    return this.authService.validateJwt(token);
  }

  @Post('reset-password')
  async resetPassword(@Body('token') token: string, @Body('newPassword') newPassword: string) {
    return this.resetPasswordService.resetPassword(token, newPassword);
  }

  @Post('forgot-password')
  async forgotPassword(@Body('email') email: string) {
    return this.forgotPasswordService.forgotpassword(email);
  }

  @Post('send-email')
  async sendEmail(@Body('email') email: string, @Body('resetToken') resetToken: string) {
    const emailSent = await this.emailService.sendPasswordResetEmail(email, resetToken);
    return { success: emailSent };
  }

  @Post('verify-email')
  async verifyEmail(@Body('email') email: string) {
    return this.verifyEmailService.verifyEmail(email);
  }

  @Post('register')
  async register(
    @Body() body: { firstName: string; lastName: string; email: string; password: string }
  ) {
    return this.registerService.register(body);
  }
}
