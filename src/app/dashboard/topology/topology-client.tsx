'use client';

/**
 * Topology Client Component
 * 
 * Visual map of cloud infrastructure costs using React Flow.
 * Supports multiple grouping strategies and drill-down navigation.
 */

import { useState, useMemo, useCallback, useEffect } from 'react';
import {
  Network,
  Loader2,
  Calendar,
  Filter,
  Layers,
  ZoomIn,
  ZoomOut,
  Maximize2,
  RefreshCw,
  Info,
  ChevronRight,
  Building2,
  Server,
  Globe,
  Tags,
  X,
  Download,
  Share2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { useSpectrum, UNIFIED_VIEW_NAME } from '@/components/providers/spectrum-provider';
import { useDataDetection } from '@/hooks/use-data-detection';
import { EmptyState } from '@/components/ui/empty-state';
import { useRouter } from 'next/navigation';

// ============================================================================
// BigInt Safety Utilities
// ============================================================================

/**
 * Safely convert a value that might be BigInt to a regular number.
 * Returns 0 if the value can't be safely converted or is null/undefined.
 */
function safeNumber(value: unknown): number {
  if (value === null || value === undefined) return 0;
  
  // Handle BigInt
  if (typeof value === 'bigint') {
    // Check if it's safe to convert
    if (value <= BigInt(Number.MAX_SAFE_INTEGER) && value >= BigInt(Number.MIN_SAFE_INTEGER)) {
      return Number(value);
    }
    // For very large numbers, return a capped value (or 0 for counts)
    console.warn(`[Topology] BigInt value ${value} exceeds safe integer range, returning 0`);
    return 0;
  }
  
  // Handle string numbers
  if (typeof value === 'string') {
    const parsed = parseFloat(value);
    return isNaN(parsed) ? 0 : parsed;
  }
  
  // Handle regular numbers
  if (typeof value === 'number') {
    return isNaN(value) ? 0 : value;
  }
  
  return 0;
}

/**
 * Safely convert any value to a display string
 */
function safeString(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'bigint') return value.toString();
  return String(value);
}
import { CostTopologyGraph, transformToTopologyNodes, type CostNode } from '@/components/charts';
import { formatCurrency, loadCurrencySettings, type CurrencySettings } from '@/lib/currency';
import { KPICard, SparklineChart } from '@/components/charts';

// ============================================================================
// Types
// ============================================================================

type GroupingStrategy = 'service-category' | 'account' | 'region' | 'tag' | 'resource-type';

interface TopologyData {
  nodes: CostNode[];
  totalCost: number;
  serviceCount: number;
  categoryCount: number;
  topServices: Array<{ name: string; cost: number; percentage: number }>;
}

interface NodeDetails {
  node: CostNode;
  childNodes: CostNode[];
  sparklineData: number[];
  metadata: Record<string, unknown>;
}

// ============================================================================
// Grouping Configuration
// ============================================================================

const GROUPING_OPTIONS: Array<{
  value: GroupingStrategy;
  label: string;
  icon: typeof Network;
  description: string;
}> = [
  {
    value: 'service-category',
    label: 'By Service Category',
    icon: Layers,
    description: 'Group services by their category (Compute, Storage, Network, etc.)',
  },
  {
    value: 'account',
    label: 'By Account',
    icon: Building2,
    description: 'Group costs by billing account or subscription',
  },
  {
    value: 'region',
    label: 'By Region',
    icon: Globe,
    description: 'Geographic distribution of costs',
  },
  {
    value: 'tag',
    label: 'By Tag',
    icon: Tags,
    description: 'Group by resource tags (team, project, environment)',
  },
  {
    value: 'resource-type',
    label: 'By Resource Type',
    icon: Server,
    description: 'Detailed view by resource type within services',
  },
];

// ============================================================================
// Date Range Utilities
// ============================================================================

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

function getDateRangePresets(): Array<{ label: string; days: number }> {
  return [
    { label: 'Last 7 days', days: 7 },
    { label: 'Last 14 days', days: 14 },
    { label: 'Last 30 days', days: 30 },
    { label: 'Last 90 days', days: 90 },
    { label: 'This month', days: -1 }, // Special case
    { label: 'Last month', days: -2 }, // Special case
  ];
}

