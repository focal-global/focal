'use client';

import { useState, useCallback } from 'react';
import { ChevronRight, ChevronLeft, X, ArrowDown, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/currency';

// ============================================================================
// Types
// ============================================================================

export interface DrillDownLevel {
  id: string;
  name: string;
  field: string;
  value: string;
  cost: number;
  percentage: number;
  query?: string;
}

export interface DrillDownPath {
  levels: DrillDownLevel[];
  totalCost: number;
}

export interface DrillDownConfig {
  // Hierarchy of fields to drill through
  hierarchy: Array<{
    field: string;
    label: string;
    drillQuery: (parentValues: Record<string, string>) => string;
  }>;
}

export interface DrillDownPanelProps {
  path: DrillDownPath;
  currency?: string;
  onDrillDown: (level: DrillDownLevel, depth: number) => void;
  onDrillUp: (toDepth: number) => void;
  onClose: () => void;
  currentLevelData?: Array<{ name: string; value: number }>;
  isLoading?: boolean;
  maxDepth?: number;
}

// ============================================================================
// Default Drill-Down Configurations
// ============================================================================

export const COST_DRILLDOWN_HIERARCHY: DrillDownConfig = {
  hierarchy: [
    {
      field: 'ServiceCategory',
      label: 'Category',
      drillQuery: () => `
        SELECT 
          ServiceCategory as name,
          SUM(BilledCost) as value
        FROM {{TABLE}}
        {{WHERE_CLAUSE}}
        GROUP BY ServiceCategory
        ORDER BY value DESC
      `,
    },
    {
      field: 'ServiceName',
      label: 'Service',
      drillQuery: (parent) => `
        SELECT 
          ServiceName as name,
          SUM(BilledCost) as value
        FROM {{TABLE}}
        WHERE ServiceCategory = '${parent.ServiceCategory}'
        {{AND_WHERE_CLAUSE}}
        GROUP BY ServiceName
        ORDER BY value DESC
      `,
    },
    {
      field: 'SubAccountName',
      label: 'Account',
      drillQuery: (parent) => `
        SELECT 
          SubAccountName as name,
          SUM(BilledCost) as value
        FROM {{TABLE}}
        WHERE ServiceCategory = '${parent.ServiceCategory}'
          AND ServiceName = '${parent.ServiceName}'
        {{AND_WHERE_CLAUSE}}
        GROUP BY SubAccountName
        ORDER BY value DESC
      `,
    },
    {
      field: 'ResourceName',
      label: 'Resource',
      drillQuery: (parent) => `
        SELECT 
          ResourceName as name,
          SUM(BilledCost) as value
        FROM {{TABLE}}
        WHERE ServiceCategory = '${parent.ServiceCategory}'
          AND ServiceName = '${parent.ServiceName}'
          AND SubAccountName = '${parent.SubAccountName}'
        {{AND_WHERE_CLAUSE}}
        GROUP BY ResourceName
        ORDER BY value DESC
        LIMIT 50
      `,
    },
  ],
};

export const REGION_DRILLDOWN_HIERARCHY: DrillDownConfig = {
  hierarchy: [
    {
      field: 'RegionName',
      label: 'Region',
      drillQuery: () => `
        SELECT 
          RegionName as name,
          SUM(BilledCost) as value
        FROM {{TABLE}}
        {{WHERE_CLAUSE}}
        GROUP BY RegionName
        ORDER BY value DESC
      `,
    },
    {
      field: 'ServiceCategory',
      label: 'Category',
      drillQuery: (parent) => `
        SELECT 
          ServiceCategory as name,
          SUM(BilledCost) as value
        FROM {{TABLE}}
        WHERE RegionName = '${parent.RegionName}'
        {{AND_WHERE_CLAUSE}}
        GROUP BY ServiceCategory
        ORDER BY value DESC
      `,
    },
    {
      field: 'ServiceName',
      label: 'Service',
      drillQuery: (parent) => `
        SELECT 
          ServiceName as name,
          SUM(BilledCost) as value
        FROM {{TABLE}}
        WHERE RegionName = '${parent.RegionName}'
          AND ServiceCategory = '${parent.ServiceCategory}'
        {{AND_WHERE_CLAUSE}}
        GROUP BY ServiceName
        ORDER BY value DESC
      `,
    },
  ],
};

// ============================================================================
// DrillDown Panel Component
// ============================================================================

export function DrillDownPanel({
  path,
  currency = 'USD',
  onDrillDown,
  onDrillUp,
  onClose,
  currentLevelData,
  isLoading,
  maxDepth = 4,
}: DrillDownPanelProps) {
  const currentDepth = path.levels.length;
  const canDrillDeeper = currentDepth < maxDepth;

  return (
    <Card className="border-primary/50 bg-slate-900/50">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-primary" />
            <CardTitle className="text-base">Drill-Down Analysis</CardTitle>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <CardDescription>
          Click items below to drill deeper into the cost breakdown
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Breadcrumb Path */}
        {path.levels.length > 0 && (
          <div className="flex flex-wrap items-center gap-1 text-sm">
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs"
              onClick={() => onDrillUp(0)}
            >
              All
            </Button>
            {path.levels.map((level, index) => (
              <div key={level.id} className="flex items-center gap-1">
                <ChevronRight className="h-3 w-3 text-muted-foreground" />
                <Button
                  variant={index === path.levels.length - 1 ? 'secondary' : 'ghost'}
                  size="sm"
                  className="h-6 px-2 text-xs max-w-[150px] truncate"
                  onClick={() => onDrillUp(index + 1)}
                  title={level.value}
                >
                  {level.value}
                </Button>
              </div>
            ))}
          </div>
        )}

        {/* Current Level Stats */}
        {path.levels.length > 0 && (
          <div className="flex items-center justify-between py-2 px-3 bg-muted/50 rounded-lg">
            <div>
              <p className="text-xs text-muted-foreground">
                {path.levels[path.levels.length - 1]?.name || 'Selected'}
              </p>
              <p className="font-semibold">
                {path.levels[path.levels.length - 1]?.value}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Cost</p>
              <p className="font-mono font-semibold text-primary">
                {formatCurrency(path.levels[path.levels.length - 1]?.cost || 0, currency)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">% of Total</p>
              <p className="font-mono font-semibold">
                {(path.levels[path.levels.length - 1]?.percentage || 0).toFixed(1)}%
              </p>
            </div>
          </div>
        )}

        {/* Drill-Down Items */}
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
          </div>
        ) : currentLevelData && currentLevelData.length > 0 ? (
          <div className="space-y-1 max-h-[300px] overflow-y-auto">
            {currentLevelData.map((item, index) => {
              const percentage = path.totalCost > 0 
                ? (item.value / path.totalCost) * 100 
                : 0;
              
              return (
                <button
                  key={item.name || index}
                  className={`w-full flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 transition-colors text-left ${
                    canDrillDeeper ? 'cursor-pointer' : 'cursor-default'
                  }`}
                  onClick={() => {
                    if (canDrillDeeper) {
                      onDrillDown({
                        id: `${currentDepth}_${item.name}`,
                        name: `Level ${currentDepth + 1}`,
                        field: '',
                        value: item.name,
                        cost: item.value,
                        percentage,
                      }, currentDepth);
                    }
                  }}
                  disabled={!canDrillDeeper}
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <div 
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ 
                        backgroundColor: `hsl(${(index * 30) % 360}, 70%, 50%)` 
                      }}
                    />
                    <span className="truncate text-sm" title={item.name}>
                      {item.name || '(unnamed)'}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className="font-mono text-sm">
                      {formatCurrency(item.value, currency)}
                    </span>
                    <Badge variant="secondary" className="text-xs">
                      {percentage.toFixed(1)}%
                    </Badge>
                    {canDrillDeeper && (
                      <ArrowDown className="h-3 w-3 text-muted-foreground" />
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-6 text-muted-foreground">
            <p>No data available at this level</p>
            {path.levels.length > 0 && (
              <Button
                variant="link"
                size="sm"
                onClick={() => onDrillUp(path.levels.length - 1)}
              >
                <ChevronLeft className="h-3 w-3 mr-1" />
                Go back
              </Button>
            )}
          </div>
        )}

        {/* Depth Indicator */}
        <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t">
          <span>Drill depth: {currentDepth} / {maxDepth}</span>
          {path.levels.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs"
              onClick={() => onDrillUp(0)}
            >
              Reset
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Hook for Managing Drill-Down State
// ============================================================================

export interface UseDrillDownOptions {
  initialTotalCost: number;
  onQueryChange?: (query: string) => void;
}

export function useDrillDown(options: UseDrillDownOptions) {
  const [path, setPath] = useState<DrillDownPath>({
    levels: [],
    totalCost: options.initialTotalCost,
  });
  const [isActive, setIsActive] = useState(false);

  const drillDown = useCallback((level: DrillDownLevel, depth: number) => {
    setPath(prev => ({
      ...prev,
      levels: [...prev.levels.slice(0, depth), level],
    }));
  }, []);

  const drillUp = useCallback((toDepth: number) => {
    setPath(prev => ({
      ...prev,
      levels: prev.levels.slice(0, toDepth),
    }));
  }, []);

  const reset = useCallback(() => {
    setPath({
      levels: [],
      totalCost: options.initialTotalCost,
    });
  }, [options.initialTotalCost]);

  const activate = useCallback(() => setIsActive(true), []);
  const deactivate = useCallback(() => {
    setIsActive(false);
    reset();
  }, [reset]);

  const getParentValues = useCallback((): Record<string, string> => {
    const values: Record<string, string> = {};
    path.levels.forEach(level => {
      values[level.field] = level.value;
    });
    return values;
  }, [path.levels]);

  return {
    path,
    isActive,
    drillDown,
    drillUp,
    reset,
    activate,
    deactivate,
    getParentValues,
    currentDepth: path.levels.length,
  };
}
