/**
 * Enrichment Steps Export
 * 
 * Centralized exports for all enrichment pipeline steps.
 */

// Core pipeline
export { IngestionPipeline, createStandardPipeline, generateExecutionId } from './ingestion/pipeline';
export { InMemoryCacheProvider, IndexedDBCacheProvider } from './ingestion/cache';
export * from './ingestion/types';

// Enrichment steps
export { VirtualTagsStep } from './enrichment/virtual-tags/step';
export type { VirtualTagRule, TagCondition } from './enrichment/virtual-tags/step';

export { GreenOpsStep } from './enrichment/green-ops/step';
export type { CO2Coefficient } from './enrichment/green-ops/step';

export { AIClassificationStep } from './enrichment/ai-classification/step';
export type { AIClassificationRule } from './enrichment/ai-classification/step';

// Utility to create a pipeline with all standard steps
export function createFullEnrichmentPipeline() {
  // Import here to avoid circular dependency
  const { IngestionPipeline } = require('./ingestion/pipeline');
  const { VirtualTagsStep } = require('./enrichment/virtual-tags/step');
  const { GreenOpsStep } = require('./enrichment/green-ops/step');
  const { AIClassificationStep } = require('./enrichment/ai-classification/step');
  
  const pipeline = new IngestionPipeline({ continueOnError: true });
  
  // Register all enrichment steps
  pipeline.register(new VirtualTagsStep());
  pipeline.register(new GreenOpsStep());
  pipeline.register(new AIClassificationStep());
  
  return pipeline;
}