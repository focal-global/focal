/**
 * Core types for the Focal Ingestion Pipeline
 * 
 * This defines the contracts for our composable data enrichment system.
 */

import type { AsyncDuckDBConnection } from '@duckdb/duckdb-wasm';

// ============================================================================
// Core Pipeline Types
// ============================================================================

export interface PipelineContext {
  /** DuckDB connection instance */
  duckdb: AsyncDuckDBConnection;
  /** Cache provider for performance optimization */
  cache: CacheProvider;
  /** Metadata and configuration */
  metadata: Record<string, unknown>;
  /** User context */
  userId: string;
  /** Organization context */
  orgId: string;
  /** Pipeline execution ID for tracing */
  executionId: string;
}

export interface EnrichmentStep<TInput = any, TOutput = any> {
  /** Unique step identifier */
  name: string;
  /** Human-readable description */
  description?: string;
  /** Execute the enrichment step */
  execute(data: TInput, context: PipelineContext): Promise<TOutput>;
  /** Optional validation of output */
  validate?(output: TOutput): boolean;
  /** Dependencies on other steps (by name) */
  dependencies?: string[];
  /** Configuration for this step */
  config?: Record<string, unknown>;
}

export interface PipelineResult<T = any> {
  /** Execution success status */
  success: boolean;
  /** Final enriched data */
  data?: T;
  /** Error information if failed */
  error?: string;
  /** Execution metadata */
  metadata: {
    executionId: string;
    duration: number;
    stepsExecuted: string[];
    stepsSkipped: string[];
    warnings: string[];
  };
}

// ============================================================================
// Data Types
// ============================================================================

export interface RawBillingData {
  /** Original FOCUS/CUR data rows */
  rows: Record<string, unknown>[];
  /** Data source metadata */
  source: {
    provider: 'aws' | 'azure' | 'gcp' | 'manual';
    format: 'focus' | 'cur' | 'csv' | 'parquet';
    uploadedAt: Date;
    fileName?: string;
  };
  /** Schema information */
  schema: {
    columns: string[];
    rowCount: number;
    estimatedSize: number;
  };
}

export interface EnrichedData extends RawBillingData {
  /** Virtual tags applied */
  virtualTags?: VirtualTagData[];
  /** CO2 emissions calculated */
  co2Data?: CO2Data[];
  /** AI/ML spend classification */
  aiClassification?: AISpendData[];
  /** Kubernetes cost allocation */
  k8sAllocation?: K8sAllocationData[];
  /** Unit economics metrics */
  unitEconomics?: UnitEconomicsData[];
}

// ============================================================================
// Enrichment Data Types
// ============================================================================

export interface VirtualTagData {
  resourceId: string;
  tags: Record<string, string>;
  appliedAt: Date;
  appliedBy: string;
}

export interface CO2Data {
  resourceId: string;
  estimatedKgCO2: number;
  confidence: number;
  coefficient: string;
  region: string;
}

export interface AISpendData {
  resourceId: string;
  isAIRelated: boolean;
  confidence: number;
  category: 'ml-training' | 'ml-inference' | 'data-processing' | 'gpu-compute' | 'ai-service';
  estimatedTokens?: number;
}

export interface K8sAllocationData {
  resourceId: string;
  namespace: string;
  workload: string;
  container?: string;
  cpuCores: number;
  memoryGB: number;
}

export interface UnitEconomicsData {
  resourceId: string;
  unitType: 'customer' | 'request' | 'gb-hour' | 'custom';
  costPerUnit: number;
  unitsConsumed: number;
  efficiency: number;
}

// ============================================================================
// Cache Provider Interface
// ============================================================================

export interface CacheProvider {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttl?: number): Promise<void>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
}

// ============================================================================
// Error Types
// ============================================================================

export class PipelineError extends Error {
  constructor(
    message: string,
    public readonly step?: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'PipelineError';
  }
}

export class ValidationError extends PipelineError {
  constructor(step: string, message: string) {
    super(`Validation failed in ${step}: ${message}`, step);
    this.name = 'ValidationError';
  }
}

export class DependencyError extends PipelineError {
  constructor(step: string, missingDependencies: string[]) {
    super(`Missing dependencies for ${step}: ${missingDependencies.join(', ')}`, step);
    this.name = 'DependencyError';
  }
}