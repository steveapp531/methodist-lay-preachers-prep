import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { Exam } from '../models/Exam.js';
import { User } from '../models/User.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler, created, ok } from '../utils/http.js';
import {
  clearRefreshCookie,
  createResetToken,
  hashResetToken,
  setRefreshCookie,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from '../services/tokenService.js';

async function withExam(user) {
  const json = user.toJSON();
  if (user.examStage) {
    json.examStage = await Exam.findById(user.examStage).lean();
  }
  return json;
}

function issue(res, user) {
  const refresh = signRefreshToken(user);
  setRefreshCookie(res, refresh);
  return { accessToken: signAccessToken(user), expiresIn: env.ACCESS_TOKEN_TTL };
}

export const register = asyncHandler(async (req, res) => {
  const { name, email, password, examStage, diocese, circuit, society, timezone } = req.body;

  if (await User.exists({ email })) {
    throw ApiError.conflict('An account with that email address already exists. Try signing in instead.');
  }

  if (examStage && !(await Exam.exists({ _id: examStage, isPublished: true }))) {
    throw ApiError.badRequest('That examination is not available.');
  }

  const user = new User({ name, email, examStage: examStage || null, diocese, circuit, society, timezone });
  await user.setPassword(password);
  if (examStage) user.onboardedAt = new Date();
  await user.save();

  const tokens = issue(res, user);
  return created(res, { user: await withExam(user), ...tokens });
});

export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findByEmailWithPassword(email);

  // Same message either way: do not reveal whether the address is registered.
  const invalid = ApiError.unauthorized('That email address or password is not correct.');
  if (!user) throw invalid;
  if (!(await user.verifyPassword(password))) throw invalid;
  if (!user.isActive) throw ApiError.forbidden('This account has been deactivated. Please contact an administrator.');

  user.lastActiveAt = new Date();
  await user.save();

  const tokens = issue(res, user);
  return ok(res, { user: await withExam(user), ...tokens });
});

export const refresh = asyncHandler(async (req, res) => {
  const token = req.cookies?.[env.REFRESH_COOKIE_NAME];
  if (!token) throw ApiError.unauthorized('Your session has ended. Please sign in again.');

  let payload;
  try {
    payload = verifyRefreshToken(token);
  } catch {
    clearRefreshCookie(res);
    throw ApiError.unauthorized('Your session has ended. Please sign in again.');
  }

  const user = await User.findById(payload.sub);
  if (!user || !user.isActive || (user.tokenVersion || 0) !== (payload.version || 0)) {
    clearRefreshCookie(res);
    throw ApiError.unauthorized('Your session has ended. Please sign in again.');
  }

  const tokens = issue(res, user);
  return ok(res, { user: await withExam(user), ...tokens });
});

export const logout = asyncHandler(async (_req, res) => {
  clearRefreshCookie(res);
  return ok(res, { message: 'Signed out.' });
});

/** Signs the user out of every device by invalidating all refresh tokens. */
export const logoutEverywhere = asyncHandler(async (req, res) => {
  req.user.tokenVersion = (req.user.tokenVersion || 0) + 1;
  await req.user.save();
  clearRefreshCookie(res);
  return ok(res, { message: 'Signed out on all devices.' });
});

export const me = asyncHandler(async (req, res) => ok(res, { user: await withExam(req.user) }));

export const updateProfile = asyncHandler(async (req, res) => {
  const { user } = req;
  const { examStage, preferences, ...rest } = req.body;

  if (examStage !== undefined && examStage !== null && String(examStage) !== String(user.examStage || '')) {
    if (!(await Exam.exists({ _id: examStage, isPublished: true }))) {
      throw ApiError.badRequest('That examination is not available.');
    }
    user.examStage = examStage;
    if (!user.onboardedAt) user.onboardedAt = new Date();
  }

  for (const [key, value] of Object.entries(rest)) {
    if (value !== undefined) user[key] = value;
  }
  if (preferences) Object.assign(user.preferences, preferences);

  await user.save();
  return ok(res, { user: await withExam(user) });
});

export const changePassword = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select('+passwordHash');
  if (!(await user.verifyPassword(req.body.currentPassword))) {
    throw ApiError.badRequest('Your current password is not correct.');
  }
  await user.setPassword(req.body.newPassword);
  user.tokenVersion = (user.tokenVersion || 0) + 1;
  await user.save();
  clearRefreshCookie(res);
  return ok(res, { message: 'Password changed. Please sign in again.' });
});

/**
 * Password reset.
 *
 * The response is identical whether or not the address is registered, so this
 * endpoint cannot be used to discover who has an account. No mail transport is
 * configured out of the box; in development the link is logged to the server
 * console and returned so the flow can be exercised end to end.
 */
export const forgotPassword = asyncHandler(async (req, res) => {
  const user = await User.findOne({ email: req.body.email });
  const generic = { message: 'If an account exists for that address, a reset link has been sent.' };

  if (!user || !user.isActive) return ok(res, generic);

  const { token, hash, expiresAt } = createResetToken();
  user.resetTokenHash = hash;
  user.resetTokenExpiresAt = expiresAt;
  await user.save();

  const link = `${req.headers.origin || env.CORS_ORIGINS[0]}/reset-password?token=${token}`;
  logger.info(`Password reset link for ${user.email}: ${link}`);

  return ok(res, env.isProd ? generic : { ...generic, devResetToken: token, devResetLink: link });
});

export const resetPassword = asyncHandler(async (req, res) => {
  const user = await User.findOne({
    resetTokenHash: hashResetToken(req.body.token),
    resetTokenExpiresAt: { $gt: new Date() },
  }).select('+passwordHash +resetTokenHash +resetTokenExpiresAt');

  if (!user) throw ApiError.badRequest('That reset link is invalid or has expired. Please request a new one.');

  await user.setPassword(req.body.password);
  user.resetTokenHash = null;
  user.resetTokenExpiresAt = null;
  user.tokenVersion = (user.tokenVersion || 0) + 1;
  await user.save();

  return ok(res, { message: 'Your password has been reset. You can now sign in.' });
});
