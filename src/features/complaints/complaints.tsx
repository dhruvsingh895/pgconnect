'use client';
import { useState, type FormEvent } from 'react';
import { Plus, Search, MessagesSquare, Clock3, ArrowUpRight } from 'lucide-react';
import { useDashboard } from '@/features/dashboard/context';
import { Badge, Modal, EmptyState, FormError } from '@/components/ui/primitives';
import { date } from '@/lib/format';
import type { ComplaintStatus } from '@/lib/types';
import { FileUpload, DocumentLink } from '@/features/uploads/file-upload';
export function Complaints() {
  const { data, user, mutate, busy } = useDashboard();
  const owner = user.role === 'OWNER';
  const [filter, setFilter] = useState('All issues');
  const [search, setSearch] = useState('');
  const [create, setCreate] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [error, setError] = useState('');
  const complaint = data.complaints.find((c) => c.id === selected);
  const list = data.complaints.filter(
    (c) =>
      (filter === 'All issues' || c.status === filter) &&
      `${c.title} ${c.category}`.toLowerCase().includes(search.toLowerCase()),
  );
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const ok = await mutate({
      type: 'complaint-create',
      title: String(f.get('title')),
      description: String(f.get('description')),
      category: String(f.get('category')) as 'Maintenance' | 'Food' | 'Housekeeping' | 'Other',
      priority: String(f.get('priority')) as 'Low' | 'Medium' | 'High',
      photo,
    });
    if (ok) {
      setCreate(false);
      setPhoto(null);
    } else setError('Could not submit your complaint. Please check the message and try again.');
  }
  async function update(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!complaint) return;
    const f = new FormData(e.currentTarget);
    const ok = await mutate({
      type: 'complaint-update',
      id: complaint.id,
      status: String(f.get('status')) as ComplaintStatus,
      note: String(f.get('note')),
    });
    if (ok) setSelected(null);
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="page-eyebrow">SMALL FIXES. BETTER EVERYDAYS.</span>
          <h1>{owner ? 'Complaints & issues' : 'My complaints'}</h1>
          <p>
            {owner
              ? 'Listen, follow up, and make your PG a little better.'
              : 'Something not quite right? Let’s get it taken care of.'}
          </p>
        </div>
        {!owner && (
          <button
            className="button primary"
            onClick={() => {
              setCreate(true);
              setError('');
            }}
          >
            <Plus size={17} /> Raise a complaint
          </button>
        )}
      </div>
      <section className="panel">
        <div className="toolbar">
          <div className="filter-tabs">
            {['All issues', 'Open', 'In progress', 'Resolved'].map((s) => (
              <button key={s} className={filter === s ? 'active' : ''} onClick={() => setFilter(s)}>
                {s}
                <span>
                  {data.complaints.filter((c) => s === 'All issues' || c.status === s).length}
                </span>
              </button>
            ))}
          </div>
          <div className="search-input">
            <Search size={17} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search issues…"
              aria-label="Search complaints"
            />
          </div>
        </div>
        {list.length ? (
          <div className="complaint-list">
            {list.map((c) => {
              const t = data.tenants.find((t) => t.id === c.tenantId);
              return (
                <button key={c.id} className="complaint-card" onClick={() => setSelected(c.id)}>
                  <span className={`issue-icon ${c.priority === 'High' ? 'warm' : ''}`}>
                    <MessagesSquare size={20} />
                  </span>
                  <div className="complaint-content">
                    <div className="complaint-title">
                      <h3>{c.title}</h3>
                      <Badge
                        tone={
                          c.status === 'Resolved'
                            ? 'green'
                            : c.status === 'In progress'
                              ? 'blue'
                              : 'amber'
                        }
                      >
                        {c.status}
                      </Badge>
                    </div>
                    <p>{c.description}</p>
                    <div className="complaint-meta">
                      <span>{c.category}</span>
                      <span>
                        {t?.name} · {t?.room}
                      </span>
                      <span>
                        <Clock3 size={13} />
                        {date(c.createdAt)}
                      </span>
                    </div>
                  </div>
                  <div className="priority-label">
                    <i className={c.priority.toLowerCase()} />
                    {c.priority}
                    <ArrowUpRight size={15} />
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <EmptyState
            title="No complaints here"
            description={
              filter === 'Resolved'
                ? 'Resolved issues will appear here.'
                : 'A quiet inbox is a good sign. Any new issues will appear here.'
            }
          />
        )}
      </section>
      {create && (
        <Modal title="Let’s get it sorted" onClose={() => setCreate(false)}>
          <form className="modal-body form-stack" onSubmit={submit}>
            <label>
              What’s the issue?
              <input
                name="title"
                placeholder="Give your issue a short title"
                maxLength={120}
                required
              />
            </label>
            <div className="form-grid">
              <label>
                Category
                <select name="category">
                  <option>Maintenance</option>
                  <option>Food</option>
                  <option>Housekeeping</option>
                  <option>Other</option>
                </select>
              </label>
              <label>
                Priority
                <select name="priority" defaultValue="Medium">
                  <option>Low</option>
                  <option>Medium</option>
                  <option>High</option>
                </select>
              </label>
            </div>
            <label>
              Tell us a little more
              <textarea
                name="description"
                placeholder="A few details will help us resolve it faster."
                rows={4}
                required
                maxLength={2000}
              />
            </label>
            <FileUpload purpose="complaint" onUploaded={setPhoto} />
            <FormError message={error} />
            <button className="button primary" disabled={busy}>
              {busy ? 'Submitting…' : 'Submit complaint'}
            </button>
          </form>
        </Modal>
      )}
      {complaint && (
        <Modal title="Complaint details" onClose={() => setSelected(null)}>
          <div className="modal-body">
            <div className="detail-title">
              <h2>{complaint.title}</h2>
              <Badge tone={complaint.status === 'Resolved' ? 'green' : 'blue'}>
                {complaint.status}
              </Badge>
            </div>
            <p className="muted">
              {complaint.category} · {complaint.priority} priority · {date(complaint.createdAt)}
            </p>
            <p className="description-text">{complaint.description}</p>
            {complaint.photo && <DocumentLink id={complaint.photo} label="View attached photo" />}
            <h3 className="section-title">Activity</h3>
            <div className="timeline">
              <div>
                <i />
                <p>
                  Complaint submitted<small>{date(complaint.createdAt)}</small>
                </p>
              </div>
              {complaint.notes.map((note, i) => (
                <div key={i}>
                  <i />
                  <p>
                    {note.text}
                    <small>
                      {note.status} · {date(note.at)}
                    </small>
                  </p>
                </div>
              ))}
            </div>
            {owner && (
              <form onSubmit={update} className="form-stack">
                <label>
                  Status
                  <select name="status" defaultValue={complaint.status}>
                    <option>Open</option>
                    {complaint.status !== 'Resolved' && <option>In progress</option>}
                    <option>Resolved</option>
                  </select>
                </label>
                <label>
                  Update or resolution note
                  <textarea
                    name="note"
                    rows={3}
                    placeholder="Keep your tenant in the loop. A note is required to resolve an issue."
                    maxLength={2000}
                  />
                </label>
                <button className="button primary" disabled={busy}>
                  Save update
                </button>
              </form>
            )}
          </div>
        </Modal>
      )}
    </>
  );
}
