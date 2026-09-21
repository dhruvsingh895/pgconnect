import pino from 'pino';
export const logger = pino({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  redact: ['password', 'phone', 'email', 'token', 'headers', 'body'],
});
