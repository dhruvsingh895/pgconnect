'use client';
import { useState, type FormEvent } from 'react';
import { Building2, Save, ShieldCheck, Copy } from 'lucide-react';
import { useDashboard } from '@/features/dashboard/context';
import { Avatar } from '@/components/ui/primitives';
import { FileUpload, DocumentLink } from '@/features/uploads/file-upload';
import { date, money } from '@/lib/format';
import { ThemeControl } from '@/components/ui/theme-control';
import { PaymentSettings } from './payment-settings';
export function SettingsPage() {
  const { data, user, mutate, busy, notify, refresh } = useDashboard();
  const owner = user.role === 'OWNER';
  const tenant = data.tenants.find((t) => t.id === user.id);
  const [tab, setTab] = useState('Property details');
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    await mutate({
      type: 'property-save',
      name: String(f.get('name')),
      address: String(f.get('address')),
      rooms: Number(f.get('rooms')),
      beds: Number(f.get('beds')),
      food: f.get('food') === 'on',
      notifications: f.get('notifications') === 'on',
    });
  }
  async function profile(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    await mutate({ type: 'profile-save', name: String(new FormData(e.currentTarget).get('name')) });
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="page-eyebrow">THE DETAILS THAT MATTER</span>
          <h1>{owner ? 'Settings' : 'My profile'}</h1>
          <p>
            {owner
              ? 'Make this workspace feel like your PG.'
              : 'Your details, safely in one place.'}
          </p>
        </div>
      </div>
      <section className="appearance-card">
        <div>
          <h2>Appearance</h2>
          <p>Choose your view. System follows your device’s theme.</p>
        </div>
        <ThemeControl expanded />
      </section>
      {owner && (
        <div className="filter-tabs standalone">
          {['Property details', 'Payments', 'My account'].map((t) => (
            <button key={t} className={tab === t ? 'active' : ''} onClick={() => setTab(t)}>
              {t}
            </button>
          ))}
        </div>
      )}
      {owner && tab === 'Payments' ? (
        <PaymentSettings />
      ) : owner && tab === 'Property details' ? (
        <div className="settings-grid">
          <section className="panel">
            <div className="panel-heading">
              <div>
                <h2>
                  <Building2 size={18} /> Property details
                </h2>
                <p>A few essentials about your place.</p>
              </div>
            </div>
            <form onSubmit={save} className="panel-padding form-stack">
              <label>
                PG name
                <input name="name" defaultValue={data.property.name} required maxLength={100} />
              </label>
              <label>
                Address
                <textarea
                  name="address"
                  defaultValue={data.property.address}
                  required
                  rows={2}
                  maxLength={300}
                />
              </label>
              <div className="form-grid">
                <label>
                  Total rooms
                  <input
                    name="rooms"
                    type="number"
                    defaultValue={data.property.rooms}
                    min="1"
                    max="10000"
                    required
                  />
                </label>
                <label>
                  Total beds
                  <input
                    name="beds"
                    type="number"
                    defaultValue={data.property.beds}
                    min={data.tenants.length || 1}
                    max="100000"
                    required
                  />
                </label>
              </div>
              <label className="checkbox-row">
                <input type="checkbox" name="food" defaultChecked={data.property.food} />
                <span>
                  <strong>Mess / food service</strong>
                  <small>Show the weekly food timetable to residents.</small>
                </span>
              </label>
              <label className="checkbox-row">
                <input
                  type="checkbox"
                  name="notifications"
                  defaultChecked={data.property.notifications}
                />
                <span>
                  <strong>In-app reminders</strong>
                  <small>Allow payment reminders for this property.</small>
                </span>
              </label>
              <button className="button primary" disabled={busy}>
                <Save size={16} /> Save changes
              </button>
            </form>
          </section>
          <section className="panel settings-aside">
            <span className="announcement-icon">
              <ShieldCheck size={22} />
            </span>
            <h2>Your invite code</h2>
            <p className="muted">Share this with new tenants so they can join your PG.</p>
            <div className="invite-code">{data.property.code}</div>
            <button
              className="button secondary full"
              onClick={() =>
                void navigator.clipboard
                  .writeText(data.property.code)
                  .then(() => notify('Invite code copied.'))
                  .catch(() => notify('Please select and copy the code.'))
              }
            >
              <Copy size={15} /> Copy code
            </button>
            <hr />
            <h3>A private space</h3>
            <p className="muted">
              Tenants can only see their own profile, payments, and complaints. ID documents are
              only accessible to the tenant and their PG owner.
            </p>
          </section>
        </div>
      ) : (
        <div className="settings-grid">
          <section className="panel">
            <div className="panel-padding">
              <div className="profile-intro">
                <Avatar name={user.name} size="large" />
                <div>
                  <h2>{user.name}</h2>
                  <p className="muted">
                    {owner ? 'PG Owner' : `${tenant?.room} · Bed ${tenant?.bed}`} ·{' '}
                    {data.property.name}
                  </p>
                </div>
              </div>
              <form onSubmit={profile} className="form-stack">
                <label>
                  Full name
                  <input
                    name="name"
                    defaultValue={tenant?.name || user.name}
                    required
                    minLength={2}
                    maxLength={100}
                  />
                </label>
                {tenant && (
                  <>
                    <label>
                      Email
                      <input value={tenant.email || 'Phone account'} readOnly />
                    </label>
                    <label>
                      Phone number
                      <input value={tenant.phone} readOnly />
                    </label>
                    <p className="field-hint">
                      Contact details are tied to your sign-in and cannot be changed here.
                    </p>
                  </>
                )}
                <button className="button primary" disabled={busy}>
                  Save profile
                </button>
              </form>
            </div>
          </section>
          {tenant && (
            <section className="panel settings-aside">
              <h2>Your stay</h2>
              <dl className="details-list">
                <div>
                  <dt>Move-in date</dt>
                  <dd>{date(tenant.moveIn)}</dd>
                </div>
                <div>
                  <dt>Monthly rent</dt>
                  <dd>{money(tenant.rent)}</dd>
                </div>
                <div>
                  <dt>Security deposit</dt>
                  <dd>{money(tenant.deposit)}</dd>
                </div>
              </dl>
              <hr />
              <h3>ID verification</h3>
              <p className="muted">
                Your documents are private and only shared with your PG owner.
              </p>
              {tenant.documents.map((id) => (
                <DocumentLink key={id} id={id} label="View ID document" />
              ))}
              <FileUpload purpose="kyc" onUploaded={() => void refresh()} />
            </section>
          )}
        </div>
      )}
    </>
  );
}
