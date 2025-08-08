import { Body, Controller, Get, Param, Post, Query, Req, Res, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request, Response } from 'express';

import { authenticate } from '../../../../libs/auth-middleware';
import { AuthService } from '../../../auth/src/app/auth.service'; // Adjust path as needed
import { AiExtractLlamaService } from './ai-extract-llma.service';
import { AiExtractService } from './ai-extract.service';
import { ContactService } from './contact.service';
import { MockInterviewService } from './mock-interview.service';
import { PdfExtractService } from './pdf-extract.service';
import { ProfileQuestionsService } from './profile.service';
import { ProgramService } from './program.service';
import { RecommendationService } from './recommendation.service';
import { ResumeParseService } from './resume-parse.service';
import { ScenarioService } from './scenario.service';
import { UniversityService } from './university.service';

@Controller('static')
export class StaticController {
  constructor(
    private readonly contactService: ContactService,
    private readonly profileQuestionsService: ProfileQuestionsService,
    private readonly ProgramService: ProgramService,
    private readonly universityService: UniversityService,
    private readonly recommendationService: RecommendationService,
    private readonly mockInterviewService: MockInterviewService,
    private readonly pdfExtractService: PdfExtractService,
    private readonly aiExtractService: AiExtractService,
    private readonly aiExtractLlamaService: AiExtractLlamaService,
    private readonly resumeParseService: ResumeParseService,
    private readonly authService: AuthService,
    private readonly scenarioService: ScenarioService
  ) {}

  @Get('contact')
  getStatus() {
    return this.contactService.getStatus();
  }

  @Post('contact')
  async sendEmail(@Body('email') email: string, @Body('subject') subject: string, @Body('message') message: string) {

    console.log("Received email data:", email, subject, message); 
    await this.contactService.sendEmail(email, subject, message);
    return { message: "Email sent successfully!" };
  }
  
  @Get('profileQuestions/section')
  async getProfileSections() {
    return await this.profileQuestionsService.getProfileSections();
  }

  @Get('profileQuestions/:id?')
async getProfileQuestionById(@Param('id') id?: string) {
  // Since getProfileQuestionById does not exist, always call getAllProfileQuestions.
  return await this.profileQuestionsService.getAllProfileQuestions();
}

  @Get('programs')
  async getPrograms(
    @Query('id') userApplicationId?: string,
    @Query('universityId') universityId?: string
  ) {
    return await this.ProgramService.getAllPrograms(userApplicationId, universityId);
  }

  @Get('university')
  async getUniversities(
    @Query('id') id?: string,
    @Query('name') name?: string
  ) {
    return await this.universityService.getAllUniversities(id, name);
  }

  @Get('recommendation')
  getRecommendationStatus(@Res() res: Response) {
    return res.status(200).json({
      message: 'API endpoint is working. Please make a POST request with a resume file to get recommendations.',
    });
  }

  @Post('recommendation')
  @UseInterceptors(FileInterceptor('resume'))
  async getRecommendation(
    @Body('careerGoalsAnswer') careerGoalsAnswer: string,
    @UploadedFile() file: Express.Multer.File,
    @Res() res: Response
  ) {
    try {
      if (!file) {
        return res.status(400).json({ error: 'No resume file uploaded.' });
      }
      const result = await this.recommendationService.getRecommendation(
        file.buffer,
        file.mimetype,
        careerGoalsAnswer
      );
      return res.status(200).json(result);
    } catch (error: any) {
      const status = typeof error?.getStatus === 'function'
        ? error.getStatus()
        : (typeof error?.status === 'number' ? error.status : 500);
      const message = error?.message || 'An unknown error occurred.';
      return res.status(status).json({ error: message });
    }
  }

  @Get('mock-interview')
  async getMockInterview(@Query('school') school: string, @Res() res: Response) {
    try {
      const data = await this.mockInterviewService.generateMockInterview(school);
      return res.status(200).json(data);
    } catch (error: any) {
      const status = typeof error?.getStatus === 'function'
        ? error.getStatus()
        : (typeof error?.status === 'number' ? error.status : 500);
      const message = error?.message || 'An unknown error occurred.';
      return res.status(status).json({ error: message });
    }
  }

  @Post('extract-pdf')
  async extractPdf(@Body('pdfUrl') pdfUrl: string, @Body('targetUrl') targetUrl: string, @Res() res: Response) {
    try {
      const result = await this.pdfExtractService.extractAndSend(pdfUrl, targetUrl);
      return res.status(200).json(result);
    } catch (error: any) {
      const status = typeof error?.getStatus === 'function'
        ? error.getStatus()
        : (typeof error?.status === 'number' ? error.status : 500);
      const message = error?.message || 'An unknown error occurred.';
      return res.status(status).json({ error: message });
    }
  }

