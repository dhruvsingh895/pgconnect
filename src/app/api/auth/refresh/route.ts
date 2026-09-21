import { NextRequest } from 'next/server';
import { endpoint } from '@/server/http';
import { rotateSession } from '@/server/auth/session';
export async function POST(req: NextRequest) {
  return endpoint(req, async () => {
    await rotateSession();
    return { ok: true };
  });
}
