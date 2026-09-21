'use client';
import { createContext, useContext } from 'react';
import type { Snapshot } from '@/lib/types';
import type { Action } from '@/server/services/dashboard';
export interface DashboardContextValue extends Snapshot {
  mutate: (action: Action) => Promise<boolean>;
  busy: boolean;
  notify: (message: string) => void;
  refresh: () => Promise<void>;
}
export const DashboardContext = createContext<DashboardContextValue | null>(null);
export function useDashboard() {
  const value = useContext(DashboardContext);
  if (!value) throw new Error('Dashboard provider is required.');
  return value;
}
