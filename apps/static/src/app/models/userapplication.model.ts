import { model, models, Schema } from 'mongoose';
import { QuestionSchema } from './program.model';

// Define the question status enum
const QuestionStatus = {
  NOT_STARTED: 'not_started',
  STARTED: 'started',
  FINISHED: 'finished',
};

// Define the schema for essay questions with additional user-specific fields
const EssayQuestionSchema = new Schema(
  {
    originalQuestionId: {
      type: Schema.Types.ObjectId,
      ref: 'Program', // Correct: use the model name string
      required: false, // Not required for custom questions
    },
    isCustom: {
      type: Boolean,
      default: false,
    },
    lastModified: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: true }
);

// Add all fields from the program's QuestionSchema
EssayQuestionSchema.add(QuestionSchema.obj);

// Define a sub-schema for individual answers
const AnswerSchema = new Schema(
  {
    aiAnswer: { type: String, default: '' }, // AI-generated answer
    finalAnswer: { type: String, default: '' }, // User-provided final answer
    lastModified: { type: Date, default: Date.now },
    status: {
      type: String,
      enum: Object.values(QuestionStatus),
      default: QuestionStatus.NOT_STARTED,
    },
  },
  { _id: false }
);

// Define a sub-schema for individual notes
const NoteSchema = new Schema(
  {
    content: {
      type: String,
      required: true,
      maxlength: 300, // Maximum 300 characters per note
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: true }
);

// Define a sub-schema for deadline tracking
const DeadlineSchema = new Schema({
  name: {
    type: String,
    required: true,
  },
  date: {
    type: Date,
    required: true,
  },
  isCustom: {
    type: Boolean,
    default: false,
  },
  originalDeadlineId: {
    type: Schema.Types.ObjectId,
    ref: 'Program.deadlines', // Use the model name, not 'Program.deadlines'
    required: false, // Not required for custom deadlines
  },
});

const UserApplicationSchema = new Schema({
  program: { type: Schema.Types.ObjectId, ref: 'Program', required: true }, // Correct: use the model name string
  user: { type: String, required: true },
  questions: [EssayQuestionSchema], // Array of questions with their complete information
  answers: {
    type: Map,
    of: AnswerSchema,
    default: () => new Map(),
  },
  notes: {
    type: [NoteSchema],
    default: [],
  },
  deadline: {
    type: DeadlineSchema,
  },
  isGenerating: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  lastModified: { type: Date, default: Date.now },
});

// Create a unique compound index on program and user
UserApplicationSchema.index({ program: 1, user: 1 }, { unique: true });

// Create an index on deadline.date for efficient deadline queries
UserApplicationSchema.index({ 'deadline.date': 1 });

// Middleware to update lastModified
UserApplicationSchema.pre('save', function (next) {
  this.lastModified = new Date();
  next();
});

export { QuestionStatus };

// Export the model
export const UserApplication =
  models?.UserApplication || model('UserApplication', UserApplicationSchema);
