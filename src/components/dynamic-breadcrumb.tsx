'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Fragment } from 'react';
import { 
  Home,
  BarChart3,
  Database,
  AlertTriangle,
  Workflow,
  Settings,
  Brain,
  Zap,
  Users,
  Shield,
  Target,
  TrendingUp,
  ChevronRight,
  User,
  HardDrive,
  Palette,
  Bell
} from 'lucide-react';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';

// Route configuration with proper categorization
const ROUTE_CONFIG: Record<string, { 
  label: string; 
  icon: React.ComponentType<{ className?: string }>;
  description?: string;
  shortLabel?: string;
  category?: string; // Main category this belongs to
  isRoot?: boolean; // If this should be treated as a top-level route
}> = {
  // HEADQUARTERS category
  'dashboard': { 
    label: 'Cockpit', 
    shortLabel: 'Cockpit',
    icon: Home,
    description: 'Executive dashboard with KPIs and trends',
    category: 'HEADQUARTERS',
    isRoot: true
  },
  'topology': { 
    label: 'Topology', 
    shortLabel: 'Topology',
    icon: TrendingUp,
    description: 'Visual map of your cloud infrastructure costs',
    category: 'HEADQUARTERS'
  },
  
  // INTELLIGENCE category
  'intelligence': { 
    label: 'Intelligence Hub', 
    shortLabel: 'Intelligence',
    icon: Brain,
    description: 'AI-powered cost insights',
    category: 'INTELLIGENCE',
    isRoot: true
  },
  'unit-economics': { 
    label: 'Unit Economics', 
    shortLabel: 'Unit Econ',
    icon: Target,
    description: 'Cost per unit analysis',
    category: 'INTELLIGENCE'
  },
  
  // DETECT category
  'detector': { 
    label: 'Detector Hub', 
    shortLabel: 'Detector',
    icon: AlertTriangle,
    description: 'AI-powered optimization and detection hub',
    category: 'DETECT',
    isRoot: true
  },
  'anomalies': { 
    label: 'Anomalies', 
    shortLabel: 'Anomalies',
    icon: Zap,
    description: 'Detected cost anomalies',
    category: 'DETECT'
  },
  
  // DATA ENGINE category  
  'sources': { 
    label: 'Data Sources', 
    shortLabel: 'Sources',
    icon: Database,
    description: 'Manage billing data sources',
    category: 'DATA ENGINE',
    isRoot: true
  },
  'connectors': { 
    label: 'Connectors', 
    shortLabel: 'Connectors',
    icon: Workflow,
    description: 'Cloud provider integrations',
    category: 'DATA ENGINE',
    isRoot: true
  },
  'settings': { 
    label: 'Settings', 
    shortLabel: 'Settings',
    icon: Settings,
    description: 'Account and system preferences',
    category: 'DATA ENGINE',
    isRoot: true
  },
  
  // Legacy/Generic routes
  'analytics': { 
    label: 'Analytics', 
    shortLabel: 'Analytics',
    icon: BarChart3,
    description: 'Cost analysis and reporting',
    isRoot: true
  },
  
  // Settings sub-sections (for future use)
  'profile': { 
    label: 'Profile Settings', 
    shortLabel: 'Profile',
    icon: User,
    description: 'Personal profile settings'
  },
  'admin': { 
    label: 'User Management', 
    shortLabel: 'Admin',
    icon: Users,
    description: 'Administrative controls'
  },
  'storage': { 
    label: 'Storage Management', 
    shortLabel: 'Storage',
    icon: HardDrive,
    description: 'Local data storage settings'
  },
  'notifications': { 
    label: 'Notifications', 
    shortLabel: 'Alerts',
    icon: Bell,
    description: 'Notification preferences'
  },
  'appearance': { 
    label: 'Appearance', 
    shortLabel: 'Theme',
    icon: Palette,
    description: 'Theme and display settings'
  },
};

interface DynamicBreadcrumbProps {
  className?: string;
}

