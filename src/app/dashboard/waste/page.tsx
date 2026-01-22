'use client';

import dynamic from 'next/dynamic';
import { EnrichedSpectrumProvider } from '@/components/providers';
import { DetectorPageSkeleton } from '@/components/ui/skeleton-loaders';

// Dynamically import the heavy dashboard
const WasteHunterDashboard = dynamic(
  () => import('@/modules/detector/waste-hunter').then(mod => ({ default: mod.WasteHunterDashboard })),
  { loading: () => <DetectorPageSkeleton />, ssr: false }
);

export default function WasteHunterPage() {
  return (
    <EnrichedSpectrumProvider>
      <WasteHunterDashboard />
    </EnrichedSpectrumProvider>
  );
}
