import { NextRequest } from 'next/server';
import { endpoint, readJson } from '@/server/http';
import { identity } from '@/server/auth/session';
import { onboard } from '@/server/services/onboarding';
export async function POST(req: NextRequest) {
  return endpoint(req, async () => onboard(await identity(), await readJson(req)));
}
