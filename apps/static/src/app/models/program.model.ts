import { model, models, Schema } from 'mongoose';

export const questionTypes = {
  String: 'String',
};

export const limitTypes = {
  Word: 'Word', 
  Char: 'Char', 
  None: 'None', 
};

export const QuestionSchema = new Schema({
  question: {
    type: String,
    // required: true,
    trim: true,
  },
  type: {
    type: String,
    enum: Object.values(questionTypes),
  },
  guidelines: {
    type: String,
    required: false,
    trim: true,
  },
  limitType: {
    type: String,
    enum: Object.values(limitTypes),
    default: limitTypes.None,
  },
  limitValue: {
    type: Number,
    required: function (this: any) {
      return this.limitType !== limitTypes.None;
    },
    min: 1,
  },
  enableAI: {
    type: Boolean,
    default: false,
  },
});

// Define the Deadline schema with the specified fields
const DeadlineSchema = new Schema({
  deadlineName: {
    type: String,
    required: true,
    trim: true,
  },
  deadlineDate: {
    type: Date,
    required: true,
  },
  deadlineDescription: {
    type: String,
    required: false,
    trim: true,
  },
});

const ProgramSchema = new Schema({
  university: {
    type: Schema.Types.ObjectId,
    ref: 'University',
    required: true,
  },
  programType: {
    type: String,
    required: true,
    enum: ['Distance Learning', 'Dual Degree', 'Executive MBA', 'Full-Time', 'Part-Time'], // Corrected enum values
  },
  programName: {
    type: String,
    required: true,
    trim: true,
  },
  information: {
    type: String,
    required: false, 
    trim: true,
  },
  logo: {
    type: String,
    default: '', 
  },
  sessionId: {
    type: String,
    required: false, // Optional field to store session ID
    trim: true,
  },
  applicationQuestions: [QuestionSchema],
  deadlines: [DeadlineSchema],
});


// Ensure that each program has a unique combination of university and programName
ProgramSchema.index({ university: 1, programName: 1 }, { unique: true });

export const Program = models?.Program || model('Program', ProgramSchema);
