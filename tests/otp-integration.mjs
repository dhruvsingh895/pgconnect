import assert from 'node:assert/strict';
import { createHmac, randomInt } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
process.loadEnvFile('.env');
const db = new PrismaClient();
const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:3000';
const hash = (value) => createHmac('sha256', process.env.JWT_SECRET).update(value).digest('hex');
const phone = `+919${String(randomInt(100000000, 999999999))}`;
const code = String(randomInt(100000, 999999));
const phoneHash = hash(phone);
async function verify(value) {
  return fetch(base + '/api/auth', {
    method: 'POST',
    headers: { Origin: base, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: 'otp-verify',
      phone,
      code: value,
      name: 'QA Phone Tenant',
      role: 'TENANT',
    }),
  });
}
try {
  await db.otp.create({
    data: { phoneHash, codeHash: hash(`${phone}:${code}`), expiresAt: new Date(Date.now() - 1000) },
  });
  assert.equal((await verify(code)).status, 400);
  await db.otp.update({
    where: { phoneHash },
    data: { expiresAt: new Date(Date.now() + 300000), attempts: 0 },
  });
  const wrong = code === '111111' ? '222222' : '111111';
  for (let i = 0; i < 5; i++) assert.equal((await verify(wrong)).status, 400);
  assert.equal((await verify(code)).status, 400);
  await db.otp.update({ where: { phoneHash }, data: { attempts: 0 } });
  const result = await verify(code);
  assert.equal(result.status, 200);
  const { user } = await result.json();
  assert.equal(user.role, 'TENANT');
  assert.equal((await verify(code)).status, 400);
  const stored = await db.user.findUnique({ where: { id: user.id } });
  assert.notEqual(stored.phoneEncrypted, phone);
  assert.equal(stored.phoneHash, phoneHash);
  process.stdout.write(
    'OTP integration passed: expiry, attempt limit, one-time consumption, phone signup, encrypted phone storage. SMS delivery is not exercised.\n',
  );
} finally {
  await db.$disconnect();
}
