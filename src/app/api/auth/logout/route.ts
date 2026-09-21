import { NextRequest } from 'next/server';
import { endpoint } from '@/server/http';
import { logout } from '@/server/auth/session';
export async function POST(req: NextRequest) {
  return endpoint(req, async () => {
    await logout();
    return { ok: true };
  });
}
