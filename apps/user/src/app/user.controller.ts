import { Body, Controller, Delete, Get, Post, Put, Req, Res, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request, Response } from 'express';
import { authenticate } from '../../../../libs/auth-middleware';
import { S3Service } from '../../../../libs/s3/s3.service';
import { AuthService } from '../../../auth/src/app/auth.service'; // Adjust path as needed
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


@Controller('user')
export class UserController {
  constructor(
    private readonly userProfileService: UserProfileService,
    private readonly authService: AuthService,
    private readonly profileFileService: ProfileFileService,
    private readonly personalProfileService: PersonalProfileService,
    private readonly resumeTextService: ResumeTextService,
    private readonly profileCompletionService: ProfileCompletionService,
    private readonly emailService: EmailService,
    private readonly applicationService: ApplicationService,
    private readonly subscriptionService: SubscriptionService,
    private readonly userApplicationService: UserApplicationService,
    private readonly applicationInvalidationService: ApplicationInvalidationService,
    private readonly s3Service: S3Service,
    private readonly applicationDeadlineService: ApplicationDeadlineService,
    private readonly userApplicationAiService: UserApplicationAiService,
  ) {}

  @Get('profile')
  async getProfile(@Req() req: Request, @Res() res: Response) {
    try {
      const { isAuthenticated, user } = await authenticate(req, this.authService);
      const email = user?.email;
      if (!isAuthenticated || !email) {
        return res.status(401).json({ message: 'Unauthorized' });
      }
      const profile = await this.userProfileService.getProfile(email);
      return res.json(profile);
    } catch (err) {
      const error: any = err;
      return res.status(error.status || 500).json({ message: error.message });
    }
  }

  @Post('profile')
  async updateProfile(
    @Req() req: Request,
    @Res() res: Response,
    @Body() body: any
  ) {
    try {
      const { isAuthenticated, user } = await authenticate(req, this.authService);
      const email = user?.email;
      if (!isAuthenticated || !email) {
        return res.status(401).json({ message: 'Unauthorized' });
      }
      const { questionId, answer } = body;
      const calculateProfileCompletionScore = async (profile: any) => {
        // Placeholder: implement or import your logic
        return 100;
      };
      const result = await this.userProfileService.updateProfileAnswer(
        email,
        questionId,
        answer,
        calculateProfileCompletionScore
      );
      return res.json(result);
    } catch (err) {
      const error: any = err;
      return res.status(error.status || 500).json({ message: error.message });
    }
  }

