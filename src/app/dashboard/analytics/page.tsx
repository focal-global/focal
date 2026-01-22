import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { getMyDataSources } from '@/actions/data-sources';
import { AnalyticsClient } from './analytics-client';

export default async function AnalyticsPage() {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user) {
    redirect('/login');
  }

  const dataSourcesResult = await getMyDataSources();
  const dataSources = dataSourcesResult.success ? dataSourcesResult.dataSources : [];

  return <AnalyticsClient dataSources={dataSources} />;
}
