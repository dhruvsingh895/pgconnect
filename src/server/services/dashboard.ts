import { z } from 'zod';
import type { DashboardData, Identity } from '@/lib/types';
import { loadData, saveData } from '../repositories/dashboard';
import { requireProperty, requireRole } from '../auth/policy';
import { assert } from '../errors';
import { currentMonth, money } from '@/lib/format';
import { generateRentCycle } from '@/features/rent/domain';
import { canTransition } from '@/features/complaints/domain';
import { accounts } from '../repositories/accounts';
import { documents } from '../repositories/documents';
import { setAccess } from '../auth/session';
const text = (max: number) => z.string().trim().min(1).max(max);
const day = z.object({
  day: z.enum(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']),
  breakfast: text(200),
  lunch: text(200),
  dinner: text(200),
});
export const actionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('rent-status'), id: text(100), paid: z.boolean() }),
  z.object({ type: z.literal('rent-cycle'), month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/) }),
  z.object({ type: z.literal('remind'), ids: z.array(text(100)).min(1).max(200) }),
  z.object({
    type: z.literal('complaint-create'),
    title: text(120),
    description: text(2000),
    category: z.enum(['Maintenance', 'Food', 'Housekeeping', 'Other']),
    priority: z.enum(['Low', 'Medium', 'High']),
    photo: z.string().max(100).nullable().default(null),
  }),
  z.object({
    type: z.literal('complaint-update'),
    id: text(100),
    status: z.enum(['Open', 'In progress', 'Resolved']),
    note: z.string().trim().max(2000),
  }),
  z.object({
    type: z.literal('announcement-create'),
    title: text(120),
    body: text(3000),
    audience: text(100),
    image: z.string().max(100).nullable().default(null),
  }),
  z.object({ type: z.literal('announcement-read'), id: text(100) }),
  z.object({
    type: z.literal('menu-save'),
    menu: z
      .array(day)
      .length(7)
      .refine((m) => new Set(m.map((d) => d.day)).size === 7, 'Each day must appear once.'),
  }),
  z.object({
    type: z.literal('property-save'),
    name: text(100),
    address: text(300),
    rooms: z.number().int().min(1).max(10000),
    beds: z.number().int().min(1).max(100000),
    food: z.boolean(),
    notifications: z.boolean(),
  }),
  z.object({ type: z.literal('profile-save'), name: text(100) }),
  z.object({
    type: z.literal('tenant-update'),
    id: text(100),
    room: text(30),
    bed: text(10),
    rent: z.number().int().min(0).max(1000000),
    deposit: z.number().int().min(0).max(10000000),
  }),
  z.object({ type: z.literal('notifications-read') }),
]);
export type Action = z.infer<typeof actionSchema>;
export function scopeData(user: Identity, data: DashboardData): DashboardData {
  if (user.role === 'OWNER') return data;
  const tenant = data.tenants.find((t) => t.id === user.id);
  return {
    ...data,
    property: { ...data.property, code: '' },
    tenants: data.tenants.filter((t) => t.id === user.id),
    rents: data.rents.filter((r) => r.tenantId === user.id),
    complaints: data.complaints.filter((c) => c.tenantId === user.id),
    announcements: data.announcements
      .filter(
        (a) =>
          a.audience === 'All tenants' ||
          a.audience === tenant?.room ||
          a.audience === `Block ${tenant?.room[0]}`,
      )
      .map((a) => ({ ...a, reads: a.reads.filter((id) => id === user.id) })),
    notifications: data.notifications.filter((n) => n.tenantId === user.id),
  };
}
export async function getDashboard(user: Identity) {
  requireProperty(user);
  const data = await loadData(user);
  const newRents = generateRentCycle(data.tenants, data.rents, currentMonth());
  if (newRents.length) {
    data.rents.push(...newRents);
    await saveData(user, data);
  }
  return { user, data: scopeData(user, data) };
}
async function checkAttachment(user: Identity, id: string | null, purpose: string) {
  if (!id) return;
  assert(!user.demo, 400, 'DEMO_UPLOAD', 'Uploads are unavailable in demo mode.');
  assert(
    await documents.verifiedFor(id, user.id, purpose),
    400,
    'INVALID_FILE',
    'Upload a valid file first.',
  );
}
export async function mutateDashboard(user: Identity, input: unknown) {
  requireProperty(user);
  const a = actionSchema.parse(input);
  const data = await loadData(user);
  const now = new Date().toISOString();
  const ownerActions = [
    'rent-status',
    'rent-cycle',
    'remind',
    'complaint-update',
    'announcement-create',
    'menu-save',
    'property-save',
    'tenant-update',
  ];
  if (ownerActions.includes(a.type)) requireRole(user, 'OWNER');
  switch (a.type) {
    case 'rent-status': {
      const r = data.rents.find((r) => r.id === a.id);
      assert(r, 404, 'NOT_FOUND', 'Rent record not found.');
      assert(
        !r.payment,
        409,
        'ONLINE_PAYMENT',
        'This rent has an online payment record. Use payment verification instead of changing its status manually.',
      );
      r.paidAt = a.paid ? now : null;
      break;
    }
    case 'rent-cycle':
      assert(
        a.month <= currentMonth(),
        400,
        'FUTURE_CYCLE',
        'Future rent cycles are not available yet.',
      );
      data.rents.push(...generateRentCycle(data.tenants, data.rents, a.month));
      break;
    case 'remind': {
      assert(
        data.property.notifications,
        400,
        'REMINDERS_DISABLED',
        'Enable in-app reminders in Settings first.',
      );
      const selected = data.rents.filter((r) => a.ids.includes(r.id) && !r.paidAt);
      assert(selected.length, 400, 'NO_PENDING_DUES', 'There are no pending dues to remind.');
      for (const r of selected) {
        const recent = data.notifications.some(
          (n) => n.tenantId === r.tenantId && Date.parse(n.createdAt) > Date.now() - 86400000,
        );
        if (!recent)
          data.notifications.unshift({
            id: crypto.randomUUID(),
            tenantId: r.tenantId,
            text: `A friendly reminder: your rent of ${money(r.amount)} for ${r.month} is pending. Please contact your PG owner to arrange payment.`,
            createdAt: now,
            read: false,
          });
      }
      break;
    }
    case 'complaint-create':
      requireRole(user, 'TENANT');
      await checkAttachment(user, a.photo, 'complaint');
      data.complaints.unshift({
        id: crypto.randomUUID(),
        tenantId: user.id,
        title: a.title,
        description: a.description,
        category: a.category,
        priority: a.priority,
        status: 'Open',
        photo: a.photo,
        createdAt: now,
        notes: [],
      });
      break;
    case 'complaint-update': {
      const c = data.complaints.find((c) => c.id === a.id);
      assert(c, 404, 'NOT_FOUND', 'Complaint not found.');
      assert(
        canTransition(c.status, a.status),
        400,
        'INVALID_TRANSITION',
        'Reopen a resolved complaint before moving it to in progress.',
      );
      assert(
        a.status !== 'Resolved' || a.note.trim(),
        400,
        'NOTE_REQUIRED',
        'Add a resolution note.',
      );
      c.status = a.status;
      c.notes.push({
        text: a.note || `Status changed to ${a.status.toLowerCase()}.`,
        at: now,
        status: a.status,
      });
      break;
    }
    case 'announcement-create':
      assert(
        a.audience === 'All tenants' ||
          data.tenants.some((t) => t.room === a.audience || `Block ${t.room[0]}` === a.audience),
        400,
        'INVALID_AUDIENCE',
        'Choose a valid audience.',
      );
      await checkAttachment(user, a.image, 'announcement');
      data.announcements.unshift({
        id: crypto.randomUUID(),
        title: a.title,
        body: a.body,
        audience: a.audience,
        image: a.image,
        createdAt: now,
        reads: [],
      });
      break;
    case 'announcement-read': {
      requireRole(user, 'TENANT');
      const visible = scopeData(user, data).announcements.some((x) => x.id === a.id);
      assert(visible, 404, 'NOT_FOUND', 'Announcement not found.');
      const announcement = data.announcements.find((x) => x.id === a.id)!;
      if (!announcement.reads.includes(user.id)) announcement.reads.push(user.id);
      break;
    }
    case 'menu-save':
      data.menu = a.menu;
      break;
    case 'property-save':
      assert(
        a.beds >= data.tenants.length,
        400,
        'CAPACITY',
        'Bed capacity cannot be lower than current occupancy.',
      );
      assert(a.beds >= a.rooms, 400, 'CAPACITY', 'There must be at least one bed per room.');
      Object.assign(data.property, {
        name: a.name,
        address: a.address,
        rooms: a.rooms,
        beds: a.beds,
        food: a.food,
        notifications: a.notifications,
      });
      break;
    case 'profile-save': {
      const t = data.tenants.find((t) => t.id === user.id);
      if (t) t.name = a.name;
      else if (!user.demo) await accounts.rename(user.id, a.name);
      user.name = a.name;
      break;
    }
    case 'tenant-update': {
      const t = data.tenants.find((t) => t.id === a.id);
      assert(t, 404, 'NOT_FOUND', 'Tenant not found.');
      assert(
        !data.tenants.some((x) => x.id !== t.id && x.room === a.room && x.bed === a.bed),
        409,
        'BED_OCCUPIED',
        'This bed is already occupied.',
      );
      Object.assign(t, { room: a.room, bed: a.bed, rent: a.rent, deposit: a.deposit });
      break;
    }
    case 'notifications-read':
      data.notifications
        .filter((n) => n.tenantId === user.id)
        .forEach((n) => {
          n.read = true;
        });
      break;
  }
  await saveData(user, data);
  if (a.type === 'profile-save') await setAccess(user);
  return { user, data: scopeData(user, data) };
}
