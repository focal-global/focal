'use client';

import { useState, Suspense, lazy } from 'react';
import dynamic from 'next/dynamic';
import { DashboardSelector, type DashboardPersona } from '@/components/dashboards';
import { DashboardPageSkeleton } from '@/components/ui/skeleton-loaders';

// Dynamically import heavy dashboard components
const CostOverviewDashboard = dynamic(
  () => import('@/components/dashboards').then(mod => ({ default: mod.CostOverviewDashboard })),
  { loading: () => <DashboardPageSkeleton /> }
);

const ExecutiveDashboard = dynamic(
  () => import('@/components/dashboards').then(mod => ({ default: mod.ExecutiveDashboard })),
  { loading: () => <DashboardPageSkeleton /> }
);

const FinanceDashboard = dynamic(
  () => import('@/components/dashboards').then(mod => ({ default: mod.FinanceDashboard })),
  { loading: () => <DashboardPageSkeleton /> }
);

const EngineeringDashboard = dynamic(
  () => import('@/components/dashboards').then(mod => ({ default: mod.EngineeringDashboard })),
  { loading: () => <DashboardPageSkeleton /> }
);

interface DashboardClientProps {
  organizationName: string;
}

export function DashboardClient({ organizationName }: DashboardClientProps) {
  const [currentPersona, setCurrentPersona] = useState<DashboardPersona>('overview');

  const renderDashboard = () => {
    switch (currentPersona) {
      case 'executive':
        return <ExecutiveDashboard />;
      case 'finance':
        return <FinanceDashboard />;
      case 'engineering':
        return <EngineeringDashboard />;
      case 'overview':
      default:
        return <CostOverviewDashboard />;
    }
  };

  const getDescription = () => {
    switch (currentPersona) {
      case 'executive':
        return 'High-level KPIs and business insights for leadership';
      case 'finance':
        return 'Budget tracking, cost allocation, and financial reporting';
      case 'engineering':
        return 'Resource optimization and utilization metrics for DevOps';
      case 'overview':
      default:
        return `Cloud cost overview for ${organizationName}`;
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            {getDescription()}
          </p>
        </div>
        <DashboardSelector
          currentPersona={currentPersona}
          onSelectPersona={setCurrentPersona}
        />
      </div>

      {/* Active Dashboard */}
      {renderDashboard()}
    </div>
  );
}
