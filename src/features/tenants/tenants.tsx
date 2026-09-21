'use client';
import { useState, type FormEvent } from 'react';
import { Search, ArrowUpRight, Phone, Mail, FileText, Users, Copy } from 'lucide-react';
import { useDashboard } from '@/features/dashboard/context';
import { Avatar, Badge, Table, EmptyState, Modal } from '@/components/ui/primitives';
import { money, date, currentMonth } from '@/lib/format';
import { api } from '@/lib/api';
export function Tenants() {
  const { data, mutate, busy, notify } = useDashboard();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('All tenants');
  const [selected, setSelected] = useState<string | null>(null);
  const tenant = data.tenants.find((t) => t.id === selected);
  const pending = (id: string) =>
    data.rents.some((r) => r.tenantId === id && !r.paidAt && r.month <= currentMonth());
  const list = data.tenants.filter(
    (t) =>
      `${t.name} ${t.room} ${t.phone}`.toLowerCase().includes(search.toLowerCase()) &&
      (filter === 'All tenants' || (filter === 'Pending rent' ? pending(t.id) : !pending(t.id))),
  );
  async function update(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!tenant) return;
    const f = new FormData(e.currentTarget);
    await mutate({
      type: 'tenant-update',
      id: tenant.id,
      room: String(f.get('room')),
      bed: String(f.get('bed')),
      rent: Number(f.get('rent')),
      deposit: Number(f.get('deposit')),
    });
  }
  async function openDocument(id: string) {
    try {
      const result = await api<{ url: string }>(`/api/uploads?id=${encodeURIComponent(id)}`);
      window.open(result.url, '_blank', 'noopener,noreferrer');
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Unable to open document.');
    }
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="page-eyebrow">THE PEOPLE WHO MAKE IT HOME</span>
          <h1>Tenants</h1>
          <p>Everything you need to look after your residents.</p>
        </div>
        <button
          className="button primary"
          onClick={() =>
            void navigator.clipboard
              .writeText(data.property.code)
              .then(() => notify(`Invite code copied: ${data.property.code}`))
              .catch(() => notify(`Your invite code: ${data.property.code}`))
          }
        >
          <Copy size={16} /> Copy invite code
        </button>
      </div>
      <section className="panel">
        <div className="toolbar">
          <div className="search-input">
            <Search size={17} />
            <input
              aria-label="Search tenants"
              placeholder="Search by name, room or phone…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select
            aria-label="Filter tenants"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option>All tenants</option>
            <option>Pending rent</option>
            <option>Paid rent</option>
          </select>
        </div>
        {list.length ? (
          <Table headings={['Tenant', 'Room / bed', 'Monthly rent', 'Rent status', 'Contact', '']}>
            {list.map((t) => (
              <tr key={t.id}>
                <td>
                  <button
                    className="person-cell table-person-button"
                    onClick={() => setSelected(t.id)}
                  >
                    <Avatar name={t.name} />
                    <div>
                      <strong>{t.name}</strong>
                      <small>Joined {date(t.moveIn)}</small>
                    </div>
                  </button>
                </td>
                <td>
                  {t.room} <span className="muted">/ {t.bed}</span>
                </td>
                <td className="amount-cell">{money(t.rent)}</td>
                <td>
                  <Badge tone={pending(t.id) ? 'amber' : 'green'}>
                    {pending(t.id) ? 'Pending' : 'Paid'}
                  </Badge>
                </td>
                <td className="muted">{t.phone}</td>
                <td>
                  <button
                    className="icon-button"
                    aria-label={`View ${t.name}`}
                    onClick={() => setSelected(t.id)}
                  >
                    <ArrowUpRight size={17} />
                  </button>
                </td>
              </tr>
            ))}
          </Table>
        ) : (
          <EmptyState
            title="No tenants found"
            description={
              search
                ? 'Try a different name or room number.'
                : 'Share your invite code to welcome your first tenant.'
            }
          />
        )}
        <div className="panel-footer">
          <span>
            <Users size={14} /> {list.length} of {data.tenants.length} tenants
          </span>
          <span>{data.property.beds - data.tenants.length} beds available</span>
        </div>
      </section>
      {tenant && (
        <Modal title="Tenant profile" onClose={() => setSelected(null)}>
          <div className="modal-body">
            <div className="profile-intro">
              <Avatar name={tenant.name} size="large" />
              <div>
                <h2>{tenant.name}</h2>
                <p className="muted">Moved in {date(tenant.moveIn)}</p>
              </div>
            </div>
            <div className="contact-row">
              <span>
                <Phone size={15} />
                {tenant.phone}
              </span>
              <span>
                <Mail size={15} />
                {tenant.email || 'No email added'}
              </span>
            </div>
            <form className="form-stack" onSubmit={update}>
              <div className="form-grid">
                <label>
                  Room
                  <input name="room" defaultValue={tenant.room} required maxLength={30} />
                </label>
                <label>
                  Bed
                  <input name="bed" defaultValue={tenant.bed} required maxLength={10} />
                </label>
                <label>
                  Monthly rent (₹)
                  <input
                    name="rent"
                    type="number"
                    min="0"
                    max="1000000"
                    defaultValue={tenant.rent}
                    required
                  />
                </label>
                <label>
                  Security deposit (₹)
                  <input
                    name="deposit"
                    type="number"
                    min="0"
                    max="10000000"
                    defaultValue={tenant.deposit}
                    required
                  />
                </label>
              </div>
              <button className="button primary" disabled={busy}>
                Save tenant details
              </button>
            </form>
            <h3 className="section-title">KYC documents</h3>
            {tenant.documents.length ? (
              tenant.documents.map((id) => (
                <button key={id} className="document-button" onClick={() => void openDocument(id)}>
                  <FileText size={16} /> View private ID document <ArrowUpRight size={15} />
                </button>
              ))
            ) : (
              <p className="muted">No ID document uploaded yet.</p>
            )}
            <h3 className="section-title">Payment history</h3>
            <Table headings={['Month', 'Amount', 'Status']}>
              {data.rents
                .filter((r) => r.tenantId === tenant.id)
                .sort((a, b) => b.month.localeCompare(a.month))
                .map((r) => (
                  <tr key={r.id}>
                    <td>{r.month}</td>
                    <td>{money(r.amount)}</td>
                    <td>
                      <Badge tone={r.paidAt ? 'green' : 'amber'}>
                        {r.paidAt ? 'Paid' : 'Pending'}
                      </Badge>
                    </td>
                  </tr>
                ))}
            </Table>
          </div>
        </Modal>
      )}
    </>
  );
}
