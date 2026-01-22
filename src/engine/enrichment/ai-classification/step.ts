/**
 * AI Spend Classification Enrichment Step
 * 
 * Identifies and classifies AI/ML related spending across cloud resources.
 * Uses pattern matching, service names, and heuristics to detect:
 * - ML training workloads
 * - Model inference endpoints 
 * - GPU compute instances
 * - AI-as-a-Service usage (OpenAI, Bedrock, etc.)
 */

import type { 
  EnrichmentStep, 
  PipelineContext, 
  EnrichedData,
  AISpendData 
} from '../../ingestion/types';

export interface AIClassificationRule {
  id: string;
  name: string;
  description: string;
  category: 'ml-training' | 'ml-inference' | 'data-processing' | 'gpu-compute' | 'ai-service';
  patterns: {
    serviceName?: RegExp[];
    resourceName?: RegExp[];
    instanceType?: RegExp[];
    tags?: Record<string, RegExp>;
  };
  confidence: number;
  priority: number;
}

export class AIClassificationStep implements EnrichmentStep<EnrichedData, EnrichedData> {
  name = 'ai-classification';
  description = 'Classify AI/ML related cloud spending';
  dependencies = ['virtual-tags']; // Can leverage virtual tags for better classification

  private rules: AIClassificationRule[] = [];

  constructor() {
    this.initializeClassificationRules();
  }

