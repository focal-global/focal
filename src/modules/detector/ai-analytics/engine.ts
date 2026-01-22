/**
 * AI Analytics Engine
 * 
 * Local-First analytics engine for tracking AI/ML cloud spending.
 * Identifies AI-related services and provides detailed cost breakdown.
 * 
 * AI Service Categories:
 * 1. Large Language Models (OpenAI, Anthropic, Azure OpenAI, Bedrock)
 * 2. ML Training (SageMaker, Vertex AI, Azure ML)
 * 3. ML Inference (Endpoints, Batch Transform)
 * 4. GPU Compute (NC, ND, A100, V100, T4 instances)
 * 5. AI Services (Cognitive Services, Vision, Speech, Translation)
 * 6. Vector Databases (Pinecone, Weaviate, Qdrant costs on cloud)
 * 7. Data Processing (Databricks ML, Synapse ML)
 */

// ============================================================================
// Types
// ============================================================================

export type AIServiceCategory = 
  | 'llm'
  | 'ml-training'
  | 'ml-inference'
  | 'gpu-compute'
  | 'cognitive-services'
  | 'vector-db'
  | 'data-processing'
  | 'model-hosting'
  | 'ai-search'
  | 'other-ai';

export interface AIServicePattern {
  category: AIServiceCategory;
  patterns: string[];
  description: string;
  icon: string;
}

export interface AISpendItem {
  id: string;
  resourceId: string;
  resourceName: string;
  resourceType: string;
  serviceName: string;
  serviceCategory: AIServiceCategory;
  region: string;
  
  // Cost metrics
  totalCost: number;
  dailyAvgCost: number;
  costTrend: number; // Percentage change
  currency: string;
  
  // Usage metrics
  usageQuantity: number;
  usageUnit: string;
  
  // Time series
  dailyCosts: { date: string; cost: number }[];
  
  // Additional info
  model?: string;
  tier?: string;
  provider: 'azure' | 'aws' | 'gcp' | 'other';
}

export interface AISpendSummary {
  totalSpend: number;
  spendTrend: number;
  byCategory: Record<AIServiceCategory, { cost: number; count: number; trend: number }>;
  byProvider: Record<string, { cost: number; count: number }>;
  byModel: { name: string; cost: number; calls?: number }[];
  byRegion: { region: string; cost: number }[];
  topResources: AISpendItem[];
  dailyTrend: { date: string; cost: number; llm: number; training: number; inference: number }[];
  projectedMonthly: number;
  costPerThousandCalls?: number;
}

export interface AIEfficiencyMetrics {
  costPerToken: number;
  tokensPerDollar: number;
  avgRequestCost: number;
  peakHourCost: number;
  offPeakSavingsPotential: number;
  batchingPotential: number;
  modelDowngradeSavings: number;
}

// ============================================================================
// AI Service Patterns
// ============================================================================

export const AI_SERVICE_PATTERNS: AIServicePattern[] = [
  {
    category: 'llm',
    patterns: [
      'openai', 'gpt-4', 'gpt-3', 'gpt-35', 'chatgpt', 'davinci', 'curie', 'babbage', 'ada',
      'azure openai', 'anthropic', 'claude', 'bedrock', 'titan', 'cohere', 'ai21',
      'palm', 'gemini', 'llama', 'mistral'
    ],
    description: 'Large Language Models',
    icon: '🤖'
  },
  {
    category: 'ml-training',
    patterns: [
      'sagemaker training', 'vertex training', 'azure machine learning compute',
      'training job', 'ml training', 'hyperparameter tuning', 'automl',
      'databricks training', 'model training'
    ],
    description: 'ML Model Training',
    icon: '🏋️'
  },
  {
    category: 'ml-inference',
    patterns: [
      'sagemaker endpoint', 'sagemaker inference', 'vertex endpoint', 'vertex prediction',
      'azure ml endpoint', 'online endpoint', 'batch endpoint', 'inference endpoint',
      'real-time inference', 'batch transform'
    ],
    description: 'ML Inference',
    icon: '⚡'
  },
  {
    category: 'gpu-compute',
    patterns: [
      'gpu', 'nvidia', 'a100', 'a10g', 'v100', 't4', 'p100', 'k80',
      'nc series', 'nd series', 'nv series', 'ncas', 'nda',
      'p4d', 'p3', 'g4dn', 'g5', 'inf1', 'inf2', 'trn1',
      'n1-highmem-gpu', 'a2-highgpu', 'a2-megagpu'
    ],
    description: 'GPU Compute',
    icon: '🎮'
  },
  {
    category: 'cognitive-services',
    patterns: [
      'cognitive services', 'computer vision', 'custom vision', 'face api',
      'form recognizer', 'document intelligence', 'speech service', 'text analytics',
      'language understanding', 'translator', 'content moderator', 'personalizer',
      'rekognition', 'textract', 'comprehend', 'polly', 'transcribe', 'translate',
      'vision api', 'natural language', 'speech-to-text', 'text-to-speech'
    ],
    description: 'AI/Cognitive Services',
    icon: '🧠'
  },
  {
    category: 'vector-db',
    patterns: [
      'vector', 'embedding', 'pinecone', 'weaviate', 'qdrant', 'milvus',
      'azure ai search', 'cognitive search', 'opensearch', 'elasticsearch vector',
      'pgvector', 'redis vector'
    ],
    description: 'Vector Databases',
    icon: '📊'
  },
  {
    category: 'data-processing',
    patterns: [
      'databricks', 'synapse', 'dataflow', 'data factory ml',
      'glue ml', 'emr spark ml', 'dataproc ml'
    ],
    description: 'ML Data Processing',
    icon: '🔄'
  },
  {
    category: 'model-hosting',
    patterns: [
      'model registry', 'mlflow', 'model deployment', 'container instance ml',
      'app service ml', 'lambda ml', 'cloud functions ml', 'cloud run ml'
    ],
    description: 'Model Hosting',
    icon: '🏠'
  },
  {
    category: 'ai-search',
    patterns: [
      'ai search', 'semantic search', 'cognitive search', 'knowledge mining',
      'rag', 'retrieval augmented', 'kendra'
    ],
    description: 'AI-Powered Search',
    icon: '🔍'
  }
];

