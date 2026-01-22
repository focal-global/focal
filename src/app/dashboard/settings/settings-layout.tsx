'use client';

import { Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { 
  User, 
  Building2, 
  HardDrive, 
  Bell, 
  Shield, 
  Palette,
  Users,
  CreditCard,
  Settings,
  ChevronRight,
  Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

// Import settings components
import { ProfileSettings } from '@/components/settings/profile-settings';
import { OrganizationSettings } from '@/components/settings/organization-settings';
import { StorageManager } from '@/components/settings/storage-manager';

interface SettingsLayoutProps {
  activeTab: string;
  isOrgOwner: boolean;
  isOrgAdmin: boolean;
  isSuperAdmin: boolean;
  userName: string;
  userEmail: string;
}

interface NavItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  badge?: string;
  badgeVariant?: 'default' | 'secondary' | 'destructive' | 'outline';
  requiresAdmin?: boolean;
  requiresOwner?: boolean;
  requiresSuperAdmin?: boolean;
  comingSoon?: boolean;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

const navigationGroups: NavGroup[] = [
  {
    title: 'Account',
    items: [
      {
        id: 'profile',
        label: 'Profile',
        icon: User,
        description: 'Personal information and preferences',
      },
      {
        id: 'notifications',
        label: 'Notifications',
        icon: Bell,
        description: 'Email and alert preferences',
        comingSoon: true,
      },
      {
        id: 'appearance',
        label: 'Appearance',
        icon: Palette,
        description: 'Theme and display settings',
        comingSoon: true,
      },
    ],
  },
  {
    title: 'Organization',
    items: [
      {
        id: 'organization',
        label: 'General',
        icon: Building2,
        description: 'Organization details and team',
      },
      {
        id: 'billing',
        label: 'Billing & Plan',
        icon: CreditCard,
        description: 'Subscription and payment',
        requiresOwner: true,
        comingSoon: true,
      },
      {
        id: 'members',
        label: 'Team Members',
        icon: Users,
        description: 'Manage team and invitations',
        requiresAdmin: true,
      },
    ],
  },
  {
    title: 'Data & Privacy',
    items: [
      {
        id: 'storage',
        label: 'Local Storage',
        icon: HardDrive,
        description: 'Manage browser storage',
      },
      {
        id: 'security',
        label: 'Security',
        icon: Shield,
        description: 'Password and security options',
        comingSoon: true,
      },
    ],
  },
];

function LoadingFallback() {
  return (
    <Card>
      <CardContent className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </CardContent>
    </Card>
  );
}

export function SettingsLayout({ 
  activeTab, 
  isOrgOwner, 
  isOrgAdmin, 
  isSuperAdmin,
  userName,
  userEmail,
}: SettingsLayoutProps) {
  const router = useRouter();

  const handleTabChange = (tabId: string) => {
    router.push(`/dashboard/settings?tab=${tabId}`);
  };

  const isItemVisible = (item: NavItem): boolean => {
    if (item.requiresSuperAdmin && !isSuperAdmin) return false;
    if (item.requiresOwner && !isOrgOwner) return false;
    if (item.requiresAdmin && !isOrgAdmin) return false;
    return true;
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'profile':
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold tracking-tight">Profile Settings</h2>
              <p className="text-muted-foreground">
                Manage your personal information and account preferences.
              </p>
            </div>
            <Suspense fallback={<LoadingFallback />}>
              <ProfileSettings />
            </Suspense>
          </div>
        );

      case 'organization':
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold tracking-tight">Organization Settings</h2>
              <p className="text-muted-foreground">
                Manage your organization details, team members, and invitations.
              </p>
            </div>
            <Suspense fallback={<LoadingFallback />}>
              <OrganizationSettings />
            </Suspense>
          </div>
        );

      case 'members':
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold tracking-tight">Team Members</h2>
              <p className="text-muted-foreground">
                Manage your team members, roles, and pending invitations.
              </p>
            </div>
            <Suspense fallback={<LoadingFallback />}>
              <OrganizationSettings showMembersOnly />
            </Suspense>
          </div>
        );

      case 'storage':
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold tracking-tight">Local Storage</h2>
              <p className="text-muted-foreground">
                Control how billing data is stored and managed in your browser.
              </p>
            </div>
            <Suspense fallback={<LoadingFallback />}>
              <StorageManager />
            </Suspense>
          </div>
        );

      case 'notifications':
      case 'appearance':
      case 'billing':
      case 'security':
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold tracking-tight">
                {navigationGroups
                  .flatMap(g => g.items)
                  .find(i => i.id === activeTab)?.label || 'Settings'}
              </h2>
              <p className="text-muted-foreground">
                {navigationGroups
                  .flatMap(g => g.items)
                  .find(i => i.id === activeTab)?.description}
              </p>
            </div>
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4">
                  <Settings className="h-6 w-6 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold mb-2">Coming Soon</h3>
                <p className="text-sm text-muted-foreground max-w-md">
                  This feature is currently under development and will be available in a future update.
                </p>
              </CardContent>
            </Card>
          </div>
        );

      default:
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold tracking-tight">Profile Settings</h2>
              <p className="text-muted-foreground">
                Manage your personal information and account preferences.
              </p>
            </div>
            <Suspense fallback={<LoadingFallback />}>
              <ProfileSettings />
            </Suspense>
          </div>
        );
    }
  };

  return (
    <div className="container max-w-7xl mx-auto py-6">
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-1">
          Manage your account, organization, and application preferences.
        </p>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Sidebar Navigation */}
        <aside className="lg:w-64 flex-shrink-0">
          <nav className="space-y-6">
            {navigationGroups.map((group) => {
              const visibleItems = group.items.filter(isItemVisible);
              if (visibleItems.length === 0) return null;

              return (
                <div key={group.title}>
                  <h3 className="text-sm font-medium text-muted-foreground mb-2 px-3">
                    {group.title}
                  </h3>
                  <div className="space-y-1">
                    {visibleItems.map((item) => {
                      const Icon = item.icon;
                      const isActive = activeTab === item.id;
                      const isDisabled = item.comingSoon;

                      return (
                        <Button
                          key={item.id}
                          variant="ghost"
                          className={cn(
                            'w-full justify-start gap-3 h-auto py-2.5 px-3',
                            isActive && 'bg-muted',
                            isDisabled && 'opacity-50 cursor-not-allowed'
                          )}
                          onClick={() => !isDisabled && handleTabChange(item.id)}
                          disabled={isDisabled}
                        >
                          <Icon className="h-4 w-4 flex-shrink-0" />
                          <div className="flex-1 text-left">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium">{item.label}</span>
                              {item.comingSoon && (
                                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                                  Soon
                                </Badge>
                              )}
                              {item.requiresOwner && (
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-yellow-500/50 text-yellow-600">
                                  Owner
                                </Badge>
                              )}
                              {item.requiresAdmin && !item.requiresOwner && (
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-blue-500/50 text-blue-600">
                                  Admin
                                </Badge>
                              )}
                            </div>
                          </div>
                          {isActive && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                        </Button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 min-w-0">
          {renderContent()}
        </main>
      </div>
    </div>
  );
}
