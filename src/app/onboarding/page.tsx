'use client';
import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Building2, ArrowRight } from 'lucide-react';
import { api } from '@/lib/api';
import type { Identity } from '@/lib/types';
import { FormError, Loading } from '@/components/ui/primitives';
import { ThemeControl } from '@/components/ui/theme-control';
export default function Onboarding() {
  const router = useRouter();
  const [user, setUser] = useState<Identity | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState('');
  useEffect(() => {
    void api<{ user: Identity }>('/api/me')
      .then(({ user }) => {
        setCode(new URLSearchParams(window.location.search).get('code') || '');
        if (user.propertyId) router.replace(`/${user.role.toLowerCase()}/overview`);
        else setUser(user);
      })
      .catch(() =>
        router.replace(
          `/login?invite=${encodeURIComponent(new URLSearchParams(window.location.search).get('code') || '')}`,
        ),
      );
  }, [router]);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!user) return;
    setBusy(true);
    setError('');
    const f = new FormData(e.currentTarget);
    try {
      await api(
        '/api/onboarding',
        user.role === 'OWNER'
          ? {
              type: 'owner',
              name: f.get('name'),
              address: f.get('address'),
              rooms: Number(f.get('rooms')),
              beds: Number(f.get('beds')),
              food: f.get('food') === 'on',
            }
          : {
              type: 'tenant',
              code: f.get('code'),
              phone: `+91${String(f.get('phone'))}`,
              moveIn: f.get('moveIn'),
            },
      );
      router.push(`/${user.role.toLowerCase()}/overview`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to complete setup.');
      setBusy(false);
    }
  }
  if (!user) return <Loading />;
  return (
    <main className="onboarding-layout">
      <div className="auth-theme">
        <ThemeControl />
      </div>
      <Link href="/login" className="brand">
        <span className="brand-icon">
          <Building2 size={23} />
        </span>
        PGConnect<span className="brand-period">.</span>
      </Link>
      <section className="onboarding-card">
        <span className="page-eyebrow">LET’S MAKE IT YOURS</span>
        <h1>{user.role === 'OWNER' ? 'Welcome your PG to PGConnect.' : 'Find your new home.'}</h1>
        <p>
          {user.role === 'OWNER'
            ? 'A few details now. A simpler everyday from here.'
            : 'Enter the invite code shared by your PG owner.'}
        </p>
        <form onSubmit={submit} className="form-stack">
          {user.role === 'OWNER' ? (
            <>
              <label>
                PG / hostel name
                <input
                  name="name"
                  placeholder="e.g. Maple House"
                  required
                  minLength={2}
                  maxLength={100}
                />
              </label>
              <label>
                Property address
                <textarea
                  name="address"
                  placeholder="Street, neighbourhood, city"
                  required
                  minLength={5}
                  maxLength={300}
                />
              </label>
              <div className="form-grid">
                <label>
                  Total rooms
                  <input name="rooms" type="number" min="1" max="10000" required />
                </label>
                <label>
                  Total beds
                  <input name="beds" type="number" min="1" max="100000" required />
                </label>
              </div>
              <label className="checkbox-row">
                <input name="food" type="checkbox" defaultChecked />
                <span>We offer mess / food service</span>
              </label>
            </>
          ) : (
            <>
              <label>
                PG invite code
                <input
                  name="code"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="Your PG code"
                  required
                  minLength={4}
                  maxLength={30}
                />
              </label>
              <label>
                Phone number
                <div className="phone-input">
                  <span>IN +91</span>
                  <input
                    name="phone"
                    type="tel"
                    pattern="[6-9][0-9]{9}"
                    maxLength={10}
                    placeholder="9876543210"
                    required
                  />
                </div>
              </label>
              <label>
                Move-in date
                <input name="moveIn" type="date" required />
              </label>
              <p className="field-hint">
                Your owner will assign your room and rent. After joining, add your ID proof securely
                from My profile.
              </p>
            </>
          )}
          <FormError message={error} />
          <button className="button primary full" disabled={busy}>
            {busy
              ? 'Setting things up…'
              : user.role === 'OWNER'
                ? 'Create my workspace'
                : 'Join my PG'}
            <ArrowRight size={17} />
          </button>
        </form>
      </section>
    </main>
  );
}