// ============================================================================
// AI Analytics Engine
// ============================================================================

export class AIAnalyticsEngine {
  private patterns: AIServicePattern[];

  constructor() {
    this.patterns = AI_SERVICE_PATTERNS;
  }

  /**
   * Detect if a resource is AI-related
   */
  detectAICategory(serviceName: string, resourceType: string, resourceName: string): AIServiceCategory | null {
    const searchText = `${serviceName} ${resourceType} ${resourceName}`.toLowerCase();
    
    for (const pattern of this.patterns) {
      if (pattern.patterns.some(p => searchText.includes(p.toLowerCase()))) {
        return pattern.category;
      }
    }
    
    return null;
  }

  /**
   * Analyze AI spending from resource data
   */
  analyzeAISpend(resources: {
    resourceId: string;
    resourceName: string;
    resourceType: string;
    serviceName: string;
    serviceCategory: string;
    region: string;
    totalCost: number;
    usageQuantity: number;
    pricingUnit: string;
    currency: string;
    dailyCosts: { date: string; cost: number }[];
  }[]): AISpendItem[] {
    const aiItems: AISpendItem[] = [];

    for (const resource of resources) {
      const aiCategory = this.detectAICategory(
        resource.serviceName,
        resource.resourceType,
        resource.resourceName
      );

      if (aiCategory) {
        const dailyAvg = resource.dailyCosts.length > 0
          ? resource.totalCost / resource.dailyCosts.length
          : 0;
        
        // Calculate trend (compare last 7 days vs previous 7 days)
        const costTrend = this.calculateTrend(resource.dailyCosts);
        
        // Detect provider from service name
        const provider = this.detectProvider(resource.serviceName);
        
        // Extract model name if possible
        const model = this.extractModelName(resource.resourceName, resource.serviceName);

        aiItems.push({
          id: `ai-${resource.resourceId}`,
          resourceId: resource.resourceId,
          resourceName: resource.resourceName,
          resourceType: resource.resourceType,
          serviceName: resource.serviceName,
          serviceCategory: aiCategory,
          region: resource.region,
          totalCost: resource.totalCost,
          dailyAvgCost: dailyAvg,
          costTrend,
          currency: resource.currency,
          usageQuantity: resource.usageQuantity,
          usageUnit: resource.pricingUnit,
          dailyCosts: resource.dailyCosts,
          model,
          provider,
        });
      }
    }

    // Sort by cost descending
    return aiItems.sort((a, b) => b.totalCost - a.totalCost);
  }

