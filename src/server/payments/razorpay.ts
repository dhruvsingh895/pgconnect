import { createHmac, timingSafeEqual } from 'node:crypto';
import { AppError } from '../errors';

export function validSignature(body: string, signature: string, secret: string) {
  if (!/^[a-f\d]{64}$/i.test(signature)) return false;
  const expected = createHmac('sha256', secret).update(body).digest();
  return timingSafeEqual(expected, Buffer.from(signature, 'hex'));
}

export interface ProviderPayment {
  id: string;
  order_id: string;
  amount: number;
  currency: string;
  status: string;
  captured: boolean;
  amount_refunded: number;
}
export function matchesCapturedPayment(
  payment: ProviderPayment,
  order: { providerOrderId: string | null; amount: number; currency: string },
) {
  return (
    payment.order_id === order.providerOrderId &&
    payment.amount === order.amount &&
    payment.currency === order.currency &&
    payment.status === 'captured' &&
    payment.captured === true &&
    payment.amount_refunded === 0
  );
}
export async function razorpay<T>(
  keyId: string,
  secret: string,
  path: string,
  body?: unknown,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`https://api.razorpay.com/v1/${path}`, {
      method: body ? 'POST' : 'GET',
      headers: {
        Authorization: `Basic ${Buffer.from(`${keyId}:${secret}`).toString('base64')}`,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
      cache: 'no-store',
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    throw new AppError(
      503,
      'PAYMENT_PROVIDER_UNAVAILABLE',
      'The payment provider could not be reached. Check payment status before trying again.',
    );
  }
  if (!response.ok)
    throw new AppError(
      502,
      [400, 401, 403, 422].includes(response.status)
        ? 'PAYMENT_REJECTED'
        : 'PAYMENT_PROVIDER_ERROR',
      response.status === 401
        ? 'Razorpay did not accept the account credentials. Ask the PG owner to check payment settings.'
        : 'Razorpay could not complete the request. Please try checking payment status later.',
    );
  return response.json() as Promise<T>;
}
