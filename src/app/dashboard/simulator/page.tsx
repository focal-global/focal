'use client';

/**
 * Savings Simulator Page
 * 
 * What-if analysis for cost optimization scenarios.
 */

import dynamic from 'next/dynamic';
import { AnalyticsPageSkeleton } from '@/components/ui/skeleton-loaders';

// Dynamically import the heavy dashboard
const SavingsSimulatorDashboard = dynamic(
  () => import('@/modules/detector/savings-simulator').then(mod => ({ default: mod.SavingsSimulatorDashboard })),
  { loading: () => <AnalyticsPageSkeleton />, ssr: false }
);

export default function SavingsSimulatorPage() {
  return <SavingsSimulatorDashboard />;
}