  /**
   * Generate summary statistics
   */
  generateSummary(items: AISpendItem[], dateRange: { start: Date; end: Date }): AISpendSummary {
    const totalSpend = items.reduce((sum, i) => sum + i.totalCost, 0);
    
    // Calculate overall trend
    const allDailyCosts = this.aggregateDailyCosts(items);
    const spendTrend = this.calculateTrend(allDailyCosts);
    
    // By category
    const byCategory = {} as Record<AIServiceCategory, { cost: number; count: number; trend: number }>;
    for (const pattern of this.patterns) {
      byCategory[pattern.category] = { cost: 0, count: 0, trend: 0 };
    }
    byCategory['other-ai'] = { cost: 0, count: 0, trend: 0 };
    
    for (const item of items) {
      if (byCategory[item.serviceCategory]) {
        byCategory[item.serviceCategory].cost += item.totalCost;
        byCategory[item.serviceCategory].count++;
      }
    }
    
    // Calculate trends per category
    for (const cat of Object.keys(byCategory) as AIServiceCategory[]) {
      const catItems = items.filter(i => i.serviceCategory === cat);
      if (catItems.length > 0) {
        const catDailyCosts = this.aggregateDailyCosts(catItems);
        byCategory[cat].trend = this.calculateTrend(catDailyCosts);
      }
    }
    
    // By provider
    const providerMap = new Map<string, { cost: number; count: number }>();
    for (const item of items) {
      const current = providerMap.get(item.provider) || { cost: 0, count: 0 };
      current.cost += item.totalCost;
      current.count++;
      providerMap.set(item.provider, current);
    }
    const byProvider = Object.fromEntries(providerMap);
    
    // By model
    const modelMap = new Map<string, number>();
    for (const item of items) {
      if (item.model) {
        modelMap.set(item.model, (modelMap.get(item.model) || 0) + item.totalCost);
      }
    }
    const byModel = Array.from(modelMap.entries())
      .map(([name, cost]) => ({ name, cost }))
      .sort((a, b) => b.cost - a.cost)
      .slice(0, 10);
    
    // By region
    const regionMap = new Map<string, number>();
    for (const item of items) {
      regionMap.set(item.region, (regionMap.get(item.region) || 0) + item.totalCost);
    }
    const byRegion = Array.from(regionMap.entries())
      .map(([region, cost]) => ({ region, cost }))
      .sort((a, b) => b.cost - a.cost);
    
    // Daily trend with category breakdown
    const dailyTrendMap = new Map<string, { cost: number; llm: number; training: number; inference: number }>();
    for (const item of items) {
      for (const day of item.dailyCosts) {
        const current = dailyTrendMap.get(day.date) || { cost: 0, llm: 0, training: 0, inference: 0 };
        current.cost += day.cost;
        if (item.serviceCategory === 'llm') current.llm += day.cost;
        if (item.serviceCategory === 'ml-training') current.training += day.cost;
        if (item.serviceCategory === 'ml-inference') current.inference += day.cost;
        dailyTrendMap.set(day.date, current);
      }
    }
    const dailyTrend = Array.from(dailyTrendMap.entries())
      .map(([date, data]) => ({ date, ...data }))
      .sort((a, b) => a.date.localeCompare(b.date));
    
    // Projected monthly
    const daysInRange = Math.max(1, Math.ceil((dateRange.end.getTime() - dateRange.start.getTime()) / (24 * 60 * 60 * 1000)));
    const dailyAverage = totalSpend / daysInRange;
    const projectedMonthly = dailyAverage * 30;
    
    return {
      totalSpend,
      spendTrend,
      byCategory,
      byProvider,
      byModel,
      byRegion,
      topResources: items.slice(0, 20),
      dailyTrend,
      projectedMonthly,
    };
  }

  /**
   * Calculate efficiency metrics
   */
  calculateEfficiencyMetrics(items: AISpendItem[]): AIEfficiencyMetrics {
    const llmItems = items.filter(i => i.serviceCategory === 'llm');
    const totalLLMCost = llmItems.reduce((sum, i) => sum + i.totalCost, 0);
    const totalTokens = llmItems.reduce((sum, i) => sum + i.usageQuantity, 0);
    
    // Estimate tokens (many units are per 1000 tokens)
    const estimatedTokens = totalTokens * 1000;
    
    return {
      costPerToken: estimatedTokens > 0 ? totalLLMCost / estimatedTokens : 0,
      tokensPerDollar: totalLLMCost > 0 ? estimatedTokens / totalLLMCost : 0,
      avgRequestCost: llmItems.length > 0 ? totalLLMCost / Math.max(1, totalTokens) : 0,
      peakHourCost: totalLLMCost * 0.15, // Estimate 15% of cost in peak hour
      offPeakSavingsPotential: totalLLMCost * 0.1, // 10% potential by shifting load
      batchingPotential: totalLLMCost * 0.2, // 20% potential from batching
      modelDowngradeSavings: totalLLMCost * 0.3, // 30% potential by using smaller models
    };
  }

