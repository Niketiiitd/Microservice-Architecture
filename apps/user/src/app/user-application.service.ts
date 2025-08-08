import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { limitTypes } from '@org/models';
import { Model } from 'mongoose';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

function validateQuestionData(data: any) {
  if (
    !data.question ||
    typeof data.question !== 'string' ||
    !data.question.trim()
  ) {
    return { isValid: false, error: 'Question text is required' };
  }
  if (!data.limitType || !Object.values(limitTypes).includes(data.limitType)) {
    return { isValid: false, error: 'Invalid limit type' };
  }
  if (
    data.limitType !== limitTypes.None &&
    (!data.limitValue || data.limitValue < 1)
  ) {
    return { isValid: false, error: 'Invalid limit value' };
  }
  return { isValid: true };
}

function extractJSON(content: string) {
  const regex = /```json\s*([\s\S]*?)\s*```/;
  const match = content.match(regex);
  if (match && match[1]) {
    return match[1];
  }
  try {
    return JSON.stringify(JSON.parse(content));
  } catch {
    return content.trim();
  }
}

async function sendPrompt(prompt: string) {
  try {
    const completion = await openai.chat.completions.create({
      messages: [
        {
          role: 'system',
          content:
            'You are an expert in MBA admissions, well-versed in creating high-quality, tailored MBA application essays that help candidates showcase their unique stories, strengths, and fit with a specific business school. Your task is to generate persuasive, authentic essays based on the applicant’s background and stories provided below. You always return a response in strict JSON format so that it can be parsed.',
        },
        { role: 'user', content: prompt },
      ],
      model: 'gpt-4o-mini',
    });
    return completion.choices[0];
  } catch (error) {
    console.error('OpenAI API Error:', error);
    return null;
  }
}

async function generateEssayUntilValid(prompt: string, wordLimit: number) {
  let response;
  let attempts = 0;

  while (true) {
    response = await sendPrompt(prompt);
    if (!response) throw new Error('Failed to generate essay.');

    const content = response.message.content;
    const essayJSON = extractJSON(content);

    let essayObj;
    try {
      essayObj = JSON.parse(essayJSON);
      if (typeof essayObj !== 'object' || Array.isArray(essayObj)) {
        continue;
      }
    } catch (error) {
      continue;
    }

    if (!essayObj.essay || typeof essayObj.essay !== 'string') {
      continue;
    }

    const wordCount = essayObj.essay.split(/\s+/).length;
    if (wordCount <= wordLimit && wordCount >= wordLimit * 0.9) {
      return essayObj.essay;
    }

    attempts++;
    if (attempts > 0) {
      return essayObj.essay;
    }
  }
}

async function getPointersUntilComplete(pointersPrompt: string, questions: any[]) {
  let pointersResponse;
  let attempts = 0;

  while (true) {
    pointersResponse = await sendPrompt(pointersPrompt);
    if (!pointersResponse) throw new Error('Failed to fetch pointers.');

    const content = pointersResponse.message.content;
    const pointersJSON = extractJSON(content);

    let pointers;
    try {
      pointers = JSON.parse(pointersJSON);
      if (typeof pointers !== 'object' || Array.isArray(pointers)) {
        continue;
      }
    } catch (error) {
      continue;
    }

    const missingPointers = questions.filter(
      (q: any) => !pointers[q.questionID]?.pointers
    );

    if (missingPointers.length === 0) {
      return pointers;
    }

    pointersPrompt += `
      Some questions did not receive pointers. Please provide pointers for all the questions.
    `;

    attempts++;
    if (attempts > 2) {
      return pointers;
    }
  }
}

@Injectable()
export class UserApplicationService {
  constructor(
    @InjectModel('UserApplication') private userApplicationModel: Model<any>,
    @InjectModel('User') private userModel: Model<any>,
    @InjectModel('Program') private programModel: Model<any>,
    @InjectModel('Subscription') private subscriptionModel: Model<any>,
    @InjectModel('University') private universityModel: Model<any>,
    @InjectModel('UserProfile') private userProfileModel: Model<any>,
    @InjectModel('ProfileQuestion') private profileQuestionModel: Model<any>,
  ) {}

