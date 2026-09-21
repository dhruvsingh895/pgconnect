import { NextRequest } from 'next/server';
import { z } from 'zod';
import { endpoint, readJson } from '@/server/http';
import { identity } from '@/server/auth/session';
import { createRentOrder, verifyRentPayment, rentPaymentStatus } from '@/server/services/payments';
export async function POST(req: NextRequest) {
  return endpoint(req, async () => {
    const user = await identity();
    const input = z
      .object({ action: z.enum(['create', 'verify', 'status']) })
      .passthrough()
      .parse(await readJson(req));
    if (input.action === 'create') return createRentOrder(user, input);
    if (input.action === 'verify') return verifyRentPayment(user, input);
    return rentPaymentStatus(user, input);
  });
}