  private calculateTrend(dailyCosts: { date: string; cost: number }[]): number {
    if (dailyCosts.length < 14) return 0;
    
    const sorted = [...dailyCosts].sort((a, b) => a.date.localeCompare(b.date));
    const recent = sorted.slice(-7);
    const previous = sorted.slice(-14, -7);
    
    const recentTotal = recent.reduce((sum, d) => sum + d.cost, 0);
    const previousTotal = previous.reduce((sum, d) => sum + d.cost, 0);
    
    if (previousTotal === 0) return recentTotal > 0 ? 100 : 0;
    return ((recentTotal - previousTotal) / previousTotal) * 100;
  }

  private aggregateDailyCosts(items: AISpendItem[]): { date: string; cost: number }[] {
    const dateMap = new Map<string, number>();
    for (const item of items) {
      for (const day of item.dailyCosts) {
        dateMap.set(day.date, (dateMap.get(day.date) || 0) + day.cost);
      }
    }
    return Array.from(dateMap.entries())
      .map(([date, cost]) => ({ date, cost }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  private detectProvider(serviceName: string): 'azure' | 'aws' | 'gcp' | 'other' {
    const lower = serviceName.toLowerCase();
    if (lower.includes('azure') || lower.includes('microsoft')) return 'azure';
    if (lower.includes('aws') || lower.includes('amazon') || lower.includes('sagemaker')) return 'aws';
    if (lower.includes('google') || lower.includes('gcp') || lower.includes('vertex')) return 'gcp';
    return 'other';
  }

  private extractModelName(resourceName: string, serviceName: string): string | undefined {
    const combined = `${resourceName} ${serviceName}`.toLowerCase();
    
    // GPT models
    if (combined.includes('gpt-4-turbo')) return 'GPT-4 Turbo';
    if (combined.includes('gpt-4o')) return 'GPT-4o';
    if (combined.includes('gpt-4')) return 'GPT-4';
    if (combined.includes('gpt-35') || combined.includes('gpt-3.5')) return 'GPT-3.5 Turbo';
    if (combined.includes('gpt-3')) return 'GPT-3';
    
    // Claude models
    if (combined.includes('claude-3-opus')) return 'Claude 3 Opus';
    if (combined.includes('claude-3-sonnet')) return 'Claude 3 Sonnet';
    if (combined.includes('claude-3-haiku')) return 'Claude 3 Haiku';
    if (combined.includes('claude-2')) return 'Claude 2';
    if (combined.includes('claude')) return 'Claude';
    
    // Google models
    if (combined.includes('gemini-pro')) return 'Gemini Pro';
    if (combined.includes('gemini')) return 'Gemini';
    if (combined.includes('palm')) return 'PaLM';
    
    // Other models
    if (combined.includes('llama')) return 'LLaMA';
    if (combined.includes('mistral')) return 'Mistral';
    if (combined.includes('cohere')) return 'Cohere';
    
    return undefined;
  }

  /**
   * Get pattern info
   */
  getCategoryInfo(category: AIServiceCategory): AIServicePattern | undefined {
    return this.patterns.find(p => p.category === category);
  }

  /**
   * Get all patterns
   */
  getPatterns(): AIServicePattern[] {
    return [...this.patterns];
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

export function getCategoryLabel(category: AIServiceCategory): string {
  const labels: Record<AIServiceCategory, string> = {
    'llm': 'Large Language Models',
    'ml-training': 'ML Training',
    'ml-inference': 'ML Inference',
    'gpu-compute': 'GPU Compute',
    'cognitive-services': 'Cognitive Services',
    'vector-db': 'Vector Databases',
    'data-processing': 'Data Processing',
    'model-hosting': 'Model Hosting',
    'ai-search': 'AI Search',
    'other-ai': 'Other AI',
  };
  return labels[category] || category;
}

export function getCategoryIcon(category: AIServiceCategory): string {
  const pattern = AI_SERVICE_PATTERNS.find(p => p.category === category);
  return pattern?.icon || '🤖';
}

export function getCategoryColor(category: AIServiceCategory): string {
  const colors: Record<AIServiceCategory, string> = {
    'llm': '#8b5cf6',
    'ml-training': '#f59e0b',
    'ml-inference': '#10b981',
    'gpu-compute': '#ef4444',
    'cognitive-services': '#3b82f6',
    'vector-db': '#ec4899',
    'data-processing': '#06b6d4',
    'model-hosting': '#6366f1',
    'ai-search': '#14b8a6',
    'other-ai': '#9ca3af',
  };
  return colors[category] || '#9ca3af';
}
