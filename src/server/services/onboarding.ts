import { z } from 'zod';
import { createPropertyForOwner, joinProperty } from '../repositories/properties';
import { assert } from '../errors';
import { inviteCode } from './auth';
import { encrypt } from '../crypto';
import { setAccess } from '../auth/session';
import type { Identity } from '@/lib/types';
const schema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('owner'),
    name: z.string().trim().min(2).max(100),
    address: z.string().trim().min(5).max(300),
    rooms: z.number().int().min(1).max(10000),
    beds: z.number().int().min(1).max(100000),
    food: z.boolean(),
  }),
  z.object({
    type: z.literal('tenant'),
    code: z.string().trim().min(4).max(30),
    phone: z.string().regex(/^\+91[6-9]\d{9}$/),
    moveIn: z.iso.date(),
  }),
]);
export async function onboard(user: Identity, input: unknown) {
  assert(!user.propertyId, 409, 'ALREADY_ONBOARDED', 'Your account already belongs to a PG.');
  const a = schema.parse(input);
  let propertyId: string;
  if (a.type === 'owner') {
    assert(user.role === 'OWNER', 403, 'FORBIDDEN', 'Only owners can create a PG.');
    assert(a.beds >= a.rooms, 400, 'CAPACITY', 'Beds must be at least the number of rooms.');
    propertyId = await createPropertyForOwner(user.id, {
      name: a.name,
      address: a.address,
      rooms: a.rooms,
      beds: a.beds,
      food: a.food,
      code: inviteCode(),
    });
  } else {
    assert(user.role === 'TENANT', 403, 'FORBIDDEN', 'Only tenants can join a PG.');
    propertyId = await joinProperty(user.id, a.code.toUpperCase(), encrypt(a.phone), a.moveIn);
  }
  const next = { ...user, propertyId };
  await setAccess(next);
  return { user: next };
}
