'use client';

/**
 * Unit Economics Client Component
 * 
 * Wrapper that provides the EnrichedSpectrumProvider context for the Unit Economics dashboard
 */

import { EnrichedSpectrumProvider } from '@/components/providers';
import { UnitEconomicsDashboard } from '@/modules/intelligence';

export function UnitEconomicsClient() {
  return (
    <EnrichedSpectrumProvider>
      <UnitEconomicsDashboard />
    </EnrichedSpectrumProvider>
  );
}