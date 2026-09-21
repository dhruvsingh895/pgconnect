import { NextRequest } from 'next/server';
import { z } from 'zod';
import { endpoint, readJson } from '@/server/http';
import { config } from '@/server/config';
import { assert } from '@/server/errors';
import { createDemo } from '@/server/repositories/dashboard';
import { setAccess, logout } from '@/server/auth/session';
export async function POST(req: NextRequest) {
  return endpoint(req, async () => {
    assert(config.demo, 404, 'NOT_FOUND', 'Demo is unavailable.');
    const { role } = z.object({ role: z.enum(['OWNER', 'TENANT']) }).parse(await readJson(req));
    const demo = crypto.randomUUID();
    await createDemo(demo);
    const user = {
      id: role === 'OWNER' ? 'owner-demo' : 'tenant-1',
      name: role === 'OWNER' ? 'Aditya Sharma' : 'Aarav Sharma',
      role,
      propertyId: 'property-demo',
      demo,
    };
    await logout();
    await setAccess(user);
    return { user };
  });
}
