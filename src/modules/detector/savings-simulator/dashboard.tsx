'use client';

/**
 * Savings Simulator Dashboard
 * 
 * Interactive what-if analysis for cost optimization scenarios.
 * All calculations run locally in the browser.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  SavingsSimulatorEngine,
  SimulationScenario,
  SimulationSummary,
  SimulationType,
  SIMULATION_TEMPLATES,
  getTypeLabel,
  getTypeIcon,
  getRiskColor,
  getEffortColor,
} from './engine';
import { useSpectrum, UNIFIED_VIEW_NAME } from '@/components/providers/spectrum-provider';
import { formatCurrency as formatCurrencyLib, loadCurrencySettings, SUPPORTED_CURRENCIES } from '@/lib/currency';
import { EmptyState } from '@/components/ui/empty-state';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Calculator,
  TrendingDown,
  Target,
  DollarSign,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Zap,
  ChevronRight,
  Calendar,
  Sliders,
  BarChart3,
  PiggyBank,
  ArrowRight,
  Loader2,
  RefreshCw,
  Download,
  Plus,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Area,
  ComposedChart,
} from 'recharts';

// ============================================================================
// Helper Components
// ============================================================================

function createFormatCurrency(currency: string) {
  const symbol = SUPPORTED_CURRENCIES[currency]?.symbol || currency;
  return function formatCurrency(value: number): string {
    if (value >= 1000000) {
      return `${symbol}${(value / 1000000).toFixed(1)}M`;
    }
    if (value >= 1000) {
      return `${symbol}${(value / 1000).toFixed(1)}K`;
    }
    return `${symbol}${value.toFixed(0)}`;
  };
}

function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

// ============================================================================
// KPI Card Component
// ============================================================================

interface KPICardProps {
  title: string;
  value: string;
  subtitle?: string;
  icon: React.ReactNode;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
}

function KPICard({ title, value, subtitle, icon, trend, trendValue }: KPICardProps) {
  return (
    <Card className="bg-card/50 backdrop-blur">
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold tracking-tight">{value}</p>
            {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
          </div>
          <div className="rounded-lg bg-primary/10 p-2 text-primary">
            {icon}
          </div>
        </div>
        {trend && trendValue && (
          <div className={`mt-3 flex items-center text-xs ${
            trend === 'down' ? 'text-emerald-500' : 
            trend === 'up' ? 'text-red-500' : 
            'text-muted-foreground'
          }`}>
            <TrendingDown className="h-3 w-3 mr-1" />
            {trendValue}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Scenario Card Component
// ============================================================================

interface ScenarioCardProps {
  scenario: SimulationScenario;
  onSelect: () => void;
  isSelected: boolean;
  formatCurrency: (value: number) => string;
}

function ScenarioCard({ scenario, onSelect, isSelected, formatCurrency }: ScenarioCardProps) {
  const icon = getTypeIcon(scenario.type);
  
  return (
    <Card 
      className={`cursor-pointer transition-all hover:shadow-md ${
        isSelected ? 'ring-2 ring-primary' : ''
      }`}
      onClick={onSelect}
    >
      <CardContent className="pt-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="text-2xl">{icon}</div>
            <div className="space-y-1">
              <h4 className="font-semibold text-sm">{scenario.name}</h4>
              <p className="text-xs text-muted-foreground line-clamp-1">
                {scenario.description}
              </p>
              <div className="flex items-center gap-2 mt-2">
                <Badge 
                  variant="outline" 
                  className="text-[10px]"
                  style={{ borderColor: getRiskColor(scenario.riskLevel) }}
                >
                  {scenario.riskLevel} risk
                </Badge>
                <Badge 
                  variant="outline" 
                  className="text-[10px]"
                  style={{ borderColor: getEffortColor(scenario.effort) }}
                >
                  {scenario.effort} effort
                </Badge>
              </div>
            </div>
          </div>
          <div className="text-right">
            <p className="text-lg font-bold text-emerald-500">
              {formatCurrency(scenario.savings)}
            </p>
            <p className="text-xs text-muted-foreground">
              {formatPercent(scenario.savingsPercent)} savings
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Scenario Detail Dialog
// ============================================================================

interface ScenarioDetailDialogProps {
  scenario: SimulationScenario | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  formatCurrency: (value: number) => string;
}

function ScenarioDetailDialog({ scenario, open, onOpenChange, formatCurrency }: ScenarioDetailDialogProps) {
  if (!scenario) return null;

  const projectionData = [
    { month: 'Now', current: scenario.currentCost, projected: scenario.currentCost },
    { month: 'M1', current: scenario.currentCost, projected: scenario.projectedCost },
    { month: 'M3', current: scenario.currentCost * 3, projected: scenario.projectedCost * 3 },
    { month: 'M6', current: scenario.currentCost * 6, projected: scenario.projectedCost * 6 },
    { month: '1Y', current: scenario.currentCost * 12, projected: scenario.projectedCost * 12 },
    { month: '3Y', current: scenario.currentCost * 36, projected: scenario.projectedCost * 36 },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="text-2xl">{getTypeIcon(scenario.type)}</span>
            {scenario.name}
          </DialogTitle>
          <DialogDescription>{scenario.description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* Summary Cards */}
          <div className="grid grid-cols-3 gap-4">
            <Card className="bg-muted/50">
              <CardContent className="pt-4 text-center">
                <p className="text-xs text-muted-foreground">Current Cost</p>
                <p className="text-xl font-bold">{formatCurrency(scenario.currentCost)}</p>
              </CardContent>
            </Card>
            <Card className="bg-emerald-500/10">
              <CardContent className="pt-4 text-center">
                <p className="text-xs text-emerald-600">Projected Cost</p>
                <p className="text-xl font-bold text-emerald-600">
                  {formatCurrency(scenario.projectedCost)}
                </p>
              </CardContent>
            </Card>
            <Card className="bg-primary/10">
              <CardContent className="pt-4 text-center">
                <p className="text-xs text-primary">Monthly Savings</p>
                <p className="text-xl font-bold text-primary">{formatCurrency(scenario.savings)}</p>
              </CardContent>
            </Card>
          </div>

          {/* Cost Projection Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Cost Projection</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={projectionData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis 
                      dataKey="month" 
                      tick={{ fontSize: 12 }}
                      className="text-muted-foreground"
                    />
                    <YAxis 
                      tickFormatter={(v) => formatCurrency(v)}
                      tick={{ fontSize: 12 }}
                      className="text-muted-foreground"
                    />
                    <Tooltip 
                      formatter={(value) => formatCurrency(Number(value) || 0)}
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                      }}
                    />
                    <Legend />
                    <Area
                      type="monotone"
                      dataKey="current"
                      name="Current Cost"
                      fill="hsl(var(--muted))"
                      stroke="hsl(var(--muted-foreground))"
                      fillOpacity={0.3}
                    />
                    <Line
                      type="monotone"
                      dataKey="projected"
                      name="After Optimization"
                      stroke="#10b981"
                      strokeWidth={3}
                      dot={{ fill: '#10b981', strokeWidth: 2 }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Implementation Details */}
          <div className="grid grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  Risk Factors
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1">
                  {scenario.riskFactors.map((risk, i) => (
                    <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                      <span className="text-amber-500 mt-0.5">•</span>
                      {risk}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4" />
                  Prerequisites
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1">
                  {scenario.prerequisites.map((prereq, i) => (
                    <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                      <span className="text-emerald-500 mt-0.5">✓</span>
                      {prereq}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>

          {/* Long-term Savings */}
          <Card className="bg-gradient-to-r from-emerald-500/10 to-primary/10">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Annual Savings</p>
                  <p className="text-2xl font-bold">{formatCurrency(scenario.annualSavings)}</p>
                </div>
                <ArrowRight className="h-6 w-6 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">3-Year Savings</p>
                  <p className="text-2xl font-bold text-emerald-500">
                    {formatCurrency(scenario.threeYearSavings)}
                  </p>
                </div>
              </div>
              {scenario.breakEvenMonths && (
                <div className="mt-4 pt-4 border-t border-border/50">
                  <p className="text-sm text-muted-foreground">
                    Break-even period: <span className="font-medium text-foreground">{scenario.breakEvenMonths} months</span>
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Affected Services */}
          <div className="space-y-2">
            <p className="text-sm font-medium">Affected Services</p>
            <div className="flex flex-wrap gap-2">
              {scenario.targetServices.map((service, i) => (
                <Badge key={i} variant="secondary">{service}</Badge>
              ))}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// Custom Scenario Creator
// ============================================================================

interface CustomScenarioCreatorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateScenario: (scenario: SimulationScenario) => void;
  engine: SavingsSimulatorEngine;
  availableResources: { resourceId: string; resourceName: string; totalCost: number }[];
  formatCurrency: (value: number) => string;
}

function CustomScenarioCreator({ 
  open, 
  onOpenChange, 
  onCreateScenario, 
  engine,
  availableResources,
  formatCurrency,
}: CustomScenarioCreatorProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [discountPercent, setDiscountPercent] = useState(20);
  const [selectedResources, setSelectedResources] = useState<string[]>([]);

  const handleCreate = () => {
    const resources = availableResources.filter(r => 
      selectedResources.includes(r.resourceId)
    );
    
    if (resources.length === 0 || !name) return;

    const scenario = engine.createCustomScenario(
      name,
      description,
      resources,
      discountPercent
    );
    
    onCreateScenario(scenario);
    onOpenChange(false);
    
    // Reset form
    setName('');
    setDescription('');
    setDiscountPercent(20);
    setSelectedResources([]);
  };

  const totalSelectedCost = useMemo(() => {
    return availableResources
      .filter(r => selectedResources.includes(r.resourceId))
      .reduce((sum, r) => sum + r.totalCost, 0);
  }, [availableResources, selectedResources]);

  const projectedSavings = totalSelectedCost * (discountPercent / 100);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Create Custom Scenario</DialogTitle>
          <DialogDescription>
            Model a custom savings scenario with your own parameters
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="name">Scenario Name</Label>
            <Input
              id="name"
              placeholder="e.g., Vendor Negotiation"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Input
              id="description"
              placeholder="Describe the optimization approach"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Expected Discount: {discountPercent}%</Label>
            <input
              type="range"
              min="1"
              max="90"
              value={discountPercent}
              onChange={(e) => setDiscountPercent(parseInt(e.target.value))}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>1%</span>
              <span>90%</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Select Resources ({selectedResources.length} selected)</Label>
            <div className="max-h-40 overflow-y-auto border rounded-md p-2 space-y-1">
              {availableResources.slice(0, 20).map((resource) => (
                <label 
                  key={resource.resourceId}
                  className="flex items-center justify-between p-2 hover:bg-muted/50 rounded cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={selectedResources.includes(resource.resourceId)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedResources([...selectedResources, resource.resourceId]);
                        } else {
                          setSelectedResources(selectedResources.filter(id => id !== resource.resourceId));
                        }
                      }}
                      className="rounded"
                    />
                    <span className="text-sm truncate max-w-[200px]">{resource.resourceName}</span>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {formatCurrency(resource.totalCost)}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {selectedResources.length > 0 && (
            <Card className="bg-emerald-500/10">
              <CardContent className="pt-4">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-sm text-muted-foreground">Current Cost</p>
                    <p className="font-bold">{formatCurrency(totalSelectedCost)}</p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  <div className="text-right">
                    <p className="text-sm text-emerald-600">Projected Savings</p>
                    <p className="font-bold text-emerald-600">{formatCurrency(projectedSavings)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <Button 
            onClick={handleCreate} 
            disabled={!name || selectedResources.length === 0}
            className="w-full"
          >
            <Plus className="h-4 w-4 mr-2" />
            Create Scenario
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// Main Dashboard Component
// ============================================================================

export function SavingsSimulatorDashboard() {
  const { isReady, query, unifiedView } = useSpectrum();
  const [isLoading, setIsLoading] = useState(true);
  const [summary, setSummary] = useState<SimulationSummary | null>(null);
  const [selectedScenario, setSelectedScenario] = useState<SimulationScenario | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [customOpen, setCustomOpen] = useState(false);
  const [resources, setResources] = useState<{
    resourceId: string;
    resourceName: string;
    serviceName: string;
    serviceCategory: string;
    region: string;
    totalCost: number;
    avgDailyCost: number;
    chargeCategory: string;
  }[]>([]);
  const [filterType, setFilterType] = useState<string>('all');

  // Currency state
  const [currency, setCurrency] = useState('USD');
  useEffect(() => {
    const settings = loadCurrencySettings();
    setCurrency(settings?.displayCurrency || unifiedView?.detectedCurrency || 'USD');
  }, [unifiedView?.detectedCurrency]);

  // Create currency-aware formatter
  const formatCurrency = useMemo(() => createFormatCurrency(currency), [currency]);

  const engine = useMemo(() => new SavingsSimulatorEngine(), []);

  // Check if unified data exists
  const hasData = useMemo(() => {
    return unifiedView.exists;
  }, [unifiedView.exists]);

  // Load resource data
  const loadData = useCallback(async () => {
    if (!isReady || !hasData) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    try {
      // Get resource-level spending for the last 30 days
      const sql = `
        SELECT 
          ResourceId as resourceId,
          ResourceName as resourceName,
          ServiceName as serviceName,
          ServiceCategory as serviceCategory,
          Region as region,
          ChargeCategory as chargeCategory,
          SUM(BilledCost) as totalCost,
          AVG(BilledCost) as avgDailyCost
        FROM ${UNIFIED_VIEW_NAME}
        WHERE ChargePeriodStart >= CURRENT_DATE - INTERVAL 30 DAY
          AND BilledCost > 0
        GROUP BY ResourceId, ResourceName, ServiceName, ServiceCategory, Region, ChargeCategory
        HAVING SUM(BilledCost) >= 10
        ORDER BY totalCost DESC
        LIMIT 500
      `;

      const rows = await query<{
        resourceId: string | bigint;
        resourceName: string;
        serviceName: string;
        serviceCategory: string;
        region: string;
        totalCost: number;
        avgDailyCost: number;
        chargeCategory: string;
      }>(sql);
      const resourceData = rows.map((row) => ({
        resourceId: String(row.resourceId || ''),
        resourceName: String(row.resourceName || 'Unknown'),
        serviceName: String(row.serviceName || 'Unknown'),
        serviceCategory: String(row.serviceCategory || 'Other'),
        region: String(row.region || 'Unknown'),
        totalCost: Number(row.totalCost) || 0,
        avgDailyCost: Number(row.avgDailyCost) || 0,
        chargeCategory: String(row.chargeCategory || 'Usage'),
      }));

      setResources(resourceData);

      // Generate scenarios
      const scenarios = engine.generateScenarios(resourceData);
      const simulationSummary = engine.generateSummary(scenarios);
      setSummary(simulationSummary);

    } catch (error) {
      console.error('Error loading simulation data:', error);
    } finally {
      setIsLoading(false);
    }
  }, [isReady, hasData, engine, query]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Filter scenarios
  const filteredScenarios = useMemo(() => {
    if (!summary) return [];
    if (filterType === 'all') return summary.scenarios;
    return summary.scenarios.filter(s => s.type === filterType);
  }, [summary, filterType]);

  // Prepare chart data
  const savingsByTypeData = useMemo(() => {
    if (!summary) return [];
    return Object.entries(summary.byType)
      .filter(([_, data]) => data.savings > 0)
      .map(([type, data]) => ({
        name: getTypeLabel(type as SimulationType),
        savings: data.savings,
        count: data.count,
        icon: getTypeIcon(type as SimulationType),
      }))
      .sort((a, b) => b.savings - a.savings);
  }, [summary]);

  const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];

  // Handle custom scenario creation
  const handleCreateCustomScenario = (scenario: SimulationScenario) => {
    if (summary) {
      const updatedScenarios = [...summary.scenarios, scenario];
      const updatedSummary = engine.generateSummary(updatedScenarios);
      setSummary(updatedSummary);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[400px]">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">Analyzing savings opportunities...</p>
        </div>
      </div>
    );
  }

  if (!hasData) {
    return (
      <EmptyState
        icon={Calculator}
        title="No Data Available"
        description="Connect a data source to start simulating savings scenarios"
        action={{
          label: 'Go to Data Sources',
          href: '/dashboard/sources'
        }}
        skeletonType="analytics"
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Savings Simulator</h2>
          <p className="text-muted-foreground">
            Model what-if scenarios to optimize your cloud costs
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadData}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button size="sm" onClick={() => setCustomOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Custom Scenario
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      {summary && (
        <div className="grid grid-cols-4 gap-4">
          <KPICard
            title="Current Monthly Cost"
            value={formatCurrency(summary.totalCurrentCost)}
            subtitle="Based on last 30 days"
            icon={<DollarSign className="h-5 w-5" />}
          />
          <KPICard
            title="Potential Savings"
            value={formatCurrency(summary.totalSavings)}
            subtitle={`${formatPercent(summary.savingsPercent)} reduction`}
            icon={<PiggyBank className="h-5 w-5" />}
            trend="down"
            trendValue="Monthly savings potential"
          />
          <KPICard
            title="Active Scenarios"
            value={summary.scenarios.length.toString()}
            subtitle="Optimization opportunities"
            icon={<Target className="h-5 w-5" />}
          />
          <KPICard
            title="Quick Wins"
            value={summary.scenarios.filter(s => s.effort === 'low' && s.riskLevel === 'low').length.toString()}
            subtitle="Low effort, low risk"
            icon={<Zap className="h-5 w-5" />}
          />
        </div>
      )}

      {/* Main Content Grid */}
      <div className="grid grid-cols-3 gap-6">
        {/* Left Column - Savings by Type */}
        <Card className="col-span-1">
          <CardHeader>
            <CardTitle className="text-base">Savings by Strategy</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={savingsByTypeData}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="savings"
                  >
                    {savingsByTypeData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value) => formatCurrency(Number(value) || 0)}
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-2 mt-4">
              {savingsByTypeData.slice(0, 5).map((item, index) => (
                <div key={item.name} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: COLORS[index % COLORS.length] }}
                    />
                    <span className="truncate">{item.name}</span>
                  </div>
                  <span className="font-medium">{formatCurrency(item.savings)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Middle Column - Recommendations */}
        <Card className="col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Top Recommendations</CardTitle>
            <CardDescription>Prioritized optimization actions</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {summary?.recommendations.map((rec, index) => (
                <div 
                  key={index}
                  className="flex items-start gap-4 p-4 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                >
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="text-sm font-bold text-primary">#{rec.priority}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold">{rec.title}</h4>
                    <p className="text-sm text-muted-foreground">{rec.description}</p>
                    <div className="flex items-center gap-3 mt-2">
                      <Badge variant="outline" style={{ borderColor: getRiskColor(rec.risk) }}>
                        {rec.risk} risk
                      </Badge>
                      <Badge variant="outline" style={{ borderColor: getEffortColor(rec.effort) }}>
                        {rec.effort} effort
                      </Badge>
                      <span className="text-sm text-muted-foreground">
                        {rec.scenarios.length} scenario{rec.scenarios.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-lg font-bold text-emerald-500">
                      {formatCurrency(rec.savings)}
                    </p>
                    <p className="text-xs text-muted-foreground">potential savings</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Scenarios List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Simulation Scenarios</CardTitle>
              <CardDescription>Click a scenario to see details</CardDescription>
            </div>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {SIMULATION_TEMPLATES.map(template => (
                  <SelectItem key={template.type} value={template.type}>
                    {template.icon} {template.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            {filteredScenarios.map((scenario) => (
              <ScenarioCard
                key={scenario.id}
                scenario={scenario}
                onSelect={() => {
                  setSelectedScenario(scenario);
                  setDetailOpen(true);
                }}
                isSelected={selectedScenario?.id === scenario.id}
                formatCurrency={formatCurrency}
              />
            ))}
          </div>
          
          {filteredScenarios.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <Calculator className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No scenarios match the current filter</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Templates Reference */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Optimization Strategies</CardTitle>
          <CardDescription>Available simulation templates</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-4">
            {SIMULATION_TEMPLATES.map((template) => (
              <div 
                key={template.type}
                className="p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
              >
                <div className="text-2xl mb-2">{template.icon}</div>
                <h4 className="font-semibold text-sm">{template.name}</h4>
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                  {template.description}
                </p>
                <div className="flex items-center gap-2 mt-3">
                  <Badge variant="outline" className="text-[10px]">
                    {template.discountRange.min}-{template.discountRange.max}% off
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Scenario Detail Dialog */}
      <ScenarioDetailDialog
        scenario={selectedScenario}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        formatCurrency={formatCurrency}
      />

      {/* Custom Scenario Creator */}
      <CustomScenarioCreator
        open={customOpen}
        onOpenChange={setCustomOpen}
        onCreateScenario={handleCreateCustomScenario}
        engine={engine}
        availableResources={resources}
        formatCurrency={formatCurrency}
      />
    </div>
  );
}
