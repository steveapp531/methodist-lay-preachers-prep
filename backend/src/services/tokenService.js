import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

/**
 * Two-token scheme.
 *
 * The access token is short-lived and sent in the Authorization header. The
 * refresh token lives only in an httpOnly cookie, so client-side script can
 * never read it, and carries a `version` claim that is compared against the
 * user's `tokenVersion` — bumping that number signs the user out everywhere.
 */
export function signAccessToken(user) {
  return jwt.sign(
    { sub: String(user._id), role: user.role, name: user.name },
    env.JWT_ACCESS_SECRET,
    { expiresIn: env.ACCESS_TOKEN_TTL, issuer: 'mlpp' },
  );
}

export function signRefreshToken(user) {
  return jwt.sign(
    { sub: String(user._id), version: user.tokenVersion || 0 },
    env.JWT_REFRESH_SECRET,
    { expiresIn: env.REFRESH_TOKEN_TTL, issuer: 'mlpp' },
  );
}

export function verifyAccessToken(token) {
  return jwt.verify(token, env.JWT_ACCESS_SECRET, { issuer: 'mlpp' });
}

export function verifyRefreshToken(token) {
  return jwt.verify(token, env.JWT_REFRESH_SECRET, { issuer: 'mlpp' });
}

export function refreshCookieOptions() {
  const maxAgeDays = Number.parseInt(env.REFRESH_TOKEN_TTL, 10) || 30;
  return {
    httpOnly: true,
    secure: env.isProd,
    // Cross-site in production: the web client and API are deployed to
    // different hosts, so the cookie must be SameSite=None to be sent at all.
    sameSite: env.isProd ? 'none' : 'lax',
    path: '/api/auth',
    maxAge: maxAgeDays * 24 * 60 * 60 * 1000,
  };
}

export function setRefreshCookie(res, token) {
  res.cookie(env.REFRESH_COOKIE_NAME, token, refreshCookieOptions());
}

export function clearRefreshCookie(res) {
  res.clearCookie(env.REFRESH_COOKIE_NAME, { ...refreshCookieOptions(), maxAge: undefined });
}

/** Password reset tokens: a random value is emailed, only its hash is stored. */
export function createResetToken() {
  const token = crypto.randomBytes(32).toString('hex');
  const hash = crypto.createHash('sha256').update(token).digest('hex');
  return { token, hash, expiresAt: new Date(Date.now() + 60 * 60 * 1000) };
}

export function hashResetToken(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}
