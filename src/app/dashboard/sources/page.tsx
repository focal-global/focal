import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { getConnectors } from '@/actions/connectors';
import { getMyDataSources } from '@/actions/data-sources';
import { getUserOrganization } from '@/actions/organizations';
import { DataSourcesClient } from './sources-client';

export default async function DataSourcesPage() {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user) {
    redirect('/login');
  }

  // Check if user has an organization
  const orgResult = await getUserOrganization();
  if (!orgResult.success || !orgResult.data) {
    redirect('/dashboard/setup');
  }

  const [connectorsResult, dataSourcesResult] = await Promise.all([
    getConnectors(),
    getMyDataSources(),
  ]);

  const connectors = connectorsResult.success ? connectorsResult.data : [];
  const savedDataSources = dataSourcesResult.success ? dataSourcesResult.dataSources : [];

  return <DataSourcesClient connectors={connectors} savedDataSources={savedDataSources} />;
}
