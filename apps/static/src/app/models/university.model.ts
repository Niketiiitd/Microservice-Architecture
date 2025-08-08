import { model, models, Schema } from 'mongoose';

const UniversitySchema = new Schema({
  name: { type: String, required: true, unique: true },
  information: { type: String },
  logo: { type: String, default: '' },
});

// Index on name
UniversitySchema.index({ name: 1 });

export const University =
  models?.University || model('University', UniversitySchema);
