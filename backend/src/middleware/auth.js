import { ROLES } from '../../../shared/constants.js';
import { User } from '../models/User.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/http.js';
import { verifyAccessToken } from '../services/tokenService.js';

function bearerToken(req) {
  const header = req.headers.authorization || '';
  if (header.startsWith('Bearer ')) return header.slice(7).trim();
  return null;
}

/** Requires a valid access token and loads the user onto the request. */
export const requireAuth = asyncHandler(async (req, _res, next) => {
  const token = bearerToken(req);
  if (!token) throw ApiError.unauthorized('Please sign in to continue.');

  let payload;
  try {
    payload = verifyAccessToken(token);
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      throw new ApiError(401, 'Your session has expired. Please sign in again.', { code: 'TOKEN_EXPIRED' });
    }
    throw ApiError.unauthorized('Your session is not valid. Please sign in again.');
  }

  const user = await User.findById(payload.sub);
  if (!user || !user.isActive) throw ApiError.unauthorized('This account is no longer active.');

  req.user = user;
  next();
});

/** Loads the user when a token is present, but does not require one. */
export const optionalAuth = asyncHandler(async (req, _res, next) => {
  const token = bearerToken(req);
  if (!token) return next();
  try {
    const payload = verifyAccessToken(token);
    const user = await User.findById(payload.sub);
    if (user?.isActive) req.user = user;
  } catch {
    /* An invalid token on an optional route is simply ignored. */
  }
  return next();
});

export function requireRole(...roles) {
  return (req, _res, next) => {
    if (!req.user) return next(ApiError.unauthorized());
    if (!roles.includes(req.user.role)) return next(ApiError.forbidden('This area is restricted to administrators.'));
    return next();
  };
}

export const requireAdmin = requireRole(ROLES.ADMIN);
