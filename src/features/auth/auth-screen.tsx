'use client';
import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Building2, ArrowRight, ShieldCheck, House, Users, Check, ArrowLeft } from 'lucide-react';
import { api } from '@/lib/api';
import type { Identity, Role } from '@/lib/types';
import { FormError } from '@/components/ui/primitives';
import { ThemeControl } from '@/components/ui/theme-control';
export function AuthScreen({
  demoEnabled,
  smsEnabled,
  invite,
}: {
  demoEnabled: boolean;
  smsEnabled: boolean;
  invite?: string;
}) {
  const router = useRouter();
  const [signup, setSignup] = useState(false);
  const [method, setMethod] = useState<'phone' | 'email'>(smsEnabled ? 'phone' : 'email');
  const [role, setRole] = useState<Role>(invite ? 'TENANT' : 'OWNER');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    setBusy(true);
    const f = new FormData(e.currentTarget);
    try {
      const body =
        method === 'email'
          ? {
              type: signup ? 'signup' : 'login',
              email: f.get('email'),
              password: f.get('password'),
              name: f.get('name'),
              role,
            }
          : {
              type: sent ? 'otp-verify' : 'otp-send',
              phone: `+91${String(f.get('phone')).replace(/\D/g, '')}`,
              code: f.get('code'),
              name: signup ? f.get('name') : undefined,
              role: signup ? role : undefined,
            };
      const result = await api<{ user?: Identity; sent?: boolean }>('/api/auth', body);
      if (result.sent) setSent(true);
      if (result.user)
        router.push(
          result.user.propertyId
            ? `/${result.user.role.toLowerCase()}/overview`
            : `/onboarding${invite ? `?code=${encodeURIComponent(invite)}` : ''}`,
        );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not sign in.');
    } finally {
      setBusy(false);
    }
  }
  async function demo(demoRole: Role) {
    setBusy(true);
    setError('');
    try {
      await api('/api/auth/demo', { role: demoRole });
      router.push(`/${demoRole.toLowerCase()}/overview`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not open demo.');
      setBusy(false);
    }
  }
  return (
    <div className="auth-layout">
      <div className="auth-theme">
        <ThemeControl />
      </div>
      <aside className="auth-story">
        <Link className="brand" href="/login">
          <span className="brand-icon">
            <Building2 size={23} />
          </span>
          PGConnect<span className="brand-period">.</span>
        </Link>
        <div className="story-content">
          <span className="eyebrow">A LITTLE LESS ADMIN. A LOT MORE LIVING.</span>
          <h1>
            A better way
            <br />
            to manage
            <br />
            <span>a place called home.</span>
          </h1>
          <p>
            From the first move-in to the everyday details.
            <br />
            Bring your PG and its people together.
          </p>
          <div className="story-checks">
            <span>
              <Check size={17} /> One place for rent & residents
            </span>
            <span>
              <Check size={17} /> Everyday communication, simplified
            </span>
            <span>
              <Check size={17} /> A connected living experience
            </span>
          </div>
          <div className="workspace-peek" aria-label="A preview of the owner demo">
            <div className="peek-heading">
              <span className="property-icon">
                <Building2 size={19} />
              </span>
              <div>
                <strong>Maple House</strong>
                <span>A peek at your owner workspace</span>
              </div>
              <span className="peek-live">
                <span /> All in one place
              </span>
            </div>
            <div className="peek-stats">
              <div>
                <span>Residents</span>
                <strong>
                  12<span> / 20 beds</span>
                </strong>
              </div>
              <div>
                <span>Collected this month</span>
                <strong>₹71,000</strong>
              </div>
            </div>
            <div className="peek-row">
              <span className="avatar">AS</span>
              <span>
                <strong>Aarav Sharma</strong>
                <small>Room A-101 · Monthly rent</small>
              </span>
              <span className="badge green">
                <Check size={12} /> Paid
              </span>
            </div>
            <div className="peek-foot">
              <ShieldCheck size={14} /> The details are taken care of.
            </div>
          </div>
        </div>
        <div className="story-footer">
          <div className="tiny-house">
            <House size={21} />
          </div>
          <span>Thoughtfully built for shared living.</span>
        </div>
      </aside>
      <main className="auth-main">
        <div className="auth-card">
          <span className="eyebrow">WELCOME TO PGCONNECT</span>
          <h2>{signup ? 'Make yourself at home.' : 'Good to have you here.'}</h2>
          <p className="muted">
            {signup ? 'Create your account to get started.' : 'Sign in to your everyday workspace.'}
          </p>
          {smsEnabled && (
            <div className="segmented">
              <button
                onClick={() => {
                  setMethod('phone');
                  setError('');
                }}
                className={method === 'phone' ? 'active' : ''}
              >
                Phone number
              </button>
              <button
                onClick={() => {
                  setMethod('email');
                  setError('');
                }}
                className={method === 'email' ? 'active' : ''}
              >
                Email address
              </button>
            </div>
          )}
          <form onSubmit={submit} className="form-stack">
            {signup && (
              <>
                <label>
                  Full name
                  <input
                    name="name"
                    autoComplete="name"
                    required
                    maxLength={100}
                    placeholder="Your full name"
                  />
                </label>
                <div className="role-options">
                  <button
                    type="button"
                    className={role === 'OWNER' ? 'selected' : ''}
                    onClick={() => setRole('OWNER')}
                  >
                    <Building2 size={18} /> I’m a PG Owner
                  </button>
                  <button
                    type="button"
                    className={role === 'TENANT' ? 'selected' : ''}
                    onClick={() => setRole('TENANT')}
                  >
                    <Users size={18} /> I’m a Tenant
                  </button>
                </div>
              </>
            )}
            {method === 'phone' ? (
              <>
                <label>
                  Phone number
                  <div className="phone-input">
                    <span>IN +91</span>
                    <input
                      name="phone"
                      type="tel"
                      autoComplete="tel-national"
                      pattern="[6-9][0-9]{9}"
                      placeholder="98765 43210"
                      required
                      maxLength={10}
                      readOnly={sent}
                    />
                  </div>
                </label>
                {sent ? (
                  <label>
                    Verification code
                    <input
                      name="code"
                      inputMode="numeric"
                      pattern="[0-9]{6}"
                      maxLength={6}
                      autoComplete="one-time-code"
                      placeholder="6-digit code"
                      required
                    />
                  </label>
                ) : (
                  <p className="field-hint">We’ll send you a one-time verification code.</p>
                )}
              </>
            ) : (
              <>
                <label>
                  Email address
                  <input
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    placeholder="you@example.com"
                  />
                </label>
                <label>
                  Password
                  <input
                    name="password"
                    type="password"
                    autoComplete={signup ? 'new-password' : 'current-password'}
                    minLength={signup ? 12 : 1}
                    maxLength={128}
                    required
                    placeholder={signup ? 'At least 12 characters' : 'Enter your password'}
                  />
                </label>
              </>
            )}
            <FormError message={error} />
            <button className="button primary full" disabled={busy}>
              {busy
                ? 'Please wait…'
                : method === 'phone'
                  ? sent
                    ? 'Verify & continue'
                    : 'Send verification code'
                  : signup
                    ? 'Create account'
                    : 'Sign in'}
              <ArrowRight size={17} />
            </button>
            {sent && (
              <button type="button" className="text-button" onClick={() => setSent(false)}>
                <ArrowLeft size={14} /> Change phone number
              </button>
            )}
          </form>
          <p className="auth-toggle">
            {signup ? 'Already have an account?' : 'New to PGConnect?'}{' '}
            <button
              onClick={() => {
                setSignup(!signup);
                setError('');
                setSent(false);
              }}
            >
              {signup ? 'Sign in' : 'Create an account'}
            </button>
          </p>
          {demoEnabled && (
            <div className="demo-box">
              <span className="eyebrow">TAKE A LOOK AROUND</span>
              <p>Explore a fully furnished demo workspace.</p>
              <div>
                <button disabled={busy} onClick={() => demo('OWNER')}>
                  Owner demo <ArrowRight size={15} />
                </button>
                <button disabled={busy} onClick={() => demo('TENANT')}>
                  Tenant demo <ArrowRight size={15} />
                </button>
              </div>
            </div>
          )}
          <div className="auth-security">
            <ShieldCheck size={15} /> Your home. Your data. Safely connected.
          </div>
        </div>
      </main>
    </div>
  );
}
