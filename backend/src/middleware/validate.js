import { ApiError } from '../utils/ApiError.js';

/**
 * Validates `body`, `query` and `params` against Zod schemas and replaces them
 * with the parsed values, so handlers receive coerced, trusted input.
 */
export function validate(schemas) {
  return (req, _res, next) => {
    try {
      for (const key of ['body', 'query', 'params']) {
        const schema = schemas[key];
        if (!schema) continue;
        const result = schema.safeParse(req[key]);
        if (!result.success) {
          const details = result.error.issues.map((issue) => ({
            field: issue.path.join('.') || key,
            message: issue.message,
          }));
          throw ApiError.unprocessable('Please check the highlighted fields.', details);
        }
        if (key === 'query') {
          // Express 5 exposes req.query as a getter; assign field by field.
          Object.defineProperty(req, 'validatedQuery', { value: result.data, writable: true, configurable: true });
          req.query = result.data;
        } else {
          req[key] = result.data;
        }
      }
      return next();
    } catch (err) {
      return next(err);
    }
  };
}
