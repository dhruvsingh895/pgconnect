import { NextRequest } from 'next/server';
import { endpoint } from '@/server/http';
import { identity } from '@/server/auth/session';
export async function GET(req: NextRequest) {
  return endpoint(req, async () => ({ user: await identity() }));
}
