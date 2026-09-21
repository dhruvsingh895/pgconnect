import type { Role } from '@/lib/types';
import { db } from '../db';

interface NewAccount {
  name: string;
  role: Role;
  email?: string;
  passwordHash?: string;
  phoneHash?: string;
  phoneEncrypted?: string;
}
export const accounts = {
  byId: (id: string) => db.user.findUnique({ where: { id } }),
  byEmail: (email: string) => db.user.findUnique({ where: { email } }),
  byPhone: (phoneHash: string) => db.user.findUnique({ where: { phoneHash } }),
  create: (data: NewAccount) => db.user.create({ data }),
  rename: (id: string, name: string) => db.user.update({ where: { id }, data: { name } }),
};
export const otps = {
  save: (phoneHash: string, codeHash: string, expiresAt: Date) =>
    db.otp.upsert({
      where: { phoneHash },
      create: { phoneHash, codeHash, expiresAt },
      update: { codeHash, expiresAt, attempts: 0 },
    }),
  find: (phoneHash: string) => db.otp.findUnique({ where: { phoneHash } }),
  recordAttempt: (phoneHash: string) =>
    db.otp.updateMany({ where: { phoneHash }, data: { attempts: { increment: 1 } } }),
  consume: (phoneHash: string, codeHash: string) =>
    db.otp.deleteMany({
      where: { phoneHash, codeHash, attempts: { lte: 5 }, expiresAt: { gt: new Date() } },
    }),
};
export const sessions = {
  create: (userId: string, family: string, tokenHash: string, expiresAt: Date) =>
    db.session.create({ data: { userId, family, tokenHash, expiresAt } }),
  byToken: (tokenHash: string) =>
    db.session.findUnique({ where: { tokenHash }, include: { user: true } }),
  active: (userId: string, family: string) =>
    db.session.findFirst({
      where: { userId, family, revokedAt: null, expiresAt: { gt: new Date() } },
      select: { id: true },
    }),
  revokeFamily: (family: string) =>
    db.session.updateMany({ where: { family }, data: { revokedAt: new Date() } }),
  consume: (id: string) =>
    db.session.updateMany({ where: { id, revokedAt: null }, data: { revokedAt: new Date() } }),
};
export async function incrementRateLimit(key: string, windowMs: number) {
  const now = new Date();
  await db.rateLimit.upsert({
    where: { key },
    create: { key, count: 0, resetAt: new Date(Date.now() + windowMs) },
    update: {},
  });
  await db.rateLimit.updateMany({
    where: { key, resetAt: { lte: now } },
    data: { count: 0, resetAt: new Date(Date.now() + windowMs) },
  });
  return db.rateLimit.update({ where: { key }, data: { count: { increment: 1 } } });
}
