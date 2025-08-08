import { model, models, Schema } from 'mongoose';

// Define the WorkExperience sub-schema
const WorkExperienceSchema = new Schema({
  company: { type: String, required: true },
  role: { type: String, required: true },
  location: { type: String },
  startDate: { type: String },
  endDate: { type: String },
  description: { type: String },
});

// Define the Education sub-schema
const EducationSchema = new Schema({
  universityName: { type: String, required: true },
  degreeType: { type: String },
  gpa: { type: Number },
  major: { type: String },
  startDate: { type: String },
  endDate: { type: String },
  coursesDone: { type: [String] },
});

// Define the File sub-schema
const FileSchema = new Schema({
  originalFileName: { type: String }, 
  fileName: { type: String, required: true }, // Original file name
  documentType: {
    type: String,
    enum: [
      'Profile Picture',
      'CV',
      'Transcript',
      'Degree Certificate',
      'Additional Document',
    ],
    required: true,
  },
  fileSize: { type: Number, required: true }, // File size in bytes
  fileExtension: { type: String, required: true }, // File extension (e.g., .pdf, .jpg)
  s3FileName: { type: String, required: true }, // Generated file name in S3
  uploadedAt: { type: Date, default: Date.now }, // Timestamp of file upload
});

export const UserProfileSchema = new Schema(
  {
    email: { type: String, required: true, unique: true },
    questionaire: { type: Map, of: String, default: {} },
    personalInfo: { type: Map, of: String, default: {} },
    files: { type: [FileSchema], default: [] },
    workExperience: { type: [WorkExperienceSchema], default: [] },
    education: { type: [EducationSchema], default: [] },
    profileCompletionScore: { type: Number, default: 0 },
    resumeText: { type: String, default: '' }, // Field to store parsed resume text
  },
  { timestamps: true }
);

export const UserProfile =
  models?.UserProfile || model('UserProfile', UserProfileSchema);
