'use client';
import { useRef, useState } from 'react';
import { CreditCard, RefreshCw } from 'lucide-react';
import { api } from '@/lib/api';
import { useDashboard } from '@/features/dashboard/context';
import type { Rent } from '@/lib/types';
import { money, monthLabel } from '@/lib/format';
import { Modal, FormError } from '@/components/ui/primitives';

type Result = { status: 'paid' | 'pending' | 'processing' | 'review'; paymentId?: string };
type CheckoutResult = {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
};
type Checkout = { open: () => void; on: (event: string, handler: () => void) => void };
type RazorpayWindow = Window & { Razorpay?: new (options: Record<string, unknown>) => Checkout };
let checkoutScript: Promise<void> | undefined;
function loadCheckout() {
  if ((window as RazorpayWindow).Razorpay) return Promise.resolve();
  checkoutScript ??= new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    const timer = setTimeout(() => {
      script.remove();
      checkoutScript = undefined;
      reject(new Error('Checkout took too long to load. Please try again.'));
    }, 15000);
    script.onload = () => {
      clearTimeout(timer);
      resolve();
    };
    script.onerror = () => {
      clearTimeout(timer);
      script.remove();
      checkoutScript = undefined;
      reject(new Error('Unable to load secure checkout. Check your connection and try again.'));
    };
    document.head.appendChild(script);
  });
  return checkoutScript;
}
export function PayRent({ rent }: { rent: Rent }) {
  const { data, user, refresh, notify } = useDashboard();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const inFlight = useRef(false);
  async function showResult(result: Result) {
    if (result.status === 'paid') {
      setOpen(false);
      notify('Payment verified. The rent is marked as paid.');
    } else
      setError(
        result.status === 'review'
          ? 'Your payment needs the PG owner’s review. Do not pay again.'
          : 'Payment is not confirmed yet. If money was debited, use Check payment status instead of paying again.',
      );
    await refresh();
  }
  async function check() {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError('');
    try {
      await showResult(await api<Result>('/api/payments', { action: 'status', rentId: rent.id }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to check payment.');
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }
  async function pay() {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError('');
    try {
      await loadCheckout();
      const order = await api<{
        keyId: string;
        orderId: string;
        amount: number;
        currency: string;
        name: string;
      }>('/api/payments', { action: 'create', rentId: rent.id });
      const Razorpay = (window as RazorpayWindow).Razorpay;
      if (!Razorpay) throw new Error('Secure checkout is unavailable. Please try again.');
      // Close the native dialog so it cannot obscure Razorpay's hosted checkout iframe.
      setOpen(false);
      const checkout = new Razorpay({
        key: order.keyId,
        order_id: order.orderId,
        amount: order.amount,
        currency: order.currency,
        name: order.name,
        description: `Rent for ${monthLabel(rent.month)}`,
        theme: { color: '#4263df' },
        handler: async (result: CheckoutResult) => {
          try {
            await showResult(
              await api<Result>('/api/payments', {
                action: 'verify',
                rentId: rent.id,
                paymentId: result.razorpay_payment_id,
                orderId: result.razorpay_order_id,
                signature: result.razorpay_signature,
              }),
            );
          } catch {
            setError(
              'Payment confirmation is delayed. Use Check payment status before paying again.',
            );
          } finally {
            inFlight.current = false;
            setBusy(false);
          }
        },
        modal: {
          ondismiss: () => {
            inFlight.current = false;
            setBusy(false);
            void refresh();
          },
        },
      });
      checkout.on('payment.failed', () => {
        setError('Payment was not completed. Check payment status if your account was debited.');
      });
      checkout.open();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to start payment.');
      inFlight.current = false;
      setBusy(false);
      await refresh();
    }
  }
  return (
    <div className="payment-actions">
      {!rent.paidAt && user.role === 'TENANT' && (
        <button
          className="button primary small"
          disabled={
            busy ||
            !data.property.onlinePayments ||
            !!user.demo ||
            rent.payment?.status === 'REVIEW'
          }
          onClick={() => {
            setError('');
            setOpen(true);
          }}
        >
          <CreditCard size={15} />
          {busy ? 'Processing…' : 'Pay rent'}
        </button>
      )}
      {rent.payment && (
        <button className="button ghost small" disabled={busy} onClick={() => void check()}>
          <RefreshCw size={14} />
          Check payment status
        </button>
      )}
      <FormError message={error} />
      {open && (
        <Modal title="Pay your rent" onClose={() => !busy && setOpen(false)}>
          <div className="panel-padding form-stack">
            <span className="eyebrow">{monthLabel(rent.month)}</span>
            <h2>{money(rent.amount)}</h2>
            <p>
              Paying <strong>{data.property.name}</strong> for your monthly rent.
            </p>
            <p className="muted">
              Continue to Razorpay to choose from the payment methods available for this PG,
              including UPI, cards, or netbanking. Confirm the merchant name in checkout before
              paying.
            </p>
            <p className="field-hint">
              Rent updates automatically after payment is confirmed. If money is debited but rent
              stays pending, check the payment status before retrying.
            </p>
            <FormError message={error} />
            <button className="button primary" disabled={busy} onClick={() => void pay()}>
              <CreditCard size={17} />
              {busy ? 'Opening secure checkout…' : `Continue to pay ${money(rent.amount)}`}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
