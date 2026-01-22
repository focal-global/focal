/**
 * Shared Scan Configuration for DETECT Module
 * 
 * Unified scan frequency settings used across all detector dashboards:
 * - Anomaly Detection
 * - Waste Hunter  
 * - AI Analytics
 * 
 * Since billing data typically updates daily, the default is 24h.
 */

// ============================================================================
// Scan Frequency Configuration
// ============================================================================

export const SCAN_FREQUENCIES = {
  manual: { label: 'Manual Only', interval: 0, description: 'Only scan when you click "Scan Now"' },
  '1h': { label: 'Every Hour', interval: 60 * 60 * 1000, description: 'Good for high-activity accounts' },
  '6h': { label: 'Every 6 Hours', interval: 6 * 60 * 60 * 1000, description: 'Balanced frequency' },
  '12h': { label: 'Every 12 Hours', interval: 12 * 60 * 60 * 1000, description: 'Twice daily checks' },
  '24h': { label: 'Daily', interval: 24 * 60 * 60 * 1000, description: 'Recommended for daily data updates' },
} as const;

export type ScanFrequency = keyof typeof SCAN_FREQUENCIES;

// Array version for iteration in UI
export const SCAN_FREQUENCY_OPTIONS: { value: ScanFrequency; label: string; interval: number; description: string }[] = [
  { value: 'manual', label: 'Manual Only', interval: 0, description: 'Only scan when you click "Scan Now"' },
  { value: '1h', label: 'Every Hour', interval: 60 * 60 * 1000, description: 'Good for high-activity accounts' },
  { value: '6h', label: 'Every 6 Hours', interval: 6 * 60 * 60 * 1000, description: 'Balanced frequency' },
  { value: '12h', label: 'Every 12 Hours', interval: 12 * 60 * 60 * 1000, description: 'Twice daily checks' },
  { value: '24h', label: 'Daily', interval: 24 * 60 * 60 * 1000, description: 'Recommended for daily data updates' },
];

// Storage keys for persisting scan settings
export const SCAN_SETTINGS_KEYS = {
  anomaly: 'focal:anomaly-scan-settings',
  waste: 'focal:waste-scan-settings',
  aiAnalytics: 'focal:ai-analytics-scan-settings',
} as const;

// ============================================================================
// Timeframe Options
// ============================================================================

export const TIMEFRAME_OPTIONS = [
  { value: '7d', label: '7 days' },
  { value: '14d', label: '14 days' },
  { value: '30d', label: '30 days' },
  { value: '60d', label: '60 days' },
  { value: '90d', label: '90 days' },
] as const;

export type Timeframe = typeof TIMEFRAME_OPTIONS[number]['value'];

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Format time until a future date in a human-readable way
 */
export function formatTimeUntil(date: Date): string {
  const now = Date.now();
  const target = date.getTime();
  const diff = target - now;
  
  if (diff <= 0) return 'Now';
  
  const minutes = Math.floor(diff / (60 * 1000));
  const hours = Math.floor(diff / (60 * 60 * 1000));
  
  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    return `${days}d ${hours % 24}h`;
  }
  if (hours >= 1) {
    return `${hours}h ${minutes % 60}m`;
  }
  return `${minutes}m`;
}

/**
 * Load scan settings from localStorage
 */
export function loadScanSettings(key: string): { 
  frequency?: ScanFrequency; 
  lastScan?: Date;
} | null {
  if (typeof window === 'undefined') return null;
  
  try {
    const saved = localStorage.getItem(key);
    if (saved) {
      const settings = JSON.parse(saved);
      return {
        frequency: settings.frequency as ScanFrequency | undefined,
        lastScan: settings.lastScan ? new Date(settings.lastScan) : undefined,
      };
    }
  } catch (e) {
    console.warn('[ScanConfig] Failed to load scan settings:', e);
  }
  return null;
}

/**
 * Save scan settings to localStorage
 */
export function saveScanSettings(key: string, settings: { 
  frequency: ScanFrequency; 
  lastScan?: Date;
}): void {
  if (typeof window === 'undefined') return;
  
  try {
    localStorage.setItem(key, JSON.stringify({
      frequency: settings.frequency,
      lastScan: settings.lastScan?.toISOString(),
    }));
  } catch (e) {
    console.warn('[ScanConfig] Failed to save scan settings:', e);
  }
}

/**
 * Calculate next scheduled scan time
 */
export function calculateNextScan(frequency: ScanFrequency, lastScan: Date | null): Date | null {
  const freq = SCAN_FREQUENCIES[frequency];
  if (freq.interval === 0 || !lastScan) return null;
  
  return new Date(lastScan.getTime() + freq.interval);
}

/**
 * Check if a scan is due
 */
export function isScanDue(frequency: ScanFrequency, lastScan: Date | null): boolean {
  if (frequency === 'manual') return false;
  if (!lastScan) return true;
  
  const nextScan = calculateNextScan(frequency, lastScan);
  if (!nextScan) return false;
  
  return Date.now() >= nextScan.getTime();
}