  async createUserApplication(userEmail: string, data: any) {
    const userRecord = await this.userModel.findOne({ email: userEmail }).populate('subscription');
    if (!userRecord) throw new NotFoundException('User not found');

    const subscription = userRecord.subscription;
    let applicationLimit = Number(process.env.NEXT_PUBLIC_FREE_APPLICATION_LIMIT) || 1;
    if (subscription?.subscriptionType === 'Standard') applicationLimit = 3;
    else if (subscription?.subscriptionType === 'Pro') applicationLimit = 7;
    else if (subscription?.subscriptionType === 'Elite') applicationLimit = 12;

    const applicationCount = await this.userApplicationModel.countDocuments({ user: userEmail });
    if (applicationCount >= applicationLimit) {
      throw new ForbiddenException('Application limit reached. Upgrade your plan to create more.');
    }

    if (!data.programId) {
      throw new BadRequestException('Program ID is required');
    }

    const program = await this.programModel.findById(data.programId).populate('applicationQuestions');
    if (!program) {
      throw new NotFoundException('Program not found');
    }

    const existingApplication = await this.userApplicationModel.findOne({
      user: userEmail,
      program: data.programId,
    });

    if (existingApplication) {
      throw new ConflictException('An application for this program already exists in your account.');
    }

    const questions = program.applicationQuestions.map((q: any) => ({
      originalQuestionId: q._id,
      question: q.question,
      type: q.type,
      guidelines: q.guidelines,
      limitType: q.limitType,
      limitValue: q.limitValue,
      enableAI: q.enableAI,
      isCustom: false,
      lastModified: new Date(),
    }));

    let deadline = null;
    if (data.deadline) {
      if (data.deadline.originalDeadlineId) {
        const programDeadline = program.deadlines.find(
          (d: any) => d._id.toString() === data.deadline.originalDeadlineId
        );
        if (!programDeadline) {
          throw new BadRequestException('Invalid deadline selected for this program');
        }
        deadline = {
          name: programDeadline.deadlineName,
          date: programDeadline.deadlineDate,
          isCustom: false,
          originalDeadlineId: data.deadline.originalDeadlineId,
        };
      } else if (data.deadline.name && data.deadline.date) {
        deadline = {
          name: data.deadline.name,
          date: new Date(data.deadline.date),
          isCustom: true,
          originalDeadlineId: null,
        };
      }
    }

    const userApplication = await this.userApplicationModel.create({
      program: data.programId,
      user: userEmail,
      questions: questions,
      isActive: true,
      ...(deadline && { deadline }),
    });

    return userApplication;
  }

  async getUserApplications(userEmail: string, invalidateApplication: (email: string) => Promise<void>, getObjectSignedUrl: (key: string) => Promise<string>) {
    await invalidateApplication(userEmail);

    const userApplications = await this.userApplicationModel.find({ user: userEmail })
      .populate({
        path: 'program',
        populate: {
          path: 'university',
          model: 'University',
        },
      })
      .sort({ createdAt: 1 });
      
    const responseApplications = await Promise.all(
      userApplications.map(async (application: any) => {
        if (!application.isActive) {
          return {
            _id: application._id,
            programName: application.program.programName,
            universityName: application.program.university.name,
            isActive: application.isActive,
            logo: application.program.university.logo
              ? await getObjectSignedUrl(application.program.university.logo)
              : null,
          };
        } else {
          const logoUrl = application.program.university.logo
            ? await getObjectSignedUrl(application.program.university.logo)
            : null;
          application.program.university.logo = logoUrl;
          return application;
        }
      })
    );

    return responseApplications;
  }

