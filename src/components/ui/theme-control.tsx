'use client';

import { useSyncExternalStore } from 'react';
import { Sun, Moon, Monitor } from 'lucide-react';

type Theme = 'light' | 'dark' | 'system';
const storageKey = 'pgconnect-theme';
const isTheme = (value: string | null): value is Theme =>
  value === 'light' || value === 'dark' || value === 'system';

function applyTheme(theme: Theme) {
  const resolved =
    theme === 'system'
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light'
      : theme;
  document.documentElement.dataset.theme = resolved;
  document.documentElement.dataset.themePreference = theme;
  document.documentElement.style.colorScheme = resolved;
}

function snapshot(): Theme {
  const value = document.documentElement.dataset.themePreference ?? null;
  return isTheme(value) ? value : 'system';
}

function subscribe(listener: () => void) {
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  const update = () => {
    applyTheme(snapshot());
    listener();
  };
  const storage = (event: StorageEvent) => {
    if (event.key !== storageKey && event.key !== null) return;
    applyTheme(isTheme(event.newValue) ? event.newValue : 'system');
    listener();
  };
  window.addEventListener('pgconnect-theme-change', update);
  window.addEventListener('storage', storage);
  media.addEventListener('change', update);
  return () => {
    window.removeEventListener('pgconnect-theme-change', update);
    window.removeEventListener('storage', storage);
    media.removeEventListener('change', update);
  };
}

export function ThemeControl({ expanded = false }: { expanded?: boolean }) {
  const theme = useSyncExternalStore(subscribe, snapshot, () => 'system' as Theme);
  function select(value: Theme) {
    applyTheme(value);
    try {
      localStorage.setItem(storageKey, value);
    } catch {
      /* The current page still works when storage is unavailable. */
    }
    window.dispatchEvent(new Event('pgconnect-theme-change'));
  }
  return (
    <div
      className={`theme-control ${expanded ? 'expanded' : ''}`}
      role="group"
      aria-label="Color theme"
    >
      {(
        [
          { value: 'light', label: 'Light', icon: Sun },
          { value: 'dark', label: 'Dark', icon: Moon },
          { value: 'system', label: 'System', icon: Monitor },
        ] as const
      ).map(({ value, label, icon: Icon }) => (
        <button
          key={value}
          type="button"
          aria-label={`${label} mode`}
          aria-pressed={theme === value}
          title={`${label} mode`}
          onClick={() => select(value)}
        >
          <Icon size={15} />
          {expanded && <span>{label}</span>}
        </button>
      ))}
    </div>
  );
}
