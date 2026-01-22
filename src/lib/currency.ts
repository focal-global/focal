/**
 * Currency Utilities for FOCUS Cost Analytics
 * 
 * FOCUS specification defines two currency columns:
 * - BillingCurrency: The currency used for billing/invoicing
 * - PricingCurrency: The currency used for pricing (may differ from billing)
 * 
 * This module provides utilities for:
 * - Detecting currency from FOCUS data
 * - Formatting currency values with proper symbols
 * - Managing user currency preferences
 */

// ============================================================================
// Types
// ============================================================================

export interface CurrencyInfo {
  code: string;
  name: string;
  symbol: string;
  locale: string;
}

export interface CurrencySettings {
  /** Display currency (may differ from data currency) */
  displayCurrency: string;
  /** Whether to auto-detect currency from data */
  autoDetect: boolean;
  /** Detected currency from data (if auto-detect is enabled) */
  detectedCurrency: string | null;
  /** Locale for number formatting */
  locale: string;
}

// ============================================================================
// Supported Currencies
// ============================================================================

/**
 * Common currencies used in cloud billing
 * Based on ISO 4217 currency codes
 */
export const SUPPORTED_CURRENCIES: Record<string, CurrencyInfo> = {
  USD: { code: 'USD', name: 'US Dollar', symbol: '$', locale: 'en-US' },
  EUR: { code: 'EUR', name: 'Euro', symbol: '€', locale: 'de-DE' },
  GBP: { code: 'GBP', name: 'British Pound', symbol: '£', locale: 'en-GB' },
  NOK: { code: 'NOK', name: 'Norwegian Krone', symbol: 'kr', locale: 'nb-NO' },
  SEK: { code: 'SEK', name: 'Swedish Krona', symbol: 'kr', locale: 'sv-SE' },
  DKK: { code: 'DKK', name: 'Danish Krone', symbol: 'kr', locale: 'da-DK' },
  CHF: { code: 'CHF', name: 'Swiss Franc', symbol: 'CHF', locale: 'de-CH' },
  CAD: { code: 'CAD', name: 'Canadian Dollar', symbol: 'CA$', locale: 'en-CA' },
  AUD: { code: 'AUD', name: 'Australian Dollar', symbol: 'A$', locale: 'en-AU' },
  JPY: { code: 'JPY', name: 'Japanese Yen', symbol: '¥', locale: 'ja-JP' },
  CNY: { code: 'CNY', name: 'Chinese Yuan', symbol: '¥', locale: 'zh-CN' },
  INR: { code: 'INR', name: 'Indian Rupee', symbol: '₹', locale: 'en-IN' },
  BRL: { code: 'BRL', name: 'Brazilian Real', symbol: 'R$', locale: 'pt-BR' },
  MXN: { code: 'MXN', name: 'Mexican Peso', symbol: 'MX$', locale: 'es-MX' },
  SGD: { code: 'SGD', name: 'Singapore Dollar', symbol: 'S$', locale: 'en-SG' },
  HKD: { code: 'HKD', name: 'Hong Kong Dollar', symbol: 'HK$', locale: 'en-HK' },
  KRW: { code: 'KRW', name: 'South Korean Won', symbol: '₩', locale: 'ko-KR' },
  PLN: { code: 'PLN', name: 'Polish Zloty', symbol: 'zł', locale: 'pl-PL' },
  ZAR: { code: 'ZAR', name: 'South African Rand', symbol: 'R', locale: 'en-ZA' },
  NZD: { code: 'NZD', name: 'New Zealand Dollar', symbol: 'NZ$', locale: 'en-NZ' },
};

// ============================================================================
// Default Settings
// ============================================================================

export const DEFAULT_CURRENCY_SETTINGS: CurrencySettings = {
  displayCurrency: 'USD',
  autoDetect: true,
  detectedCurrency: null,
  locale: 'en-US',
};

// ============================================================================
// Currency Detection
// ============================================================================

/**
 * Detect currency from FOCUS data rows
 * Looks for BillingCurrency or PricingCurrency columns
 * Returns the most common currency found
 */
export function detectCurrencyFromData(
  rows: Record<string, unknown>[],
  preferBilling: boolean = true
): string | null {
  if (!rows || rows.length === 0) return null;

  const currencyCounts: Record<string, number> = {};

  for (const row of rows) {
    // Check for currency columns (case-insensitive)
    const billingCurrency = row['BillingCurrency'] || row['billingcurrency'] || row['BILLINGCURRENCY'];
    const pricingCurrency = row['PricingCurrency'] || row['pricingcurrency'] || row['PRICINGCURRENCY'];

    const currency = preferBilling
      ? (billingCurrency || pricingCurrency)
      : (pricingCurrency || billingCurrency);

    if (currency && typeof currency === 'string') {
      const code = currency.toUpperCase();
      currencyCounts[code] = (currencyCounts[code] || 0) + 1;
    }
  }

  // Return the most common currency
  const entries = Object.entries(currencyCounts);
  if (entries.length === 0) return null;

  entries.sort((a, b) => b[1] - a[1]);
  return entries[0][0];
}

/**
 * Get currency from a single row
 */