  async getUserApplicationById(
    applicationId: string,
    userEmail: string,
    invalidateApplication: (email: string) => Promise<void>
  ) {
    if (!applicationId || !userEmail) {
      throw new Error('Application ID and user email are required.');
    }

    // Validate ObjectId
    if (!/^[a-f\d]{24}$/i.test(applicationId)) {
      throw new Error('Invalid application ID format.');
    }

    const userApplication = await this.userApplicationModel.findById(applicationId)
      .populate({
        path: 'program',
        populate: {
          path: 'university',
          model: 'University',
        },
      })
      .exec();

    if (!userApplication) {
      const err: any = new Error('Application not found.');
      err.status = 404;
      throw err;
    }

    await invalidateApplication(userEmail);

    if (
      userApplication.user !== userEmail ||
      !userApplication.isActive
    ) {
      const err: any = new Error('Forbidden access to this application.');
      err.status = 403;
      throw err;
    }

    return {
      _id: userApplication._id,
      program: userApplication.program,
      user: userApplication.user,
      questions: userApplication.questions,
      answers: Object.fromEntries(userApplication.answers),
      isGenerating: userApplication.isGenerating,
      isActive: userApplication.isActive,
      createdAt: userApplication.createdAt,
      lastModified: userApplication.lastModified,
    };
  }

  async getApplicationQuestions(applicationId: string, userEmail: string) {
    if (!/^[a-f\d]{24}$/i.test(applicationId)) {
      const err: any = new Error('Invalid application ID format.');
      err.status = 400;
      throw err;
    }
    const userApplication = await this.userApplicationModel.findById(applicationId);
    if (!userApplication) {
      const err: any = new Error('Application not found.');
      err.status = 404;
      throw err;
    }
    if (
      userApplication.user !== userEmail ||
      !userApplication.isActive
    ) {
      const err: any = new Error('Forbidden access to this application.');
      err.status = 403;
      throw err;
    }
    return userApplication.questions;
  }

  async addApplicationQuestion(applicationId: string, userEmail: string, data: any) {
    if (!/^[a-f\d]{24}$/i.test(applicationId)) {
      const err: any = new Error('Invalid application ID format.');
      err.status = 400;
      throw err;
    }
    const userApplication = await this.userApplicationModel.findById(applicationId);
    if (!userApplication) {
      const err: any = new Error('Application not found.');
      err.status = 404;
      throw err;
    }
    if (
      userApplication.user !== userEmail ||
      !userApplication.isActive
    ) {
      const err: any = new Error('Forbidden access to this application.');
      err.status = 403;
      throw err;
    }
    const validation = validateQuestionData(data);
    if (!validation.isValid) {
      const err: any = new Error(validation.error);
      err.status = 400;
      throw err;
    }
    const newQuestion = {
      question: data.question.trim(),
      type: data.type,
      guidelines: data.guidelines?.trim() || '',
      limitType: data.limitType,
      limitValue: data.limitType === limitTypes.None ? undefined : data.limitValue,
      enableAI: data.enableAI || false,
      isCustom: true,
      lastModified: new Date(),
    };
    const result = await this.userApplicationModel.findByIdAndUpdate(
      applicationId,
      {
        $push: { questions: newQuestion },
        $set: { lastModified: new Date() },
      },
      { new: true }
    );
    return result.questions[result.questions.length - 1];
  }

  async updateApplicationQuestion(applicationId: string, userEmail: string, updates: any) {
    if (!/^[a-f\d]{24}$/i.test(applicationId)) {
      const err: any = new Error('Invalid application ID format.');
      err.status = 400;
      throw err;
    }
    const userApplication = await this.userApplicationModel.findById(applicationId);
    if (!userApplication) {
      const err: any = new Error('Application not found.');
      err.status = 404;
      throw err;
    }
    if (
      userApplication.user !== userEmail ||
      !userApplication.isActive
    ) {
      const err: any = new Error('Forbidden access to this application.');
      err.status = 403;
      throw err;
    }
    const { questionId, ...rest } = updates;
    if (!questionId || !/^[a-f\d]{24}$/i.test(questionId)) {
      const err: any = new Error('Invalid question ID.');
      err.status = 400;
      throw err;
    }
    const validation = validateQuestionData(rest);
    if (!validation.isValid) {
      const err: any = new Error(validation.error);
      err.status = 400;
      throw err;
    }
    const questionIndex = userApplication.questions.findIndex(
      (q: any) => q._id.toString() === questionId
    );
    if (questionIndex === -1) {
      const err: any = new Error('Question not found.');
      err.status = 404;
      throw err;
    }
    userApplication.questions[questionIndex].question = rest.question;
    userApplication.questions[questionIndex].limitType = rest.limitType;
    userApplication.questions[questionIndex].limitValue = rest.limitValue;
    userApplication.questions[questionIndex].enableAI = rest.enableAI;
    userApplication.questions[questionIndex].lastModified = new Date();
    await userApplication.save();
    return userApplication.questions[questionIndex];
  }

