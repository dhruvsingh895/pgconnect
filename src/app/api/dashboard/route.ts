import { NextRequest } from 'next/server';
import { endpoint, readJson } from '@/server/http';
import { identity } from '@/server/auth/session';
import { getDashboard, mutateDashboard } from '@/server/services/dashboard';
export async function GET(req: NextRequest) {
  return endpoint(req, async () => getDashboard(await identity()));
}
export async function POST(req: NextRequest) {
  return endpoint(req, async () => mutateDashboard(await identity(), await readJson(req)));
}
