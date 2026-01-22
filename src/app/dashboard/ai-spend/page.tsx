'use client';

/**
 * AI Analytics Page
 * 
 * Track AI/ML spending across cloud services.
 */

import dynamic from 'next/dynamic';
import { EnrichedSpectrumProvider } from '@/components/providers';
import { AnalyticsPageSkeleton } from '@/components/ui/skeleton-loaders';

// Dynamically import the heavy dashboard
const AIAnalyticsDashboard = dynamic(
  () => import('@/modules/detector/ai-analytics').then(mod => ({ default: mod.AIAnalyticsDashboard })),
  { loading: () => <AnalyticsPageSkeleton />, ssr: false }
);

export default function AISpendPage() {
  return (
    <EnrichedSpectrumProvider>
      <AIAnalyticsDashboard />
    </EnrichedSpectrumProvider>
  );
}
