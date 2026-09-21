'use client';
import { useEffect, useRef, type ReactNode } from 'react';
import { X, Inbox, LoaderCircle } from 'lucide-react';
export function Badge({
  children,
  tone = 'neutral',
}: {
  children: ReactNode;
  tone?: 'green' | 'amber' | 'red' | 'blue' | 'neutral';
}) {
  return (
    <span className={`badge ${tone}`}>
      <span className="badge-dot" />
      {children}
    </span>
  );
}
export function Avatar({ name, size = 'normal' }: { name: string; size?: 'normal' | 'large' }) {
  return (
    <span className={`avatar ${size}`}>
      {name
        .split(' ')
        .slice(0, 2)
        .map((n) => n[0])
        .join('')}
    </span>
  );
}
export function StatCard({
  label,
  value,
  detail,
  icon,
  accent,
}: {
  label: string;
  value: ReactNode;
  detail: ReactNode;
  icon: ReactNode;
  accent?: boolean;
}) {
  return (
    <div className="stat-card">
      <div className="stat-top">
        <span>{label}</span>
        <span className={accent ? 'stat-icon accent' : 'stat-icon'}>{icon}</span>
      </div>
      <div className="stat-value">{value}</div>
      <div className="stat-detail">{detail}</div>
    </div>
  );
}
export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <span className="empty-icon">
        <Inbox size={24} />
      </span>
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}
export function Loading() {
  return (
    <div className="loading-state" role="status">
      <LoaderCircle className="spin" size={24} />
      <p>Getting your workspace ready…</p>
    </div>
  );
}
export function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className="modal"
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      aria-labelledby="modal-title"
    >
      <div className="modal-head">
        <h2 id="modal-title">{title}</h2>
        <button className="icon-button" onClick={onClose} aria-label="Close dialog">
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
export function Table({ headings, children }: { headings: string[]; children: ReactNode }) {
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            {headings.map((h) => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}
export function FormError({ message }: { message: string }) {
  return message ? (
    <div className="form-error" role="alert">
      {message}
    </div>
  ) : null;
}
