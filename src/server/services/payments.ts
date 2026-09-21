import { z } from 'zod';
import { db } from '../db';
import { encrypt, decrypt } from '../crypto';
import { config } from '../config';
import { assert, AppError } from '../errors';
import { requireProperty, requireRole } from '../auth/policy';
import { rateLimit } from '../auth/rate-limit';
import type { Identity } from '@/lib/types';
import {
  razorpay,
  validSignature,
  matchesCapturedPayment,
  type ProviderPayment,
} from '../payments/razorpay';

const identifier = z.string().regex(/^[A-Za-z0-9_-]{1,100}$/);
const settingsSchema = z.object({
  keyId: z.string().regex(/^rzp_(live|test)_[A-Za-z0-9]{8,80}$/),
  keySecret: z.string().trim().min(12).max(200),
  webhookSecret: z.string().trim().min(32).max(200),
  confirmed: z.literal(true),
});
function realUser(user: Identity) {
  const propertyId = requireProperty(user);
  assert(!user.demo, 400, 'DEMO_PAYMENT', 'Payments cannot be made or configured in demo mode.');
  return propertyId;
}
export async function paymentSettings(user: Identity) {
  const propertyId = realUser(user);
  requireRole(user, 'OWNER');
  const account = await db.paymentAccount.findFirst({ where: { propertyId, enabled: true } });
  return {
    configured: !!account,
    keyId: account?.keyId ?? '',
    webhookUrl: account ? `${config.origin}/api/payments/webhook?account=${account.id}` : '',
  };
}
export async function savePaymentSettings(user: Identity, input: unknown) {
  const propertyId = realUser(user);
  requireRole(user, 'OWNER');
  const values = settingsSchema.parse(input);
  assert(
    !config.production || values.keyId.startsWith('rzp_live_'),
    400,
    'TEST_KEY',
    'Use live Razorpay keys on the public website. Test keys are only allowed in local development.',
  );
  await rateLimit('payment-settings', user.id, 5);
  // Validate credentials without creating a charge or exposing provider response details.
  await razorpay(values.keyId, values.keySecret, 'orders?count=1');
  await db.$transaction(async (tx) => {
    await tx.property.update({ where: { id: propertyId }, data: { revision: { increment: 1 } } });
    const pending = await tx.paymentOrder.count({
      where: { rent: { propertyId }, status: { notIn: ['CAPTURED', 'REFUNDED'] } },
    });
    assert(
      !pending,
      409,
      'PAYMENTS_PENDING',
      'Resolve existing online payments before changing the receiving account.',
    );
    await tx.paymentAccount.updateMany({
      where: { propertyId, enabled: true },
      data: { enabled: false },
    });
    await tx.paymentAccount.create({
      data: {
        propertyId,
        keyId: values.keyId,
        secretEncrypted: encrypt(values.keySecret),
        webhookSecretEncrypted: encrypt(values.webhookSecret),
      },
    });
  });
  return paymentSettings(user);
}
async function tenantRent(user: Identity, rentId: string) {
  const propertyId = realUser(user);
  requireRole(user, 'TENANT');
  const rent = await db.rent.findFirst({
    where: { id: rentId, tenantId: user.id, propertyId },
    include: { property: true },
  });
  assert(rent, 404, 'RENT_NOT_FOUND', 'Rent record not found.');
  return rent;
}
async function reconcile(orderId: string, paymentId?: string) {
  let order = await db.paymentOrder.findUniqueOrThrow({
    where: { id: orderId },
    include: { account: true, rent: true },
  });
  const secret = decrypt(order.account.secretEncrypted);
  if (!order.providerOrderId) {
    const recovered = await razorpay<{
      items: { id: string; receipt: string; amount: number; currency: string }[];
    }>(order.account.keyId, secret, `orders?receipt=${encodeURIComponent(order.id)}&count=2`);
    const matches = recovered.items.filter(
      (item) =>
        item.receipt === order.id &&
        item.amount === order.amount &&
        item.currency === order.currency &&
        /^order_[A-Za-z0-9]+$/.test(item.id),
    );
    if (matches.length !== 1) return { status: 'processing' as const };
    await db.paymentOrder.updateMany({
      where: { id: order.id, providerOrderId: null },
      data: { providerOrderId: matches[0].id, status: 'CREATED' },
    });
    order = await db.paymentOrder.findUniqueOrThrow({
      where: { id: order.id },
      include: { account: true, rent: true },
    });
  }
  let payments: ProviderPayment[];
  if (paymentId)
    payments = [
      await razorpay<ProviderPayment>(
        order.account.keyId,
        secret,
        `payments/${encodeURIComponent(paymentId)}`,
      ),
    ];
  else
    payments = (
      await razorpay<{ items: ProviderPayment[] }>(
        order.account.keyId,
        secret,
        `orders/${encodeURIComponent(order.providerOrderId!)}/payments`,
      )
    ).items;
  assert(
    Array.isArray(payments),
    502,
    'INVALID_PROVIDER_RESPONSE',
    'Payment status is unavailable. Please try again later.',
  );
  const captured = payments.find((p) => matchesCapturedPayment(p, order));
  const refunded = payments.find(
    (p) =>
      p.order_id === order.providerOrderId &&
      p.amount === order.amount &&
      p.currency === order.currency &&
      p.amount_refunded > 0,
  );
  if (refunded) {
    await db.$transaction(async (tx) => {
      await tx.property.update({
        where: { id: order.rent.propertyId },
        data: { revision: { increment: 1 } },
      });
      await tx.paymentOrder.update({
        where: { id: order.id },
        data: { status: 'REVIEW', providerPaymentId: refunded.id },
      });
      await tx.rent.update({ where: { id: order.rentId }, data: { paidAt: null } });
    });
    return { status: 'review' as const };
  }
  if (order.status === 'REVIEW') return { status: 'review' as const };
  if (!captured)
    return { status: order.status === 'CAPTURED' ? ('paid' as const) : ('pending' as const) };
  return db.$transaction(async (tx) => {
    // The same property lock is used by dashboard mutations, preventing stale writes to paidAt.
    await tx.property.update({
      where: { id: order.rent.propertyId },
      data: { revision: { increment: 1 } },
    });
    const fresh = await tx.paymentOrder.findUniqueOrThrow({
      where: { id: order.id },
      include: { rent: true },
    });
    if (fresh.status === 'REVIEW') return { status: 'review' as const };
    if (fresh.status === 'CAPTURED')
      return { status: 'paid' as const, paymentId: fresh.providerPaymentId };
    if (fresh.rent.paidAt || fresh.rent.amount * 100 !== order.amount) {
      await tx.paymentOrder.update({
        where: { id: order.id },
        data: { status: 'REVIEW', providerPaymentId: captured.id },
      });
      return { status: 'review' as const };
    }
    const now = new Date();
    await tx.paymentOrder.update({
      where: { id: order.id },
      data: { status: 'CAPTURED', providerPaymentId: captured.id, capturedAt: now },
    });
    await tx.rent.update({ where: { id: order.rentId }, data: { paidAt: now.toISOString() } });
    return { status: 'paid' as const, paymentId: captured.id };
  });
}
export async function createRentOrder(user: Identity, input: unknown) {
  const { rentId } = z.object({ rentId: identifier }).parse(input);
  const rent = await tenantRent(user, rentId);
  assert(
    !rent.paidAt,
    409,
    'ALREADY_PAID',
    'This rent has already been paid. Refresh your payments.',
  );
  assert(
    rent.amount > 0 && Number.isSafeInteger(rent.amount * 100),
    400,
    'INVALID_AMOUNT',
    'The PG owner must assign a valid rent amount first.',
  );
  await rateLimit('payment-order', user.id, 20);
  const existing = await db.paymentOrder.findUnique({
    where: { rentId },
    include: { account: true },
  });
  if (existing) {
    const result = await reconcile(existing.id);
    const refreshed = await db.paymentOrder.findUniqueOrThrow({ where: { id: existing.id } });
    assert(
      result.status !== 'paid',
      409,
      'ALREADY_PAID',
      'Payment received. Refresh your rent history.',
    );
    assert(
      refreshed.providerOrderId && refreshed.status === 'CREATED' && result.status !== 'review',
      409,
      'PAYMENT_PROCESSING',
      'This payment needs a status check. Do not pay again; contact your PG owner if it remains unresolved.',
    );
    return {
      keyId: existing.account.keyId,
      orderId: refreshed.providerOrderId,
      amount: existing.amount,
      currency: existing.currency,
      name: rent.property.name,
    };
  }
  const order = await db.$transaction(async (tx) => {
    await tx.property.update({
      where: { id: rent.propertyId },
      data: { revision: { increment: 1 } },
    });
    const current = await tx.rent.findUniqueOrThrow({ where: { id: rentId } });
    assert(!current.paidAt, 409, 'ALREADY_PAID', 'This rent has already been paid.');
    const account = await tx.paymentAccount.findFirst({
      where: { propertyId: rent.propertyId, enabled: true },
    });
    assert(
      account,
      409,
      'PAYMENTS_NOT_CONFIGURED',
      'Your PG owner has not enabled online payments yet.',
    );
    return tx.paymentOrder.create({
      data: { rentId, accountId: account.id, amount: current.amount * 100 },
      include: { account: true },
    });
  });
  // Reserve one durable order per rent before contacting Razorpay. An ambiguous network
  // failure leaves it locked for reconciliation rather than issuing a second payable order.
  const remote = await razorpay<{ id: string; amount: number; currency: string }>(
    order.account.keyId,
    decrypt(order.account.secretEncrypted),
    'orders',
    { amount: order.amount, currency: 'INR', receipt: order.id, notes: { rentId } },
  ).catch(async (error) => {
    if (error instanceof AppError && error.code === 'PAYMENT_REJECTED') {
      await db.paymentOrder.deleteMany({
        where: { id: order.id, providerOrderId: null, status: 'CREATING' },
      });
    }
    throw error;
  });
  assert(
    /^order_[A-Za-z0-9]+$/.test(remote.id) &&
      remote.amount === order.amount &&
      remote.currency === 'INR',
    502,
    'INVALID_ORDER',
    'The payment order could not be confirmed. Please contact your PG owner.',
  );
  await db.paymentOrder.update({
    where: { id: order.id },
    data: { providerOrderId: remote.id, status: 'CREATED' },
  });
  return {
    keyId: order.account.keyId,
    orderId: remote.id,
    amount: order.amount,
    currency: 'INR',
    name: rent.property.name,
  };
}
export async function verifyRentPayment(user: Identity, input: unknown) {
  const values = z
    .object({
      rentId: identifier,
      paymentId: identifier,
      orderId: identifier,
      signature: z.string().max(128),
    })
    .parse(input);
  await tenantRent(user, values.rentId);
  await rateLimit('payment-verify', user.id, 30);
  const order = await db.paymentOrder.findUnique({
    where: { rentId: values.rentId },
    include: { account: true },
  });
  assert(
    order?.providerOrderId && order.providerOrderId === values.orderId,
    400,
    'INVALID_ORDER',
    'The payment order does not match this rent.',
  );
  assert(
    validSignature(
      `${order.providerOrderId}|${values.paymentId}`,
      values.signature,
      decrypt(order.account.secretEncrypted),
    ),
    400,
    'INVALID_SIGNATURE',
    'The payment could not be verified. Use Check payment status before trying again.',
  );
  return reconcile(order.id, values.paymentId);
}
export async function rentPaymentStatus(user: Identity, input: unknown) {
  const { rentId } = z.object({ rentId: identifier }).parse(input);
  const propertyId = realUser(user);
  const rent = await db.rent.findFirst({
    where: { id: rentId, propertyId, ...(user.role === 'TENANT' ? { tenantId: user.id } : {}) },
  });
  assert(rent, 404, 'RENT_NOT_FOUND', 'Rent record not found.');
  await rateLimit('payment-status', user.id, 60);
  const order = await db.paymentOrder.findUnique({ where: { rentId } });
  return order ? reconcile(order.id) : { status: rent.paidAt ? 'paid' : 'pending' };
}
export async function receivePaymentWebhook(accountId: string, raw: string, signature: string) {
  identifier.parse(accountId);
  const account = await db.paymentAccount.findUnique({ where: { id: accountId } });
  assert(
    account && validSignature(raw, signature, decrypt(account.webhookSecretEncrypted)),
    400,
    'INVALID_SIGNATURE',
    'Invalid webhook signature.',
  );
  const event = z
    .object({
      event: z.string(),
      payload: z.object({
        payment: z
          .object({ entity: z.object({ id: identifier, order_id: identifier.nullable() }) })
          .optional(),
      }),
    })
    .parse(JSON.parse(raw));
  if (
    !['payment.captured', 'payment.authorized', 'payment.refunded'].includes(event.event) ||
    !event.payload.payment?.entity.order_id
  )
    return { received: true };
  const payment = event.payload.payment.entity;
  const order = await db.paymentOrder.findFirst({
    where: { accountId, providerOrderId: payment.order_id },
  });
  if (order) await reconcile(order.id, payment.id);
  return { received: true };
}
