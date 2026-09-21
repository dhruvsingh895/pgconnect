import { NextRequest } from 'next/server';
import { endpoint, readJson } from '@/server/http';
import { authenticate } from '@/server/services/auth';
export const runtime = 'nodejs';
export async function POST(req: NextRequest) {
  return endpoint(req, () => authenticateFromRequest(req));
}
async function authenticateFromRequest(req: NextRequest) {
  return authenticate(await readJson(req), 'global');
}
