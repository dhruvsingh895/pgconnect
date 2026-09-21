'use client';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Building2,
  LayoutDashboard,
  Users,
  Wallet,
  MessagesSquare,
  Utensils,
  Megaphone,
  Settings,
  ChevronDown,
  ChevronLeft,
  Bell,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  ArrowUpRight,
  Check,
  UserRound,
  X,
} from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import type { Snapshot } from '@/lib/types';
import type { Action } from '@/server/services/dashboard';
import { DashboardContext } from './context';
import { Avatar, Loading, Modal } from '@/components/ui/primitives';
import { Overview } from './overview';
import { Tenants } from '@/features/tenants/tenants';
import { RentPage } from '@/features/rent/rent-page';
import { Complaints } from '@/features/complaints/complaints';
import { Announcements } from '@/features/announcements/announcements';
import { Food } from '@/features/food/food';
import { SettingsPage } from '@/features/settings/settings';
import { ThemeControl } from '@/components/ui/theme-control';
const ownerNav = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'tenants', label: 'Tenants', icon: Users },
  { id: 'rent', label: 'Rent & dues', icon: Wallet },
  { id: 'complaints', label: 'Complaints', icon: MessagesSquare },
  { id: 'announcements', label: 'Announcements', icon: Megaphone },
  { id: 'food', label: 'Food timetable', icon: Utensils },
];
const tenantNav = [
  { id: 'overview', label: 'Home', icon: LayoutDashboard },
  { id: 'rent', label: 'My dues & payments', icon: Wallet },
  { id: 'complaints', label: 'My complaints', icon: MessagesSquare },
  { id: 'announcements', label: 'Announcements', icon: Megaphone },
  { id: 'food', label: 'Food timetable', icon: Utensils },
];
export function DashboardShell({ role, page }: { role: string; page: string }) {
  const router = useRouter();
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState('');
  const [collapsed, setCollapsed] = useState(false);
  const [notifications, setNotifications] = useState(false);
  const [account, setAccount] = useState(false);
  const [invite, setInvite] = useState(false);
  const refresh = useCallback(async () => {
    try {
      const s = await api<Snapshot>('/api/dashboard');
      if (s.user.role.toLowerCase() !== role) {
        router.replace(`/${s.user.role.toLowerCase()}/overview`);
        return;
      }
      setSnapshot(s);
      setError('');
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) router.replace('/login');
      else if (e instanceof ApiError && e.code === 'ONBOARDING_REQUIRED')
        router.replace('/onboarding');
      else setError(e instanceof Error ? e.message : 'Unable to load your workspace.');
    }
  }, [role, router]);
  // Refresh only updates state after an external HTTP response.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, [refresh]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(''), 4500);
    return () => clearTimeout(timer);
  }, [toast]);
  async function mutate(action: Action) {
    if (busy) return false;
    setBusy(true);
    try {
      setSnapshot(await api<Snapshot>('/api/dashboard', action));
      setToast(action.type === 'remind' ? 'In-app reminders sent.' : 'Changes saved.');
      return true;
    } catch (e) {
      setToast(e instanceof Error ? e.message : 'Unable to save changes.');
      return false;
    } finally {
      setBusy(false);
    }
  }
  async function logout() {
    try {
      await api('/api/auth/logout', {});
      router.push('/login');
    } catch {
      setToast('Could not sign out. Please try again.');
    }
  }
  if (error)
    return (
      <div className="loading-state">
        <h2>We couldn’t load your workspace.</h2>
        <p>{error}</p>
        <button className="button primary" onClick={() => void refresh()}>
          Try again
        </button>
        <Link href="/login">Back to sign in</Link>
      </div>
    );
  if (!snapshot) return <Loading />;
  const { user, data } = snapshot;
  const owner = user.role === 'OWNER';
  const nav = owner ? ownerNav : tenantNav;
  const current =
    nav.find((n) => n.id === page)?.label || (page === 'profile' ? 'My profile' : 'Settings');
  const open = data.complaints.filter((c) => c.status !== 'Resolved').length;
  const unread = data.notifications.filter((n) => !n.read).length;
  return (
    <DashboardContext.Provider value={{ ...snapshot, mutate, busy, notify: setToast, refresh }}>
      <div className={`app-shell ${collapsed ? 'sidebar-collapsed' : ''}`}>
        <aside className="sidebar">
          <Link href={`/${role}/overview`} className="brand">
            <span className="brand-icon">
              <Building2 size={22} />
            </span>
            <span className="brand-word">
              PGConnect<span className="brand-period">.</span>
            </span>
          </Link>
          <button
            className="property-switch"
            onClick={() => router.push(`/${role}/${owner ? 'settings' : 'profile'}`)}
          >
            <span className="property-icon">
              <Building2 size={20} />
            </span>
            <span>
              <strong>{data.property.name}</strong>
              <small>{owner ? 'Owner workspace' : 'Your home, connected'}</small>
            </span>
            <ChevronDown size={15} />
          </button>
          <span className="nav-heading">WORKSPACE</span>
          <nav>
            {nav.map(({ id, label, icon: Icon }) => (
              <Link
                key={id}
                title={label}
                className={`nav-item ${page === id ? 'active' : ''}`}
                href={`/${role}/${id}`}
              >
                <Icon size={19} />
                <span>{label}</span>
                {id === 'complaints' && open > 0 && <b className="nav-count">{open}</b>}
              </Link>
            ))}
          </nav>
          <div className="sidebar-bottom">
            {owner && (
              <div className="invite-card">
                <div className="invite-icon">
                  <Users size={19} />
                  <span className="little-plus">+</span>
                </div>
                <strong>Make room for your people</strong>
                <p>Invite tenants to their new home.</p>
                <button onClick={() => setInvite(true)}>
                  Invite tenants <ArrowUpRight size={15} />
                </button>
              </div>
            )}
            <Link
              className={`nav-item ${page === (owner ? 'settings' : 'profile') ? 'active' : ''}`}
              href={`/${role}/${owner ? 'settings' : 'profile'}`}
            >
              {owner ? <Settings size={19} /> : <UserRound size={19} />}
              <span>{owner ? 'Settings' : 'My profile'}</span>
            </Link>
            <button className="account-button" onClick={() => setAccount(!account)}>
              <Avatar name={user.name} />
              <span>
                <strong>{user.name}</strong>
                <small>{owner ? 'PG Owner' : 'Tenant'}</small>
              </span>
              <ChevronDown size={15} />
            </button>
            {account && (
              <div className="account-menu">
                <button onClick={() => void logout()}>
                  <LogOut size={16} /> Sign out
                </button>
              </div>
            )}
          </div>
          <button
            className="collapse-control"
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            onClick={() => setCollapsed(!collapsed)}
          >
            {collapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}
          </button>
        </aside>
        <div className="workspace">
          <header className="topbar">
            <div className="breadcrumb">
              <span>Workspace</span>
              <ChevronLeft size={13} className="breadcrumb-arrow" />
              <strong>{current}</strong>
            </div>
            <div className="topbar-actions">
              <ThemeControl />
              {user.demo && <span className="demo-tag">Demo workspace</span>}
              <span className="property-location">
                {data.property.address.split(',').at(-1)?.trim()}
              </span>
              <button
                className="notification-button icon-button"
                aria-label="Notifications"
                onClick={() => setNotifications(true)}
              >
                <Bell size={19} />
                {unread > 0 && <i />}
              </button>
              <button
                className="top-account-button"
                aria-label="Account and navigation"
                onClick={() => setAccount(!account)}
              >
                <Avatar name={user.name} />
              </button>
              {account && (
                <div className="top-account-menu">
                  {nav.map((n) => (
                    <Link key={n.id} href={`/${role}/${n.id}`} onClick={() => setAccount(false)}>
                      {n.label}
                    </Link>
                  ))}
                  <Link
                    href={`/${role}/${owner ? 'settings' : 'profile'}`}
                    onClick={() => setAccount(false)}
                  >
                    {owner ? 'Settings' : 'My profile'}
                  </Link>
                  <button onClick={() => void logout()}>
                    <LogOut size={14} /> Sign out
                  </button>
                </div>
              )}
            </div>
          </header>
          <main className="main-content">
            {page === 'overview' ? (
              <Overview onInvite={() => setInvite(true)} />
            ) : page === 'tenants' && owner ? (
              <Tenants />
            ) : page === 'rent' ? (
              <RentPage />
            ) : page === 'complaints' ? (
              <Complaints />
            ) : page === 'announcements' ? (
              <Announcements />
            ) : page === 'food' ? (
              <Food />
            ) : (page === 'settings' && owner) || page === 'profile' ? (
              <SettingsPage />
            ) : (
              <div className="empty-state">
                <h2>This page is for PG owners.</h2>
                <Link href={`/${role}/overview`}>Return home</Link>
              </div>
            )}
            <footer className="workspace-footer">
              <span>
                <span className="footer-dot" /> A little more connected. A little more home.
              </span>
              <span>PGConnect</span>
            </footer>
          </main>
        </div>
        <nav className="mobile-nav">
          {nav.slice(0, 4).map(({ id, label, icon: Icon }) => (
            <Link key={id} href={`/${role}/${id}`} className={page === id ? 'active' : ''}>
              <Icon size={19} />
              <span>{id === 'rent' ? 'Dues' : id === 'complaints' ? 'Complaints' : label}</span>
            </Link>
          ))}
          <Link href={`/${role}/food`} className={page === 'food' ? 'active' : ''}>
            <Utensils size={19} />
            <span>Food</span>
          </Link>
        </nav>
        {toast && (
          <div className="toast" role="status">
            <Check size={18} />
            {toast}
            <button onClick={() => setToast('')} aria-label="Dismiss">
              <X size={16} />
            </button>
          </div>
        )}
        {invite && (
          <Modal title="Welcome someone new" onClose={() => setInvite(false)}>
            <div className="modal-body">
              <p className="muted">
                Share your PG code with tenants. They can use it during signup to join{' '}
                {data.property.name}.
              </p>
              <div className="invite-code">{data.property.code}</div>
              <button
                className="button primary full"
                onClick={() => {
                  void navigator.clipboard
                    .writeText(data.property.code)
                    .then(() => setToast('Invite code copied.'))
                    .catch(() => setToast('Please select and copy the code above.'));
                }}
              >
                Copy invite code
              </button>
              <button
                className="button secondary full"
                onClick={() => {
                  void navigator.clipboard
                    .writeText(`${window.location.origin}/login?invite=${data.property.code}`)
                    .then(() => setToast('Invite link copied.'))
                    .catch(() => setToast('Clipboard is unavailable. Share the code instead.'));
                }}
              >
                Copy invite link
              </button>
            </div>
          </Modal>
        )}
        {notifications && (
          <Modal title="Your notifications" onClose={() => setNotifications(false)}>
            <div className="modal-body">
              {data.notifications.length ? (
                data.notifications.map((n) => (
                  <div className="notification-item" key={n.id}>
                    <span className="whatsapp-label">In-app payment reminder</span>
                    <p>{n.text}</p>
                    <small className="muted">{new Date(n.createdAt).toLocaleString('en-IN')}</small>
                  </div>
                ))
              ) : (
                <div className="empty-state">
                  <Bell size={26} />
                  <h3>You’re all caught up.</h3>
                  <p>New reminders will appear here.</p>
                </div>
              )}
              {!owner && unread > 0 && (
                <button
                  className="button secondary"
                  disabled={busy}
                  onClick={() => void mutate({ type: 'notifications-read' })}
                >
                  Mark all as read
                </button>
              )}
            </div>
          </Modal>
        )}
      </div>
    </DashboardContext.Provider>
  );
}
