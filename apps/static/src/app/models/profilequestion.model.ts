import { model, models, Schema, Types } from 'mongoose';

const ProfileSectionSchema = new Schema(
  {
    name: {
      type: String,
      required: [true, 'Section name is required.'],
      unique: true,
      trim: true,
      minlength: [3, 'Section name must be at least 3 characters long.'],
    },
    description: {
      type: String,
      trim: true,
    },
    pageNumber: {
      type: Number,
      default: 0,
      min: [0, 'Page number must be greater than or equal to 0'],
      validate: {
        validator: Number.isInteger,
        message: 'Page number must be an integer'
      }
    }
  },
  {
    timestamps: true,
  }
);

const ProfileQuestionSchema = new Schema({
  question: {
    type: String,
    required: [true, 'Question text is required.'],
  },
  section: {
    type: Types.ObjectId,
    ref: 'ProfileSection',
    required: [true, 'Profile section reference is required.'],
  },
});

ProfileQuestionSchema.index({ section: 1, question: 1 }, { unique: true });

export const ProfileSection =
  models.ProfileSection || model('ProfileSection', ProfileSectionSchema);

export const ProfileQuestion =
  models.ProfileQuestion || model('ProfileQuestion', ProfileQuestionSchema);
