'use client';
import { useState, type ChangeEvent } from 'react';
import { FileText, ArrowUpRight, Upload } from 'lucide-react';
import { api } from '@/lib/api';
import { useDashboard } from '@/features/dashboard/context';
export function FileUpload({
  purpose,
  onUploaded,
}: {
  purpose: 'kyc' | 'complaint' | 'announcement';
  onUploaded: (id: string) => void;
}) {
  const { user } = useDashboard();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  async function select(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setMessage('');
    if (file.size > 5 * 1024 * 1024) {
      setMessage('Choose a file smaller than 5 MB.');
      return;
    }
    setBusy(true);
    try {
      const signed = await api<{ id: string; url: string; fields: Record<string, string> }>(
        '/api/uploads',
        { type: 'prepare', name: file.name, size: file.size, contentType: file.type, purpose },
      );
      const form = new FormData();
      Object.entries(signed.fields).forEach(([key, value]) => form.append(key, value));
      form.append('file', file);
      const result = await fetch(signed.url, { method: 'POST', body: form });
      if (!result.ok) throw new Error('The upload failed. Please try again.');
      await api('/api/uploads', { type: 'complete', id: signed.id });
      onUploaded(signed.id);
      setMessage(`${file.name} uploaded securely.`);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Upload failed.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="upload-box">
      <label>
        <span style={{ display: 'flex', gap: 7, alignItems: 'center' }}>
          <Upload size={14} />
          {purpose === 'kyc' ? 'Upload ID proof' : 'Add an image (optional)'}
        </span>
        <input
          type="file"
          accept={
            purpose === 'kyc' ? 'image/jpeg,image/png,application/pdf' : 'image/jpeg,image/png'
          }
          disabled={busy || !!user.demo}
          onChange={(e) => void select(e)}
        />
      </label>
      <p>
        {user.demo
          ? 'Private uploads are available with a regular account.'
          : busy
            ? 'Uploading securely…'
            : message ||
              `${purpose === 'kyc' ? 'PDF, ' : ''}JPG or PNG, up to 5 MB. Files are private.`}
      </p>
    </div>
  );
}
export function DocumentLink({ id, label }: { id: string; label: string }) {
  const { notify } = useDashboard();
  async function open() {
    try {
      const result = await api<{ url: string }>(`/api/uploads?id=${encodeURIComponent(id)}`);
      window.open(result.url, '_blank', 'noopener,noreferrer');
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Unable to open file.');
    }
  }
  return (
    <button type="button" className="document-button" onClick={() => void open()}>
      <FileText size={15} />
      {label}
      <ArrowUpRight size={14} />
    </button>
  );
}
