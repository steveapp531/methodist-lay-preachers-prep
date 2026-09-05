import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';

const message = {
  success: false,
  error: { code: 'RATE_LIMITED', message: 'Too many requests. Please wait a moment and try again.' },
};

export const apiLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message,
  skip: () => env.isTest,
});

/** Tighter budget on the endpoints worth brute-forcing. */
export const authLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.AUTH_RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message,
  skipSuccessfulRequests: true,
  skip: () => env.isTest,
});

/** AI-backed marking is the most expensive path, so it gets its own budget. */
export const gradingLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message,
  skip: () => env.isTest,
});
