'use client';

/**
 * App Sidebar - FinOps Hub Navigation
 * 
 * Comprehensive navigation structure for the Focal platform.
 * Organized into collapsible groups by FinOps domain:
 * - HEADQUARTERS: Core dashboards and topology
 * - INTELLIGENCE: Analytics and insights
 * - DETECT: Optimization and anomaly detection
 * - CONTROLLER: Operational controls (Premium)
 * - DATA ENGINE: Configuration and data management
 */

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  // Headquarters
  LayoutDashboard,
  Network,
  // Intelligence
  Telescope,
  Scale,
  Container,
  Leaf,
  // Detect
  Siren,
  Trash2,
  BrainCircuit,
  Calculator,
  // Controller
  CreditCard,
  ShieldAlert,
  Workflow,
  // Data Engine
  DatabaseZap,
  Tags,
  Settings,
  Cable,
  // UI
  ChevronRight,
  Sparkles,
  Lock,
  type LucideIcon,
} from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

// ============================================================================
// Types
// ============================================================================

interface NavItem {
  title: string;
  href: string;
  icon: LucideIcon;
  /** Whether the page is implemented and clickable */
  implemented?: boolean;
  /** Premium feature indicator */
  premium?: boolean;
  /** New feature indicator */
  isNew?: boolean;
  /** Description for tooltip */
  description?: string;
}

interface NavGroup {
  title: string;
  items: NavItem[];
  /** Default collapsed state */
  defaultOpen?: boolean;
}

interface AppSidebarProps {
  user: {
    id: string;
    name: string;
    email: string;
    image?: string | null;
  };
}

// ============================================================================
// Navigation Configuration
// ============================================================================

const navigationGroups: NavGroup[] = [
  {
    title: 'HEADQUARTERS',
    defaultOpen: true,
    items: [
      {
        title: 'Cockpit',
        href: '/dashboard',
        icon: LayoutDashboard,
        implemented: true,
        description: 'Executive dashboard with KPIs and trends',
      },
      {
        title: 'Topology',
        href: '/dashboard/topology',
        icon: Network,
        implemented: true,
        isNew: true,
        description: 'Visual map of your cloud infrastructure costs',
      },
    ],
  },
  {
    title: 'INTELLIGENCE',
    defaultOpen: true,
    items: [
      {
        title: 'Intelligence Hub',
        href: '/dashboard/intelligence',
        icon: Telescope,
        implemented: true,
        description: 'Advanced analytics and cost intelligence',
        isNew: true,
      },
      {
        title: 'Unit Economics',
        href: '/dashboard/intelligence/unit-economics',
        icon: Scale,
        implemented: true,
        description: 'Cost per unit, customer, or transaction metrics',
        isNew: true,
      },
      {
        title: 'Kubernetes',
        href: '/dashboard/k8s',
        icon: Container,
        implemented: false,
        description: 'Container and Kubernetes cost allocation',
      },
      {
        title: 'Sustainability',
        href: '/dashboard/green-ops',
        icon: Leaf,
        implemented: false,
        description: 'Carbon footprint and sustainability metrics',
      },
    ],
  },
  {
    title: 'DETECT',
    defaultOpen: false,
    items: [
      {
        title: 'Detector Hub',
        href: '/dashboard/detector',
        icon: Siren,
        implemented: true,
        description: 'AI-powered optimization and detection hub',
        isNew: true,
      },
      {
        title: 'Anomalies',
        href: '/dashboard/detector/anomalies',
        icon: Siren,
        implemented: true,
        description: 'AI-powered cost anomaly detection',
        isNew: true,
      },
      {
        title: 'Waste Hunter',
        href: '/dashboard/waste',
        icon: Trash2,
        implemented: true,
        isNew: true,
        description: 'Find and eliminate unused resources',
      },
      {
        title: 'AI Analytics',
        href: '/dashboard/ai-spend',
        icon: BrainCircuit,
        implemented: true,
        isNew: true,
        description: 'Track AI/ML model training and inference costs',
      },
      {
        title: 'Savings Simulator',
        href: '/dashboard/simulator',
        icon: Calculator,
        implemented: true,
        isNew: true,
        description: 'Model cost savings scenarios',
      },
    ],
  },
  {
    title: 'CONTROLLER',
    defaultOpen: false,
    items: [
      {
        title: 'Wallet',
        href: '/dashboard/wallet',
        icon: CreditCard,
        implemented: false,
        premium: true,
        description: 'Bank integration and payment tracking',
      },
      {
        title: 'Guardrails',
        href: '/dashboard/guardrails',
        icon: ShieldAlert,
        implemented: false,
        premium: true,
        description: 'Budget alerts and kill switches',
      },
      {
        title: 'Automations',
        href: '/dashboard/automations',
        icon: Workflow,
        implemented: false,
        premium: true,
        description: 'Automated cost optimization workflows',
      },
    ],
  },
  {
    title: 'DATA ENGINE',
    defaultOpen: true,
    items: [
      {
        title: 'Sources',
        href: '/dashboard/sources',
        icon: DatabaseZap,
        implemented: true,
        description: 'Manage cloud data sources and imports',
      },
      {
        title: 'Connectors',
        href: '/dashboard/connectors',
        icon: Cable,
        implemented: true,
        description: 'Configure cloud provider connections',
      },
      {
        title: 'Virtual Tagging',
        href: '/dashboard/tagging',
        icon: Tags,
        implemented: false,
        description: 'Apply tags without modifying cloud resources',
      },
      {
        title: 'Settings',
        href: '/dashboard/settings',
        icon: Settings,
        implemented: true,
        isNew: true,
        description: 'Platform configuration and local storage management',
      },
    ],
  },
];

