'use client';
import { useEffect, useState, type FormEvent } from 'react';
import { CreditCard, ShieldCheck } from 'lucide-react';
import { api } from '@/lib/api';
import { useDashboard } from '@/features/dashboard/context';
import { FormError } from '@/components/ui/primitives';
type Settings = { configured: boolean; keyId: string; webhookUrl: string };
export function PaymentSettings() {
  const { user, refresh, notify } = useDashboard();
  const [settings, setSettings] = useState<Settings>();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!user.demo)
      void api<Settings>('/api/payments/settings')
        .then(setSettings)
        .catch((e) => setError(e.message));
  }, [user.demo]);
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    const form = e.currentTarget;
    const values = new FormData(form);
    setBusy(true);
    setError('');
    try {
      setSettings(
        await api<Settings>('/api/payments/settings', {
          keyId: values.get('keyId'),
          keySecret: values.get('keySecret'),
          webhookSecret: values.get('webhookSecret'),
          confirmed: values.get('confirmed') === 'on',
        }),
      );
      form.reset();
      await refresh();
      notify('Payment account connected. Complete the webhook setup below.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to connect payment account.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <h2>
            <CreditCard size={18} />
            Online rent payments
          </h2>
          <p>Receive rent in your own Razorpay merchant account.</p>
        </div>
      </div>
      <div className="panel-padding form-stack">
        <FormError message={error} />
        {user.demo ? (
          <p>
            Payment setup is available in your real owner account. Demo mode never accepts money.
          </p>
        ) : (
          <>
            <p className="payment-notice">
              <ShieldCheck size={18} />
              {settings?.configured
                ? `Connected: ${settings.keyId}`
                : 'Connect your account to enable the tenant Pay rent button.'}
            </p>
            <p className="muted">
              Use an activated Razorpay account approved for your PG business. Enable automatic
              payment capture in Razorpay. Payment methods, processing fees, and settlement timing
              are controlled by your merchant account.
            </p>
            <a
              href="https://dashboard.razorpay.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-link"
            >
              Open Razorpay dashboard ↗
            </a>
            <form className="form-stack" onSubmit={save}>
              <label>
                Razorpay key ID
                <input
                  name="keyId"
                  placeholder="rzp_live_…"
                  required
                  autoComplete="off"
                  maxLength={100}
                />
              </label>
              <label>
                Razorpay key secret
                <input
                  name="keySecret"
                  type="password"
                  required
                  autoComplete="new-password"
                  minLength={12}
                  maxLength={200}
                />
              </label>
              <label>
                Webhook secret
                <input
                  name="webhookSecret"
                  type="password"
                  required
                  autoComplete="new-password"
                  minLength={32}
                  maxLength={200}
                />
                <span className="field-hint">
                  Choose a separate secret of at least 32 characters and save it in your password
                  manager. Enter the same secret in Razorpay’s webhook settings.
                </span>
              </label>
              <label className="checkbox-row">
                <input name="confirmed" type="checkbox" required />
                <span>
                  I confirm this merchant account belongs to this PG and is the intended recipient
                  of its rent payments.
                </span>
              </label>
              <p className="field-hint">
                Secrets are encrypted on the server and are never returned to your browser. Account
                changes are blocked while online payments are unresolved.
              </p>
              <button className="button primary" disabled={busy || !settings}>
                {busy
                  ? 'Verifying account…'
                  : settings?.configured
                    ? 'Replace payment account'
                    : 'Connect payment account'}
              </button>
            </form>
            {settings?.configured && (
              <div className="payment-setup">
                <h3>Finish webhook setup</h3>
                <p>
                  In Razorpay, add this webhook URL and select <strong>payment.captured</strong> and{' '}
                  <strong>payment.authorized</strong>. Also enable <strong>payment.refunded</strong>{' '}
                  to flag refunds for review. Use the webhook secret you entered above. This
                  confirms rent even if the tenant closes checkout.
                </p>
                <label>
                  Webhook URL
                  <input readOnly value={settings.webhookUrl} onFocus={(e) => e.target.select()} />
                </label>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
