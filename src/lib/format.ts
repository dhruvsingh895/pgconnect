export const money = (value: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value);
export const date = (value: string) =>
  new Date(value).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
export const initials = (name: string) =>
  name
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('');
export const currentMonth = () => new Date().toISOString().slice(0, 7);
export const monthLabel = (month: string) =>
  new Date(`${month}-01T12:00:00`).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
export const isOverdue = (due: string) => due.slice(0, 10) < new Date().toISOString().slice(0, 10);