// ============================================================================
// Navigation Item Component
// ============================================================================

interface NavItemButtonProps {
  item: NavItem;
  isActive: boolean;
}

function NavItemButton({ item, isActive }: NavItemButtonProps) {
  const content = (
    <SidebarMenuButton
      asChild={item.implemented}
      isActive={isActive}
      className={cn(
        !item.implemented && 'opacity-50 cursor-not-allowed hover:bg-transparent'
      )}
    >
      {item.implemented ? (
        <Link href={item.href}>
          <item.icon className="h-4 w-4" />
          <span className="flex-1">{item.title}</span>
          {item.isNew && (
            <Badge variant="secondary" className="ml-auto h-5 px-1.5 text-[10px] bg-primary/20 text-primary">
              NEW
            </Badge>
          )}
          {item.premium && (
            <Lock className="h-3 w-3 ml-auto text-amber-500" />
          )}
        </Link>
      ) : (
        <div className="flex items-center gap-2 w-full">
          <item.icon className="h-4 w-4" />
          <span className="flex-1">{item.title}</span>
          {item.isNew && (
            <Badge variant="secondary" className="ml-auto h-5 px-1.5 text-[10px] bg-primary/20 text-primary">
              NEW
            </Badge>
          )}
          {item.premium && (
            <Lock className="h-3 w-3 ml-auto text-amber-500" />
          )}
          {!item.isNew && !item.premium && (
            <span className="ml-auto text-[10px] text-muted-foreground">Soon</span>
          )}
        </div>
      )}
    </SidebarMenuButton>
  );

  if (!item.implemented && item.description) {
    return (
      <TooltipProvider delayDuration={300}>
        <Tooltip>
          <TooltipTrigger asChild>
            {content}
          </TooltipTrigger>
          <TooltipContent side="right" className="max-w-[200px]">
            <p className="font-medium">{item.title}</p>
            <p className="text-xs text-muted-foreground">{item.description}</p>
            <p className="text-xs text-primary mt-1">Coming soon</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return content;
}

// ============================================================================
// Main Component
// ============================================================================

export function AppSidebar({ user }: AppSidebarProps) {
  const pathname = usePathname();

  return (
    <Sidebar variant="inset">
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primary/70 text-primary-foreground font-bold shadow-lg">
            F
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-semibold">Focal</span>
            <span className="text-xs text-muted-foreground">Sovereign FinOps Hub</span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        {navigationGroups.map((group) => (
          <Collapsible
            key={group.title}
            defaultOpen={group.defaultOpen}
            className="group/collapsible"
          >
            <SidebarGroup>
              <SidebarGroupLabel asChild>
                <CollapsibleTrigger className="flex w-full items-center justify-between">
                  <span>{group.title}</span>
                  <ChevronRight className="h-4 w-4 transition-transform group-data-[state=open]/collapsible:rotate-90" />
                </CollapsibleTrigger>
              </SidebarGroupLabel>
              <CollapsibleContent>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {group.items.map((item) => {
                      const isActive = pathname === item.href || 
                        (item.href !== '/dashboard' && pathname.startsWith(item.href));
                      
                      return (
                        <SidebarMenuItem key={item.href}>
                          <NavItemButton item={item} isActive={isActive} />
                        </SidebarMenuItem>
                      );
                    })}
                  </SidebarMenu>
                </SidebarGroupContent>
              </CollapsibleContent>
            </SidebarGroup>
          </Collapsible>
        ))}
      </SidebarContent>

      <SidebarFooter>
        <div className="px-3 py-2">
          <div className="flex items-center gap-2 rounded-lg bg-muted/50 p-2">
            <Sparkles className="h-4 w-4 text-amber-500" />
            <div className="flex-1 text-xs">
              <p className="font-medium">Local-First</p>
              <p className="text-muted-foreground">Your data stays in your browser</p>
            </div>
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
