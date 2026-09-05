/* Minimal structured logger. No dependency, JSON in production, readable locally. */
const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };
const threshold = LEVELS[process.env.APP_LOG_LEVEL] ?? (process.env.NODE_ENV === 'test' ? 0 : 2);

const COLOURS = { error: '[31m', warn: '[33m', info: '[36m', debug: '[90m' };
const RESET = '[0m';

function emit(level, message, meta) {
  if (LEVELS[level] > threshold) return;
  if (process.env.NODE_ENV === 'production') {
    const payload = { ts: new Date().toISOString(), level, message };
    if (meta !== undefined) payload.meta = meta instanceof Error ? { name: meta.name, message: meta.message } : meta;
    process.stdout.write(`${JSON.stringify(payload)}\n`);
    return;
  }
  const stamp = new Date().toISOString().slice(11, 19);
  const line = `${COLOURS[level] || ''}${stamp} ${level.toUpperCase().padEnd(5)}${RESET} ${message}`;
  if (meta instanceof Error) console[level === 'debug' ? 'log' : level](line, meta.stack || meta.message);
  else if (meta !== undefined) console[level === 'debug' ? 'log' : level](line, meta);
  else console[level === 'debug' ? 'log' : level](line);
}

export const logger = {
  error: (m, meta) => emit('error', m, meta),
  warn: (m, meta) => emit('warn', m, meta),
  info: (m, meta) => emit('info', m, meta),
  debug: (m, meta) => emit('debug', m, meta),
};
