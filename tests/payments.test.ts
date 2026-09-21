import { describe, it, expect } from 'vitest';
import { createHmac } from 'node:crypto';
import {
  validSignature,
  matchesCapturedPayment,
  type ProviderPayment,
} from '@/server/payments/razorpay';
const secret = 'test-only-secret';
const body = 'order_123|pay_456';
const signature = createHmac('sha256', secret).update(body).digest('hex');
const order = { providerOrderId: 'order_123', amount: 750000, currency: 'INR' };
const payment: ProviderPayment = {
  id: 'pay_456',
  order_id: 'order_123',
  amount: 750000,
  currency: 'INR',
  status: 'captured',
  captured: true,
  amount_refunded: 0,
};
describe('payment verification', () => {
  it('accepts authentic signatures and rejects modified bodies, wrong secrets and malformed signatures', () => {
    expect(validSignature(body, signature, secret)).toBe(true);
    expect(validSignature(body + 'x', signature, secret)).toBe(false);
    expect(validSignature(body, signature, 'wrong')).toBe(false);
    for (const value of ['', 'ab', 'g'.repeat(64), signature + '00'])
      expect(validSignature(body, value, secret)).toBe(false);
  });
  it('validates the unmodified raw webhook body', () => {
    const raw = '{ "event": "payment.captured" }';
    const signed = createHmac('sha256', secret).update(raw).digest('hex');
    expect(validSignature(raw, signed, secret)).toBe(true);
    expect(validSignature(JSON.stringify(JSON.parse(raw)), signed, secret)).toBe(false);
  });
  it('requires the exact saved order, amount, currency, captured status and no refund', () => {
    expect(matchesCapturedPayment(payment, order)).toBe(true);
    for (const changed of [
      { order_id: 'order_someoneelse' },
      { amount: 1 },
      { currency: 'USD' },
      { status: 'authorized' },
      { captured: false },
      { amount_refunded: 100 },
    ]) {
      expect(matchesCapturedPayment({ ...payment, ...changed }, order)).toBe(false);
    }
  });
});