  async getApplicationQuestionById(applicationId: string, questionId: string, userEmail: string) {
    if (!/^[a-f\d]{24}$/i.test(applicationId) || !/^[a-f\d]{24}$/i.test(questionId)) {
      const err: any = new Error('Invalid ID format.');
      err.status = 400;
      throw err;
    }
    const userApplication = await this.userApplicationModel.findById(applicationId);
    if (!userApplication) {
      const err: any = new Error('Application not found.');
      err.status = 404;
      throw err;
    }
    if (userApplication.user !== userEmail || !userApplication.isActive) {
      const err: any = new Error('Forbidden access to this application.');
      err.status = 403;
      throw err;
    }
    const question = userApplication.questions.id(questionId);
    if (!question) {
      const err: any = new Error('Question not found.');
      err.status = 404;
      throw err;
    }
    return question;
  }

  async updateApplicationQuestionById(applicationId: string, questionId: string, userEmail: string, data: any) {
    if (!/^[a-f\d]{24}$/i.test(applicationId) || !/^[a-f\d]{24}$/i.test(questionId)) {
      const err: any = new Error('Invalid ID format.');
      err.status = 400;
      throw err;
    }
    const userApplication = await this.userApplicationModel.findById(applicationId);
    if (!userApplication) {
      const err: any = new Error('Application not found.');
      err.status = 404;
      throw err;
    }
    if (userApplication.user !== userEmail || !userApplication.isActive) {
      const err: any = new Error('Forbidden access to this application.');
      err.status = 403;
      throw err;
    }
    const question = userApplication.questions.id(questionId);
    if (!question) {
      const err: any = new Error('Question not found.');
      err.status = 404;
      throw err;
    }
    const validation = validateQuestionData(data);
    if (!validation.isValid) {
      const err: any = new Error(validation.error);
      err.status = 400;
      throw err;
    }
    question.question = data.question.trim();
    question.type = data.type;
    question.guidelines = data.guidelines?.trim() || '';
    question.limitType = data.limitType;
    question.limitValue = data.limitType === limitTypes.None ? undefined : data.limitValue;
    question.enableAI = data.enableAI || false;
    question.lastModified = new Date();
    userApplication.lastModified = new Date();
    await userApplication.save();
    return question;
  }

  async deleteApplicationQuestionById(applicationId: string, questionId: string, userEmail: string) {
    if (!/^[a-f\d]{24}$/i.test(applicationId) || !/^[a-f\d]{24}$/i.test(questionId)) {
      const err: any = new Error('Invalid ID format.');
      err.status = 400;
      throw err;
    }
    const userApplication = await this.userApplicationModel.findById(applicationId);
    if (!userApplication) {
      const err: any = new Error('Application not found.');
      err.status = 404;
      throw err;
    }
    if (userApplication.user !== userEmail || !userApplication.isActive) {
      const err: any = new Error('Forbidden access to this application.');
      err.status = 403;
      throw err;
    }
    const question = userApplication.questions.id(questionId);
    if (!question) {
      const err: any = new Error('Question not found.');
      err.status = 404;
      throw err;
    }
    if (!question.isCustom) {
      const err: any = new Error('Cannot delete original program questions.');
      err.status = 403;
      throw err;
    }
    userApplication.questions.pull(questionId);
    userApplication.lastModified = new Date();
    await userApplication.save();
    return { message: 'Question deleted successfully.' };
  }

