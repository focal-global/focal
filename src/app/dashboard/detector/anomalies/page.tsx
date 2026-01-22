import type { Metadata } from 'next';
import { AnomalyDetectionClient } from './anomaly-detection-client';

export const metadata: Metadata = {
  title: 'Anomaly Detection | Focal Detector',
  description: 'AI-powered detection of cost anomalies and unusual spending patterns',
};

export default function AnomalyDetectionPage() {
  return <AnomalyDetectionClient />;
}