import { notFound } from 'next/navigation';
import { DashboardShell } from '@/features/dashboard/shell';
export default async function DashboardPage({
  params,
}: {
  params: Promise<{ role: string; page: string }>;
}) {
  const { role, page } = await params;
  if (
    !['owner', 'tenant'].includes(role) ||
    ![
      'overview',
      'tenants',
      'rent',
      'announcements',
      'food',
      'complaints',
      'settings',
      'profile',
    ].includes(page)
  )
    notFound();
  return <DashboardShell role={role} page={page} />;
}
