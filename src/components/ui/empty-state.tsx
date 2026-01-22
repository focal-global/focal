/**
 * Elegant Empty State Component
 * 
 * Provides a consistent "no data" state that can overlay content
 * without covering the sidebar, with optional blur effect.
 */

import { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Database, ArrowRight, Cable } from 'lucide-react';
import Link from 'next/link';

// ============================================================================
// Skeleton Preview Components (for background)
// ============================================================================

function SkeletonBar({ className }: { className?: string }) {
  return <div className={cn("bg-muted/50 rounded animate-pulse", className)} />;
}

function DashboardSkeletonPreview() {
  return (
    <div className="space-y-6 p-6">
      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="bg-card/30">
            <CardContent className="pt-6">
              <div className="flex items-start justify-between">
                <div className="space-y-2 flex-1">
                  <SkeletonBar className="h-4 w-24" />
                  <SkeletonBar className="h-8 w-32" />
                  <SkeletonBar className="h-3 w-20" />
                </div>
                <SkeletonBar className="h-10 w-10 rounded-lg" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid gap-6 md:grid-cols-2">
        {[1, 2].map((i) => (
          <Card key={i} className="bg-card/30">
            <CardHeader>
              <SkeletonBar className="h-5 w-32" />
              <SkeletonBar className="h-4 w-48" />
            </CardHeader>
            <CardContent>
              <SkeletonBar className="h-[200px] w-full" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Table */}
      <Card className="bg-card/30">
        <CardHeader>
          <SkeletonBar className="h-5 w-32" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex gap-4 pb-2 border-b border-border/30">
              <SkeletonBar className="h-4 w-24" />
              <SkeletonBar className="h-4 w-32" />
              <SkeletonBar className="h-4 w-20" />
              <SkeletonBar className="h-4 w-16 ml-auto" />
            </div>
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex gap-4 py-2">
                <SkeletonBar className="h-4 w-24" />
                <SkeletonBar className="h-4 w-32" />
                <SkeletonBar className="h-4 w-20" />
                <SkeletonBar className="h-4 w-16 ml-auto" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function DetectorSkeletonPreview() {
  return (
    <div className="space-y-6 p-6">
      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="bg-card/30">
            <CardContent className="pt-6 text-center">
              <SkeletonBar className="h-4 w-20 mx-auto mb-2" />
              <SkeletonBar className="h-8 w-24 mx-auto" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main Content */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <Card key={i} className="bg-card/30">
              <CardContent className="py-4">
                <div className="flex items-center gap-4">
                  <SkeletonBar className="h-10 w-10 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <SkeletonBar className="h-4 w-3/4" />
                    <SkeletonBar className="h-3 w-1/2" />
                  </div>
                  <SkeletonBar className="h-6 w-20" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        <Card className="bg-card/30">
          <CardHeader>
            <SkeletonBar className="h-5 w-32" />
          </CardHeader>
          <CardContent>
            <SkeletonBar className="h-[300px] w-full rounded-full" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function AnalyticsSkeletonPreview() {
  return (
    <div className="space-y-6 p-6">
      {/* Main Chart */}
      <Card className="bg-card/30">
        <CardHeader>
          <SkeletonBar className="h-5 w-40" />
          <SkeletonBar className="h-4 w-64" />
        </CardHeader>
        <CardContent>
          <SkeletonBar className="h-[350px] w-full" />
        </CardContent>
      </Card>

      {/* Grid */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card className="bg-card/30">
          <CardHeader>
            <SkeletonBar className="h-5 w-32" />
          </CardHeader>
          <CardContent>
            <SkeletonBar className="h-[250px] w-full" />
          </CardContent>
        </Card>
        <Card className="bg-card/30">
          <CardHeader>
            <SkeletonBar className="h-5 w-32" />
          </CardHeader>
          <CardContent className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex gap-4 py-2">
                <SkeletonBar className="h-4 w-32" />
                <SkeletonBar className="h-4 w-20" />
                <SkeletonBar className="h-4 w-16 ml-auto" />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ============================================================================
// Main Empty State Types
// ============================================================================

interface EmptyStateProps {
  /** Icon component to display */
  icon: React.ComponentType<{ className?: string }>;
  /** Main title text */
  title: string;
  /** Description text */
  description: string;
  /** Optional action button */
  action?: {
    label: string;
    onClick?: () => void;
    href?: string;
  };
  /** Whether to show as overlay (blurs background content) */
  overlay?: boolean;
  /** Skeleton type to show behind the overlay */
  skeletonType?: 'dashboard' | 'detector' | 'analytics' | 'custom';
  /** Custom CSS classes */
  className?: string;
  /** Children to render behind the overlay (when overlay=true) */
  children?: ReactNode;
}

// ============================================================================
// Main Component
// ============================================================================

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  overlay = false,
  skeletonType,
  className,
  children,
}: EmptyStateProps) {
  // Render skeleton based on type
  const renderSkeleton = () => {
    if (children) return children;
    
    switch (skeletonType) {
      case 'dashboard':
        return <DashboardSkeletonPreview />;
      case 'detector':
        return <DetectorSkeletonPreview />;
      case 'analytics':
        return <AnalyticsSkeletonPreview />;
      default:
        return <DashboardSkeletonPreview />;
    }
  };

  if (overlay || skeletonType) {
    return (
      <div className={cn("relative min-h-[600px]", className)}>
        {/* Background content (blurred skeleton) */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none select-none">
          <div className="blur-[2px] opacity-40 scale-[1.01]">
            {renderSkeleton()}
          </div>
        </div>
        
        {/* Gradient overlay for depth */}
        <div className="absolute inset-0 bg-gradient-to-b from-background/60 via-background/80 to-background/60" />
        
        {/* Centered call-to-action */}
        <div className="absolute inset-0 flex items-center justify-center">
          <Card className="p-8 max-w-lg mx-4 border-2 border-dashed border-muted-foreground/30 bg-card/95 backdrop-blur-sm shadow-2xl">
            <div className="text-center space-y-5">
              <div className="mx-auto w-20 h-20 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center ring-1 ring-primary/20">
                <Icon className="w-10 h-10 text-primary" />
              </div>
              
              <div className="space-y-2">
                <h3 className="text-xl font-semibold">{title}</h3>
                <p className="text-sm text-muted-foreground max-w-sm mx-auto leading-relaxed">
                  {description}
                </p>
              </div>
              
              {action && (
                action.href ? (
                  <Button asChild size="lg" className="mt-2 gap-2">
                    <Link href={action.href}>
                      {action.label}
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                ) : (
                  <Button onClick={action.onClick} size="lg" className="mt-2 gap-2">
                    {action.label}
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                )
              )}
            </div>
          </Card>
        </div>
      </div>
    );
  }

  // Standard centered empty state (no skeleton background)
  return (
    <div className={cn("flex items-center justify-center h-full min-h-[400px]", className)}>
      <div className="text-center space-y-4 max-w-md mx-4">
        <div className="mx-auto w-16 h-16 rounded-full bg-muted flex items-center justify-center">
          <Icon className="w-8 h-8 text-muted-foreground" />
        </div>
        
        <div className="space-y-2">
          <h3 className="text-lg font-semibold">{title}</h3>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        
        {action && (
          action.href ? (
            <Button asChild className="mt-4">
              <Link href={action.href}>{action.label}</Link>
            </Button>
          ) : (
            <Button onClick={action.onClick} className="mt-4">
              {action.label}
            </Button>
          )
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Preset Empty States
// ============================================================================

interface NoDataStateProps {
  skeletonType?: 'dashboard' | 'detector' | 'analytics';
  className?: string;
}

export function NoDataState({ skeletonType = 'dashboard', className }: NoDataStateProps) {
  return (
    <EmptyState
      icon={Database}
      title="No Data Available"
      description="Connect a cloud data source to start analyzing your costs. Your data stays in your browser - we never see it."
      action={{
        label: "Connect Data Source",
        href: "/dashboard/sources",
      }}
      skeletonType={skeletonType}
      className={className}
    />
  );
}

export function NoConnectorState({ className }: { className?: string }) {
  return (
    <EmptyState
      icon={Cable}
      title="No Connectors Configured"
      description="Set up a connector to your cloud provider to start importing cost data."
      action={{
        label: "Add Connector",
        href: "/dashboard/connectors",
      }}
      skeletonType="dashboard"
      className={className}
    />
  );
}