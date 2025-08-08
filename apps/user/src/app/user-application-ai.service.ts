import { BadRequestException, Injectable, InternalServerErrorException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import OpenAI from 'openai';

@Injectable()
export class UserApplicationAiService {
  private openai: OpenAI;

  constructor(
    @InjectModel('UserApplication') private readonly userApplicationModel: Model<any>,
    @InjectModel('UserProfile') private readonly userProfileModel: Model<any>,
    @InjectModel('ProfileQuestion') private readonly profileQuestionModel: Model<any>,
  ) {
    this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }

  private async sendPrompt(prompt: string, systemPrompt: string) {
    try {
      const completion = await this.openai.chat.completions.create({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt },
        ],
        model: 'gpt-4o-mini',
      });
      return completion.choices[0];
    } catch (error) {
      throw new InternalServerErrorException('OpenAI API Error');
    }
  }

  async refineAnswer(applicationId: string, questionId: string, userEmail: string, userPrompt: string) {
    // Fetch application and validate ownership
    const userApplication = await this.userApplicationModel.findById(applicationId)
      .populate({ path: 'program', populate: { path: 'university', model: 'University' } })
      .exec();
    if (!userApplication) throw new NotFoundException('Application not found');
    if (userApplication.user !== userEmail || !userApplication.isActive) throw new UnauthorizedException('Forbidden');

    const currentQuestion = userApplication.questions.find(
      (q: any) => q._id.toString() === questionId.toString()
    );
    if (!currentQuestion) throw new NotFoundException('Question not found in the application.');

    const currentAnswer = userApplication.answers?.get(questionId);
    if (!currentAnswer) throw new NotFoundException('Answer not found for the specified question.');

    const { aiAnswer, finalAnswer } = currentAnswer;

    const userProfile = await this.userProfileModel.findOne({ email: userEmail }).exec();
    if (!userProfile) throw new NotFoundException('User profile not found.');

    const brainstormQuestions = await this.profileQuestionModel.find({ type: 'BrainStorm' }).exec();
    const answeredBrainstorm = brainstormQuestions
      .filter((question: any) => {
        const answer = userProfile.questionaire[question._id.toString()];
        return answer && answer.trim() !== '';
      })
      .map((question: any) => ({
        question: question.question,
        answer: userProfile.questionaire[question._id.toString()],
      }));

    const education = userProfile.education.map((edu: any) => ({
      universityName: edu.universityName,
      degreeType: edu.degreeType,
      gpa: edu.gpa,
      major: edu.major,
      startDate: edu.startDate,
      endDate: edu.endDate,
      coursesDone: edu.coursesDone,
    }));

    const workExperience = userProfile.workExperience.map((work: any) => ({
      company: work.company,
      role: work.role,
      location: work.location,
      startDate: work.startDate,
      endDate: work.endDate,
      description: work.description,
    }));

    const program = {
      programName: userApplication.program.programName,
      information: userApplication.program.information,
      university: {
        name: userApplication.program.university.name,
        information: userApplication.program.university.information,
      },
    };

    const refinedPrompt = `
You are an AI assistant helping to refine essay answers for university applications.

### User Profile:

### Brainstorm Questions and Answers:
${JSON.stringify(answeredBrainstorm, null, 2)}

### Education:
${JSON.stringify(education, null, 2)}

### Work Experience:
${JSON.stringify(workExperience, null, 2)}

### Program Details:
${JSON.stringify(program, null, 2)}

### Original Question:
${currentQuestion.question}

### Question Guidelines:
${currentQuestion.guidelines || 'N/A'}

### Current AI-Generated Answer:
${aiAnswer || 'No AI-generated answer yet.'}

### User Request:
${userPrompt}

### Instructions:
- Modify the AI-generated answer according to the user's request.
- Ensure the refined answer maintains the same length as the original. Unless something about it is specified in the user request.
- Preserve the key points and overall structure of the original answer.
- The refined answer should be clear, concise, and align with the provided user profile and question guidelines.

### Example Response:
\`\`\`json
{
  "refinedAnswer": "Your refined essay content here..."
}
\`\`\`
    `;

    const systemPrompt = 'You are an expert in MBA admissions, well-versed in creating high-quality, tailored MBA application essays that help candidates showcase their unique stories, strengths, and fit with a specific business school. Your task is to generate persuasive, authentic essays based on the applicant’s background and stories provided below. You always return a response in strict JSON format so that it can be parsed.';

    const refinedResponse = await this.sendPrompt(refinedPrompt, systemPrompt);
    const refinedAnswerContent = refinedResponse.message.content.trim();

    // Extract JSON from OpenAI response
    const regex = /```json\s*([\s\S]*?)\s*```/;
    const match = refinedAnswerContent.match(regex);
    let refinedAnswerJSON = match && match[1] ? match[1] : refinedAnswerContent;
    let refinedAnswerObj;
    try {
      refinedAnswerObj = JSON.parse(refinedAnswerJSON);
    } catch {
      throw new BadRequestException('Could not parse JSON content in OpenAI refined answer response.');
    }
    if (!refinedAnswerObj.refinedAnswer || typeof refinedAnswerObj.refinedAnswer !== 'string') {
      throw new BadRequestException('Invalid or missing "refinedAnswer" field in response.');
    }

    // Update the aiAnswer in the database
    userApplication.answers.set(questionId, {
      aiAnswer: refinedAnswerObj.refinedAnswer,
      finalAnswer: finalAnswer || '',
    });
    await userApplication.save();

    return { refinedAnswer: refinedAnswerObj.refinedAnswer };
  }

  async getSuggestions(applicationId: string, questionId: string, userEmail: string, answer: string) {
    const userApplication = await this.userApplicationModel.findById(applicationId)
      .populate({ path: 'program', populate: { path: 'university', model: 'University' } })
      .exec();
    if (!userApplication) throw new NotFoundException('Application not found');
    if (userApplication.user !== userEmail || !userApplication.isActive) throw new UnauthorizedException('Forbidden');

    const currentQuestion = userApplication.questions.find(
      (q: any) => q._id.toString() === questionId.toString()
    );
    if (!currentQuestion) throw new NotFoundException('Question not found in the application.');

    const { question: originalQuestion, guidelines, limitValue, limitType } = currentQuestion;

    const userProfile = await this.userProfileModel.findOne({ email: userEmail }).exec();
    if (!userProfile) throw new NotFoundException('User profile not found.');

    const brainstormQuestions = await this.profileQuestionModel.find({ type: 'BrainStorm' }).exec();
    const answeredBrainstorm = brainstormQuestions
      .filter((question: any) => {
        const ans = userProfile.questionaire[question._id.toString()];
        return ans && ans.trim() !== '';
      })
      .map((question: any) => ({
        question: question.question,
        answer: userProfile.questionaire[question._id.toString()],
      }));

    const education = userProfile.education.map((edu: any) => ({
      universityName: edu.universityName,
      degreeType: edu.degreeType,
      gpa: edu.gpa,
      major: edu.major,
      startDate: edu.startDate,
      endDate: edu.endDate,
      coursesDone: edu.coursesDone,
    }));

    const workExperience = userProfile.workExperience.map((work: any) => ({
      company: work.company,
      role: work.role,
      location: work.location,
      startDate: work.startDate,
      endDate: work.endDate,
      description: work.description,
    }));

    const program = {
      programName: userApplication.program.programName,
      information: userApplication.program.information,
      university: {
        name: userApplication.program.university.name,
        information: userApplication.program.university.information,
      },
    };

    const refinedPrompt = `
You are an AI assistant helping to provide suggestions for essay answers for university applications.

### Brainstorm Questions and Answers:
${JSON.stringify(answeredBrainstorm, null, 2)}

### Education:
${JSON.stringify(education, null, 2)}

### Work Experience:
${JSON.stringify(workExperience, null, 2)}

### Program Details:
${JSON.stringify(program, null, 2)}

### Original Question:
${originalQuestion}

### Question Limits:
${limitType === 'Word' && limitValue ? `Word Limit: ${limitValue}` : limitType === 'Char' && limitValue ? `Character Limit: ${limitValue}` : 'N/A'}

### Question Guidelines:
${guidelines || 'N/A'}

### Current Answer by user:
${answer}

### Instructions:
- Suggestions should be specific to the user's profile and the program they are applying to.
- Suggestions should be actionable and help improve the quality of the answer.
- Provide suggestions within the limits of the question.
- Provide suggestions as a list of brief and actionable points.
- Return suggestions in strict JSON format as an array.

### Example Response:
\`\`\`json
{
  "suggestions": ["Suggestion 1", "Suggestion 2", "Suggestion 3"]
}
\`\`\`
    `;

    const systemPrompt = 'You are an expert in MBA admissions, well-versed in creating high-quality, tailored MBA application essays. Provide suggestions in brief points based on the input provided.';

    const suggestionsResponse = await this.sendPrompt(refinedPrompt, systemPrompt);
    const suggestionsContent = suggestionsResponse.message.content.trim();

    const regex = /```json\s*([\s\S]*?)\s*```/;
    const match = suggestionsContent.match(regex);
    let suggestionsJSON = match && match[1] ? match[1] : suggestionsContent;
    let suggestionObject;
    try {
      suggestionObject = JSON.parse(suggestionsJSON);
    } catch {
      throw new BadRequestException('Could not parse suggestions JSON content.');
    }
    if (!Array.isArray(suggestionObject.suggestions) || suggestionObject.suggestions.length === 0) {
      throw new BadRequestException('Suggestions response is not a valid array.');
    }
    return { suggestions: suggestionObject.suggestions };
  }
}
