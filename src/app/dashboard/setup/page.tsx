import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { getUserOrganization } from '@/actions/organizations';
import { OrganizationSetup } from './organization-setup';
import { SetupHeader } from './setup-header';

export default async function SetupPage() {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user) {
    redirect('/login');
  }

  // Check if user already has an organization
  const orgResult = await getUserOrganization();
  
  if (orgResult.success && orgResult.data) {
    // User already has an org, redirect to dashboard
    redirect('/dashboard');
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      <SetupHeader userName={session.user.name} userEmail={session.user.email} />
      <div className="container max-w-6xl mx-auto py-12 px-4">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold tracking-tight mb-4">
            Welcome to Focal
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            To get started with FinOps analytics, you need to either create a new 
            organization or join an existing one via invitation.
          </p>
        </div>

        <OrganizationSetup userEmail={session.user.email} userName={session.user.name} />
      </div>
    </div>
  );
}
