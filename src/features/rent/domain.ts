import type { Rent, Tenant } from '@/lib/types';
export function generateRentCycle(tenants: Tenant[], rents: Rent[], month: string): Rent[] {
  return tenants
    .filter(
      (t) =>
        t.room !== 'Unassigned' &&
        t.rent > 0 &&
        t.moveIn.slice(0, 7) <= month &&
        !rents.some((r) => r.tenantId === t.id && r.month === month),
    )
    .map((t) => ({
      id: crypto.randomUUID(),
      tenantId: t.id,
      month,
      amount: t.rent,
      dueDate: `${month}-05`,
      paidAt: null,
    }));
}
export function rentTotals(rents: Rent[]) {
  return rents.reduce(
    (sum, r) => ({
      collected: sum.collected + (r.paidAt ? r.amount : 0),
      pending: sum.pending + (!r.paidAt ? r.amount : 0),
    }),
    { collected: 0, pending: 0 },
  );
}
