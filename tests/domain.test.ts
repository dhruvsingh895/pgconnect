import { describe, it, expect } from 'vitest';
import { generateRentCycle, rentTotals } from '@/features/rent/domain';
import { canTransition } from '@/features/complaints/domain';
import { seedData } from '@/features/demo/seed';
import { requireRole } from '@/server/auth/policy';
describe('monthly rent accounting', () => {
  it('does not bill until a room and positive rent are assigned', () => {
    const d = seedData();
    d.tenants[0].room = 'Unassigned';
    d.tenants[1].rent = 0;
    expect(generateRentCycle(d.tenants, [], '2027-01')).toHaveLength(d.tenants.length - 2);
  });
  it('does not create duplicate monthly obligations', () => {
    const d = seedData();
    const month = d.rents[0].month;
    expect(generateRentCycle(d.tenants, d.rents, month)).toEqual([]);
  });
  it('only bills tenants who have moved in by the selected month', () => {
    const d = seedData();
    d.tenants[0].moveIn = '2027-04-01';
    const result = generateRentCycle(d.tenants, [], '2027-03');
    expect(result).toHaveLength(d.tenants.length - 1);
    expect(result.some((r) => r.tenantId === d.tenants[0].id)).toBe(false);
    expect(result.every((r) => r.dueDate === '2027-03-05')).toBe(true);
  });
  it('reconciles collected and pending against all rent', () => {
    const d = seedData();
    const totals = rentTotals(d.rents);
    expect(totals.collected + totals.pending).toBe(d.rents.reduce((n, r) => n + r.amount, 0));
    expect(totals.pending).toBe(35000);
  });
});
describe('complaint workflow', () => {
  it('allows open complaints to be resolved directly', () =>
    expect(canTransition('Open', 'Resolved')).toBe(true));
  it('requires a resolved complaint to be reopened before work resumes', () => {
    expect(canTransition('Resolved', 'In progress')).toBe(false);
    expect(canTransition('Resolved', 'Open')).toBe(true);
  });
});
describe('server role policy', () => {
  it('rejects a tenant from owner-only actions with a 403', () => {
    expect(() =>
      requireRole({ id: 't', name: 'Tenant', role: 'TENANT', propertyId: 'p' }, 'OWNER'),
    ).toThrow(expect.objectContaining({ status: 403, code: 'FORBIDDEN' }));
  });
  it('allows owner access', () =>
    expect(() =>
      requireRole({ id: 'o', name: 'Owner', role: 'OWNER', propertyId: 'p' }, 'OWNER'),
    ).not.toThrow());
});