  @Post('file')
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: any,
    @Req() req: Request,
    @Res() res: Response
  ) {
    try {
      console.log('Received file:', file);
      console.log('Received body:', body);
      const { isAuthenticated, user } = await authenticate(req, this.authService);
      if (!isAuthenticated) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      const email = user?.email;
      console.log('body:', body);
      const result = await this.profileFileService.uploadUserFile(email, file, body);
      return res.status(200).json(result);
    } catch (error: any) {
      return res.status(error.status || 500).json({ error: error.message || 'Internal server error' });
    }
  }

  @Get('files')
  async getFiles(@Req() req: Request, @Res() res: Response) {
    try {
      const { isAuthenticated, user } = await authenticate(req, this.authService);
      if (!isAuthenticated) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      // console.log('User session:', user);
      const email = user?.email;
      if (!email) {
        return res.status(400).json({ error: 'Email not found in user session' });
      }
      const result = await this.profileFileService.getUserFiles(email);
      return res.status(200).json(result);
    } catch (error: any) {
      return res.status(error.status || 500).json({ error: error.message || 'Internal server error' });
    }
  }

  @Get('personal-profile')
  async getPersonalProfile(@Req() req: Request, @Res() res: Response) {
    try {
      const { isAuthenticated, user } = await authenticate(req, this.authService);
      const email = user?.email;
      if (!isAuthenticated || !email) {
        return res.status(401).json({ message: 'Unauthorized' });
      }
      const profile = await this.personalProfileService.getPersonalProfile(email);
      return res.json(profile);
    } catch (err) {
      const error: any = err;
      return res.status(error.status || 500).json({ message: error.message });
    }
  }

  @Post('personal-profile')
  async updatePersonalProfile(
    @Req() req: Request,
    @Res() res: Response,
    @Body() body: any
  ) {
    try {
      const { isAuthenticated, user } = await authenticate(req, this.authService);
      const email = user?.email;
      if (!isAuthenticated || !email) {
        return res.status(401).json({ message: 'Unauthorized' });
      }
      // You should provide the actual implementation for calculateProfileCompletionScore
      const calculateProfileCompletionScore = async (profile: any) => 100;
      const result = await this.personalProfileService.updatePersonalProfile(
        email,
        body,
        calculateProfileCompletionScore
      );
      return res.json(result);
    } catch (err) {
      const error: any = err;
      return res.status(error.status || 500).json({ message: error.message });
    }
  }

  @Get('resume-text')
  async getResumeText(@Req() req: Request, @Res() res: Response) {
    try {
      const { isAuthenticated, user } = await authenticate(req, this.authService);
      if (!isAuthenticated || !user?.email) {
        return res.status(401).json({ message: 'Unauthorized' });
      }
      const result = await this.resumeTextService.getResumeText(user.email);
      return res.status(200).json(result);
    } catch (error: any) {
      return res.status(error.status || 500).json({ error: error.message || 'Internal server error' });
    }
  }

  @Post('calculate-profile-completion')
  async calculateProfileCompletion(
    @Req() req: Request,
    @Res() res: Response,
    @Body() body: any
  ) {
    try {
      const { isAuthenticated, user } = await authenticate(req, this.authService);
      if (!isAuthenticated || !user?.email) {
        return res.status(401).json({ message: 'Unauthorized' });
      }
      // Expecting userProfile in body, or fetch if needed
      const userProfile = body.userProfile;
      if (!userProfile) {
        return res.status(400).json({ message: 'userProfile is required in body' });
      }
      const score = await this.profileCompletionService.calculateProfileCompletionScore(userProfile);
      return res.status(200).json({ score });
    } catch (error: any) {
      return res.status(error.status || 500).json({ error: error.message || 'Internal server error' });
    }
  }

  @Post('send-verification-email')
  async sendVerificationEmail(
    @Req() req: Request,
    @Res() res: Response,
    @Body() body: any
  ) {
    try {
      const { isAuthenticated } = await authenticate(req, this.authService);
      if (!isAuthenticated) {
        return res.status(401).json({ message: 'Unauthorized' });
      }
      const { email } = body;
      if (!email) {
        return res.status(400).json({ message: 'Email is required' });
      }
      const result = await this.emailService.sendVerificationEmail(email);
      return res.status(200).json({ success: result });
    } catch (error: any) {
      return res.status(error.status || 500).json({ error: error.message || 'Internal server error' });
    }
  }

  @Post('send-password-reset-email')
  async sendPasswordResetEmail(
    @Req() req: Request,
    @Res() res: Response,
    @Body() body: any
  ) {
    try {
      const { isAuthenticated } = await authenticate(req, this.authService);
      if (!isAuthenticated) {
        return res.status(401).json({ message: 'Unauthorized' });
      }
      const { email, resetToken } = body;
      if (!email || !resetToken) {
        return res.status(400).json({ message: 'Email and resetToken are required' });
      }
      const result = await this.emailService.sendPasswordResetEmail(email, resetToken);
      return res.status(200).json({ success: result });
    } catch (error: any) {
      return res.status(error.status || 500).json({ error: error.message || 'Internal server error' });
    }
  }

  @Post('invalidate-application')
  async invalidateApplication(
    @Req() req: Request,
    @Res() res: Response,
    @Body() body: any
  ) {
    try {
      const { isAuthenticated } = await authenticate(req, this.authService);
      if (!isAuthenticated) {
        return res.status(401).json({ message: 'Unauthorized' });
      }
      const { email } = body;
      if (!email) {
        return res.status(400).json({ message: 'Email is required' });
      }
      await this.applicationInvalidationService.invalidateApplication(email);
      return res.status(200).json({ success: true });
    } catch (error: any) {
      return res.status(error.status || 500).json({ error: error.message || 'Internal server error' });
    }
  }

  @Get('subscription')
  async getSubscription(@Req() req: Request, @Res() res: Response) {
    try {
      const { isAuthenticated, user } = await authenticate(req, this.authService);
      if (!isAuthenticated || !user?.email) {
        return res.status(401).json({ message: 'Unauthorized' });
      }
      // By default, just fetch from DB
      const subscription = await this.subscriptionService.getUserSubscription(user.email);
      return res.status(200).json(subscription);
    } catch (error: any) {
      return res.status(error.status || 500).json({ error: error.message || 'Internal server error' });
    }
  }

  @Get('refresh-subscription')
  async refreshSubscription(@Req() req: Request, @Res() res: Response) {
    try {
      const { isAuthenticated, user } = await authenticate(req, this.authService);
      if (!isAuthenticated || !user?.email) {
        return res.status(401).json({ message: 'Unauthorizeee' });
      }
      const result = await this.subscriptionService.refreshUserSubscription(user.email);
      if (result.error === 'Stripe Customer not found') {
        // Provide a more user-friendly message or guidance
        return res.status(404).json({
          error: 'Stripe customer not found. Please ensure you have signed up for a subscription on the platform.',
        });
      }
      if (result.error) {
        return res.status(404).json(result);
      }
      return res.status(200).json(result);
    } catch (error: any) {
      return res.status(error.status || 500).json({ error: error.message || 'Internal server error' });
    }
  }

  @Post('stripe-session')
  async createOrGetStripeSession(
    @Req() req: Request,
    @Res() res: Response,
    @Body() body: any
  ) {
    try {
      const { isAuthenticated, user } = await authenticate(req, this.authService);
      if (!isAuthenticated || !user?.email) {
        return res.status(401).json({ message: 'Unauthorized' });
      }
      const { priceId } = body;
      if (!priceId) {
        return res.status(400).json({ error: 'Price ID is required' });
      }
      const returnUrlBase = process.env.NEXTAUTH_URL || 'http://localhost:3000';
      const result = await this.subscriptionService.createOrGetStripeSession(user.email, priceId, returnUrlBase);
      if (result.error) {
        return res.status(result.status || 500).json({ error: result.error });
      }
      return res.status(result.status || 200).json({ url: result.url });
    } catch (error: any) {
      return res.status(500).json({ error: error.message || 'Internal server error' });
    }
  }

  @Post('application')
  async createUserApplication(
    @Req() req: Request,
    @Res() res: Response,
    @Body() body: any
  ) {
    try {
      const { isAuthenticated, user } = await authenticate(req, this.authService);
      if (!isAuthenticated || !user?.email) {
        return res.status(401).json({ message: 'Unauthorized' });
      }
      const result = await this.userApplicationService.createUserApplication(user.email, body);
      return res.status(201).json(result);
    } catch (error: any) {
      if (error.status) {
        return res.status(error.status).json({ error: error.message });
      }
      return res.status(500).json({ error: error.message || 'Internal server error' });
    }
  }

  @Get('application')
  async getUserApplications(@Req() req: Request, @Res() res: Response) {
    try {
      const { isAuthenticated, user } = await authenticate(req, this.authService);
      if (!isAuthenticated || !user?.email) {
        return res.status(401).json({ message: 'Unauthorized' });
      }
      // Use the injected s3Service for signed URLs
      const result = await this.userApplicationService.getUserApplications(
        user.email,
        (email: string) => this.applicationInvalidationService.invalidateApplication(email),
        (key: string) => this.s3Service.getObjectSignedUrl(key)
      );
      return res.status(200).json(result);
    } catch (error: any) {
      return res.status(error.status || 500).json({ error: error.message || 'Internal server error' });
    }
  }

  @Get('application/:applicationId')
  async getUserApplicationById(
    @Req() req: Request,
    @Res() res: Response
  ) {
    try {
      const applicationId = req.params.applicationId;
      const { isAuthenticated, user } = await authenticate(req, this.authService);
      if (!isAuthenticated || !user?.email) {
        return res.status(401).json({ message: 'Unauthorized' });
      }
      const result = await this.userApplicationService.getUserApplicationById(
        applicationId,
        user.email,
        (email: string) => this.applicationInvalidationService.invalidateApplication(email)
      );
      return res.status(200).json(result);
    } catch (error: any) {
      if (error.status) {
        return res.status(error.status).json({ error: error.message });
      }
      return res.status(500).json({ error: error.message || 'Internal server error' });
    }
  }

  @Get('application/:applicationId/questions')
  async getApplicationQuestions(
    @Req() req: Request,
    @Res() res: Response
  ) {
    try {
      const applicationId = req.params.applicationId;
      const { isAuthenticated, user } = await authenticate(req, this.authService);
      if (!isAuthenticated || !user?.email) {
        return res.status(401).json({ message: 'Unauthorized' });
      }
      const result = await this.userApplicationService.getApplicationQuestions(
        applicationId,
        user.email
      );
      return res.status(200).json(result);
    } catch (error: any) {
      if (error.status) {
        return res.status(error.status).json({ error: error.message });
      }
      return res.status(500).json({ error: error.message || 'Internal server error' });
    }
  }

  @Post('application/:applicationId/questions')
  async addApplicationQuestion(
    @Req() req: Request,
    @Res() res: Response,
    @Body() body: any
  ) {
    try {
      const applicationId = req.params.applicationId;
      const { isAuthenticated, user } = await authenticate(req, this.authService);
      if (!isAuthenticated || !user?.email) {
        return res.status(401).json({ message: 'Unauthorized' });
      }
      const result = await this.userApplicationService.addApplicationQuestion(
        applicationId,
        user.email,
        body
      );
      return res.status(201).json(result);
    } catch (error: any) {
      if (error.status) {
        return res.status(error.status).json({ error: error.message });
      }
      return res.status(500).json({ error: error.message || 'Internal server error' });
    }
  }

  @Get('application/:applicationId/questions/:questionId')
  async getApplicationQuestionById(
    @Req() req: Request,
    @Res() res: Response
  ) {
    try {
      const { applicationId, questionId } = req.params;
      const { isAuthenticated, user } = await authenticate(req, this.authService);
      if (!isAuthenticated || !user?.email) {
        return res.status(401).json({ message: 'Unauthorized' });
      }
      const result = await this.userApplicationService.getApplicationQuestionById(
        applicationId,
        questionId,
        user.email
      );
      return res.status(200).json(result);
    } catch (error: any) {
      if (error.status) {
        return res.status(error.status).json({ error: error.message });
      }
      return res.status(500).json({ error: error.message || 'Internal server error' });
    }
  }

  @Put('application/:applicationId/questions/:questionId')
  async updateApplicationQuestion(
    @Req() req: Request,
    @Res() res: Response,
    @Body() body: any
  ) {
    try {
      const { applicationId, questionId } = req.params;
      const { isAuthenticated, user } = await authenticate(req, this.authService);
      if (!isAuthenticated || !user?.email) {
        return res.status(401).json({ message: 'Unauthorized' });
      }
      // Validate input
      if (!questionId) {
        return res.status(400).json({ error: 'Invalid question ID.' });
      }
      // Use the service to update the question
      const result = await this.userApplicationService.updateApplicationQuestion(
        applicationId,
        user.email,
        { questionId, ...body }
      );
      return res.status(200).json(result);
    } catch (error: any) {
      if (error.status) {
        return res.status(error.status).json({ error: error.message });
      }
      return res.status(500).json({ error: error.message || 'Internal server error' });
    }
  }

  @Delete('application/:applicationId/questions/:questionId')
  async deleteApplicationQuestionById(
    @Req() req: Request,
    @Res() res: Response
  ) {
    try {
      const { applicationId, questionId } = req.params;
      const { isAuthenticated, user } = await authenticate(req, this.authService);
      if (!isAuthenticated || !user?.email) {
        return res.status(401).json({ message: 'Unauthorized' });
      }
      const result = await this.userApplicationService.deleteApplicationQuestionById(
        applicationId,
        questionId,
        user.email
      );
      return res.status(200).json(result);
    } catch (error: any) {
      if (error.status) {
        return res.status(error.status).json({ error: error.message });
      }
      return res.status(500).json({ error: error.message || 'Internal server error' });
    }
  }

  @Get('application/:applicationId/notes')
  async getApplicationNotes(
    @Req() req: Request,
    @Res() res: Response
  ) {
    try {
      const { applicationId } = req.params;
      const { isAuthenticated, user } = await authenticate(req, this.authService);
      if (!isAuthenticated || !user?.email) {
        return res.status(401).json({ message: 'Unauthorized' });
      }
      const notes = await this.userApplicationService.getApplicationNotes(applicationId, user.email);
      return res.status(200).json({ notes });
    } catch (error: any) {
      if (error.status) {
        return res.status(error.status).json({ error: error.message });
      }
      return res.status(500).json({ error: error.message || 'Internal server error' });
    }
  }

  @Post('application/:applicationId/notes')
  async addApplicationNote(
    @Req() req: Request,
    @Res() res: Response,
    @Body() body: any
  ) {
    try {
      const { applicationId } = req.params;
      const { isAuthenticated, user } = await authenticate(req, this.authService);
      if (!isAuthenticated || !user?.email) {
        return res.status(401).json({ message: 'Unauthorized' });
      }
      const note = await this.userApplicationService.addApplicationNote(applicationId, user.email, body.content);
      return res.status(201).json({ message: 'Note added successfully', note });
    } catch (error: any) {
      if (error.status) {
        return res.status(error.status).json({ error: error.message });
      }
      return res.status(500).json({ error: error.message || 'Internal server error' });
    }
  }

  @Put('application/:applicationId/notes')
  async updateApplicationNote(
    @Req() req: Request,
    @Res() res: Response,
    @Body() body: any
  ) {
    try {
      const { applicationId } = req.params;
      const { noteId, content } = body;
      const { isAuthenticated, user } = await authenticate(req, this.authService);
      if (!isAuthenticated || !user?.email) {
        return res.status(401).json({ message: 'Unauthorized' });
      }
      const note = await this.userApplicationService.updateApplicationNote(applicationId, user.email, noteId, content);
      return res.status(200).json({ message: 'Note updated successfully', note });
    } catch (error: any) {
      if (error.status) {
        return res.status(error.status).json({ error: error.message });
      }
      return res.status(500).json({ error: error.message || 'Internal server error' });
    }
  }

  @Delete('application/:applicationId/notes')
  async deleteApplicationNote(
    @Req() req: Request,
    @Res() res: Response,
    @Body() body: any
  ) {
    try {
      const { applicationId } = req.params;
      const { noteId } = body;
      const { isAuthenticated, user } = await authenticate(req, this.authService);
      if (!isAuthenticated || !user?.email) {
        return res.status(401).json({ message: 'Unauthorized' });
      }
      const result = await this.userApplicationService.deleteApplicationNote(applicationId, user.email, noteId);
      return res.status(200).json(result);
    } catch (error: any) {
      if (error.status) {
        return res.status(error.status).json({ error: error.message });
      }
      return res.status(500).json({ error: error.message || 'Internal server error' });
    }
  }

  @Get('application/:applicationId/generate-ai-answers')
  async generateAiAnswers(
    @Req() req: Request,
    @Res() res: Response
  ) {
    try {
      const { applicationId } = req.params;
      const { isAuthenticated, user } = await authenticate(req, this.authService);
      if (!isAuthenticated || !user?.email) {
        return res.status(401).json({ message: 'Unauthorized' });
      }
      const result = await this.userApplicationService.generateAiAnswers(
        applicationId,
        user.email,
        (email: string) => this.applicationInvalidationService.invalidateApplication(email)
      );
      return res.status(200).json(result);
    } catch (error: any) {
      if (error.status) {
        return res.status(error.status).json({ error: error.message });
      }
      return res.status(500).json({ error: error.message || 'Internal server error' });
    }
  }

  @Post('application/:applicationId/questions/:questionId/final-answer')
  async updateFinalAnswer(
    @Req() req: Request,
    @Res() res: Response,
    @Body() body: any
  ) {
    try {
      const { applicationId, questionId } = req.params;
      const { isAuthenticated, user } = await authenticate(req, this.authService);
      if (!isAuthenticated || !user?.email) {
        return res.status(401).json({ message: 'Unauthorized' });
      }
      const { finalAnswer } = body;
      const result = await this.userApplicationService.updateFinalAnswer(
        applicationId,
        questionId,
        user.email,
        finalAnswer
      );
      return res.status(200).json(result);
    } catch (error: any) {
      if (error.status) {
        return res.status(error.status).json({ error: error.message });
      }
      return res.status(500).json({ error: error.message || 'Internal server error' });
    }
  }

  @Post('application/:applicationId/questions/:questionId/status')
  async updateAnswerStatus(
    @Req() req: Request,
    @Res() res: Response,
    @Body() body: any
  ) {
    try {
      const { applicationId, questionId } = req.params;
      const { isAuthenticated, user } = await authenticate(req, this.authService);
      if (!isAuthenticated || !user?.email) {
        return res.status(401).json({ message: 'Unauthorized' });
      }
      const { status } = body;
      const result = await this.userApplicationService.updateAnswerStatus(
        applicationId,
        questionId,
        user.email,
        status
      );
      return res.status(200).json(result);
    } catch (error: any) {
      if (error.status) {
        return res.status(error.status).json({ error: error.message });
      }
      return res.status(500).json({ error: error.message || 'Internal server error' });
    }
  }

  @Post('application/:applicationId/deadline')
  async updateApplicationDeadline(
    @Req() req: Request,
    @Res() res: Response,
    @Body() body: any
  ) {
    try {
      const { applicationId } = req.params;
      const { isAuthenticated, user } = await authenticate(req, this.authService);
      if (!isAuthenticated || !user?.email) {
        return res.status(401).json({ message: 'Unauthorized' });
      }
      if (!applicationId) {
        return res.status(400).json({ error: 'Application ID is required', code: 'MISSING_REQUIRED_FIELDS' });
      }
      const result = await this.applicationDeadlineService.updateDeadline(applicationId, user.email, body.deadline);
      return res.status(200).json(result);
    } catch (error: any) {
      return res.status(error.status || 500).json({ error: error.message });
    }
  }

  @Delete('application/:applicationId/deadline')
  async deleteApplicationDeadline(
    @Req() req: Request,
    @Res() res: Response
  ) {
    try {
      const { applicationId } = req.params;
      const { isAuthenticated, user } = await authenticate(req, this.authService);
      if (!isAuthenticated || !user?.email) {
        return res.status(401).json({ message: 'Unauthorized' });
      }
      if (!applicationId) {
        return res.status(400).json({ error: 'Application ID is required', code: 'MISSING_REQUIRED_FIELDS' });
      }
      const result = await this.applicationDeadlineService.removeDeadline(applicationId, user.email);
      return res.status(200).json(result);
    } catch (error: any) {
      return res.status(error.status || 500).json({ error: error.message });
    }
  }

  @Post('application/:applicationId/questions/:questionId/refine-ai-answer')
  async refineAiAnswer(
    @Req() req: Request,
    @Res() res: Response,
    @Body() body: any
  ) {
    try {
      const { applicationId, questionId } = req.params;
      const { isAuthenticated, user } = await authenticate(req, this.authService);
      if (!isAuthenticated || !user?.email) {
        return res.status(401).json({ message: 'Unauthorized' });
      }
      const { prompt } = body;
      if (typeof prompt !== 'string' || !prompt.trim()) {
        return res.status(400).json({ error: 'Invalid or missing "prompt" in the request body.' });
      }
      const result = await this.userApplicationAiService.refineAnswer(applicationId, questionId, user.email, prompt);
      return res.status(200).json(result);
    } catch (error: any) {
      return res.status(error.status || 500).json({ error: error.message });
    }
  }

  @Post('application/:applicationId/questions/:questionId/ai-suggestions')
  async getAiSuggestions(
    @Req() req: Request,
    @Res() res: Response,
    @Body() body: any
  ) {
    try {
      const { applicationId, questionId } = req.params;
      const { isAuthenticated, user } = await authenticate(req, this.authService);
      if (!isAuthenticated || !user?.email) {
        return res.status(401).json({ message: 'Unauthorized' });
      }
      const { answer } = body;
      if (typeof answer !== 'string' || !answer.trim()) {
        return res.status(400).json({ error: 'Invalid or missing "answer" in the request body.' });
      }
      const result = await this.userApplicationAiService.getSuggestions(applicationId, questionId, user.email, answer);
      return res.status(200).json(result);
    } catch (error: any) {
      return res.status(error.status || 500).json({ error: error.message });
    }
  }
}

