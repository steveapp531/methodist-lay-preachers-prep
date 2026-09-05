/**
 * Errors thrown deliberately by application code. Anything else that reaches
 * the error handler is treated as unexpected and reported without internals.
 */
export class ApiError extends Error {
  constructor(status, message, { code = undefined, details = undefined } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code || defaultCode(status);
    this.details = details;
    this.expected = true;
  }

  static badRequest(message = 'Invalid request', details) {
    return new ApiError(400, message, { details });
  }

  static unauthorized(message = 'You need to sign in to do that') {
    return new ApiError(401, message);
  }

  static forbidden(message = 'You do not have access to that') {
    return new ApiError(403, message);
  }

  static notFound(message = 'Not found') {
    return new ApiError(404, message);
  }

  static conflict(message = 'That conflicts with something that already exists') {
    return new ApiError(409, message);
  }

  static unprocessable(message = 'That request could not be processed', details) {
    return new ApiError(422, message, { details });
  }

  static tooMany(message = 'Too many requests. Please wait a moment and try again') {
    return new ApiError(429, message);
  }
}

function defaultCode(status) {
  return (
    {
      400: 'BAD_REQUEST',
      401: 'UNAUTHORIZED',
      403: 'FORBIDDEN',
      404: 'NOT_FOUND',
      409: 'CONFLICT',
      422: 'UNPROCESSABLE',
      429: 'RATE_LIMITED',
    }[status] || 'ERROR'
  );
}

export default ApiError;
