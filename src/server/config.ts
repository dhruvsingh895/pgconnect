import { randomBytes } from 'node:crypto';
const production = process.env.NODE_ENV === 'production';
const developmentGlobal = globalThis as unknown as { pgDevelopmentKey?: string };
const devKey = developmentGlobal.pgDevelopmentKey ?? randomBytes(32).toString('hex');
if (!production) developmentGlobal.pgDevelopmentKey = devKey;
export const config = {
  production,
  demo: !production && process.env.DEMO_ENABLED !== 'false',
  origin: process.env.APP_ORIGIN || 'http://localhost:3000',
  jwtSecret: process.env.JWT_SECRET || (production ? '' : devKey),
  encryptionKey: process.env.ENCRYPTION_KEY || (production ? '' : devKey),
  sms: {
    accountSid: process.env.SMS_ACCOUNT_SID,
    authToken: process.env.SMS_AUTH_TOKEN,
    from: process.env.SMS_FROM,
  },
  storage: { region: process.env.S3_REGION || 'ap-south-1', bucket: process.env.S3_BUCKET },
};
export function requireSecrets() {
  if (config.jwtSecret.length < 32 || !/^[a-f0-9]{64}$/i.test(config.encryptionKey))
    throw new Error(
      'Configure JWT_SECRET (32+ characters) and ENCRYPTION_KEY (64 hex characters).',
    );
}
