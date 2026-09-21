import type { Identity, Role } from '@/lib/types';
import { assert } from '../errors';
export function requireRole(user: Identity, role: Role) {
  assert(user.role === role, 403, 'FORBIDDEN', 'You do not have access to this action.');
}
export function requireProperty(user: Identity) {
  assert(user.propertyId, 403, 'ONBOARDING_REQUIRED', 'Complete your property setup first.');
  return user.propertyId;
}
