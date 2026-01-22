import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { db } from '@/db';
import { user, member } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { SettingsLayout } from './settings-layout';

interface SettingsPageProps {
  searchParams: Promise<{ tab?: string }>;
}

export default async function SettingsPage({ searchParams }: SettingsPageProps) {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user) {
    redirect('/login');
  }

  // Get user details and organization role
  const [userData, memberData] = await Promise.all([
    db
      .select({ 
        isSuperAdmin: user.isSuperAdmin,
      })
      .from(user)
      .where(eq(user.id, session.user.id))
      .limit(1),
    db.query.member.findFirst({
      where: eq(member.userId, session.user.id),
    }),
  ]);

  const isSuperAdmin = userData[0]?.isSuperAdmin || false;
  const orgRole = memberData?.role || 'member';
  const isOrgOwner = orgRole === 'owner';
  const isOrgAdmin = orgRole === 'owner' || orgRole === 'admin';

  // Resolve searchParams
  const params = await searchParams;
  const activeTab = params.tab || 'profile';

  return (
    <SettingsLayout 
      activeTab={activeTab}
      isOrgOwner={isOrgOwner}
      isOrgAdmin={isOrgAdmin}
      isSuperAdmin={isSuperAdmin}
      userName={session.user.name}
      userEmail={session.user.email}
    />
  );
}