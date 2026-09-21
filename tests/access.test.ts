import { describe, it, expect, vi } from 'vitest';
vi.mock('@/server/db', () => ({ db: {} }));
import { scopeData, actionSchema } from '@/server/services/dashboard';
import { seedData } from '@/features/demo/seed';
describe('property data privacy', () => {
  it('does not expose another tenant’s payments, profile or complaints', () => {
    const d = seedData();
    const scoped = scopeData(
      { id: 'tenant-1', name: 'Aarav', role: 'TENANT', propertyId: d.property.id },
      d,
    );
    expect(scoped.tenants).toHaveLength(1);
    expect(scoped.tenants[0].id).toBe('tenant-1');
    expect(scoped.rents.every((r) => r.tenantId === 'tenant-1')).toBe(true);
    expect(scoped.complaints.every((c) => c.tenantId === 'tenant-1')).toBe(true);
    expect(scoped.property.code).toBe('');
    expect(scoped.announcements.every((a) => a.reads.every((id) => id === 'tenant-1'))).toBe(true);
  });
  it('hides announcements targeted to a different block', () => {
    const d = seedData();
    d.announcements[0].audience = 'Block B';
    expect(
      scopeData(
        { id: 'tenant-1', name: 'Aarav', role: 'TENANT', propertyId: d.property.id },
        d,
      ).announcements.some((a) => a.id === d.announcements[0].id),
    ).toBe(false);
  });
  it('rejects malformed amounts and duplicate menu days', () => {
    expect(
      actionSchema.safeParse({
        type: 'tenant-update',
        id: 't',
        room: 'A1',
        bed: '1',
        rent: -500,
        deposit: 0,
      }).success,
    ).toBe(false);
    const day = { day: 'Monday', breakfast: 'Idli', lunch: 'Rice', dinner: 'Roti' };
    expect(actionSchema.safeParse({ type: 'menu-save', menu: Array(7).fill(day) }).success).toBe(
      false,
    );
  });
});
