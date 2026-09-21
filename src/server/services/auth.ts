import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { randomInt, randomBytes } from 'node:crypto';
import { accounts, otps } from '../repositories/accounts';
import { assert } from '../errors';
import { digest, encrypt } from '../crypto';
import { issueSession } from '../auth/session';
import { rateLimit } from '../auth/rate-limit';
import { config } from '../config';
const phone = z.string().regex(/^\+91[6-9]\d{9}$/, 'Enter a valid Indian phone number with +91.');
const role = z.enum(['OWNER', 'TENANT']);
const email = z.email().trim().toLowerCase().max(254);
const password = z.string().min(12, 'Use at least 12 characters.').max(128);
const name = z.string().trim().min(2).max(100);
export const authSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('login'), email, password: z.string().min(1).max(128) }),
  z.object({ type: z.literal('signup'), name, email, password, role }),
  z.object({ type: z.literal('otp-send'), phone }),
  z.object({
    type: z.literal('otp-verify'),
    phone,
    code: z.string().regex(/^\d{6}$/),
    name: name.optional(),
    role: role.optional(),
  }),
]);
async function sessionFor(user: {
  id: string;
  name: string;
  role: 'OWNER' | 'TENANT';
  propertyId: string | null;
}) {
  await issueSession(user);
  return { user: { id: user.id, name: user.name, role: user.role, propertyId: user.propertyId } };
}
export async function authenticate(input: unknown, client: string) {
  const a = authSchema.parse(input);
  await rateLimit('auth-client', client, 300, 60000);
  if (a.type === 'login') {
    await rateLimit('login', a.email, 10);
    const user = await accounts.byEmail(a.email);
    const valid = await bcrypt.compare(
      a.password,
      user?.passwordHash || '$2b$12$R9h/cIPz0gi.URNNX3kh2OPST9/PgBkqquzi.Ss7KIUgO2t0jWMUW',
    );
    assert(
      user?.passwordHash && valid,
      401,
      'INVALID_CREDENTIALS',
      'Email or password is incorrect.',
    );
    return sessionFor(user);
  }
  if (a.type === 'signup') {
    await rateLimit('signup', a.email);
    assert(
      !(await accounts.byEmail(a.email)),
      409,
      'ACCOUNT_EXISTS',
      'An account already exists. Please sign in.',
    );
    const user = await accounts.create({
      name: a.name,
      email: a.email,
      passwordHash: await bcrypt.hash(a.password, 12),
      role: a.role,
    });
    return sessionFor(user);
  }
  const phoneHash = digest(a.phone);
  if (a.type === 'otp-send') {
    await rateLimit('otp-send', a.phone, 3);
    const sid = config.sms.accountSid;
    const token = config.sms.authToken;
    const from = config.sms.from;
    assert(
      sid && token && from,
      503,
      'SMS_UNAVAILABLE',
      'Phone sign-in is not configured. Please use email or explore the demo.',
    );
    const code = String(randomInt(100000, 1000000));
    await otps.save(phoneHash, digest(`${a.phone}:${code}`), new Date(Date.now() + 5 * 60000));
    const result = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}/Messages.json`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          To: a.phone,
          From: from,
          Body: `Your PGConnect verification code is ${code}. It expires in 5 minutes. Do not share it.`,
        }),
        signal: AbortSignal.timeout(10000),
      },
    );
    assert(result.ok, 503, 'SMS_UNAVAILABLE', 'Could not send a code. Please try again later.');
    return { sent: true };
  }
  await rateLimit('otp-verify', a.phone, 10);
  const record = await otps.find(phoneHash);
  assert(
    record && record.expiresAt > new Date() && record.attempts < 5,
    400,
    'INVALID_OTP',
    'The code is invalid or expired.',
  );
  await otps.recordAttempt(phoneHash);
  assert(
    record.codeHash === digest(`${a.phone}:${a.code}`),
    400,
    'INVALID_OTP',
    'The code is invalid or expired.',
  );
  const consumed = await otps.consume(phoneHash, record.codeHash);
  assert(consumed.count === 1, 400, 'INVALID_OTP', 'The code has already been used.');
  let user = await accounts.byPhone(phoneHash);
  if (!user) {
    assert(
      a.name && a.role,
      400,
      'SIGNUP_REQUIRED',
      'Choose a role and provide your name to create an account.',
    );
    user = await accounts.create({
      name: a.name,
      role: a.role,
      phoneHash,
      phoneEncrypted: encrypt(a.phone),
    });
  }
  return sessionFor(user);
}
export function inviteCode() {
  return randomBytes(6).toString('hex').toUpperCase();
}