function getDateRange(preset: number): { start: Date; end: Date } {
  const end = new Date();
  const start = new Date();
  
  if (preset === -1) {
    // This month
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
  } else if (preset === -2) {
    // Last month
    start.setMonth(start.getMonth() - 1);
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
    end.setDate(0); // Last day of previous month
  } else {
    start.setDate(start.getDate() - preset);
  }
  
  return { start, end };
}

// ============================================================================
// Query Builders
// ============================================================================

function buildTopologyQuery(
  grouping: GroupingStrategy,
  startDate: Date,
  endDate: Date,
  viewName: string
): string {
  const startMs = startDate.getTime();
  const endMs = endDate.getTime();
  
  const baseWhere = `
    WHERE ChargePeriodStart >= epoch_ms(${startMs})
      AND ChargePeriodEnd < epoch_ms(${endMs})
  `;
  
  // Note: We cast ResourceId to VARCHAR before COUNT(DISTINCT) to avoid BigInt issues
  // when ResourceId contains very large numeric strings
  switch (grouping) {
    case 'service-category':
      return `
        SELECT 
          COALESCE(ServiceName, 'Unknown Service') as ServiceName,
          COALESCE(ServiceCategory, 'Other') as ServiceCategory,
          CAST(SUM(BilledCost) AS DOUBLE) as BilledCost,
          COUNT(DISTINCT CAST(ResourceId AS VARCHAR)) as ResourceCount
        FROM "${viewName}"
        ${baseWhere}
        GROUP BY ServiceName, ServiceCategory
        HAVING SUM(BilledCost) > 0
        ORDER BY BilledCost DESC
      `;
      
    case 'account':
      return `
        SELECT 
          COALESCE(SubAccountName, BillingAccountName, 'Unknown Account') as AccountName,
          COALESCE(ServiceCategory, 'Other') as ServiceCategory,
          CAST(SUM(BilledCost) AS DOUBLE) as BilledCost,
          COUNT(DISTINCT ServiceName) as ServiceCount
        FROM "${viewName}"
        ${baseWhere}
        GROUP BY AccountName, ServiceCategory
        HAVING SUM(BilledCost) > 0
        ORDER BY BilledCost DESC
      `;
      
    case 'region':
      return `
        SELECT 
          COALESCE(Region, RegionName, 'Global') as RegionName,
          COALESCE(ServiceCategory, 'Other') as ServiceCategory,
          CAST(SUM(BilledCost) AS DOUBLE) as BilledCost,
          COUNT(DISTINCT ServiceName) as ServiceCount
        FROM "${viewName}"
        ${baseWhere}
        GROUP BY RegionName, ServiceCategory
        HAVING SUM(BilledCost) > 0
        ORDER BY BilledCost DESC
      `;
      
    case 'tag':
      return `
        SELECT 
          COALESCE(
            json_extract_string(Tags, '$.Environment'),
            json_extract_string(Tags, '$.environment'),
            json_extract_string(Tags, '$.Project'),
            json_extract_string(Tags, '$.project'),
            json_extract_string(Tags, '$.Team'),
            json_extract_string(Tags, '$.team'),
            'Untagged'
          ) as TagValue,
          COALESCE(ServiceCategory, 'Other') as ServiceCategory,
          CAST(SUM(BilledCost) AS DOUBLE) as BilledCost,
          COUNT(DISTINCT ServiceName) as ServiceCount
        FROM "${viewName}"
        ${baseWhere}
        GROUP BY TagValue, ServiceCategory
        HAVING SUM(BilledCost) > 0
        ORDER BY BilledCost DESC
      `;
      
    case 'resource-type':
      return `
        SELECT 
          COALESCE(ResourceType, ServiceName, 'Unknown') as ResourceType,
          COALESCE(ServiceName, 'Unknown Service') as ServiceName,
          COALESCE(ServiceCategory, 'Other') as ServiceCategory,
          CAST(SUM(BilledCost) AS DOUBLE) as BilledCost,
          COUNT(DISTINCT CAST(ResourceId AS VARCHAR)) as ResourceCount
        FROM "${viewName}"
        ${baseWhere}
        GROUP BY ResourceType, ServiceName, ServiceCategory
        HAVING SUM(BilledCost) > 0
        ORDER BY BilledCost DESC
        LIMIT 100
      `;
      
    default:
      return buildTopologyQuery('service-category', startDate, endDate, viewName);
  }
}

