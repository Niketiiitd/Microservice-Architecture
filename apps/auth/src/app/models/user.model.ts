import { Schema, model, models } from 'mongoose';

export const UserSchema = new Schema(
  {
    name: { type: String },
    email: { type: String, required: true, unique: true },
    password: { type: String },
    isAdmin: { type: Boolean, default: false },
    isEmailVerified: { type: Boolean, default: false },
    emailVerificationToken: { type: String },
    resetPasswordToken: { type: String },
    resetPasswordExpires: { type: Date },
    customerId: { type: String },
    subscription: {
      type: Schema.Types.ObjectId,
      ref: 'Subscription',
    },
  },
  { timestamps: true }
);

export const User = models?.User || model('User', UserSchema);
