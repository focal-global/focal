import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { getConnectors } from '@/actions/connectors';
import { getUserOrganization } from '@/actions/organizations';
import { ConnectorsClient } from './connectors-client';

export default async function ConnectorsPage() {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user) {
    redirect('/login');
  }

  // Check if user has an organization
  const orgResult = await getUserOrganization();
  if (!orgResult.success || !orgResult.data) {
    redirect('/dashboard/setup');
  }

  const result = await getConnectors();
  const connectors = result.success ? result.data : [];

  return <ConnectorsClient initialConnectors={connectors} />;
}