  async getApplicationNotes(applicationId: string, userEmail: string) {
    if (!/^[a-f\d]{24}$/i.test(applicationId)) {
      const err: any = new Error('Invalid application ID format.');
      err.status = 400;
      throw err;
    }
    const application = await this.userApplicationModel.findById(applicationId);
    if (!application) {
      const err: any = new Error('Application not found.');
      err.status = 404;
      throw err;
    }
    if (application.user !== userEmail) {
      const err: any = new Error('Unauthorized access');
      err.status = 403;
      throw err;
    }
    return application.notes;
  }

  async addApplicationNote(applicationId: string, userEmail: string, content: string) {
    if (!/^[a-f\d]{24}$/i.test(applicationId)) {
      const err: any = new Error('Invalid application ID format.');
      err.status = 400;
      throw err;
    }
    if (!content || content.length > 300) {
      const err: any = new Error('Note content is required and must not exceed 300 characters.');
      err.status = 400;
      throw err;
    }
    const application = await this.userApplicationModel.findById(applicationId);
    if (!application) {
      const err: any = new Error('Application not found.');
      err.status = 404;
      throw err;
    }
    if (application.user !== userEmail) {
      const err: any = new Error('Unauthorized access');
      err.status = 403;
      throw err;
    }
    application.notes.push({ content });
    await application.save();
    return application.notes[application.notes.length - 1];
  }

  async updateApplicationNote(applicationId: string, userEmail: string, noteId: string, content: string) {
    if (!/^[a-f\d]{24}$/i.test(applicationId)) {
      const err: any = new Error('Invalid application ID format.');
      err.status = 400;
      throw err;
    }
    if (!noteId || !content || content.length > 300) {
      const err: any = new Error('Note ID and content are required. Content must not exceed 300 characters.');
      err.status = 400;
      throw err;
    }
    const application = await this.userApplicationModel.findById(applicationId);
    if (!application) {
      const err: any = new Error('Application not found.');
      err.status = 404;
      throw err;
    }
    if (application.user !== userEmail) {
      const err: any = new Error('Unauthorized access');
      err.status = 403;
      throw err;
    }
    const noteIndex = application.notes.findIndex(
      (note: any) => note._id.toString() === noteId
    );
    if (noteIndex === -1) {
      const err: any = new Error('Note not found.');
      err.status = 404;
      throw err;
    }
    application.notes[noteIndex].content = content;
    await application.save();
    return application.notes[noteIndex];
  }

  async deleteApplicationNote(applicationId: string, userEmail: string, noteId: string) {
    if (!/^[a-f\d]{24}$/i.test(applicationId)) {
      const err: any = new Error('Invalid application ID format.');
      err.status = 400;
      throw err;
    }
    if (!noteId) {
      const err: any = new Error('Note ID is required.');
      err.status = 400;
      throw err;
    }
    const application = await this.userApplicationModel.findById(applicationId);
    if (!application) {
      const err: any = new Error('Application not found.');
      err.status = 404;
      throw err;
    }
    if (application.user !== userEmail) {
      const err: any = new Error('Unauthorized access');
      err.status = 403;
      throw err;
    }
    const noteIndex = application.notes.findIndex(
      (note: any) => note._id.toString() === noteId
    );
    if (noteIndex === -1) {
      const err: any = new Error('Note not found.');
      err.status = 404;
      throw err;
    }
    application.notes.splice(noteIndex, 1);
    await application.save();
    return { message: 'Note deleted successfully' };
  }

