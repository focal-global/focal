import type { Metadata } from 'next';
import { UnitEconomicsClient } from './unit-economics-client';

export const metadata: Metadata = {
  title: 'Unit Economics | Focal Intelligence',
  description: 'Analyze cost efficiency across different business units and metrics',
};

export default function UnitEconomicsPage() {
  return <UnitEconomicsClient />;
}