export function DynamicBreadcrumb({ className }: DynamicBreadcrumbProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  
  // Get tab parameter for settings page
  const currentTab = searchParams.get('tab');
  
  // Split path and filter out empty strings
  const pathSegments = pathname.split('/').filter(segment => segment !== '');
  
  // Skip "dashboard" as it's just a routing prefix
  const filteredSegments = pathSegments[0] === 'dashboard' ? pathSegments.slice(1) : pathSegments;
  
  // Build breadcrumb items with cumulative paths
  const breadcrumbItems = filteredSegments.map((segment, index) => {
    // Build the actual path including the dashboard prefix if it was there
    const fullPathSegments = pathSegments[0] === 'dashboard' ? ['dashboard', ...filteredSegments.slice(0, index + 1)] : filteredSegments.slice(0, index + 1);
    const path = '/' + fullPathSegments.join('/');
    
    const config = ROUTE_CONFIG[segment] || { 
      label: segment.charAt(0).toUpperCase() + segment.slice(1),
      shortLabel: segment.charAt(0).toUpperCase() + segment.slice(1),
      icon: Home 
    };
    const isLast = index === filteredSegments.length - 1;
    
    return {
      segment,
      path,
      config,
      isLast,
      index
    };
  });

  // Add tab as a virtual breadcrumb item if we're on settings and have a tab
  if (pathname.includes('/settings') && currentTab && ROUTE_CONFIG[currentTab]) {
    const tabConfig = ROUTE_CONFIG[currentTab];
    breadcrumbItems.push({
      segment: currentTab,
      path: `${pathname}?tab=${currentTab}`,
      config: tabConfig,
      isLast: true,
      index: breadcrumbItems.length
    });
    
    // Mark the previous last item as not last
    if (breadcrumbItems.length > 1) {
      breadcrumbItems[breadcrumbItems.length - 2].isLast = false;
    }
  }

  // If we're on the root dashboard, show "Cockpit"
  if (pathname === '/dashboard' || pathname === '/') {
    const dashboardConfig = ROUTE_CONFIG.dashboard;
    const Icon = dashboardConfig.icon;
    
    return (
      <Breadcrumb className={className}>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbPage className="flex items-center gap-2">
              <Icon className="h-4 w-4" />
              <span className="hidden sm:inline">{dashboardConfig.label}</span>
              <span className="sm:hidden">{dashboardConfig.shortLabel}</span>
            </BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
    );
  }

  // If we have no filtered segments (shouldn't happen, but safety check)
  if (filteredSegments.length === 0) {
    return (
      <Breadcrumb className={className}>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbPage className="flex items-center gap-2">
              <Home className="h-4 w-4" />
              <span>Cockpit</span>
            </BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
    );
  }

  return (
    <Breadcrumb className={className}>
      <BreadcrumbList>
        {breadcrumbItems.map((item, index) => {
          const ItemIcon = item.config.icon;
          
          return (
            <Fragment key={item.path}>
              <BreadcrumbItem>
                {item.isLast ? (
                  <BreadcrumbPage className="flex items-center gap-2">
                    <ItemIcon className="h-4 w-4" />
                    <span className="hidden sm:inline">{item.config.label}</span>
                    <span className="sm:hidden">{item.config.shortLabel || item.config.label}</span>
                  </BreadcrumbPage>
                ) : (
                  <BreadcrumbLink asChild>
                    <Link 
                      href={item.path} 
                      className="flex items-center gap-2 hover:text-foreground transition-colors"
                    >
                      <ItemIcon className="h-4 w-4" />
                      <span className="hidden sm:inline">{item.config.label}</span>
                      <span className="sm:hidden">{item.config.shortLabel || item.config.label}</span>
                    </Link>
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
              
              {!item.isLast && (
                <BreadcrumbSeparator>
                  <ChevronRight className="h-4 w-4" />
                </BreadcrumbSeparator>
              )}
            </Fragment>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}

// Export route config for use in other components
export { ROUTE_CONFIG };