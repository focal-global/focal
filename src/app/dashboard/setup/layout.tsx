import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';

interface SetupLayoutProps {
  children: React.ReactNode;
}

export default async function SetupLayout({ children }: SetupLayoutProps) {
  // Protect the route - redirect to login if not authenticated
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user) {
    redirect('/login');
  }

  // This layout doesn't include the dashboard shell/sidebar
  // since users without orgs shouldn't see the full navigation
  return <>{children}</>;
}
