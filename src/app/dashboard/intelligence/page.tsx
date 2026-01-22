import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Intelligence | Focal',
  description: 'Advanced cost intelligence and unit economics analysis',
};

export default function IntelligencePage() {
  return (
    <div className="container mx-auto py-6">
      <div className="space-y-8">
        {/* Page Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Intelligence Hub</h1>
          <p className="text-muted-foreground">
            Advanced analytics, unit economics, and cost intelligence powered by AI
          </p>
        </div>

        {/* Quick Navigation */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <div className="group relative overflow-hidden rounded-lg border p-6 hover:bg-muted/50 transition-colors">
            <div className="space-y-3">
              <div className="p-2 w-fit rounded-lg bg-blue-100 dark:bg-blue-900/20">
                <svg className="h-6 w-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"/>
                </svg>
              </div>
              <div>
                <h3 className="font-semibold">Unit Economics</h3>
                <p className="text-sm text-muted-foreground">
                  Analyze cost per customer, per request, and per unit of business value
                </p>
              </div>
            </div>
          </div>

          <div className="group relative overflow-hidden rounded-lg border p-6 hover:bg-muted/50 transition-colors opacity-50">
            <div className="space-y-3">
              <div className="p-2 w-fit rounded-lg bg-green-100 dark:bg-green-900/20">
                <svg className="h-6 w-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9v-9m0-9v9"/>
                </svg>
              </div>
              <div>
                <h3 className="font-semibold">GreenOps</h3>
                <p className="text-sm text-muted-foreground">
                  CO2 emissions tracking and carbon footprint optimization
                </p>
              </div>
              <div className="absolute top-2 right-2">
                <span className="text-xs px-2 py-1 bg-orange-100 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300 rounded-full">
                  Coming Soon
                </span>
              </div>
            </div>
          </div>

          <div className="group relative overflow-hidden rounded-lg border p-6 hover:bg-muted/50 transition-colors opacity-50">
            <div className="space-y-3">
              <div className="p-2 w-fit rounded-lg bg-purple-100 dark:bg-purple-900/20">
                <svg className="h-6 w-6 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"/>
                </svg>
              </div>
              <div>
                <h3 className="font-semibold">Kubernetes Costs</h3>
                <p className="text-sm text-muted-foreground">
                  Container-level cost analysis with OpenCost integration
                </p>
              </div>
              <div className="absolute top-2 right-2">
                <span className="text-xs px-2 py-1 bg-orange-100 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300 rounded-full">
                  Coming Soon
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Coming Soon Features */}
        <div className="rounded-lg border-2 border-dashed border-muted-foreground/25 p-8 text-center">
          <div className="space-y-4">
            <div className="mx-auto w-16 h-16 bg-muted rounded-full flex items-center justify-center">
              <svg className="h-8 w-8 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"/>
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-semibold">Advanced Intelligence Features</h3>
              <p className="text-muted-foreground max-w-md mx-auto">
                We're building advanced AI-powered cost intelligence features including predictive analytics, 
                automated insights, and ML-powered recommendations.
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-2 text-sm">
              <span className="px-3 py-1 bg-muted text-muted-foreground rounded-full">Forecasting</span>
              <span className="px-3 py-1 bg-muted text-muted-foreground rounded-full">Anomaly Detection</span>
              <span className="px-3 py-1 bg-muted text-muted-foreground rounded-full">Cost Optimization AI</span>
              <span className="px-3 py-1 bg-muted text-muted-foreground rounded-full">Budget Predictions</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}