  async execute(
    data: EnrichedData,
    context: PipelineContext
  ): Promise<EnrichedData> {
    const { duckdb } = context;

    // Create billing data view
    await this.createBillingView(data, duckdb);

    // Apply AI classification rules
    const aiClassifications = await this.classifyAISpend(data, duckdb);

    console.log(`[AIClassification] Classified ${aiClassifications.length} AI-related resources`);

    // Log category breakdown
    const categories = aiClassifications.reduce((acc, item) => {
      acc[item.category] = (acc[item.category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    console.log('[AIClassification] Categories:', categories);

    return {
      ...data,
      aiClassification: aiClassifications
    };
  }

  validate(output: EnrichedData): boolean {
    return Array.isArray(output.aiClassification);
  }

  /**
   * Classify AI spending using pattern matching
   */
  private async classifyAISpend(
    data: EnrichedData,
    duckdb: any
  ): Promise<AISpendData[]> {
    const aiSpendData: AISpendData[] = [];

    // Get all resources for classification
    const resources = await duckdb.query(`
      SELECT DISTINCT 
        ResourceId,
        ServiceName,
        COALESCE(ResourceName, ResourceId) as ResourceName,
        COALESCE(InstanceType, 'unknown') as InstanceType,
        BilledCost
      FROM billing_ai_classification
    `);

    for (const resource of resources) {
      const classification = this.classifyResource(resource);
      if (classification) {
        aiSpendData.push({
          resourceId: String(resource.ResourceId),
          isAIRelated: true,
          confidence: classification.confidence,
          category: classification.category,
          estimatedTokens: this.estimateTokenUsage(resource, classification)
        });
      }
    }

    return aiSpendData;
  }

  /**
   * Classify a single resource using rules
   */
  private classifyResource(resource: any): { category: AISpendData['category']; confidence: number } | null {
    const serviceName = String(resource.ServiceName || '').toLowerCase();
    const resourceName = String(resource.ResourceName || '').toLowerCase();
    const instanceType = String(resource.InstanceType || '').toLowerCase();

    // Check each rule in priority order
    for (const rule of this.rules.sort((a, b) => b.priority - a.priority)) {
      let matches = 0;
      let totalChecks = 0;

      // Check service name patterns
      if (rule.patterns.serviceName) {
        totalChecks++;
        if (rule.patterns.serviceName.some(pattern => pattern.test(serviceName))) {
          matches++;
        }
      }

      // Check resource name patterns
      if (rule.patterns.resourceName) {
        totalChecks++;
        if (rule.patterns.resourceName.some(pattern => pattern.test(resourceName))) {
          matches++;
        }
      }

      // Check instance type patterns
      if (rule.patterns.instanceType) {
        totalChecks++;
        if (rule.patterns.instanceType.some(pattern => pattern.test(instanceType))) {
          matches++;
        }
      }

      // If at least 70% of patterns match, classify as AI
      if (totalChecks > 0 && (matches / totalChecks) >= 0.7) {
        return {
          category: rule.category,
          confidence: rule.confidence * (matches / totalChecks)
        };
      }
    }

    return null;
  }

  /**
   * Estimate token usage for AI services (rough approximation)
   */
  private estimateTokenUsage(
    resource: any, 
    classification: { category: AISpendData['category']; confidence: number }
  ): number | undefined {
    const cost = Number(resource.BilledCost) || 0;
    
    // Rough estimates based on typical pricing
    switch (classification.category) {
      case 'ml-inference':
        // Assume $0.002 per 1K tokens (GPT-3.5 range)
        return Math.floor((cost / 0.002) * 1000);
      case 'ai-service':
        // Similar to inference
        return Math.floor((cost / 0.003) * 1000);
      default:
        return undefined; // Training and compute don't have token-based pricing
    }
  }

  /**
   * Create billing view for AI classification
   */
  private async createBillingView(data: EnrichedData, duckdb: any): Promise<void> {
    const rows = data.rows.slice(0, 10000); // Performance limit
    
    if (rows.length === 0) return;

    const valuesClause = rows.map(row => {
      const resourceId = this.escapeValue(row.ResourceId);
      const serviceName = this.escapeValue(row.ServiceName);
      const resourceName = this.escapeValue(row.ResourceName || row.ResourceId);
      const instanceType = this.escapeValue(row.InstanceType || 'unknown');
      const billedCost = Number(row.BilledCost) || 0;
      
      return `(${resourceId}, ${serviceName}, ${resourceName}, ${instanceType}, ${billedCost})`;
    }).join(',\n');

    await duckdb.query(`
      CREATE OR REPLACE TEMPORARY VIEW billing_ai_classification AS
      SELECT * FROM (VALUES ${valuesClause})
      AS t(ResourceId, ServiceName, ResourceName, InstanceType, BilledCost)
    `);
  }

  /**
   * Initialize AI classification rules
   */
  private initializeClassificationRules(): void {
    this.rules = [
      // OpenAI and AI-as-a-Service
      {
        id: 'openai-services',
        name: 'OpenAI API Usage',
        description: 'Direct OpenAI API calls and similar services',
        category: 'ai-service',
        patterns: {
          serviceName: [
            /openai/,
            /gpt/,
            /claude/,
            /bedrock/,
            /comprehend/,
            /textract/,
            /rekognition/
          ]
        },
        confidence: 0.95,
        priority: 100
      },
      
      // AWS AI Services  
      {
        id: 'aws-ai-services',
        name: 'AWS AI/ML Services',
        description: 'AWS managed AI services',
        category: 'ai-service',
        patterns: {
          serviceName: [
            /sagemaker/,
            /bedrock/,
            /comprehend/,
            /polly/,
            /transcribe/,
            /translate/,
            /personalize/,
            /forecast/,
            /kendra/,
            /lex/,
            /rekognition/,
            /textract/
          ]
        },
        confidence: 0.9,
        priority: 90
      },

      // Azure AI Services
      {
        id: 'azure-ai-services', 
        name: 'Azure AI Services',
        description: 'Azure Cognitive Services and ML',
        category: 'ai-service',
        patterns: {
          serviceName: [
            /cognitive services/,
            /machine learning/,
            /bot service/,
            /speech services/,
            /computer vision/,
            /language understanding/,
            /custom vision/
          ]
        },
        confidence: 0.9,
        priority: 90
      },

      // Google Cloud AI
      {
        id: 'gcp-ai-services',
        name: 'Google Cloud AI Services', 
        description: 'GCP AI and ML services',
        category: 'ai-service',
        patterns: {
          serviceName: [
            /ai platform/,
            /cloud ml/,
            /automl/,
            /cloud vision/,
            /cloud speech/,
            /cloud translation/,
            /dialogflow/,
            /vertex ai/
          ]
        },
        confidence: 0.9,
        priority: 90
      },

      // GPU Instances (ML Training)
      {
        id: 'gpu-instances',
        name: 'GPU Compute Instances',
        description: 'GPU instances typically used for ML training',
        category: 'ml-training',
        patterns: {
          instanceType: [
            /p\d+\./,     // AWS p3, p4 instances
            /g\d+\./,     // AWS g4, g5 instances  
            /nc\d+/,      // Azure NC series
            /nd\d+/,      // Azure ND series
            /nv\d+/,      // Azure NV series
            /gpu/,
            /cuda/,
            /nvidia/
          ]
        },
        confidence: 0.8,
        priority: 80
      },

      // ML Training Patterns
      {
        id: 'ml-training-patterns',
        name: 'ML Training Resources',
        description: 'Resources with ML training naming patterns',
        category: 'ml-training',
        patterns: {
          resourceName: [
            /training/,
            /model.*train/,
            /ml.*train/,
            /pytorch/,
            /tensorflow/,
            /jupyter/,
            /notebook/,
            /experiment/
          ]
        },
        confidence: 0.7,
        priority: 70
      },

      // ML Inference Patterns
      {
        id: 'ml-inference-patterns',
        name: 'ML Inference Endpoints',
        description: 'Resources serving ML models',
        category: 'ml-inference', 
        patterns: {
          resourceName: [
            /inference/,
            /endpoint/,
            /model.*serv/,
            /predict/,
            /api.*model/,
            /ml.*serve/
          ]
        },
        confidence: 0.7,
        priority: 70
      },

      // Data Processing for ML
      {
        id: 'ml-data-processing',
        name: 'ML Data Processing',
        description: 'Data processing for ML pipelines',
        category: 'data-processing',
        patterns: {
          serviceName: [
            /glue/,
            /data factory/,
            /dataflow/,
            /kinesis/,
            /stream analytics/
          ],
          resourceName: [
            /etl/,
            /pipeline/,
            /feature.*store/,
            /data.*prep/
          ]
        },
        confidence: 0.6,
        priority: 60
      }
    ];
  }

  /**
   * Escape SQL values
   */
  private escapeValue(value: unknown): string {
    if (value === null || value === undefined) return 'NULL';
    if (typeof value === 'string') return `'${value.replace(/'/g, "''")}'`;
    if (typeof value === 'number') return String(value);
    return `'${String(value).replace(/'/g, "''")}'`;
  }
}