import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import path from 'node:path';
import { db } from '../db';
import { decrypt, encrypt } from '../crypto';
import { AppError, assert } from '../errors';
import { seedData } from '@/features/demo/seed';
import type { DashboardData, Identity, Complaint } from '@/lib/types';
const directory = path.join(process.cwd(), '.data', 'demo');
function demoPath(id: string) {
  assert(/^[a-f0-9-]{36}$/.test(id), 400, 'INVALID_DEMO', 'Invalid demo session.');
  return path.join(directory, `${id}.json`);
}
export async function createDemo(id: string) {
  await mkdir(directory, { recursive: true });
  await writeFile(demoPath(id), JSON.stringify(seedData()), { flag: 'wx' });
}
export async function loadData(user: Identity): Promise<DashboardData> {
  if (user.demo) {
    try {
      return JSON.parse(await readFile(demoPath(user.demo), 'utf8')) as DashboardData;
    } catch {
      throw new AppError(401, 'DEMO_EXPIRED', 'Please open a new demo workspace.');
    }
  }
  const p = await db.property.findUnique({
    where: { id: user.propertyId! },
    include: {
      users: {
        where: { role: 'TENANT' },
        include: { documents: { where: { verified: true, purpose: 'kyc' } } },
      },
      rents: { include: { paymentOrder: { select: { status: true, providerPaymentId: true } } } },
      paymentAccounts: { where: { enabled: true }, select: { id: true }, take: 1 },
      complaints: { orderBy: { createdAt: 'desc' } },
      announcements: { include: { reads: true }, orderBy: { createdAt: 'desc' } },
      menu: true,
    },
  });
  assert(p, 404, 'NOT_FOUND', 'Property not found.');
  const notifications = await db.notification.findMany({
    where: { tenant: { propertyId: p.id } },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });
  return {
    property: {
      id: p.id,
      name: p.name,
      address: p.address,
      rooms: p.rooms,
      beds: p.beds,
      food: p.food,
      code: p.code,
      notifications: p.notifications,
      onlinePayments: p.paymentAccounts.length > 0,
    },
    revision: p.revision,
    tenants: p.users.map((t) => ({
      id: t.id,
      name: t.name,
      email: t.email || '',
      phone: t.phoneEncrypted ? decrypt(t.phoneEncrypted) : '',
      room: t.room,
      bed: t.bed,
      moveIn: t.moveIn,
      rent: t.rent,
      deposit: t.deposit,
      documents: t.documents.map((d) => d.id),
    })),
    rents: p.rents.map((r) => ({
      id: r.id,
      tenantId: r.tenantId,
      month: r.month,
      amount: r.amount,
      dueDate: r.dueDate,
      paidAt: r.paidAt,
      ...(r.paymentOrder
        ? {
            payment: { status: r.paymentOrder.status, reference: r.paymentOrder.providerPaymentId },
          }
        : {}),
    })),
    complaints: p.complaints.map((c) => ({
      id: c.id,
      tenantId: c.tenantId,
      title: c.title,
      description: c.description,
      category: c.category,
      priority: c.priority,
      status: c.status as Complaint['status'],
      createdAt: c.createdAt.toISOString(),
      photo: c.photo,
      notes: c.notes as unknown as Complaint['notes'],
    })),
    announcements: p.announcements.map((a) => ({
      id: a.id,
      title: a.title,
      body: a.body,
      audience: a.audience,
      createdAt: a.createdAt.toISOString(),
      reads: a.reads.map((r) => r.userId),
      image: a.image,
    })),
    menu: p.menu.map((m) => ({
      day: m.day,
      breakfast: m.breakfast,
      lunch: m.lunch,
      dinner: m.dinner,
    })),
    notifications: notifications.map((n) => ({ ...n, createdAt: n.createdAt.toISOString() })),
  };
}
const locks = new Map<string, Promise<void>>();
export async function saveData(user: Identity, data: DashboardData) {
  if (user.demo) {
    const key = user.demo;
    const previous = locks.get(key) || Promise.resolve();
    let release!: () => void;
    const pending = new Promise<void>((r) => {
      release = r;
    });
    locks.set(key, pending);
    await previous;
    try {
      const current = await loadData(user);
      assert(
        current.revision === data.revision,
        409,
        'CONFLICT',
        'This workspace changed. Refresh and try again.',
      );
      data.revision++;
      const file = demoPath(key);
      const temp = `${file}.${crypto.randomUUID()}.tmp`;
      await writeFile(temp, JSON.stringify(data));
      await rename(temp, file);
    } finally {
      release();
      if (locks.get(key) === pending) locks.delete(key);
    }
    return;
  }
  await db.$transaction(
    async (tx) => {
      const { id, onlinePayments: _onlinePayments, ...property } = data.property;
      void _onlinePayments;
      const updated = await tx.property.updateMany({
        where: { id, revision: data.revision },
        data: { ...property, revision: { increment: 1 } },
      });
      assert(
        updated.count === 1,
        409,
        'CONFLICT',
        'This workspace changed. Refresh and try again.',
      );
      for (const t of data.tenants)
        await tx.user.updateMany({
          where: { id: t.id, propertyId: id, role: 'TENANT' },
          data: {
            name: t.name,
            phoneEncrypted: t.phone ? encrypt(t.phone) : null,
            room: t.room,
            bed: t.bed,
            moveIn: t.moveIn,
            rent: t.rent,
            deposit: t.deposit,
          },
        });
      for (const r of data.rents)
        await tx.rent.upsert({
          where: { id: r.id },
          create: {
            id: r.id,
            tenantId: r.tenantId,
            month: r.month,
            amount: r.amount,
            dueDate: r.dueDate,
            paidAt: r.paidAt,
            propertyId: id,
          },
          update: { paidAt: r.paidAt },
        });
      for (const c of data.complaints)
        await tx.complaint.upsert({
          where: { id: c.id },
          create: { ...c, propertyId: id, createdAt: new Date(c.createdAt) },
          update: { status: c.status, notes: c.notes },
        });
      for (const a of data.announcements) {
        const { reads, ...fields } = a;
        await tx.announcement.upsert({
          where: { id: a.id },
          create: { ...fields, propertyId: id, createdAt: new Date(a.createdAt) },
          update: {},
        });
        if (reads.length)
          await tx.announcementRead.createMany({
            data: reads.map((userId) => ({ announcementId: a.id, userId })),
            skipDuplicates: true,
          });
      }
      for (const m of data.menu)
        await tx.menuDay.upsert({
          where: { propertyId_day: { propertyId: id, day: m.day } },
          create: { ...m, propertyId: id },
          update: m,
        });
      for (const n of data.notifications)
        await tx.notification.upsert({
          where: { id: n.id },
          create: { ...n, createdAt: new Date(n.createdAt) },
          update: { read: n.read },
        });
    },
    { timeout: 20000 },
  );
}
