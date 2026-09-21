'use client';
import Link from 'next/link';
import {
  Users,
  BedDouble,
  Wallet,
  MessagesSquare,
  ArrowRight,
  Plus,
  ArrowUpRight,
  CalendarDays,
  Sun,
  Coffee,
  Utensils,
  Moon,
  Megaphone,
  CheckCircle2,
  Clock3,
  Building2,
} from 'lucide-react';
import { useDashboard } from './context';
import { Avatar, Badge, StatCard, Table, EmptyState } from '@/components/ui/primitives';
import { money, currentMonth, monthLabel, isOverdue, date } from '@/lib/format';
import { rentTotals } from '@/features/rent/domain';
export function Overview({ onInvite }: { onInvite: () => void }) {
  const { user, data, mutate, busy } = useDashboard();
  const owner = user.role === 'OWNER';
  const month = currentMonth();
  const rents = data.rents.filter((r) => r.month === month);
  const totals = rentTotals(rents);
  const pending = rents.filter((r) => !r.paidAt);
  const open = data.complaints.filter((c) => c.status !== 'Resolved');
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long' });
  const menu = data.menu.find((m) => m.day === today);
  const base = `/${user.role.toLowerCase()}`;
  const announcement = data.announcements[0];
  const occupancy = Math.round((data.tenants.length / data.property.beds) * 100);
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="page-eyebrow">
            <span className="sun-mark">
              <Sun size={14} />
            </span>{' '}
            YOUR EVERYDAY, AT A GLANCE
          </div>
          <h1>
            Welcome back, {user.name.split(' ')[0]} <span className="greeting-dot">.</span>
          </h1>
          <p>
            {owner
              ? 'Here’s what’s happening at your PG today.'
              : 'A little update from your home away from home.'}
          </p>
        </div>
        <div className="heading-actions">
          <span className="date-chip">
            <CalendarDays size={15} />
            {new Date().toLocaleDateString('en-IN', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            })}
          </span>
          {owner && (
            <button className="button primary" onClick={onInvite}>
              <Plus size={17} /> Add tenant
            </button>
          )}
        </div>
      </div>
      <div className="stats-grid">
        {owner ? (
          <>
            <StatCard
              label="Total tenants"
              value={data.tenants.length.toString().padStart(2, '0')}
              icon={<Users size={20} />}
              detail={
                <>
                  <span className="small-green-dot" /> At home in {data.property.name}
                </>
              }
            />
            <StatCard
              label="Bed occupancy"
              value={
                <>
                  {data.tenants.length}
                  <span className="stat-denominator"> / {data.property.beds}</span>
                </>
              }
              icon={<BedDouble size={20} />}
              detail={
                <>
                  <span className="occupancy-mini">
                    <i style={{ width: `${occupancy}%` }} />
                  </span>
                  <strong>{data.property.beds - data.tenants.length} beds available</strong>
                </>
              }
            />
            <StatCard
              label="Pending dues"
              value={money(totals.pending)}
              icon={<Wallet size={20} />}
              detail={
                <>
                  <span className="amber-text">{pending.length} tenants</span> yet to pay this month
                </>
              }
              accent
            />
            <StatCard
              label="Open complaints"
              value={String(open.length).padStart(2, '0')}
              icon={<MessagesSquare size={20} />}
              detail={
                <>
                  <span className="amber-text">
                    {open.filter((c) => c.priority === 'High').length} high priority
                  </span>{' '}
                  needs attention
                </>
              }
            />
          </>
        ) : (
          <>
            <StatCard
              label="Your current dues"
              value={money(totals.pending)}
              icon={<Wallet size={20} />}
              detail={
                pending.length ? 'Due by the 5th of each month' : 'You’re all paid up. Thank you!'
              }
            />
            <StatCard
              label="Your room"
              value={data.tenants[0]?.room || 'Unassigned'}
              icon={<BedDouble size={20} />}
              detail={`Bed ${data.tenants[0]?.bed || '—'} · ${data.property.name}`}
            />
            <StatCard
              label="My complaints"
              value={open.length}
              icon={<MessagesSquare size={20} />}
              detail="Open or being taken care of"
            />
            <StatCard
              label="New announcements"
              value={data.announcements.filter((a) => !a.reads.includes(user.id)).length}
              icon={<Megaphone size={20} />}
              detail="Stay in the loop with your home"
            />
          </>
        )}
      </div>
      <div className="overview-grid">
        <div className="overview-main">
          <section className="panel rent-panel">
            <div className="panel-heading">
              <div>
                <h2>
                  {owner ? 'Rent collection' : 'My rent summary'}{' '}
                  <span className="subtle-pill">{monthLabel(month)}</span>
                </h2>
                <p>
                  {owner
                    ? 'A clear picture of this month’s payments.'
                    : 'Your payments, all in one place.'}
                </p>
              </div>
              <Link href={`${base}/rent`} className="text-link">
                View all <ArrowUpRight size={15} />
              </Link>
            </div>
            <div className="collection-summary">
              <div>
                <span className="muted">Collected this month</span>
                <strong>
                  {money(totals.collected)}{' '}
                  <small>of {money(totals.collected + totals.pending)}</small>
                </strong>
              </div>
              <span className="collection-percent">
                {Math.round((totals.collected / (totals.collected + totals.pending || 1)) * 100)}
                <small>%</small>
              </span>
            </div>
            <div className="collection-progress">
              <i
                style={{
                  width: `${(totals.collected / (totals.collected + totals.pending || 1)) * 100}%`,
                }}
              />
            </div>
            <div className="collection-legend">
              <span>
                <i className="legend-dot blue" />
                {rents.filter((r) => r.paidAt).length} paid
              </span>
              <span>
                <i className="legend-dot light" />
                {pending.length} pending
              </span>
              <span className="legend-total">
                {owner ? 'One less thing to chase.' : 'Thank you for making this place home.'}
              </span>
            </div>
            <div className="table-section-title">
              <h3>{owner ? 'Pending payments' : 'Current dues'}</h3>
              {pending.length > 0 && <span className="count-pill">{pending.length}</span>}
            </div>
            {pending.length ? (
              <Table
                headings={
                  owner
                    ? ['Tenant', 'Room', 'Amount', 'Status']
                    : ['Month', 'Due date', 'Amount', 'Status']
                }
              >
                {pending.slice(0, 4).map((r) => {
                  const tenant = data.tenants.find((t) => t.id === r.tenantId)!;
                  return (
                    <tr key={r.id}>
                      <td>
                        {owner ? (
                          <div className="person-cell">
                            <Avatar name={tenant.name} />
                            <div>
                              <strong>{tenant.name}</strong>
                              <small>Monthly rent</small>
                            </div>
                          </div>
                        ) : (
                          monthLabel(r.month)
                        )}
                      </td>
                      <td className="muted">{owner ? tenant.room : date(r.dueDate)}</td>
                      <td className="amount-cell">{money(r.amount)}</td>
                      <td>
                        <Badge tone={isOverdue(r.dueDate) ? 'red' : 'amber'}>
                          {isOverdue(r.dueDate) ? 'Overdue' : 'Pending'}
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
              </Table>
            ) : (
              <div className="all-paid">
                <CheckCircle2 size={20} />
                <span>All payments are up to date. Looking good!</span>
              </div>
            )}
            {owner && pending.length > 0 && (
              <div className="panel-footer">
                <span>
                  <Clock3 size={14} /> A friendly nudge goes a long way.
                </span>
                <button
                  className="text-link"
                  disabled={busy}
                  onClick={() => void mutate({ type: 'remind', ids: pending.map((r) => r.id) })}
                >
                  Send reminders <ArrowRight size={14} />
                </button>
              </div>
            )}
          </section>
          <section className="panel">
            <div className="panel-heading">
              <div>
                <h2>{owner ? 'Needs your attention' : 'My recent complaints'}</h2>
                <p>A few things to help your home run smoothly.</p>
              </div>
              <Link className="text-link" href={`${base}/complaints`}>
                View all <ArrowUpRight size={15} />
              </Link>
            </div>
            {open.length ? (
              <div className="attention-list">
                {open.slice(0, 3).map((c) => {
                  const tenant = data.tenants.find((t) => t.id === c.tenantId);
                  return (
                    <Link href={`${base}/complaints`} className="attention-item" key={c.id}>
                      <span className={`issue-icon ${c.priority === 'High' ? 'warm' : ''}`}>
                        <MessagesSquare size={18} />
                      </span>
                      <div>
                        <h3>{c.title}</h3>
                        <p>
                          {tenant?.name} <span>·</span> {tenant?.room} <span>·</span> {c.category}
                        </p>
                      </div>
                      <Badge tone={c.status === 'In progress' ? 'blue' : 'amber'}>{c.status}</Badge>
                      <ArrowUpRight size={16} className="muted" />
                    </Link>
                  );
                })}
              </div>
            ) : (
              <EmptyState
                title="Everything looks good"
                description="There are no open complaints."
              />
            )}
          </section>
        </div>
        <div className="overview-aside">
          <section className="panel food-preview">
            <div className="panel-heading">
              <div>
                <span className="card-eyebrow">
                  <Utensils size={14} /> THE DAILY MENU
                </span>
                <h2>What’s cooking today?</h2>
              </div>
            </div>
            <div className="today-label">
              <span>{today}</span>
              <span>Made for a good day</span>
            </div>
            {data.property.food && menu ? (
              <div className="meal-list">
                {[
                  { name: 'Breakfast', time: '7:30 – 9:30 AM', text: menu.breakfast, icon: Coffee },
                  { name: 'Lunch', time: '12:30 – 2:30 PM', text: menu.lunch, icon: Sun },
                  { name: 'Dinner', time: '7:30 – 9:30 PM', text: menu.dinner, icon: Moon },
                ].map(({ name, time, text, icon: Icon }) => (
                  <div className="meal" key={name}>
                    <span className="meal-icon">
                      <Icon size={18} />
                    </span>
                    <div>
                      <div className="meal-heading">
                        <h3>{name}</h3>
                        <small>{time}</small>
                      </div>
                      <p>{text}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="panel-padding muted">
                {data.property.food
                  ? 'This week’s menu is coming soon.'
                  : 'Mess service is not offered at this PG.'}
              </p>
            )}
            <Link href={`${base}/food`} className="food-footer">
              View weekly menu <ArrowRight size={15} />
            </Link>
          </section>
          <section className="panel announcement-preview">
            <div className="panel-heading">
              <span className="card-eyebrow">
                <Megaphone size={14} /> NOTICE BOARD
              </span>
              <span className="new-dot" />
            </div>
            {announcement ? (
              <div className="notice-body">
                <span className="notice-date">{date(announcement.createdAt)}</span>
                <h2>{announcement.title}</h2>
                <p>{announcement.body}</p>
                <Link className="text-link" href={`${base}/announcements`}>
                  Read announcements <ArrowRight size={15} />
                </Link>
              </div>
            ) : (
              <EmptyState
                title="A quiet notice board"
                description="New updates will appear here."
              />
            )}
          </section>
          <div className="home-note">
            <Building2 size={25} />
            <p>
              More than a place to stay.
              <br />
              <strong>A place to belong.</strong>
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
