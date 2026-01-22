import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { DashboardShell } from '@/components/dashboard-shell';
import { getUserOrganization } from '@/actions/organizations';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export default async function DashboardLayout({ children }: DashboardLayoutProps) {
  // Protect the route - redirect to login if not authenticated
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user) {
    redirect('/login');
  }

  return (
    <DashboardShell user={session.user}>
      {children}
    </DashboardShell>
  );
}
