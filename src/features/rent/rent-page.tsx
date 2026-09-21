'use client';
import { useState } from 'react';
import { Wallet, CheckCircle2, Clock3, Send, Plus, Search } from 'lucide-react';
import { useDashboard } from '@/features/dashboard/context';
import { Avatar, Badge, StatCard, Table, EmptyState } from '@/components/ui/primitives';
import { money, date, currentMonth, monthLabel, isOverdue } from '@/lib/format';
import { rentTotals } from './domain';
import { PayRent } from './pay-rent';
import Link from 'next/link';
export function RentPage() {
  const { data, user, mutate, busy } = useDashboard();
  const owner = user.role === 'OWNER';
  const [month, setMonth] = useState(currentMonth());
  const [status, setStatus] = useState('All payments');
  const [search, setSearch] = useState('');
  const all = data.rents.filter((r) => r.month === month);
  const totals = rentTotals(all);
  const list = all.filter((r) => {
    const t = data.tenants.find((t) => t.id === r.tenantId);
    return (
      (status === 'All payments' ||
        (status === 'Paid'
          ? !!r.paidAt
          : status === 'Overdue'
            ? !r.paidAt && isOverdue(r.dueDate)
            : !r.paidAt)) &&
      t?.name.toLowerCase().includes(search.toLowerCase())
    );
  });
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="page-eyebrow">A LITTLE CLARITY FOR EVERY PAYMENT</span>
          <h1>{owner ? 'Rent & dues' : 'My dues & payments'}</h1>
          <p>
            {owner
              ? 'Track rent, follow up gently, and keep things moving.'
              : 'Your rent history and what’s coming up next.'}
          </p>
        </div>
        {owner && (
          <button
            className="button primary"
            disabled={busy}
            onClick={() => void mutate({ type: 'rent-cycle', month })}
          >
            <Plus size={16} /> Generate monthly rent
          </button>
        )}
      </div>
      {!data.property.onlinePayments && (
        <div className="payment-notice">
          <Wallet size={18} />
          <span>
            {owner
              ? 'Enable online rent collection so tenants can pay from their dashboard.'
              : 'Your PG owner has not enabled online payments yet. Contact them to arrange payment.'}
          </span>
          {owner && (
            <Link className="text-link" href="/owner/settings">
              Set up payments →
            </Link>
          )}
        </div>
      )}
      <div className="stats-grid three">
        <StatCard
          label="Total rent"
          value={money(totals.collected + totals.pending)}
          icon={<Wallet size={20} />}
          detail={monthLabel(month)}
        />
        <StatCard
          label="Collected"
          value={money(totals.collected)}
          icon={<CheckCircle2 size={20} />}
          detail={`${all.filter((r) => r.paidAt).length} payments received`}
        />
        <StatCard
          label="Outstanding"
          value={money(totals.pending)}
          icon={<Clock3 size={20} />}
          detail={`${all.filter((r) => !r.paidAt).length} payments pending`}
          accent
        />
      </div>
      <section className="panel">
        <div className="toolbar">
          <div className="toolbar-group">
            {owner && (
              <div className="search-input">
                <Search size={17} />
                <input
                  aria-label="Search payments"
                  placeholder="Search tenants…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            )}
            <input
              aria-label="Rent month"
              type="month"
              value={month}
              max={currentMonth()}
              onChange={(e) => setMonth(e.target.value || currentMonth())}
            />
            <select
              aria-label="Payment status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option>All payments</option>
              <option>Pending</option>
              <option>Paid</option>
              <option>Overdue</option>
            </select>
          </div>
          {owner && all.some((r) => !r.paidAt) && (
            <button
              className="button secondary"
              disabled={busy}
              onClick={() =>
                void mutate({ type: 'remind', ids: all.filter((r) => !r.paidAt).map((r) => r.id) })
              }
            >
              <Send size={15} /> Send reminders
            </button>
          )}
        </div>
        {list.length ? (
          <Table
            headings={[
              owner ? 'Tenant' : 'Month',
              'Due date',
              'Amount',
              'Status',
              owner ? 'Actions' : 'Payment',
            ]}
          >
            {list.map((r) => {
              const t = data.tenants.find((t) => t.id === r.tenantId)!;
              return (
                <tr key={r.id}>
                  <td>
                    {owner ? (
                      <div className="person-cell">
                        <Avatar name={t.name} />
                        <div>
                          <strong>{t.name}</strong>
                          <small>
                            {t.room} · Bed {t.bed}
                          </small>
                        </div>
                      </div>
                    ) : (
                      monthLabel(r.month)
                    )}
                  </td>
                  <td className="muted">{date(r.dueDate)}</td>
                  <td className="amount-cell">{money(r.amount)}</td>
                  <td>
                    <Badge tone={r.paidAt ? 'green' : isOverdue(r.dueDate) ? 'red' : 'amber'}>
                      {r.payment?.status === 'REVIEW'
                        ? 'Needs review'
                        : r.paidAt
                          ? 'Paid'
                          : isOverdue(r.dueDate)
                            ? 'Overdue'
                            : 'Pending'}
                    </Badge>
                  </td>
                  <td>
                    {owner ? (
                      r.payment ? (
                        <span className="field-hint">
                          {r.payment.status === 'CAPTURED'
                            ? 'Verified online'
                            : r.payment.status === 'REVIEW'
                              ? 'Payment needs review'
                              : 'Online payment started'}
                        </span>
                      ) : (
                        <button
                          className={`button small ${r.paidAt ? 'ghost' : 'secondary'}`}
                          disabled={busy}
                          onClick={() =>
                            void mutate({ type: 'rent-status', id: r.id, paid: !r.paidAt })
                          }
                        >
                          {r.paidAt ? 'Mark pending' : 'Mark as paid'}
                        </button>
                      )
                    ) : r.paidAt ? (
                      date(r.paidAt)
                    ) : (
                      <PayRent rent={r} />
                    )}
                    {owner && r.payment && <PayRent rent={r} />}
                    {r.payment?.reference && (
                      <small className="payment-reference">{r.payment.reference}</small>
                    )}
                  </td>
                </tr>
              );
            })}
          </Table>
        ) : (
          <EmptyState
            title="No payments to show"
            description="Try another month or change the payment filter."
          />
        )}
        <div className="panel-footer">
          <span>{list.length} payment records</span>
          <span>
            {owner
              ? 'Online payments are verified automatically. Record offline payments manually.'
              : 'Online rent is marked paid only after Razorpay confirms the payment.'}
          </span>
        </div>
      </section>
    </>
  );
}
