import { createCipheriv, createDecipheriv, randomBytes, createHmac } from 'node:crypto';
import { config, requireSecrets } from './config';
export function encrypt(value: string) {
  requireSecrets();
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', Buffer.from(config.encryptionKey, 'hex'), iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return `${iv.toString('hex')}.${cipher.getAuthTag().toString('hex')}.${encrypted.toString('hex')}`;
}
export function decrypt(value: string) {
  requireSecrets();
  const [iv, tag, data] = value.split('.');
  const cipher = createDecipheriv(
    'aes-256-gcm',
    Buffer.from(config.encryptionKey, 'hex'),
    Buffer.from(iv, 'hex'),
  );
  cipher.setAuthTag(Buffer.from(tag, 'hex'));
  return Buffer.concat([cipher.update(Buffer.from(data, 'hex')), cipher.final()]).toString('utf8');
}
export function digest(value: string) {
  requireSecrets();
  return createHmac('sha256', config.jwtSecret).update(value).digest('hex');
}
