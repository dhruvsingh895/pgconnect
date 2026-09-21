import { NextRequest } from 'next/server';
import { endpoint, readJson } from '@/server/http';
import { identity } from '@/server/auth/session';
import { upload, download } from '@/server/services/uploads';
export async function POST(req: NextRequest) {
  return endpoint(req, async () => upload(await identity(), await readJson(req)));
}
export async function GET(req: NextRequest) {
  return endpoint(req, async () =>
    download(await identity(), req.nextUrl.searchParams.get('id') || ''),
  );
}
