import { NextRequest } from 'next/server';
import { endpoint, readJson } from '@/server/http';
import { identity } from '@/server/auth/session';
import { paymentSettings, savePaymentSettings } from '@/server/services/payments';
export async function GET(req: NextRequest) {
  return endpoint(req, async () => paymentSettings(await identity()));
}
export async function POST(req: NextRequest) {
  return endpoint(req, async () => savePaymentSettings(await identity(), await readJson(req)));
}
