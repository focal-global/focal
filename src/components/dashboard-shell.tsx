'use client';

import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { SpectrumProvider } from '@/components/providers';
import { AppSidebar } from '@/components/app-sidebar';
import { AppHeader } from '@/components/app-header';

interface DashboardShellProps {
  children: React.ReactNode;
  user: {
    id: string;
    name: string;
    email: string;
    image?: string | null;
  };
}

export function DashboardShell({ children, user }: DashboardShellProps) {
  return (
    <SidebarProvider>
      <SpectrumProvider>
        <AppSidebar user={user} />
        <SidebarInset>
          <AppHeader user={user} />
          <main className="flex-1 overflow-auto p-6">
            {children}
          </main>
        </SidebarInset>
      </SpectrumProvider>
    </SidebarProvider>
  );
}
