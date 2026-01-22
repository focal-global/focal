import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Detector | Focal',
  description: 'AI-powered cost anomaly detection and optimization recommendations',
};

export default function DetectorPage() {
  return (
    <div className="container mx-auto py-6">
      <div className="space-y-8">
        {/* Page Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Detector Hub</h1>
          <p className="text-muted-foreground">
            AI-powered anomaly detection and cost optimization recommendations
          </p>
        </div>

        {/* Feature Grid */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {/* Anomaly Detection - Live */}
          <a 
            href="/dashboard/detector/anomalies"
            className="group relative overflow-hidden rounded-lg border p-6 hover:bg-muted/50 transition-colors"
          >
            <div className="space-y-3">
              <div className="p-2 w-fit rounded-lg bg-red-100 dark:bg-red-900/20">
                <svg className="h-6 w-6 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 14.5c-.77.833.192 2.5 1.732 2.5z"/>
                </svg>
              </div>
              <div>
                <h3 className="font-semibold">Anomaly Detection</h3>
                <p className="text-sm text-muted-foreground">
                  Real-time AI detection of unusual cost patterns and spikes
                </p>
              </div>
              <div className="absolute top-2 right-2">
                <span className="text-xs px-2 py-1 bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-300 rounded-full">
                  Live
                </span>
              </div>
            </div>
          </a>

          {/* Waterline Savings - Coming Soon */}
          <div className="group relative overflow-hidden rounded-lg border p-6 hover:bg-muted/50 transition-colors opacity-50">
            <div className="space-y-3">
              <div className="p-2 w-fit rounded-lg bg-blue-100 dark:bg-blue-900/20">
                <svg className="h-6 w-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/>
                </svg>
              </div>
              <div>
                <h3 className="font-semibold">Waterline Savings</h3>
                <p className="text-sm text-muted-foreground">
                  Simulate Reserved Instance and Savings Plan optimizations
                </p>
              </div>
              <div className="absolute top-2 right-2">
                <span className="text-xs px-2 py-1 bg-orange-100 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300 rounded-full">
                  Coming Soon
                </span>
              </div>
            </div>
          </div>

          {/* Rightsizing - Coming Soon */}
          <div className="group relative overflow-hidden rounded-lg border p-6 hover:bg-muted/50 transition-colors opacity-50">
            <div className="space-y-3">
              <div className="p-2 w-fit rounded-lg bg-green-100 dark:bg-green-900/20">
                <svg className="h-6 w-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4"/>
                </svg>
              </div>
              <div>
                <h3 className="font-semibold">Smart Rightsizing</h3>
                <p className="text-sm text-muted-foreground">
                  Tetris-style optimization for compute instance sizing
                </p>
              </div>
              <div className="absolute top-2 right-2">
                <span className="text-xs px-2 py-1 bg-orange-100 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300 rounded-full">
                  Coming Soon
                </span>
              </div>
            </div>
          </div>

          {/* AI Recommendations - Coming Soon */}
          <div className="group relative overflow-hidden rounded-lg border p-6 hover:bg-muted/50 transition-colors opacity-50">
            <div className="space-y-3">
              <div className="p-2 w-fit rounded-lg bg-purple-100 dark:bg-purple-900/20">
                <svg className="h-6 w-6 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/>
                </svg>
              </div>
              <div>
                <h3 className="font-semibold">AI Recommendations</h3>
                <p className="text-sm text-muted-foreground">
                  Personalized cost optimization suggestions powered by ML
                </p>
              </div>
              <div className="absolute top-2 right-2">
                <span className="text-xs px-2 py-1 bg-orange-100 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300 rounded-full">
                  Coming Soon
                </span>
              </div>
            </div>
          </div>

          {/* Budget Alerts - Coming Soon */}
          <div className="group relative overflow-hidden rounded-lg border p-6 hover:bg-muted/50 transition-colors opacity-50">
            <div className="space-y-3">
              <div className="p-2 w-fit rounded-lg bg-yellow-100 dark:bg-yellow-900/20">
                <svg className="h-6 w-6 text-yellow-600 dark:text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-5 5v-5zM7 7h5l-5 5V7z"/>
                </svg>
              </div>
              <div>
                <h3 className="font-semibold">Budget Alerts</h3>
                <p className="text-sm text-muted-foreground">
                  Proactive budget monitoring and threshold alerts
                </p>
              </div>
              <div className="absolute top-2 right-2">
                <span className="text-xs px-2 py-1 bg-orange-100 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300 rounded-full">
                  Coming Soon
                </span>
              </div>
            </div>
          </div>

          {/* Forecasting - Coming Soon */}
          <div className="group relative overflow-hidden rounded-lg border p-6 hover:bg-muted/50 transition-colors opacity-50">
            <div className="space-y-3">
              <div className="p-2 w-fit rounded-lg bg-indigo-100 dark:bg-indigo-900/20">
                <svg className="h-6 w-6 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
                </svg>
              </div>
              <div>
                <h3 className="font-semibold">Cost Forecasting</h3>
                <p className="text-sm text-muted-foreground">
                  Predict future costs based on usage trends and patterns
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

        {/* AI Privacy Statement */}
        <div className="rounded-lg bg-green-50 dark:bg-green-950/20 p-6">
          <div className="flex items-start space-x-3">
            <div className="p-2 bg-green-100 dark:bg-green-900/20 rounded-lg">
              <svg className="h-5 w-5 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.031 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-green-800 dark:text-green-200">
                Privacy-First AI Detection
              </h3>
              <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                All anomaly detection runs locally in your browser. Your cost data never leaves your device, 
                ensuring complete privacy while delivering enterprise-grade intelligence.
              </p>
            </div>
          </div>
        </div>

        {/* Coming Soon Timeline */}
        <div className="rounded-lg border-2 border-dashed border-muted-foreground/25 p-8 text-center">
          <div className="space-y-4">
            <div className="mx-auto w-16 h-16 bg-muted rounded-full flex items-center justify-center">
              <svg className="h-8 w-8 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-semibold">Advanced Detection Coming Soon</h3>
              <p className="text-muted-foreground max-w-md mx-auto">
                We're building advanced optimization features including savings simulations, 
                rightsizing recommendations, and predictive cost forecasting.
              </p>
            </div>
            <div className="text-sm text-muted-foreground space-y-1">
              <p>🎯 <strong>Q2 2026:</strong> Waterline Savings Simulation</p>
              <p>🎮 <strong>Q3 2026:</strong> Tetris-style Rightsizing</p>
              <p>🔮 <strong>Q4 2026:</strong> Predictive Cost Forecasting</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}