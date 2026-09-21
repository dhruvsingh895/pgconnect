import { SignJWT, jwtVerify } from 'jose';
import { randomBytes, randomUUID } from 'node:crypto';
import { cookies } from 'next/headers';
import { config, requireSecrets } from '../config';
import { accounts, sessions } from '../repositories/accounts';
import { digest } from '../crypto';
import { AppError, assert } from '../errors';
import type { Identity } from '@/lib/types';
const options = { httpOnly: true, secure: config.production, sameSite: 'lax' as const, path: '/' };
async function sign(identity: Identity) {
  requireSecrets();
  return new SignJWT({
    id: identity.id,
    role: identity.role,
    name: identity.name,
    propertyId: identity.propertyId,
    ...(identity.demo ? { demo: identity.demo } : {}),
    ...(identity.sessionFamily ? { sessionFamily: identity.sessionFamily } : {}),
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('15m')
    .setIssuer('pgconnect')
    .setAudience('pgconnect-app')
    .sign(new TextEncoder().encode(config.jwtSecret));
}
export async function setAccess(identity: Identity) {
  const jar = await cookies();
  jar.set('pg_access', await sign(identity), { ...options, maxAge: 900 });
}
export async function issueSession(identity: Identity, family: string = randomUUID()) {
  const token = randomBytes(48).toString('base64url');
  await sessions.create(identity.id, family, digest(token), new Date(Date.now() + 7 * 86400000));
  await setAccess({ ...identity, sessionFamily: family });
  (await cookies()).set('pg_refresh', token, { ...options, maxAge: 7 * 86400 });
}
export async function identity(): Promise<Identity> {
  const token = (await cookies()).get('pg_access')?.value;
  assert(token, 401, 'UNAUTHENTICATED', 'Please sign in to continue.');
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(config.jwtSecret), {
      algorithms: ['HS256'],
      issuer: 'pgconnect',
      audience: 'pgconnect-app',
    });
    assert(
      typeof payload.id === 'string' && (payload.role === 'OWNER' || payload.role === 'TENANT'),
      401,
      'INVALID_SESSION',
      'Please sign in again.',
    );
    if (payload.demo) {
      assert(
        config.demo && typeof payload.demo === 'string',
        401,
        'INVALID_SESSION',
        'Demo is unavailable.',
      );
      return {
        id: payload.id,
        role: payload.role,
        name: String(payload.name),
        propertyId: String(payload.propertyId),
        demo: payload.demo,
      };
    }
    const user = await accounts.byId(payload.id);
    assert(user, 401, 'INVALID_SESSION', 'Please sign in again.');
    assert(
      typeof payload.sessionFamily === 'string',
      401,
      'INVALID_SESSION',
      'Please sign in again.',
    );
    const active = await sessions.active(user.id, payload.sessionFamily);
    assert(active, 401, 'SESSION_REVOKED', 'This session was signed out. Please sign in again.');
    return {
      id: user.id,
      role: user.role,
      name: user.name,
      propertyId: user.propertyId,
      sessionFamily: payload.sessionFamily,
    };
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(401, 'SESSION_EXPIRED', 'Your session expired. Please sign in again.');
  }
}
export async function rotateSession() {
  const token = (await cookies()).get('pg_refresh')?.value;
  assert(token, 401, 'UNAUTHENTICATED', 'Please sign in again.');
  const session = await sessions.byToken(digest(token));
  assert(session, 401, 'INVALID_SESSION', 'Please sign in again.');
  if (session.revokedAt) {
    await sessions.revokeFamily(session.family);
    throw new AppError(401, 'TOKEN_REUSE', 'Session revoked. Please sign in again.');
  }
  assert(session.expiresAt > new Date(), 401, 'SESSION_EXPIRED', 'Please sign in again.');
  const rotated = await sessions.consume(session.id);
  assert(rotated.count === 1, 401, 'TOKEN_REUSE', 'Please sign in again.');
  const u = session.user;
  await issueSession(
    { id: u.id, role: u.role, name: u.name, propertyId: u.propertyId },
    session.family,
  );
}
export async function logout() {
  const jar = await cookies();
  const token = jar.get('pg_refresh')?.value;
  if (token) {
    const s = await sessions.byToken(digest(token));
    if (s) await sessions.revokeFamily(s.family);
  }
  jar.delete('pg_access');
  jar.delete('pg_refresh');
}
