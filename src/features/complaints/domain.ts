import type { ComplaintStatus } from '@/lib/types';
const transitions: Record<ComplaintStatus, ComplaintStatus[]> = {
  Open: ['In progress', 'Resolved'],
  'In progress': ['Open', 'Resolved'],
  Resolved: ['Open'],
};
export function canTransition(from: ComplaintStatus, to: ComplaintStatus) {
  return from === to || transitions[from].includes(to);
}
