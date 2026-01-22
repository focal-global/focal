import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { TopologyClient } from './topology-client';

export const metadata = {
  title: 'Topology | Focal',
  description: 'Visual map of your cloud infrastructure costs',
};

export default async function TopologyPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect('/login');
  }

  return <TopologyClient />;
}
