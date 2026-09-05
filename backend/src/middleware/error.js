import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { ApiError } from '../utils/ApiError.js';

export function notFoundHandler(req, _res, next) {
  next(ApiError.notFound(`No route matches ${req.method} ${req.originalUrl}`));
}

/**
 * Turns anything thrown anywhere into a consistent, non-leaking JSON error.
 * Mongoose and JWT failures are translated into messages a candidate can act on.
 */
export function errorHandler(err, req, res, _next) {
  let error = err;

  if (!(error instanceof ApiError)) {
    if (err?.name === 'ValidationError' && err.errors) {
      error = ApiError.unprocessable(
        'Some of those details are not valid.',
        Object.entries(err.errors).map(([field, detail]) => ({ field, message: detail.message })),
      );
    } else if (err?.name === 'CastError') {
      error = ApiError.badRequest('That identifier is not valid.');
    } else if (err?.code === 11000) {
      const field = Object.keys(err.keyPattern || {})[0] || 'value';
      error = ApiError.conflict(
        field === 'email' ? 'An account with that email address already exists.' : `That ${field} is already in use.`,
      );
    } else if (err?.type === 'entity.too.large') {
      error = ApiError.badRequest('That request was too large.');
    } else if (err?.name === 'SyntaxError' && 'body' in err) {
      error = ApiError.badRequest('The request body was not valid JSON.');
    }
  }

  const status = error.status || 500;

  if (status >= 500) {
    logger.error(`${req.method} ${req.originalUrl} failed`, err);
  } else {
    logger.debug(`${req.method} ${req.originalUrl} → ${status}: ${error.message}`);
  }

  const body = {
    success: false,
    error: {
      code: error.code || 'INTERNAL_ERROR',
      message:
        status >= 500 && env.isProd
          ? 'Something went wrong on our side. Please try again in a moment.'
          : error.message || 'Unexpected error',
    },
  };
  if (error.details) body.error.details = error.details;
  if (!env.isProd && status >= 500 && err?.stack) body.error.stack = err.stack.split('\n').slice(0, 6);

  res.status(status).json(body);
}