// ============================================================================
// Transform Functions
// ============================================================================

function transformQueryResultToNodes(
  rows: Record<string, unknown>[],
  grouping: GroupingStrategy,
  providerName: string = 'Cloud Infrastructure'
): CostNode[] {
  if (!rows || rows.length === 0) return [];
  
  const nodes: CostNode[] = [];
  let totalCost = 0;
  
  switch (grouping) {
    case 'service-category': {
      // Group by category first
      const categoryMap = new Map<string, { services: string[]; cost: number }>();
      
      rows.forEach((row) => {
        const serviceName = safeString(row.ServiceName) || 'Unknown';
        const category = safeString(row.ServiceCategory) || 'Other';
        const cost = safeNumber(row.BilledCost);
        totalCost += cost;
        
        const existing = categoryMap.get(category) || { services: [], cost: 0 };
        const serviceId = `service_${serviceName.replace(/[^a-zA-Z0-9]/g, '_')}`;
        existing.services.push(serviceId);
        existing.cost += cost;
        categoryMap.set(category, existing);
        
        // Add service node
        nodes.push({
          id: serviceId,
          name: serviceName,
          type: 'service',
          cost,
          metadata: { resourceCount: safeNumber(row.ResourceCount) },
        });
      });
      
      // Add category nodes
      const categoryIds: string[] = [];
      categoryMap.forEach((data, categoryName) => {
        const categoryId = `category_${categoryName.replace(/[^a-zA-Z0-9]/g, '_')}`;
        categoryIds.push(categoryId);
        nodes.push({
          id: categoryId,
          name: categoryName,
          type: 'category',
          cost: data.cost,
          children: data.services,
        });
      });
      
      // Add provider node
      nodes.push({
        id: 'provider_cloud',
        name: providerName,
        type: 'provider',
        cost: totalCost,
        children: categoryIds,
      });
      break;
    }
    
    case 'account': {
      const accountMap = new Map<string, { categories: string[]; cost: number }>();
      
      rows.forEach((row) => {
        const accountName = safeString(row.AccountName) || 'Unknown';
        const category = safeString(row.ServiceCategory) || 'Other';
        const cost = safeNumber(row.BilledCost);
        totalCost += cost;
        
        const existing = accountMap.get(accountName) || { categories: [], cost: 0 };
        const categoryId = `category_${accountName}_${category}`.replace(/[^a-zA-Z0-9_]/g, '_');
        existing.categories.push(categoryId);
        existing.cost += cost;
        accountMap.set(accountName, existing);
        
        // Add category node under account
        nodes.push({
          id: categoryId,
          name: category,
          type: 'category',
          cost,
          metadata: { serviceCount: safeNumber(row.ServiceCount) },
        });
      });
      
      // Add account nodes
      const accountIds: string[] = [];
      accountMap.forEach((data, accountName) => {
        const accountId = `account_${accountName.replace(/[^a-zA-Z0-9]/g, '_')}`;
        accountIds.push(accountId);
        nodes.push({
          id: accountId,
          name: accountName,
          type: 'service', // Using service type for accounts (visual distinction)
          cost: data.cost,
          children: data.categories,
        });
      });
      
      // Add provider node
      nodes.push({
        id: 'provider_cloud',
        name: providerName,
        type: 'provider',
        cost: totalCost,
        children: accountIds,
      });
      break;
    }
    
    case 'region': {
      const regionMap = new Map<string, { categories: string[]; cost: number }>();
      
      rows.forEach((row) => {
        const regionName = safeString(row.RegionName) || 'Global';
        const category = safeString(row.ServiceCategory) || 'Other';
        const cost = safeNumber(row.BilledCost);
        totalCost += cost;
        
        const existing = regionMap.get(regionName) || { categories: [], cost: 0 };
        const categoryId = `category_${regionName}_${category}`.replace(/[^a-zA-Z0-9_]/g, '_');
        existing.categories.push(categoryId);
        existing.cost += cost;
        regionMap.set(regionName, existing);
        
        nodes.push({
          id: categoryId,
          name: category,
          type: 'category',
          cost,
        });
      });
      
      const regionIds: string[] = [];
      regionMap.forEach((data, regionName) => {
        const regionId = `region_${regionName.replace(/[^a-zA-Z0-9]/g, '_')}`;
        regionIds.push(regionId);
        nodes.push({
          id: regionId,
          name: regionName,
          type: 'resource', // Using resource type for regions
          cost: data.cost,
          children: data.categories,
        });
      });
      
      nodes.push({
        id: 'provider_cloud',
        name: providerName,
        type: 'provider',
        cost: totalCost,
        children: regionIds,
      });
      break;
    }
    
    case 'tag': {
      const tagMap = new Map<string, { categories: string[]; cost: number }>();
      
      rows.forEach((row) => {
        const tagValue = safeString(row.TagValue) || 'Untagged';
        const category = safeString(row.ServiceCategory) || 'Other';
        const cost = safeNumber(row.BilledCost);
        totalCost += cost;
        
        const existing = tagMap.get(tagValue) || { categories: [], cost: 0 };
        const categoryId = `category_${tagValue}_${category}`.replace(/[^a-zA-Z0-9_]/g, '_');
        existing.categories.push(categoryId);
        existing.cost += cost;
        tagMap.set(tagValue, existing);
        
        nodes.push({
          id: categoryId,
          name: category,
          type: 'category',
          cost,
        });
      });
      
      const tagIds: string[] = [];
      tagMap.forEach((data, tagValue) => {
        const tagId = `tag_${tagValue.replace(/[^a-zA-Z0-9]/g, '_')}`;
        tagIds.push(tagId);
        nodes.push({
          id: tagId,
          name: tagValue,
          type: 'tag',
          cost: data.cost,
          children: data.categories,
        });
      });
      
      nodes.push({
        id: 'provider_cloud',
        name: providerName,
        type: 'provider',
        cost: totalCost,
        children: tagIds,
      });
      break;
    }
    
    case 'resource-type': {
      // Similar to service-category but with resource types
      const serviceMap = new Map<string, { resources: string[]; cost: number }>();
      
      rows.forEach((row) => {
        const serviceName = safeString(row.ServiceName) || 'Unknown';
        const resourceType = safeString(row.ResourceType) || 'Unknown';
        const cost = safeNumber(row.BilledCost);
        totalCost += cost;
        
        const existing = serviceMap.get(serviceName) || { resources: [], cost: 0 };
        const resourceId = `resource_${resourceType.replace(/[^a-zA-Z0-9]/g, '_')}`;
        existing.resources.push(resourceId);
        existing.cost += cost;
        serviceMap.set(serviceName, existing);
        
        nodes.push({
          id: resourceId,
          name: resourceType,
          type: 'resource',
          cost,
          metadata: { resourceCount: safeNumber(row.ResourceCount) },
        });
      });
      
      const serviceIds: string[] = [];
      serviceMap.forEach((data, serviceName) => {
        const serviceId = `service_${serviceName.replace(/[^a-zA-Z0-9]/g, '_')}`;
        serviceIds.push(serviceId);
        nodes.push({
          id: serviceId,
          name: serviceName,
          type: 'service',
          cost: data.cost,
          children: data.resources,
        });
      });
      
      nodes.push({
        id: 'provider_cloud',
        name: providerName,
        type: 'provider',
        cost: totalCost,
        children: serviceIds,
      });
      break;
    }
  }
  
  return nodes;
}