  @Post('ai-extract')
  async aiExtract(@Body('text') text: string, @Res() res: Response) {
    try {
      console.log("Received text for AI extraction:", text);
      const result = await this.aiExtractService.extractResumeInfo(text);
      return res.status(200).json(result);
    } catch (error: any) {
      const status = typeof error?.getStatus === 'function'
        ? error.getStatus()
        : (typeof error?.status === 'number' ? error.status : 500);
      const message = error?.message || 'An unknown error occurred.';
      return res.status(status).json({ error: message });
    }
  }

  @Post('ai-extract-llama')
  async aiExtractLlama(
    @Body('text') text: string,
    @Req() req: Request,
    @Res() res: Response
  ) {
    try {
      // Authenticate user using JWT from Authorization header
      // const { isAuthenticated, user } = await authenticate(req, this.authService);
      // const user_mail = user?.email;
      const user_mail = "niket22320@iiitd.ac.in";

      // if (!isAuthenticated) {
      //   return res.status(401).json({ error: 'Unauthorized' });
      // }

      // Find userProfile by email to get _id and check for parsed resume
      const userProfile = await this.resumeParseService.findUserProfileByEmail(user_mail);

      let resumeText = userProfile?.resumeText;
      if (!resumeText || resumeText.trim().length === 0) {
        // If not found, parse and save the resume text from input
        if (!text || text.trim().length === 0) {
          return res.status(400).json({ error: 'No resume text provided.' });
        }
        // Save parsed resume text to profile
        const updatedProfile = await this.resumeParseService.saveParsedResumeToProfile(userProfile?._id, text);
        resumeText = updatedProfile.resumeText || text;
      }

      // Now call the Llama extraction with the resume text
      const result = await this.aiExtractLlamaService.extractResumeInfo(resumeText);
      return res.status(200).json(result);
    } catch (error: any) {
      const status = typeof error?.getStatus === 'function'
        ? error.getStatus()
        : (typeof error?.status === 'number' ? error.status : 500);
      const message = error?.message || 'An unknown error occurred.';
      return res.status(status).json({ error: message });
    }
  }

  @Post('resume-parse')
  @UseInterceptors(FileInterceptor('resume'))
  async parseAndSaveResume(
    @UploadedFile() file: Express.Multer.File,
    @Res() res: Response,
    @Body() body: any,
    @Req() req: Request
  ) {
    try {
      // Authenticate user using JWT from Authorization header
      const { isAuthenticated, user } = await authenticate(req, this.authService);
      const user_mail = user?.email;

      if (!isAuthenticated) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      if (!file) {
        return res.status(400).json({ error: 'No resume file uploaded.' });
      }

      const allowedTypes = [
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      ];
      if (!allowedTypes.includes(file.mimetype)) {
        return res.status(400).json({ error: 'Invalid file type. Only PDF or DOCX allowed.' });
      }

      const resumeText = await this.resumeParseService.parseResume(file.buffer, file.mimetype);

      if (!resumeText || resumeText.trim().length === 0) {
        return res.status(400).json({ error: 'Could not extract text from resume.' });
      }

      // Find userProfile by email to get _id
      const userProfile = await this.resumeParseService.findUserProfileByEmail(user_mail);
      if (!userProfile) {
        return res.status(404).json({ error: 'User profile not found.' });
      }

      const updatedProfile = await this.resumeParseService.saveParsedResumeToProfile(userProfile._id, resumeText);

      return res.status(200).json({
        message: 'Resume parsed and saved successfully.',
        userProfile: updatedProfile,
      });
    } catch (error: any) {
      const status = typeof error?.getStatus === 'function'
        ? error.getStatus()
        : (typeof error?.status === 'number' ? error.status : 500);
      const message = error?.message || 'An unknown error occurred.';
      return res.status(status).json({ error: message });
    }
  }

  @Post('scenarios')
  async createScenario(@Body() body: any, @Res() res: Response) {
    try {
      const result = await this.scenarioService.createScenarioAndSaveSessionId(body);
      return res.status(200).json(result);
    } catch (error: any) {
      const status = typeof error?.getStatus === 'function'
        ? error.getStatus()
        : (typeof error?.status === 'number' ? error.status : 500);
      const message = error?.message || 'An unknown error occurred.';
      return res.status(status).json({ error: message });
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
      if (!file) {
        return res.status(400).json({ error: 'No file uploaded.' });
      }

      // For basic file upload without authentication, you can skip auth
      // or implement auth based on your requirements
      
      // Here you would typically save the file to S3 or your file storage
      // For now, returning a mock response
      const mockUrl = `https://your-bucket.s3.amazonaws.com/uploads/${Date.now()}-${file.originalname}`;
      
      return res.status(200).json({ 
        url: mockUrl,
        message: 'File uploaded successfully',
        originalName: file.originalname,
        size: file.size
      });
    } catch (error: any) {
      return res.status(500).json({ error: error.message || 'Internal server error' });
    }
  }
}

