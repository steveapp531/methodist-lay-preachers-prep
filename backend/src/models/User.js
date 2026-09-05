import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { ROLES } from '../../../shared/constants.js';

const { Schema } = mongoose;

const preferencesSchema = new Schema(
  {
    dailyQuestionGoal: { type: Number, default: 20, min: 5, max: 200 },
    dailyStudyMinutesGoal: { type: Number, default: 30, min: 5, max: 480 },
    voiceAnswersEnabled: { type: Boolean, default: true },
    soundEffectsEnabled: { type: Boolean, default: true },
    reducedMotion: { type: Boolean, default: false },
    preferredBibleTranslation: { type: String, default: '' },
  },
  { _id: false },
);

const streakSchema = new Schema(
  {
    current: { type: Number, default: 0 },
    longest: { type: Number, default: 0 },
    lastStudyDate: { type: String, default: null }, // YYYY-MM-DD in the user's timezone
  },
  { _id: false },
);

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: Object.values(ROLES), default: ROLES.STUDENT, index: true },

    // The examination the candidate is preparing for. Nullable until chosen.
    examStage: { type: Schema.Types.ObjectId, ref: 'Exam', default: null, index: true },
    examDate: { type: Date, default: null },

    diocese: { type: String, trim: true, default: '' },
    circuit: { type: String, trim: true, default: '' },
    society: { type: String, trim: true, default: '' },
    timezone: { type: String, default: 'Africa/Accra' },

    preferences: { type: preferencesSchema, default: () => ({}) },
    streak: { type: streakSchema, default: () => ({}) },

    onboardedAt: { type: Date, default: null },
    lastActiveAt: { type: Date, default: null, index: true },
    totalStudySeconds: { type: Number, default: 0 },

    // Password reset. Only the hash of the token is stored.
    resetTokenHash: { type: String, default: null, select: false },
    resetTokenExpiresAt: { type: Date, default: null, select: false },

    // Incremented to invalidate every outstanding refresh token for this user.
    tokenVersion: { type: Number, default: 0 },

    isActive: { type: Boolean, default: true },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform(_doc, ret) {
        delete ret.passwordHash;
        delete ret.resetTokenHash;
        delete ret.resetTokenExpiresAt;
        delete ret.__v;
        return ret;
      },
    },
  },
);

userSchema.virtual('isAdmin').get(function isAdmin() {
  return this.role === ROLES.ADMIN;
});

userSchema.methods.setPassword = async function setPassword(plain) {
  this.passwordHash = await bcrypt.hash(plain, 12);
};

userSchema.methods.verifyPassword = function verifyPassword(plain) {
  if (!this.passwordHash) return Promise.resolve(false);
  return bcrypt.compare(plain, this.passwordHash);
};

userSchema.statics.findByEmailWithPassword = function findByEmailWithPassword(email) {
  return this.findOne({ email: String(email).toLowerCase().trim() }).select('+passwordHash');
};

export const User = mongoose.model('User', userSchema);
export default User;
