'use client';

/**
 * Dashboard Selector Component
 * 
 * Provides a UI for switching between different dashboard personas
 * and managing custom dashboards.
 */

import { useState } from 'react';
import { 
  Briefcase, 
  Calculator, 
  Wrench, 
  LayoutDashboard, 
  Settings, 
  ChevronDown,
  Check,
  Plus,
  Star,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import type { DashboardPersona, DashboardConfig } from './types';
import { PERSONA_CONFIGS } from './types';

// ============================================================================
// Icon Mapping
// ============================================================================

const PersonaIcon = ({ persona, className }: { persona: DashboardPersona; className?: string }) => {
  const iconClass = className || 'h-4 w-4';
  switch (persona) {
    case 'executive':
      return <Briefcase className={iconClass} />;
    case 'finance':
      return <Calculator className={iconClass} />;
    case 'engineering':
      return <Wrench className={iconClass} />;
    case 'overview':
      return <LayoutDashboard className={iconClass} />;
    case 'custom':
      return <Settings className={iconClass} />;
    default:
      return <LayoutDashboard className={iconClass} />;
  }
};

// ============================================================================
// Component Props
// ============================================================================

interface DashboardSelectorProps {
  currentPersona: DashboardPersona;
  currentDashboard?: DashboardConfig;
  customDashboards?: DashboardConfig[];
  onSelectPersona: (persona: DashboardPersona) => void;
  onSelectDashboard?: (dashboard: DashboardConfig) => void;
  onCreateDashboard?: () => void;
}

// ============================================================================
// Dashboard Selector Component
// ============================================================================

export function DashboardSelector({
  currentPersona,
  currentDashboard,
  customDashboards = [],
  onSelectPersona,
  onSelectDashboard,
  onCreateDashboard,
}: DashboardSelectorProps) {
  const currentConfig = PERSONA_CONFIGS[currentPersona];
  
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="min-w-[200px] justify-between">
          <div className="flex items-center gap-2">
            <PersonaIcon persona={currentPersona} />
            <span>{currentDashboard?.name || currentConfig.name}</span>
          </div>
          <ChevronDown className="h-4 w-4 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[280px]">
        <DropdownMenuLabel>Dashboard Views</DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        {/* Pre-built Personas */}
        {(['overview', 'executive', 'finance', 'engineering'] as DashboardPersona[]).map((persona) => {
          const config = PERSONA_CONFIGS[persona];
          const isSelected = currentPersona === persona;
          
          return (
            <DropdownMenuItem
              key={persona}
              onClick={() => onSelectPersona(persona)}
              className="flex items-start gap-3 py-3"
            >
              <div className={`p-2 rounded-lg bg-gradient-to-br ${config.color} text-white`}>
                <PersonaIcon persona={persona} className="h-4 w-4" />
              </div>
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{config.name}</span>
                  {isSelected && <Check className="h-4 w-4 text-primary" />}
                </div>
                <p className="text-xs text-muted-foreground line-clamp-1">
                  {config.description}
                </p>
              </div>
            </DropdownMenuItem>
          );
        })}
        
        {/* Custom Dashboards */}
        {customDashboards.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="flex items-center gap-2">
              <Star className="h-3 w-3" />
              My Dashboards
            </DropdownMenuLabel>
            {customDashboards.map((dashboard) => (
              <DropdownMenuItem
                key={dashboard.id}
                onClick={() => onSelectDashboard?.(dashboard)}
                className="flex items-center gap-2"
              >
                <Settings className="h-4 w-4 text-muted-foreground" />
                <span>{dashboard.name}</span>
                {currentDashboard?.id === dashboard.id && (
                  <Check className="h-4 w-4 text-primary ml-auto" />
                )}
              </DropdownMenuItem>
            ))}
          </>
        )}
        
        {/* Create Custom Dashboard */}
        {onCreateDashboard && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onCreateDashboard} className="text-primary">
              <Plus className="h-4 w-4 mr-2" />
              Create Custom Dashboard
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ============================================================================
// Persona Cards for Selection Page
// ============================================================================

interface PersonaCardProps {
  persona: DashboardPersona;
  isSelected: boolean;
  onSelect: () => void;
}

export function PersonaCard({ persona, isSelected, onSelect }: PersonaCardProps) {
  const config = PERSONA_CONFIGS[persona];
  
  return (
    <button
      onClick={onSelect}
      className={`
        relative p-6 rounded-xl border-2 text-left transition-all
        hover:border-primary/50 hover:shadow-lg
        ${isSelected ? 'border-primary bg-primary/5 shadow-md' : 'border-muted bg-card'}
      `}
    >
      {isSelected && (
        <div className="absolute top-3 right-3">
          <Badge variant="default" className="bg-primary">
            <Check className="h-3 w-3 mr-1" />
            Selected
          </Badge>
        </div>
      )}
      
      <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${config.color} flex items-center justify-center mb-4`}>
        <PersonaIcon persona={persona} className="h-6 w-6 text-white" />
      </div>
      
      <h3 className="text-lg font-semibold mb-2">{config.name}</h3>
      <p className="text-sm text-muted-foreground">{config.description}</p>
    </button>
  );
}

// ============================================================================
// Persona Selection Grid
// ============================================================================

interface PersonaSelectionGridProps {
  currentPersona: DashboardPersona;
  onSelectPersona: (persona: DashboardPersona) => void;
}

export function PersonaSelectionGrid({ currentPersona, onSelectPersona }: PersonaSelectionGridProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {(['overview', 'executive', 'finance', 'engineering'] as DashboardPersona[]).map((persona) => (
        <PersonaCard
          key={persona}
          persona={persona}
          isSelected={currentPersona === persona}
          onSelect={() => onSelectPersona(persona)}
        />
      ))}
    </div>
  );
}
