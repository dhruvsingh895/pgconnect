import assert from 'node:assert/strict';
import { randomUUID, createHmac } from 'node:crypto';
import { db } from '../src/server/db';
import {
  createRentOrder,
  verifyRentPayment,
  receivePaymentWebhook,
  rentPaymentStatus,
  savePaymentSettings,
  paymentSettings,
} from '../src/server/services/payments';
import { loadData, saveData } from '../src/server/repositories/dashboard';
import { mutateDashboard } from '../src/server/services/dashboard';
import type { Identity } from '../src/lib/types';
import type { ProviderPayment } from '../src/server/payments/razorpay';

async function main() {
  const url = new URL(process.env.DATABASE_URL!);
  assert(
    ['localhost', '127.0.0.1'].includes(url.hostname),
    'Run payment integration against local PostgreSQL only',
  );
  const propertyId = randomUUID();
  const tenant: Identity = {
    id: randomUUID(),
    name: 'QA payment tenant',
    role: 'TENANT',
    propertyId,
  };
  const owner: Identity = { id: randomUUID(), name: 'QA payment owner', role: 'OWNER', propertyId };
  const outsider = { ...tenant, id: randomUUID() };
  const rents = [randomUUID(), randomUUID(), randomUUID()];
  const keySecret = 'mock-razorpay-secret-not-a-real-key';
  const webhookSecret = 'mock-webhook-secret-not-a-real-key-1234';
  const orders = new Map<
    string,
    { id: string; amount: number; currency: string; receipt: string }
  >();
  const payments = new Map<string, ProviderPayment>();
  let creates = 0;
  let failOrder = false;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const request = new URL(String(input));
    assert.equal(
      request.origin,
      'https://api.razorpay.com',
      'Never send test data to a real provider',
    );
    const path = request.pathname.replace('/v1/', '');
    if (path === 'orders' && init?.method === 'POST') {
      creates++;
      if (failOrder) throw new Error('Simulated ambiguous network failure');
      const body = JSON.parse(String(init.body));
      const order = {
        id: `order_QA${creates}`,
        amount: body.amount,
        currency: body.currency,
        receipt: body.receipt,
      };
      orders.set(order.id, order);
      return Response.json(order);
    }
    if (path === 'orders')
      return Response.json({
        items: [...orders.values()].filter(
          (order) => order.receipt === request.searchParams.get('receipt'),
        ),
      });
    if (path.startsWith('payments/')) return Response.json(payments.get(path.split('/')[1]));
    if (path.endsWith('/payments'))
      return Response.json({
        items: [...payments.values()].filter((p) => p.order_id === path.split('/')[1]),
      });
    throw new Error('Unexpected provider request');
  };
  try {
    await db.property.create({
      data: {
        id: propertyId,
        name: 'QA Payment PG',
        address: 'Local test only',
        rooms: 1,
        beds: 2,
        code: randomUUID(),
      },
    });
    await db.user.createMany({
      data: [tenant, owner].map((u) => ({ id: u.id, name: u.name, role: u.role, propertyId })),
    });
    await db.rent.createMany({
      data: rents.map((id, i) => ({
        id,
        propertyId,
        tenantId: tenant.id,
        month: `2026-0${i + 1}`,
        amount: 7500,
        dueDate: `2026-0${i + 1}-05`,
      })),
    });
    await assert.rejects(createRentOrder(owner, { rentId: rents[0] }), /access/);
    await assert.rejects(createRentOrder(outsider, { rentId: rents[0] }), /not found/);
    await assert.rejects(createRentOrder(tenant, { rentId: rents[0] }), /not enabled/);
    await assert.rejects(savePaymentSettings(tenant, {}), /access/);
    const settings = await savePaymentSettings(owner, {
      keyId: 'rzp_test_MOCK12345678',
      keySecret,
      webhookSecret,
      confirmed: true,
    });
    assert.equal(settings.configured, true);
    assert(!JSON.stringify(await paymentSettings(owner)).includes(keySecret));
    assert(!JSON.stringify(await loadData(tenant)).includes(keySecret));
    const account = await db.paymentAccount.findFirstOrThrow({ where: { propertyId } });
    assert.notEqual(account.secretEncrypted, keySecret);
    const order = await createRentOrder(tenant, { rentId: rents[0], amount: 1 });
    assert.equal(order.amount, 750000, 'Server ignores caller amount');
    assert.equal((await createRentOrder(tenant, { rentId: rents[0] })).orderId, order.orderId);
    assert.equal(creates, 1, 'Retry reuses the payable order');
    await assert.rejects(
      mutateDashboard(owner, { type: 'rent-status', id: rents[0], paid: true }),
      /online payment/,
    );
    await assert.rejects(
      savePaymentSettings(owner, {
        keyId: 'rzp_test_MOCK12345678',
        keySecret,
        webhookSecret,
        confirmed: true,
      }),
      /Resolve existing/,
    );
    const stale = await loadData(owner);
    const payment: ProviderPayment = {
      id: 'pay_QA1',
      order_id: order.orderId,
      amount: order.amount,
      currency: 'INR',
      status: 'authorized',
      captured: false,
      amount_refunded: 0,
    };
    payments.set(payment.id, payment);
    const signature = createHmac('sha256', keySecret)
      .update(`${order.orderId}|${payment.id}`)
      .digest('hex');
    await assert.rejects(
      verifyRentPayment(tenant, {
        rentId: rents[0],
        orderId: order.orderId,
        paymentId: payment.id,
        signature: '0'.repeat(64),
      }),
      /verified/,
    );
    const verification = {
      rentId: rents[0],
      orderId: order.orderId,
      paymentId: payment.id,
      signature,
    };
    assert.equal((await verifyRentPayment(tenant, verification)).status, 'pending');
    assert.equal((await db.rent.findUniqueOrThrow({ where: { id: rents[0] } })).paidAt, null);
    payment.status = 'captured';
    payment.captured = true;
    const raw = JSON.stringify({
      event: 'payment.captured',
      payload: { payment: { entity: { id: payment.id, order_id: order.orderId } } },
    });
    const signed = createHmac('sha256', webhookSecret).update(raw).digest('hex');
    await assert.rejects(receivePaymentWebhook(account.id, raw + ' ', signed), /signature/);
    await receivePaymentWebhook(account.id, raw, signed);
    const paidAt = (await db.rent.findUniqueOrThrow({ where: { id: rents[0] } })).paidAt;
    assert(paidAt);
    await receivePaymentWebhook(account.id, raw, signed);
    assert.equal((await verifyRentPayment(tenant, verification)).status, 'paid');
    assert.equal((await db.rent.findUniqueOrThrow({ where: { id: rents[0] } })).paidAt, paidAt);
    await assert.rejects(saveData(owner, stale), /workspace changed/);
    await assert.rejects(createRentOrder(tenant, { rentId: rents[0] }), /already been paid/);
    assert.equal((await rentPaymentStatus(tenant, { rentId: rents[0] })).status, 'paid');
    const concurrent = await Promise.allSettled([
      createRentOrder(tenant, { rentId: rents[1] }),
      createRentOrder(tenant, { rentId: rents[1] }),
    ]);
    assert(concurrent.some((r) => r.status === 'fulfilled'));
    assert.equal(creates, 2, 'Concurrent requests create one provider order');
    failOrder = true;
    await assert.rejects(
      createRentOrder(tenant, { rentId: rents[2] }),
      /provider could not be reached/,
    );
    await assert.rejects(createRentOrder(tenant, { rentId: rents[2] }), /status check/);
    assert.equal(creates, 3, 'An ambiguous timeout cannot issue another charge');
    const reserved = await db.paymentOrder.findUniqueOrThrow({ where: { rentId: rents[2] } });
    orders.set('order_Recovered', {
      id: 'order_Recovered',
      receipt: reserved.id,
      amount: reserved.amount,
      currency: 'INR',
    });
    assert.equal((await createRentOrder(tenant, { rentId: rents[2] })).orderId, 'order_Recovered');
    assert.equal(creates, 3, 'A recovered order is reused rather than duplicated');
    payment.amount_refunded = payment.amount;
    payment.status = 'refunded';
    assert.equal((await rentPaymentStatus(owner, { rentId: rents[0] })).status, 'review');
    assert.equal((await db.rent.findUniqueOrThrow({ where: { id: rents[0] } })).paidAt, null);
    await assert.rejects(createRentOrder(tenant, { rentId: rents[0] }), /status check/);
    console.log(
      'Payment integration passed: access control, encryption, server amounts, retries, concurrency, signatures, authorized vs captured, webhooks, replay, stale-write protection, and timeout safety.',
    );
  } finally {
    globalThis.fetch = originalFetch;
    await db.paymentOrder.deleteMany({ where: { rent: { propertyId } } });
    await db.paymentAccount.deleteMany({ where: { propertyId } });
    await db.rent.deleteMany({ where: { propertyId } });
    await db.user.deleteMany({ where: { propertyId } });
    await db.property.delete({ where: { id: propertyId } });
    await db.$disconnect();
  }
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
