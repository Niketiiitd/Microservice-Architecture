import { GoogleGenerativeAI } from '@google/generative-ai';
import { BadRequestException, Injectable, InternalServerErrorException } from '@nestjs/common';
import mammoth from 'mammoth';
import * as pdfjsLib from "pdfjs-dist";
import pdfjsWorker from "pdfjs-dist/build/pdf.worker.entry";
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

@Injectable()
export class RecommendationService {
  private genAI: GoogleGenerativeAI;
  private model: any;

  constructor() {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY is not set.');
    }
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    this.model = this.genAI.getGenerativeModel({ model: "gemini-1.5-pro" });
  }

  async parseResume(buffer: Buffer, fileType: string): Promise<string> {
    try {
      if (fileType === 'application/pdf') {
        const uint8Array = new Uint8Array(buffer);
        const loadingTask = pdfjsLib.getDocument({ data: uint8Array });
        const pdf = await loadingTask.promise;
        let fullText = '';
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          const pageText = textContent.items.map((item: any) => item.str).join(' ');
          fullText += pageText + '\n';
        }
        return fullText;
      } else if (fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        const { value } = await mammoth.extractRawText({ buffer });
        return value;
      } else {
        throw new BadRequestException('Unsupported file type for parsing.');
      }
    } catch (error) {
        console.error('Error parsing resume:', error);
        throw new InternalServerErrorException('Failed to parse resume file: ' + (error instanceof Error ? error.message : String(error)));
    }
  }


  async getRecommendation(resumeBuffer: Buffer, fileType: string, careerGoalsAnswer?: string): Promise<any> {
    const allowedTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];
    if (!allowedTypes.includes(fileType)) {
      throw new BadRequestException('Invalid file type. Only PDF or DOCX allowed.');
    }

    const resumeText = await this.parseResume(resumeBuffer, fileType);
    // console.log('Parsed resume text:', resumeText);
    if (!resumeText || resumeText.trim().length === 0) {
      throw new BadRequestException('Could not extract text from resume.');
    }

    const prompt = `Based on the following resume text and career goals, please analyze the candidate's profile and recommend MBA programs in the United States, categorized as follows:

Reach Schools (3 schools): More competitive programs where the candidate's profile is below the typical admitted student
Target Schools (3 schools): Programs where the candidate's profile matches the typical admitted student
Safety Schools (3 schools): Programs where the candidate's profile is stronger than the typical admitted student

Format your response exactly as follows, with one school per line in each category:
 
 REACH:
 [School 1]
 [School 2]
 [School 3]
 
 TARGET:
 [School 1]
 [School 2]
 [School 3]
 
 SAFETY:
 [School 1]
 [School 2]
 [School 3]
Career Goals:
${careerGoalsAnswer || 'Not provided'}

Resume Text:
${resumeText}`;
    console.log('Generated prompt:', prompt);
    const result = await this.model.generateContent(prompt);
    console.log('AI response:', result);
    const response = await result.response;
    const text = response.text();

    // Parse the response to get categorized schools
    const lines = text.split('\n').map((s: string) => s.trim()).filter((s: string) => s.length > 0);
    const schools: Record<'reach' | 'target' | 'safety', string[]> = {
      reach: [],
      target: [],
      safety: []
    };
    let currentCategory: 'reach' | 'target' | 'safety' | null = null;
    for (const line of lines) {
      if (line === 'REACH:') {
        currentCategory = 'reach';
      } else if (line === 'TARGET:') {
        currentCategory = 'target';
      } else if (line === 'SAFETY:') {
        currentCategory = 'safety';
      } else if (currentCategory && line.length > 0) {
        schools[currentCategory].push(line);
      }
    }

    if (Object.values(schools).every(list => list.length === 0)) {
      throw new InternalServerErrorException('Failed to parse school recommendations.');
    }

    return { schools };
  }
}