  async generateAiAnswers(applicationId: string, userEmail: string, invalidateApplication: (email: string) => Promise<void>) {
    // ...connection and authentication should be handled in controller...
    const userApplication = await this.userApplicationModel.findById(applicationId)
      .populate({
        path: 'program',
        populate: {
          path: 'university',
          model: 'University',
        },
      })
      .exec();

    if (!userApplication) {
      const err: any = new Error('Application not found.');
      err.status = 404;
      throw err;
    }
    // console.log('User Application:', userApplication);
    await invalidateApplication(userEmail);

    if (userApplication.user !== userEmail || !userApplication.isActive) {
      const err: any = new Error('Forbidden');
      err.status = 403;
      throw err;
    }

    userApplication.isGenerating = true;
    await userApplication.save();

    try {
      const universityName = userApplication.program.university.name;
      const universityInfo = userApplication.program.university.information;
      const programName = userApplication.program.programName;
      const programInfo = userApplication.program.information;

      const userProfile = await this.userProfileModel.findOne({ email: userEmail }).exec();
      if (!userProfile) {
        const err: any = new Error('User profile not found.');
        err.status = 404;
        throw err;
      }
      // console.log('User Profile:', userProfile);
      const brainstormQuestions = await this.profileQuestionModel.find().exec();
      // console.log('Brainstorm Questions:', brainstormQuestions);
      const mapToObject = (map: Map<any, any>) => {
        if (!map) return {};
        const obj: any = {};
        map.forEach((value, key) => {
          obj[key] = value;
        });
        return obj;
      };

      const personalInfo = mapToObject(userProfile.personalInfo);
      const questionnaire = mapToObject(userProfile.questionaire);
      // console.log("mapped");
      const answeredBrainstorm = brainstormQuestions
        .filter((question: any) => {
          const answer = questionnaire[question._id.toString()];
          return answer && answer.trim() !== '';
        })
        .map((question: any) => ({
          question: question.question,
          answer: questionnaire[question._id.toString()],
        }));
      // console.log("mapped");
      const education = userProfile.education.map((edu: any) => ({
        universityName: edu.universityName,
        degreeType: edu.degreeType,
        gpa: edu.gpa,
        major: edu.major,
        startDate: edu.startDate,
        endDate: edu.endDate,
        coursesDone: edu.coursesDone,
      }));
      // console.log("mapped");
      const workExperience = userProfile.workExperience.map((work: any) => ({
        company: work.company,
        role: work.role,
        location: work.location,
        startDate: work.startDate,
        endDate: work.endDate,
        description: work.description,
      }));
      // console.log("mapped");
      const program = {
        programName: programName,
        information: programInfo,
        university: {
          name: universityName,
          information: universityInfo,
        },
      };
      // console.log("mapped");
      const applicationQuestions = userApplication.questions
        .filter((q: any) => q.enableAI)
        .map((q: any) => ({
          questionID: q._id.toString(),
          question: q.question,
          guidelines: q.guidelines || '',
          limitType: q.limitType,
          limitValue: q.limitValue,
        }));
        // console.log("mapp");
      if (applicationQuestions.length === 0) {
        userApplication.isGenerating = false;
        await userApplication.save();
        const err: any = new Error('No AI-enabled questions found');
        err.status = 400;
        throw err;
      }
      // console.log("mappeddddd");
     

      const pointersPrompt = `${process.env.AI_POINTERS_PROMPT}

      **Personal Information and Test Scores:**
      ${JSON.stringify(personalInfo, null, 2)}

      **Education Background:**
      ${JSON.stringify(education, null, 2)}

      **Professional Experience:**
      ${JSON.stringify(workExperience, null, 2)}

      **Program Details:**
      ${JSON.stringify(program, null, 2)}

      **Brainstorm Questions and Answers:**
      ${JSON.stringify(answeredBrainstorm, null, 2)}

      **Application Questions:**
      ${JSON.stringify(
        applicationQuestions.map((q: any) => ({
          questionID: q.questionID,
          question: q.question,
          guidelines: q.guidelines,
          wordLimit: q.wordLimit,
        })),
        null,
        2
      )}`;

      const pointers = await getPointersUntilComplete(
        pointersPrompt,
        applicationQuestions
      );
      console.log('Pointers generated:', pointers);
      const generateAnswerPromises = applicationQuestions.map(async (q: any) => {
        const questionID = q.questionID;
        const question = q.question;
        const guidelines = q.guidelines;
        const pointersForQuestion = pointers[questionID]?.pointers;
        let wordLimit = 'None';
        if (q.limitType != 'None') {
          wordLimit = q.limitValue.toString() + ' ' + q.limitType;
        }
        const answerPrompt = `
        Based on the following information and pointers, generate a detailed and personalized MBA application essay.

        **Personal Information and Test Scores:**
        ${JSON.stringify(personalInfo, null, 2)}

        **Education Background:**
        ${JSON.stringify(education, null, 2)}

        **Professional Experience:**
        ${JSON.stringify(workExperience, null, 2)}

        **Program Details:**
        ${JSON.stringify(program, null, 2)}

        **Brainstorm Questions and Answers:**
        ${JSON.stringify(answeredBrainstorm, null, 2)}

        **Application Question:**
        "${question}"

        **Guidelines:**
        ${guidelines}

        **Pointers:**
        ${JSON.stringify(pointersForQuestion, null, 2)}

        **Instructions:**
        - Craft a well-structured essay that incorporates the provided pointers.
        ${wordLimit !== 'None' ? `- Adhere to the specified limit of ${wordLimit}. - write the essay around the limit.` : ''}
        - Ensure coherence and logical flow within the essay.
        - Maintain a professional yet personal tone, highlighting key attributes such as leadership, teamwork, adaptability, and problem-solving.
        - Align the essay with the target school's values and offerings.
        - Avoid introducing any information not provided in the above sections.

        Give the answer directly as string without quotes. - The response should be in JSON format example.

      **Example Response:**
      \`\`\`json
      {
        "essay": "Your essay content here..."
      }
      \`\`\`
      `;
        const essay = await generateEssayUntilValid(
          answerPrompt,
          pointers[questionID]?.wordLimit || 300
        );

        return { questionID, answer: essay };
      });
      console.log('Generating answers for questions:', applicationQuestions.map((q: { question: string }) => q.question));
      let generatedAnswers = await Promise.all(generateAnswerPromises);
      console.log('Generated answers:', generatedAnswers);
      generatedAnswers = generatedAnswers.map((ans: any) => ({
        questionId: ans.questionID,
        aiAnswer: ans.answer,
      }));

      for (const ans of generatedAnswers) {
        if (!ans.questionId || !ans.aiAnswer) {
          const err: any = new Error('Each generated answer must contain "questionId" and "aiAnswer".');
          err.status = 400;
          throw err;
        }
      }

      for (const ans of generatedAnswers) {
        if (!userApplication.answers) {
          userApplication.answers = new Map();
        }
        const existingAnswer = userApplication.answers.get(ans.questionId);
        const newAnswer = {
          aiAnswer: ans.aiAnswer,
          finalAnswer: existingAnswer ? existingAnswer.finalAnswer : '',
          lastModified: new Date(),
        };
        userApplication.answers.set(ans.questionId, newAnswer);
      }

      userApplication.isGenerating = false;
      await userApplication.save();

      return {
        success: true,
        answers: generatedAnswers,
      };
    } catch (error) {
      userApplication.isGenerating = false;
      await userApplication.save();
      const err: any = new Error('An error occurred while processing the application.');
      err.status = 500;
      throw err;
    }
  }

