/**
 * Core Ingestion Pipeline Implementation
 * 
 * The main orchestrator for data enrichment in Focal.
 * Handles dependency resolution, execution order, and error recovery.
 */

import { 
  EnrichmentStep, 
  PipelineContext, 
  PipelineResult, 
  RawBillingData, 
  EnrichedData,
  PipelineError,
  DependencyError,
  ValidationError 
} from './types';

export class IngestionPipeline {
  private steps: Map<string, EnrichmentStep> = new Map();
  private executionOrder: string[] = [];
  private isBuilt = false;

  constructor(private config: PipelineConfig = {}) {}

  /**
   * Register an enrichment step
   */
  register<TInput, TOutput>(step: EnrichmentStep<TInput, TOutput>): this {
    this.steps.set(step.name, step);
    this.isBuilt = false; // Force rebuild of execution order
    return this;
  }

  /**
   * Build the execution DAG
   */
  private build(): void {
    if (this.isBuilt) return;

    const stepNames = Array.from(this.steps.keys());
    const visited = new Set<string>();
    const visiting = new Set<string>();
    const order: string[] = [];

    const visit = (stepName: string) => {
      if (visiting.has(stepName)) {
        throw new DependencyError(stepName, [`Circular dependency detected`]);
      }
      if (visited.has(stepName)) return;

      visiting.add(stepName);
      const step = this.steps.get(stepName);
      if (!step) return;

      // Visit dependencies first
      for (const dep of step.dependencies || []) {
        if (!this.steps.has(dep)) {
          throw new DependencyError(stepName, [dep]);
        }
        visit(dep);
      }

      visiting.delete(stepName);
      visited.add(stepName);
      order.push(stepName);
    };

    // Visit all steps
    for (const stepName of stepNames) {
      visit(stepName);
    }

    this.executionOrder = order;
    this.isBuilt = true;
  }

  /**
   * Execute the pipeline with given data
   */
  async execute(
    rawData: RawBillingData, 
    context: PipelineContext
  ): Promise<PipelineResult<EnrichedData>> {
    const startTime = performance.now();
    const executionId = context.executionId;
    const stepsExecuted: string[] = [];
    const stepsSkipped: string[] = [];
    const warnings: string[] = [];

    try {
      // Build execution order
      this.build();

      console.log(`[Pipeline ${executionId}] Starting with ${this.executionOrder.length} steps`);
      
      let currentData: any = rawData;

      // Execute steps in dependency order
      for (const stepName of this.executionOrder) {
        const step = this.steps.get(stepName);
        if (!step) {
          stepsSkipped.push(stepName);
          continue;
        }

        const stepStartTime = performance.now();
        console.log(`[Pipeline ${executionId}] Executing: ${step.name}`);

        try {
          // Execute the step
          currentData = await step.execute(currentData, context);
          
          // Validate if validator exists
          if (step.validate && !step.validate(currentData)) {
            throw new ValidationError(step.name, 'Output validation failed');
          }

          const stepDuration = performance.now() - stepStartTime;
          console.log(`[Pipeline ${executionId}] ✅ ${step.name} (${stepDuration.toFixed(1)}ms)`);
          stepsExecuted.push(stepName);

        } catch (error) {
          const stepDuration = performance.now() - stepStartTime;
          console.error(`[Pipeline ${executionId}] ❌ ${step.name} (${stepDuration.toFixed(1)}ms):`, error);
          
          if (this.config.continueOnError) {
            warnings.push(`Step ${step.name} failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
            stepsSkipped.push(stepName);
          } else {
            throw new PipelineError(
              `Pipeline failed at step: ${step.name}`,
              step.name,
              error instanceof Error ? error : new Error(String(error))
            );
          }
        }
      }

      const totalDuration = performance.now() - startTime;
      console.log(`[Pipeline ${executionId}] ✅ Completed in ${totalDuration.toFixed(1)}ms`);

      return {
        success: true,
        data: currentData as EnrichedData,
        metadata: {
          executionId,
          duration: totalDuration,
          stepsExecuted,
          stepsSkipped,
          warnings
        }
      };

    } catch (error) {
      const totalDuration = performance.now() - startTime;
      console.error(`[Pipeline ${executionId}] ❌ Failed after ${totalDuration.toFixed(1)}ms:`, error);

      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        metadata: {
          executionId,
          duration: totalDuration,
          stepsExecuted,
          stepsSkipped,
          warnings
        }
      };
    }
  }

  /**
   * Get pipeline statistics
   */
  getStats() {
    return {
      totalSteps: this.steps.size,
      executionOrder: this.executionOrder,
      steps: Array.from(this.steps.values()).map(step => ({
        name: step.name,
        description: step.description,
        dependencies: step.dependencies || [],
        hasValidator: !!step.validate
      }))
    };
  }

  /**
   * Validate pipeline configuration
   */
  validate(): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    try {
      this.build();
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }

    // Check for orphaned dependencies
    for (const step of this.steps.values()) {
      for (const dep of step.dependencies || []) {
        if (!this.steps.has(dep)) {
          errors.push(`Step '${step.name}' depends on missing step '${dep}'`);
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

// ============================================================================
// Configuration
// ============================================================================

interface PipelineConfig {
  /** Continue execution even if individual steps fail */
  continueOnError?: boolean;
  /** Maximum execution time in ms */
  timeout?: number;
  /** Enable performance profiling */
  enableProfiling?: boolean;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Create a new pipeline with common steps pre-registered
 */
export function createStandardPipeline(config?: PipelineConfig): IngestionPipeline {
  const pipeline = new IngestionPipeline(config);
  
  // Standard steps will be registered here as we build them
  // pipeline.register(new VirtualTagsStep());
  // pipeline.register(new CO2CalculationStep());
  // pipeline.register(new AIClassificationStep());
  
  return pipeline;
}

/**
 * Generate a unique execution ID
 */
export function generateExecutionId(): string {
  return `exec_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}