import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { getUserOrganization } from '@/actions/organizations';
import { DashboardClient } from './dashboard-client';

export default async function DashboardPage() {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user) {
    redirect('/login');
  }

  // Check if user has an organization
  const orgResult = await getUserOrganization();
  
  if (!orgResult.success || !orgResult.data) {
    redirect('/dashboard/setup');
  }

  return <DashboardClient organizationName={orgResult.data.name} />;
}
