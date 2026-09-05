import test from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import {
  createResetToken,
  hashResetToken,
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  refreshCookieOptions,
} from '../src/services/tokenService.js';
import { requireRole } from '../src/middleware/auth.js';
import { ROLES } from '../../shared/constants.js';
import { env } from '../src/config/env.js';
import {
  registerSchema,
  loginSchema,
  createQuizSchema,
  adminQuestionSchema,
  createBookmarkSchema,
} from '../src/validators/schemas.js';

const user = { _id: '507f1f77bcf86cd799439011', role: ROLES.STUDENT, name: 'Stephen Appiah', tokenVersion: 0 };

/* --------------------------------------------------------------------- tokens */

test('an access token carries the subject and role and verifies', () => {
  const payload = verifyAccessToken(signAccessToken(user));
  assert.equal(payload.sub, String(user._id));
  assert.equal(payload.role, ROLES.STUDENT);
  assert.equal(payload.iss, 'mlpp');
});

test('an access token is not accepted as a refresh token, or the reverse', () => {
  assert.throws(() => verifyRefreshToken(signAccessToken(user)));
  assert.throws(() => verifyAccessToken(signRefreshToken(user)));
});

test('a tampered token is rejected', () => {
  const token = signAccessToken(user);
  const [header, body, signature] = token.split('.');
  const forged = Buffer.from(JSON.stringify({ sub: user._id, role: 'admin', iss: 'mlpp' })).toString('base64url');
  assert.throws(() => verifyAccessToken(`${header}.${forged}.${signature}`));
});

test('an expired token is rejected with a recognisable error', () => {
  const expired = jwt.sign({ sub: String(user._id) }, env.JWT_ACCESS_SECRET, { issuer: 'mlpp', expiresIn: -10 });
  assert.throws(() => verifyAccessToken(expired), (err) => err.name === 'TokenExpiredError');
});

test('the refresh token records the token version, so it can be revoked', () => {
  const payload = verifyRefreshToken(signRefreshToken({ ...user, tokenVersion: 4 }));
  assert.equal(payload.version, 4);
});

test('the refresh cookie is httpOnly and scoped to the auth routes', () => {
  const options = refreshCookieOptions();
  assert.equal(options.httpOnly, true, 'script must never be able to read the refresh token');
  assert.equal(options.path, '/api/auth');
  assert.ok(options.maxAge > 0);
});

test('a reset token is stored only as a hash, and the hash is reproducible', () => {
  const { token, hash, expiresAt } = createResetToken();
  assert.equal(hash.length, 64);
  assert.notEqual(token, hash);
  assert.equal(hashResetToken(token), hash);
  assert.notEqual(hashResetToken(`${token}x`), hash);
  assert.ok(expiresAt > new Date());
});

test('two reset tokens are never the same', () => {
  assert.notEqual(createResetToken().token, createResetToken().token);
});

/* ---------------------------------------------------------------- authorisation */

function runRole(role, roleUser) {
  return new Promise((resolve) => {
    requireRole(role)({ user: roleUser }, {}, (err) => resolve(err));
  });
}

test('an administrator passes an admin-only guard', async () => {
  assert.equal(await runRole(ROLES.ADMIN, { role: ROLES.ADMIN }), undefined);
});

test('a student is refused by an admin-only guard', async () => {
  const err = await runRole(ROLES.ADMIN, { role: ROLES.STUDENT });
  assert.equal(err.status, 403);
});

test('an unauthenticated request is refused before the role is considered', async () => {
  const err = await runRole(ROLES.ADMIN, undefined);
  assert.equal(err.status, 401);
});

/* -------------------------------------------------------------------- validation */

test('registration requires a real email and a password with a letter and a number', () => {
  assert.ok(registerSchema.safeParse({ name: 'Stephen Appiah', email: 'a@b.com', password: 'Methodist1' }).success);
  assert.ok(!registerSchema.safeParse({ name: 'Stephen', email: 'not-an-email', password: 'Methodist1' }).success);
  assert.ok(!registerSchema.safeParse({ name: 'Stephen', email: 'a@b.com', password: 'short1' }).success);
  assert.ok(!registerSchema.safeParse({ name: 'Stephen', email: 'a@b.com', password: 'allletters' }).success);
  assert.ok(!registerSchema.safeParse({ name: 'S', email: 'a@b.com', password: 'Methodist1' }).success);
});

test('email addresses are lowercased and trimmed on the way in', () => {
  const parsed = loginSchema.parse({ email: '  Stephen@Example.COM ', password: 'x' });
  assert.equal(parsed.email, 'stephen@example.com');
});

test('a quiz request is clamped to a sane size and defaults sensibly', () => {
  const parsed = createQuizSchema.parse({});
  assert.equal(parsed.size, 10);
  assert.equal(parsed.mode, 'practice');
  assert.ok(!createQuizSchema.safeParse({ size: 5000 }).success, 'a 5000-question quiz must be refused');
  assert.ok(!createQuizSchema.safeParse({ size: 0 }).success);
  assert.ok(!createQuizSchema.safeParse({ mode: 'nonsense' }).success);
});

test('an object id is required where the API expects one', () => {
  assert.ok(!createQuizSchema.safeParse({ subject: 'not-an-id' }).success);
  assert.ok(createQuizSchema.safeParse({ subject: '507f1f77bcf86cd799439011' }).success);
});

test('a bookmark must actually point at something', () => {
  assert.ok(!createBookmarkSchema.safeParse({ targetType: 'question' }).success);
  assert.ok(createBookmarkSchema.safeParse({ targetType: 'question', question: '507f1f77bcf86cd799439011' }).success);
  assert.ok(createBookmarkSchema.safeParse({ targetType: 'scripture', scriptureReference: 'Amos 5:24' }).success);
});

test('an admin question needs its required placement and prompt', () => {
  const valid = {
    exam: '507f1f77bcf86cd799439011',
    subject: '507f1f77bcf86cd799439012',
    type: 'multiple_choice',
    prompt: 'Who is a prophet?',
    sourceKind: 'manual_derived',
  };
  assert.ok(adminQuestionSchema.safeParse(valid).success);
  assert.ok(!adminQuestionSchema.safeParse({ ...valid, prompt: '' }).success);
  assert.ok(!adminQuestionSchema.safeParse({ ...valid, sourceKind: 'made_up' }).success);
  assert.ok(!adminQuestionSchema.safeParse({ ...valid, type: 'crossword' }).success);
});

test('validation errors name the field that failed', () => {
  const result = registerSchema.safeParse({ name: 'S', email: 'bad', password: 'x' });
  const fields = result.error.issues.map((i) => i.path.join('.'));
  assert.ok(fields.includes('email'));
  assert.ok(fields.includes('password'));
  assert.ok(fields.includes('name'));
});