  async updateApplicationDeadline(applicationId: string, userEmail: string, deadlineData: any) {
    if (!applicationId) {
      const err: any = new Error('Application ID is required');
      err.status = 400;
      throw err;
    }
    const application = await this.userApplicationModel.findById(applicationId);
    if (!application) {
      const err: any = new Error('Application not found');
      err.status = 404;
      throw err;
    }
    if (application.user !== userEmail) {
      const err: any = new Error('Unauthorized');
      err.status = 401;
      throw err;
    }
    if (!deadlineData) {
      const err: any = new Error('Deadline data is required');
      err.status = 400;
      throw err;
    }

    // If using an existing program deadline
    if (deadlineData.originalDeadlineId) {
      const program = await this.programModel.findById(application.program);
      if (!program) {
        const err: any = new Error('Program not found');
        err.status = 404;
        throw err;
      }
      const programDeadline = program.deadlines.find(
        (d: any) => d._id.toString() === deadlineData.originalDeadlineId
      );
      if (!programDeadline) {
        const err: any = new Error('Invalid deadline selected for this program');
        err.status = 400;
        throw err;
      }
      application.deadline = {
        name: programDeadline.deadlineName,
        date: programDeadline.deadlineDate,
        isCustom: false,
        originalDeadlineId: deadlineData.originalDeadlineId,
      };
    }
    // If using a custom deadline
    else if (deadlineData.name && deadlineData.date) {
      application.deadline = {
        name: deadlineData.name,
        date: new Date(deadlineData.date),
        isCustom: true,
        originalDeadlineId: null,
      };
    } else {
      const err: any = new Error('Invalid deadline data. Either provide originalDeadlineId or both name and date');
      err.status = 400;
      throw err;
    }

    await application.save();
    return application;
  }

