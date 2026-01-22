'use client';

/**
 * Anomaly Detection Client Component
 * 
 * Wrapper that provides the EnrichedSpectrumProvider context for the Anomaly Detection dashboard
 */

import dynamic from 'next/dynamic';
import { EnrichedSpectrumProvider } from '@/components/providers';
import { DetectorPageSkeleton } from '@/components/ui/skeleton-loaders';

// Dynamically import the heavy dashboard
const AnomalyDetectionDashboard = dynamic(
  () => import('@/modules/detector').then(mod => ({ default: mod.AnomalyDetectionDashboard })),
  { loading: () => <DetectorPageSkeleton />, ssr: false }
);

export function AnomalyDetectionClient() {
  return (
    <EnrichedSpectrumProvider>
      <AnomalyDetectionDashboard />
    </EnrichedSpectrumProvider>
  );
}