// ============================================================================
// Main Component
// ============================================================================

export function TopologyClient() {
  const { query, unifiedView, isReady, isInitializing } = useSpectrum();
  const { hasData, isChecking, rowCount } = useDataDetection();
  const router = useRouter();
  
  // State
  const [grouping, setGrouping] = useState<GroupingStrategy>('service-category');
  const [datePreset, setDatePreset] = useState<number>(30);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [topologyData, setTopologyData] = useState<TopologyData | null>(null);
  const [selectedNode, setSelectedNode] = useState<CostNode | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [currencySettings, setCurrencySettings] = useState<CurrencySettings | null>(null);
  
  // Load currency settings
  useEffect(() => {
    const settings = loadCurrencySettings();
    setCurrencySettings(settings);
  }, []);
  
  const currency = currencySettings?.displayCurrency || unifiedView?.detectedCurrency || 'USD';
  
  // Compute date range
  const dateRange = useMemo(() => getDateRange(datePreset), [datePreset]);
  
  // Load topology data
  const loadTopologyData = useCallback(async () => {
    if (!isReady || !unifiedView?.exists) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const sql = buildTopologyQuery(
        grouping,
        dateRange.start,
        dateRange.end,
        UNIFIED_VIEW_NAME
      );
      
      const rows = await query<Record<string, unknown>>(sql);
      
      const nodes = transformQueryResultToNodes(rows, grouping);
      const totalCost = nodes.find(n => n.type === 'provider')?.cost || 0;
      const services = nodes.filter(n => n.type === 'service');
      const categories = nodes.filter(n => n.type === 'category');
      
      // Get top services
      const topServices = services
        .sort((a, b) => b.cost - a.cost)
        .slice(0, 5)
        .map(s => ({
          name: s.name,
          cost: s.cost,
          percentage: totalCost > 0 ? (s.cost / totalCost) * 100 : 0,
        }));
      
      setTopologyData({
        nodes,
        totalCost,
        serviceCount: services.length,
        categoryCount: categories.length,
        topServices,
      });
    } catch (err) {
      console.error('[Topology] Failed to load data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load topology data');
    } finally {
      setIsLoading(false);
    }
  }, [isReady, unifiedView, grouping, dateRange, query]);
  
  // Auto-load on mount and when dependencies change
  useEffect(() => {
    loadTopologyData();
  }, [loadTopologyData]);
  
  // Handle node click
  const handleNodeClick = useCallback((node: CostNode) => {
    setSelectedNode(node);
    setDetailsOpen(true);
  }, []);
  
  // Get child nodes for selected node
  const selectedNodeDetails = useMemo((): NodeDetails | null => {
    if (!selectedNode || !topologyData) return null;
    
    const childNodes = selectedNode.children
      ? topologyData.nodes.filter(n => selectedNode.children?.includes(n.id))
      : [];
    
    // Generate sparkline data (mock for now - would come from time-series query)
    const sparklineData = Array.from({ length: 7 }, () => 
      selectedNode.cost * (0.8 + Math.random() * 0.4)
    );
    
    return {
      node: selectedNode,
      childNodes: childNodes.sort((a, b) => b.cost - a.cost),
      sparklineData,
      metadata: selectedNode.metadata || {},
    };
  }, [selectedNode, topologyData]);
  
  // Determine provider name from unified view
  const providerName = useMemo(() => {
    if (!unifiedView?.sourceTables || unifiedView.sourceTables.length === 0) {
      return 'Cloud Infrastructure';
    }
    // Check if we have Azure, AWS, or GCP data
    const hasAzure = unifiedView.sourceTables.some(t => t.toLowerCase().includes('azure'));
    const hasAWS = unifiedView.sourceTables.some(t => t.toLowerCase().includes('aws'));
    const hasGCP = unifiedView.sourceTables.some(t => t.toLowerCase().includes('gcp'));
    
    if (hasAzure && !hasAWS && !hasGCP) return 'Azure';
    if (hasAWS && !hasAzure && !hasGCP) return 'AWS';
    if (hasGCP && !hasAzure && !hasAWS) return 'GCP';
    return 'Multi-Cloud';
  }, [unifiedView]);
  
  // ============================================================================
  // Render States
  // ============================================================================
  
  // Not initialized
  if (!isReady || isInitializing) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
          <p className="text-muted-foreground">Initializing analytics engine...</p>
        </div>
      </div>
    );
  }
  
  // No data state with overlay effect
  if (!hasData) {
    return (
      <EmptyState
        icon={Network}
        title="No Data Available"
        description={`Load cost data from the Sources page to visualize your cloud topology. ${rowCount === 0 ? 'No records found.' : ''}`}
        action={{
          label: 'Go to Sources',
          href: '/dashboard/sources'
        }}
        skeletonType="analytics"
      />
    );
  }
  
  // ============================================================================
  // Main Render
  // ============================================================================
  
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex items-center justify-between p-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Network className="h-6 w-6" />
              Cost Topology
            </h1>
            <p className="text-sm text-muted-foreground">
              Visual map of your cloud infrastructure costs
            </p>
          </div>
          
          <div className="flex items-center gap-4">
            {/* Date Range Selector */}
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <Select value={String(datePreset)} onValueChange={(v) => setDatePreset(Number(v))}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {getDateRangePresets().map((preset) => (
                    <SelectItem key={preset.days} value={String(preset.days)}>
                      {preset.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {/* Grouping Selector */}
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-muted-foreground" />
              <Select value={grouping} onValueChange={(v) => setGrouping(v as GroupingStrategy)}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {GROUPING_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      <div className="flex items-center gap-2">
                        <option.icon className="h-4 w-4" />
                        <span>{option.label}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {/* Refresh Button */}
            <Button
              variant="outline"
              size="icon"
              onClick={loadTopologyData}
              disabled={isLoading}
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
      </div>
      
      {/* Main Content */}
      <div className="flex-1 flex">
        {/* Sidebar Stats */}
        <div className="w-72 border-r p-4 space-y-4 overflow-y-auto">
          {/* Summary Cards */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Cost
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {topologyData ? formatCurrency(topologyData.totalCost, currency) : '-'}
              </div>
              <p className="text-xs text-muted-foreground">
                {formatDate(dateRange.start)} → {formatDate(dateRange.end)}
              </p>
            </CardContent>
          </Card>
          
          <div className="grid grid-cols-2 gap-2">
            <Card>
              <CardContent className="p-3">
                <div className="text-2xl font-bold">
                  {topologyData?.serviceCount || 0}
                </div>
                <p className="text-xs text-muted-foreground">Services</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3">
                <div className="text-2xl font-bold">
                  {topologyData?.categoryCount || 0}
                </div>
                <p className="text-xs text-muted-foreground">Categories</p>
              </CardContent>
            </Card>
          </div>
          
          {/* Top Services */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Top Services</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {topologyData?.topServices.map((service, i) => (
                <div key={service.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-muted-foreground text-xs">{i + 1}</span>
                    <span className="text-sm truncate">{service.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">
                      {formatCurrency(service.cost, currency)}
                    </span>
                    <Badge variant="secondary" className="text-xs">
                      {service.percentage.toFixed(1)}%
                    </Badge>
                  </div>
                </div>
              ))}
              {!topologyData?.topServices.length && (
                <p className="text-sm text-muted-foreground">No data available</p>
              )}
            </CardContent>
          </Card>
          
          {/* Legend */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Legend</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-blue-500" />
                <span className="text-sm">Provider</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-green-500" />
                <span className="text-sm">Category</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-purple-500" />
                <span className="text-sm">Service</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-orange-500" />
                <span className="text-sm">Resource</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-pink-500" />
                <span className="text-sm">Tag</span>
              </div>
            </CardContent>
          </Card>
          
          {/* Help */}
          <Card className="bg-muted/50">
            <CardContent className="p-3">
              <div className="flex items-start gap-2">
                <Info className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div className="text-xs text-muted-foreground">
                  <p className="font-medium mb-1">Tips</p>
                  <ul className="space-y-1">
                    <li>• Click nodes to see details</li>
                    <li>• Scroll to zoom in/out</li>
                    <li>• Drag to pan around</li>
                    <li>• Use minimap for navigation</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        
        {/* Topology Graph */}
        <div className="flex-1 relative">
          {error && (
            <div className="absolute top-4 left-4 right-4 z-10">
              <Card className="bg-destructive/10 border-destructive">
                <CardContent className="p-3 flex items-center gap-2">
                  <X className="h-4 w-4 text-destructive" />
                  <span className="text-sm">{error}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="ml-auto"
                    onClick={() => setError(null)}
                  >
                    Dismiss
                  </Button>
                </CardContent>
              </Card>
            </div>
          )}
          
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/50 z-10">
              <div className="text-center space-y-2">
                <Loader2 className="h-8 w-8 animate-spin mx-auto" />
                <p className="text-sm text-muted-foreground">Loading topology...</p>
              </div>
            </div>
          )}
          
          {topologyData && topologyData.nodes.length > 0 ? (
            <CostTopologyGraph
              nodes={topologyData.nodes}
              currency={currency}
              height={800}
              onNodeClick={handleNodeClick}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center h-full">
              <div className="text-center space-y-4">
                <Network className="h-16 w-16 mx-auto text-muted-foreground/50" />
                <div>
                  <p className="text-lg font-medium">No topology data</p>
                  <p className="text-sm text-muted-foreground">
                    Try adjusting the date range or grouping strategy
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* Node Details Sheet */}
      <Sheet open={detailsOpen} onOpenChange={setDetailsOpen}>
        <SheetContent className="w-[400px] sm:w-[540px]">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              {selectedNode && (
                <>
                  <Badge variant="outline" className="capitalize">
                    {selectedNode.type}
                  </Badge>
                  {selectedNode.name}
                </>
              )}
            </SheetTitle>
            <SheetDescription>
              Cost details and breakdown
            </SheetDescription>
          </SheetHeader>
          
          {selectedNodeDetails && (
            <div className="mt-6 space-y-6">
              {/* Cost Summary */}
              <div>
                <Label className="text-muted-foreground">Total Cost</Label>
                <div className="text-3xl font-bold">
                  {formatCurrency(selectedNodeDetails.node.cost, currency)}
                </div>
                {topologyData && (
                  <p className="text-sm text-muted-foreground">
                    {((selectedNodeDetails.node.cost / topologyData.totalCost) * 100).toFixed(1)}% of total
                  </p>
                )}
              </div>
              
              {/* Sparkline */}
              <div>
                <Label className="text-muted-foreground">7-Day Trend</Label>
                <div className="h-16 mt-2">
                  <SparklineChart
                    data={selectedNodeDetails.sparklineData}
                    width={400}
                    height={60}
                  />
                </div>
              </div>
              
              <Separator />
              
              {/* Child Nodes */}
              {selectedNodeDetails.childNodes.length > 0 && (
                <div>
                  <Label className="text-muted-foreground mb-2 block">
                    Breakdown ({selectedNodeDetails.childNodes.length} items)
                  </Label>
                  <div className="space-y-2 max-h-[300px] overflow-y-auto">
                    {selectedNodeDetails.childNodes.map((child) => (
                      <div
                        key={child.id}
                        className="flex items-center justify-between p-2 rounded-lg bg-muted/50 hover:bg-muted cursor-pointer"
                        onClick={() => setSelectedNode(child)}
                      >
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="capitalize text-xs">
                            {child.type}
                          </Badge>
                          <span className="text-sm truncate max-w-[200px]">{child.name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">
                            {formatCurrency(child.cost, currency)}
                          </span>
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Metadata */}
              {Object.keys(selectedNodeDetails.metadata).length > 0 && (
                <div>
                  <Label className="text-muted-foreground mb-2 block">Metadata</Label>
                  <div className="space-y-1">
                    {Object.entries(selectedNodeDetails.metadata).map(([key, value]) => (
                      <div key={key} className="flex justify-between text-sm">
                        <span className="text-muted-foreground capitalize">
                          {key.replace(/([A-Z])/g, ' $1').trim()}
                        </span>
                        <span>{String(value)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
