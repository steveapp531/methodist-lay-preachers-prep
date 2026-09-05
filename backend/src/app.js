import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import routes from './routes/index.js';
import { apiLimiter } from './middleware/rateLimit.js';
import { errorHandler, notFoundHandler } from './middleware/error.js';

export function createApp() {
  const app = express();

  if (env.TRUST_PROXY) app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(
    helmet({
      // The API serves JSON only; a restrictive CSP here would have no effect
      // on the separately hosted client and only complicate local tooling.
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );

  app.use(
    cors({
      origin(origin, callback) {
        // Same-origin requests and server-to-server calls have no Origin header.
        if (!origin) return callback(null, true);
        if (env.CORS_ORIGINS.includes(origin)) return callback(null, true);
        if (!env.isProd && /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin)) return callback(null, true);
        logger.warn(`Blocked cross-origin request from ${origin}`);
        return callback(new Error('This origin is not allowed by the API CORS policy.'));
      },
      credentials: true,
      methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    }),
  );

  app.use(compression());
  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));
  app.use(cookieParser());

  if (!env.isTest) {
    app.use(morgan(env.LOG_LEVEL, { stream: { write: (msg) => logger.debug(msg.trim()) } }));
  }

  app.use('/api', apiLimiter, routes);

  app.get('/', (_req, res) =>
    res.json({
      success: true,
      data: {
        name: "Methodist Lay Preachers' Examination Preparation API",
        docs: '/api/health',
        version: '1.0.0',
      },
    }),
  );

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

export default createApp;
