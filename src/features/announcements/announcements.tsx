'use client';
import { useState, type FormEvent } from 'react';
import { Plus, Megaphone, Check, Users, CalendarDays } from 'lucide-react';
import { useDashboard } from '@/features/dashboard/context';
import { Badge, Modal, EmptyState } from '@/components/ui/primitives';
import { date } from '@/lib/format';
import { FileUpload, DocumentLink } from '@/features/uploads/file-upload';
export function Announcements() {
  const { data, user, mutate, busy } = useDashboard();
  const owner = user.role === 'OWNER';
  const [create, setCreate] = useState(false);
  const [image, setImage] = useState<string | null>(null);
  const [filter, setFilter] = useState('All announcements');
  const [readers, setReaders] = useState<string | null>(null);
  const list = data.announcements.filter(
    (a) => filter === 'All announcements' || !a.reads.includes(user.id),
  );
  const selected = data.announcements.find((a) => a.id === readers);
  const audience = (value: string) =>
    data.tenants.filter(
      (t) => value === 'All tenants' || value === t.room || value === `Block ${t.room[0]}`,
    );
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    if (
      await mutate({
        type: 'announcement-create',
        title: String(f.get('title')),
        body: String(f.get('body')),
        audience: String(f.get('audience')),
        image,
      })
    ) {
      setCreate(false);
      setImage(null);
    }
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="page-eyebrow">KEEP EVERYONE IN THE LOOP</span>
          <h1>Announcements</h1>
          <p>
            {owner
              ? 'The notice board for your shared home.'
              : 'The latest news, updates, and little things to know.'}
          </p>
        </div>
        {owner && (
          <button className="button primary" onClick={() => setCreate(true)}>
            <Plus size={17} /> New announcement
          </button>
        )}
      </div>
      {!owner && (
        <div className="filter-tabs standalone">
          {['All announcements', 'Unread'].map((f) => (
            <button key={f} className={filter === f ? 'active' : ''} onClick={() => setFilter(f)}>
              {f}
            </button>
          ))}
        </div>
      )}
      <div className="announcement-grid">
        {list.length ? (
          list.map((a) => (
            <article className="panel announcement-card" key={a.id}>
              <div className="announcement-card-top">
                <span className="announcement-icon">
                  <Megaphone size={20} />
                </span>
                <Badge tone={owner ? 'neutral' : a.reads.includes(user.id) ? 'green' : 'blue'}>
                  {owner ? a.audience : a.reads.includes(user.id) ? 'Read' : 'New'}
                </Badge>
              </div>
              <h2>{a.title}</h2>
              <p className="announcement-body">{a.body}</p>
              {a.image && <DocumentLink id={a.image} label="View announcement image" />}
              <div className="announcement-meta">
                <span>
                  <CalendarDays size={14} />
                  {date(a.createdAt)}
                </span>
                {owner ? (
                  <button onClick={() => setReaders(a.id)}>
                    <Users size={14} />
                    {a.reads.length} of {audience(a.audience).length} read
                  </button>
                ) : !a.reads.includes(user.id) ? (
                  <button
                    disabled={busy}
                    onClick={() => void mutate({ type: 'announcement-read', id: a.id })}
                  >
                    <Check size={14} /> Mark as read
                  </button>
                ) : (
                  <span>
                    <Check size={14} /> You’re up to date
                  </span>
                )}
              </div>
            </article>
          ))
        ) : (
          <div className="panel">
            <EmptyState
              title="You’re all caught up"
              description="New announcements will appear here."
            />
          </div>
        )}
      </div>
      {create && (
        <Modal title="Share an update" onClose={() => setCreate(false)}>
          <form className="modal-body form-stack" onSubmit={submit}>
            <label>
              Announcement title
              <input
                name="title"
                required
                maxLength={120}
                placeholder="What would you like everyone to know?"
              />
            </label>
            <label>
              Message
              <textarea
                name="body"
                required
                rows={5}
                maxLength={3000}
                placeholder="Keep it clear, friendly, and helpful."
              />
            </label>
            <label>
              Share with
              <select name="audience">
                <option>All tenants</option>
                {Array.from(new Set(data.tenants.map((t) => `Block ${t.room[0]}`))).map((block) => (
                  <option key={block}>{block}</option>
                ))}
                {Array.from(new Set(data.tenants.map((t) => t.room))).map((room) => (
                  <option key={room}>{room}</option>
                ))}
              </select>
            </label>
            <FileUpload purpose="announcement" onUploaded={setImage} />
            <button className="button primary" disabled={busy}>
              <Megaphone size={16} /> Publish announcement
            </button>
          </form>
        </Modal>
      )}
      {selected && (
        <Modal title="Who’s seen this update" onClose={() => setReaders(null)}>
          <div className="modal-body">
            <h3>{selected.title}</h3>
            {audience(selected.audience).map((t) => (
              <div className="read-row" key={t.id}>
                <span>
                  {t.name} <small className="muted">· {t.room}</small>
                </span>
                <Badge tone={selected.reads.includes(t.id) ? 'green' : 'neutral'}>
                  {selected.reads.includes(t.id) ? 'Read' : 'Unread'}
                </Badge>
              </div>
            ))}
          </div>
        </Modal>
      )}
    </>
  );
}
