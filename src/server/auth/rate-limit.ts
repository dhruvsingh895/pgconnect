import { incrementRateLimit } from '../repositories/accounts';
import { AppError } from '../errors';
import { digest } from '../crypto';
export async function rateLimit(scope: string, subject: string, limit = 5, windowMs = 15 * 60000) {
  const key = digest(`${scope}:${subject}`);
  const entry = await incrementRateLimit(key, windowMs);
  if (entry.count > limit)
    throw new AppError(429, 'RATE_LIMITED', 'Too many attempts. Try again in 15 minutes.');
}