  async removeApplicationDeadline(applicationId: string, userEmail: string) {
    if (!applicationId) {
      const err: any = new Error('Application ID is required');
      err.status = 400;
      throw err;
    }
    const application = await this.userApplicationModel.findById(applicationId);
    if (!application) {
      const err: any = new Error('Application not found');
      err.status = 404;
      throw err;
    }
    if (application.user !== userEmail) {
      const err: any = new Error('Unauthorized');
      err.status = 401;
      throw err;
    }
    application.deadline = undefined;
    await application.save();
    return { message: 'Deadline removed successfully' };
  }

  async updateFinalAnswer(applicationId: string, questionId: string, userEmail: string, finalAnswer: string) {
    if (!applicationId || !questionId) {
      const err: any = new Error('Missing applicationId or questionId.');
      err.status = 400;
      throw err;
    }
    const userApplication = await this.userApplicationModel.findById(applicationId).exec();
    if (
      !userApplication ||
      userApplication.user !== userEmail ||
      userApplication.isActive === false
    ) {
      const err: any = new Error('Forbidden');
      err.status = 403;
      throw err;
    }
    if (typeof finalAnswer !== 'string') {
      const err: any = new Error('Invalid or missing "finalAnswer" in the request body.');
      err.status = 400;
      throw err;
    }
    const QuestionStatus = {
      NOT_STARTED: 'not_started',
      STARTED: 'started',
      FINISHED: 'finished',
    };
    const existingAnswer = userApplication.answers.get(questionId);
    const status =
      finalAnswer.trim() === ''
        ? QuestionStatus.NOT_STARTED
        : QuestionStatus.STARTED;

    if (existingAnswer) {
      existingAnswer.finalAnswer = finalAnswer;
      if (existingAnswer.status !== QuestionStatus.FINISHED) {
        existingAnswer.status = status;
      }
      userApplication.answers.set(questionId, existingAnswer);
    } else {
      userApplication.answers.set(questionId, {
        aiAnswer: '',
        finalAnswer: finalAnswer,
        status: status,
      });
    }
    await userApplication.save();
    return {
      success: true,
      status: userApplication.answers.get(questionId).status,
    };
  }

  async updateAnswerStatus(applicationId: string, questionId: string, userEmail: string, status: string) {
    if (!applicationId || !questionId) {
      const err: any = new Error('Missing applicationId or questionId.');
      err.status = 400;
      throw err;
    }
    const userApplication = await this.userApplicationModel.findById(applicationId).exec();
    if (
      !userApplication ||
      userApplication.user !== userEmail ||
      userApplication.isActive === false
    ) {
      const err: any = new Error('Forbidden');
      err.status = 403;
      throw err;
    }
    const QuestionStatus = {
      NOT_STARTED: 'not_started',
      STARTED: 'started',
      FINISHED: 'finished',
    };
    if (!Object.values(QuestionStatus).includes(status)) {
      const err: any = new Error(
        'Invalid status value. Must be one of: ' + Object.values(QuestionStatus).join(', ')
      );
      err.status = 400;
      throw err;
    }
    const existingAnswer = userApplication.answers.get(questionId);
    if (existingAnswer) {
      existingAnswer.status = status;
      userApplication.answers.set(questionId, existingAnswer);
    } else {
      userApplication.answers.set(questionId, {
        aiAnswer: '',
        finalAnswer: '',
        status: status,
      });
    }
    await userApplication.save();
    return {
      success: true,
      status: status,
    };
  }
}
