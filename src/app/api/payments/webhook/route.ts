import { NextRequest, NextResponse } from 'next/server';
import { receivePaymentWebhook } from '@/server/services/payments';
import { AppError } from '@/server/errors';
export async function POST(req: NextRequest) {
  // Webhooks authenticate the exact raw body with HMAC, not browser cookies or Origin.
  try {
    const reader = req.body?.getReader();
    if (!reader) return NextResponse.json({ error: 'Missing body' }, { status: 400 });
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 65536) {
        await reader.cancel();
        return NextResponse.json({ error: 'Payload too large' }, { status: 413 });
      }
      chunks.push(value);
    }
    const result = await receivePaymentWebhook(
      req.nextUrl.searchParams.get('account') || '',
      Buffer.concat(chunks).toString('utf8'),
      req.headers.get('x-razorpay-signature') || '',
    );
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: 'Webhook could not be processed' },
      {
        status:
          error instanceof AppError
            ? error.status
            : error instanceof SyntaxError || (error instanceof Error && error.name === 'ZodError')
              ? 400
              : 500,
      },
    );
  }
}