export function getCurrencyFromRow(row: Record<string, unknown>): string | null {
  const billingCurrency = row['BillingCurrency'] || row['billingcurrency'] || row['BILLINGCURRENCY'];
  const pricingCurrency = row['PricingCurrency'] || row['pricingcurrency'] || row['PRICINGCURRENCY'];
  
  const currency = billingCurrency || pricingCurrency;
  return currency && typeof currency === 'string' ? currency.toUpperCase() : null;
}

// ============================================================================
// Currency Formatting
// ============================================================================

/**
 * Format a numeric value as currency
 * Uses Intl.NumberFormat for proper localization
 */
export function formatCurrency(
  value: unknown,
  currencyCode: string = 'USD',
  options: {
    locale?: string;
    minimumFractionDigits?: number;
    maximumFractionDigits?: number;
    compact?: boolean;
  } = {}
): string {
  if (value === null || value === undefined) return '-';

  // Convert to number
  let numValue: number;
  if (typeof value === 'bigint') {
    numValue = Number(value);
  } else if (typeof value === 'number') {
    numValue = value;
  } else if (typeof value === 'string') {
    numValue = parseFloat(value);
  } else {
    return String(value);
  }

  if (isNaN(numValue) || !isFinite(numValue)) return '-';

  // Validate fraction digits (must be 0-100 for Intl.NumberFormat)
  const minFracDigits = Math.max(0, Math.min(100, Math.floor(options.minimumFractionDigits ?? 2)));
  const maxFracDigits = Math.max(minFracDigits, Math.min(100, Math.floor(options.maximumFractionDigits ?? 2)));

  const code = currencyCode.toUpperCase();
  const currencyInfo = SUPPORTED_CURRENCIES[code];
  const locale = options.locale || currencyInfo?.locale || 'en-US';

  try {
    const formatOptions: Intl.NumberFormatOptions = {
      style: 'currency',
      currency: code,
      minimumFractionDigits: minFracDigits,
      maximumFractionDigits: maxFracDigits,
    };

    // Use compact notation for large numbers
    if (options.compact && Math.abs(numValue) >= 1000) {
      formatOptions.notation = 'compact';
      formatOptions.maximumFractionDigits = 1;
    }

    return new Intl.NumberFormat(locale, formatOptions).format(numValue);
  } catch {
    // Fallback for unsupported currencies
    const symbol = currencyInfo?.symbol || code;
    return `${symbol} ${numValue.toLocaleString(locale, {
      minimumFractionDigits: minFracDigits,
      maximumFractionDigits: maxFracDigits,
    })}`;
  }
}

/**
 * Format currency with automatic detection from row data
 * Falls back to provided default currency
 */
export function formatCurrencyFromRow(
  value: unknown,
  row: Record<string, unknown>,
  defaultCurrency: string = 'USD'
): string {
  const currency = getCurrencyFromRow(row) || defaultCurrency;
  return formatCurrency(value, currency);
}

// ============================================================================
// Column Detection
// ============================================================================

/**
 * Check if a column name represents a cost/currency value
 * Based on FOCUS specification column naming conventions
 */
export function isCostColumn(columnName: string): boolean {
  const lowerName = columnName.toLowerCase();
  
  // FOCUS cost columns
  const focusCostColumns = [
    'billedcost',
    'effectivecost',
    'listcost',
    'contractedcost',
    'amortizedcost',
    'listunitprice',
    'contractedunitprice',
    'effectiveunitprice',
    'billedunitprice',
  ];
  
  if (focusCostColumns.includes(lowerName)) return true;
  
  // Pattern-based detection for aggregated columns
  const costPatterns = [
    /cost$/i,
    /^total.*cost/i,
    /^sum.*cost/i,
    /price$/i,
    /^total.*price/i,
    /savings$/i,
    /^total.*savings/i,
    /amount$/i,
  ];
  
  return costPatterns.some(pattern => pattern.test(columnName));
}

/**
 * Check if a column is a currency code column
 */
export function isCurrencyColumn(columnName: string): boolean {
  const lowerName = columnName.toLowerCase();
  return lowerName === 'billingcurrency' || 
         lowerName === 'pricingcurrency' ||
         lowerName.endsWith('currency');
}

// ============================================================================
// Storage
// ============================================================================

const CURRENCY_SETTINGS_KEY = 'focal_currency_settings';

/**
 * Load currency settings from localStorage
 */
export function loadCurrencySettings(): CurrencySettings {
  if (typeof window === 'undefined') return DEFAULT_CURRENCY_SETTINGS;
  
  try {
    const stored = localStorage.getItem(CURRENCY_SETTINGS_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return { ...DEFAULT_CURRENCY_SETTINGS, ...parsed };
    }
  } catch (e) {
    console.warn('Failed to load currency settings:', e);
  }
  
  return DEFAULT_CURRENCY_SETTINGS;
}

/**
 * Save currency settings to localStorage
 */
export function saveCurrencySettings(settings: Partial<CurrencySettings>): void {
  if (typeof window === 'undefined') return;
  
  try {
    const current = loadCurrencySettings();
    const updated = { ...current, ...settings };
    localStorage.setItem(CURRENCY_SETTINGS_KEY, JSON.stringify(updated));
  } catch (e) {
    console.warn('Failed to save currency settings:', e);
  }
}

/**
 * Clear currency settings
 */
export function clearCurrencySettings(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(CURRENCY_SETTINGS_KEY);
}
