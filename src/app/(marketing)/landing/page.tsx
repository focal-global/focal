'use client';

/**
 * Focal Landing Page
 * 
 * Clean, modern landing page with light theme
 * Highlights: Open Core, Local-First, Data Sovereignty
 */

import { useRef, useState, useEffect } from 'react';
import Link from 'next/link';
import { motion, useInView, useScroll, useTransform, AnimatePresence } from 'framer-motion';
import { 
  ArrowRight, 
  Shield, 
  Zap, 
  Eye, 
  Lock, 
  Database, 
  Globe, 
  Github,
  Code2,
  Server,
  Laptop,
  CheckCircle2,
  ExternalLink
} from 'lucide-react';

// ============================================================================
// Animation Variants
// ============================================================================

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

// ============================================================================
// Navigation
// ============================================================================

function NavBar() {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-xl border-b border-gray-100">
      <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center">
            <span className="text-white font-bold text-sm">F</span>
          </div>
          <span className="text-xl font-semibold text-gray-900">Focal</span>
        </Link>

        <div className="hidden md:flex items-center gap-8">
          <a href="#open-core" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">
            Open Core
          </a>
          <a href="#features" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">
            Features
          </a>
          <a href="#how-it-works" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">
            How It Works
          </a>
          <a 
            href="https://github.com/focal-finops/focal" 
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
          >
            <Github size={16} />
            GitHub
          </a>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="text-sm text-gray-600 hover:text-gray-900 transition-colors hidden sm:block"
          >
            Sign In
          </Link>
          <Link
            href="/register"
            className="px-4 py-2 rounded-lg bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 transition-colors"
          >
            Get Started
          </Link>
        </div>
      </div>
    </nav>
  );
}

// ============================================================================
// Interactive Dashboard Demo Component
// ============================================================================

const dashboardViews = [
  { id: 'cockpit', title: 'Cockpit', icon: '📊' },
  { id: 'topology', title: 'Topology', icon: '🗺️' },
  { id: 'intelligence', title: 'Intelligence', icon: '🔭' },
  { id: 'detector', title: 'Detector', icon: '🚨' },
];

const sidebarNav = [
  { group: 'HEADQUARTERS', items: [
    { id: 'cockpit', title: 'Cockpit', icon: '📊', active: true },
    { id: 'topology', title: 'Topology', icon: '🗺️', isNew: true },
  ]},
  { group: 'INTELLIGENCE', items: [
    { id: 'intelligence', title: 'Intelligence Hub', icon: '🔭', isNew: true },
    { id: 'unit-economics', title: 'Unit Economics', icon: '⚖️' },
  ]},
  { group: 'DETECT', items: [
    { id: 'detector', title: 'Detector Hub', icon: '🚨', isNew: true },
    { id: 'anomalies', title: 'Anomalies', icon: '⚠️' },
    { id: 'waste', title: 'Waste Hunter', icon: '🗑️' },
  ]},
  { group: 'DATA ENGINE', items: [
    { id: 'sources', title: 'Data Sources', icon: '🔌' },
    { id: 'connectors', title: 'Connectors', icon: '🔗' },
  ]},
];

function DashboardDemo() {
  const [activeView, setActiveView] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Auto-cycle through views
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveView((prev) => (prev + 1) % dashboardViews.length);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div ref={containerRef} className="relative rounded-2xl border border-gray-200 bg-white shadow-2xl shadow-gray-200/50 overflow-hidden">
      {/* Browser chrome */}
      <div className="flex items-center gap-2 px-4 py-2.5 bg-gray-100 border-b border-gray-200">
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full bg-[#FF5F57]" />
          <div className="w-3 h-3 rounded-full bg-[#FEBC2E]" />
          <div className="w-3 h-3 rounded-full bg-[#28C840]" />
        </div>
        <div className="flex-1 mx-4">
          <div className="bg-white rounded-md px-3 py-1.5 text-xs text-gray-600 text-center border border-gray-200 max-w-md mx-auto">
            🔒 app.focal.dev/dashboard
          </div>
        </div>
        <div className="w-16" />
      </div>
      
      {/* Dashboard Content - Dark Theme like real app */}
      <div className="bg-[#0a0a0a]">
        {/* Sidebar + Main Layout */}
        <div className="flex">
          {/* Sidebar */}
          <div className="hidden md:flex flex-col w-56 bg-[#0a0a0a] border-r border-gray-800 min-h-[520px]">
            {/* Logo */}
            <div className="flex items-center gap-2 px-4 py-4 border-b border-gray-800">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center">
                <span className="text-white font-bold text-xs">F</span>
              </div>
              <span className="text-sm font-semibold text-white">Focal</span>
            </div>
            
            {/* Navigation Groups */}
            <div className="flex-1 overflow-y-auto py-2 px-2">
              {sidebarNav.map((group) => (
                <div key={group.group} className="mb-4">
                  <div className="px-3 py-2 text-[10px] font-semibold text-gray-500 tracking-wider">
                    {group.group}
                  </div>
                  <div className="space-y-0.5">
                    {group.items.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => {
                          const idx = dashboardViews.findIndex(v => v.id === item.id);
                          if (idx >= 0) setActiveView(idx);
                        }}
                        className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-xs transition-all ${
                          dashboardViews[activeView]?.id === item.id
                            ? 'bg-violet-600/20 text-violet-400'
                            : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
                        }`}
                      >
                        <span>{item.icon}</span>
                        <span>{item.title}</span>
                        {item.isNew && (
                          <span className="ml-auto px-1.5 py-0.5 text-[9px] font-medium bg-violet-600/30 text-violet-400 rounded">
                            NEW
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            
            {/* User */}
            <div className="p-3 border-t border-gray-800">
              <div className="flex items-center gap-2 px-2 py-2 rounded-md hover:bg-gray-800">
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-500 to-indigo-500 flex items-center justify-center text-white text-xs font-medium">
                  D
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-gray-200 truncate">Demo User</div>
                  <div className="text-[10px] text-gray-500 truncate">demo@focal.dev</div>
                </div>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1 p-4 md:p-6 min-h-[520px] bg-[#0a0a0a]">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeView}
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  transition={{ duration: 0.2 }}
                >
                  <h3 className="text-xl font-semibold text-white">
                    {dashboardViews[activeView].title}
                  </h3>
                  <p className="text-sm text-gray-500">
                    Executive summary of your cloud spending
                  </p>
                </motion.div>
              </AnimatePresence>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 px-3 py-1.5 rounded-md bg-gray-800 border border-gray-700 text-xs text-gray-400">
                  <span>📅</span>
                  <span>Jan 1 - Jan 31</span>
                </div>
                <div className="px-2 py-1.5 rounded-md bg-gray-800 border border-gray-700 text-xs text-gray-400">
                  USD
                </div>
                <button className="p-1.5 rounded-md bg-gray-800 border border-gray-700 text-gray-400 hover:text-white">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </button>
              </div>
            </div>

            {/* View Content */}
            <AnimatePresence mode="wait">
              {activeView === 0 && <CockpitView key="cockpit" />}
              {activeView === 1 && <TopologyView key="topology" />}
              {activeView === 2 && <IntelligenceView key="intelligence" />}
              {activeView === 3 && <DetectorView key="detector" />}
            </AnimatePresence>

            {/* Progress indicator */}
            <div className="flex items-center justify-center gap-2 mt-6">
              {dashboardViews.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setActiveView(index)}
                  className={`h-1.5 rounded-full transition-all ${
                    activeView === index 
                      ? 'w-8 bg-violet-500' 
                      : 'w-1.5 bg-gray-700 hover:bg-gray-600'
                  }`}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function CockpitView() {
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.3 }}
    >
      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Total Billed Cost', value: '$47,382', change: '-12%', positive: true, icon: '💵', spark: [40,45,38,52,48,55,42] },
          { label: 'Effective Cost', value: '$39,141', change: '-8%', positive: true, icon: '💰', spark: [35,40,32,48,42,50,38] },
          { label: 'Total Savings', value: '$8,241', change: '+24%', positive: true, icon: '🎯', spark: [20,25,28,30,32,35,38] },
          { label: 'Tag Coverage', value: '67%', change: '+5%', positive: true, icon: '🏷️', spark: [50,55,58,60,62,65,67] },
        ].map((kpi, i) => (
          <motion.div
            key={kpi.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="bg-gray-900 rounded-xl p-4 border border-gray-800"
          >
            <div className="flex items-start justify-between mb-2">
              <span className="text-lg">{kpi.icon}</span>
              <span className={`text-xs font-medium ${kpi.positive ? 'text-emerald-400' : 'text-red-400'}`}>
                {kpi.change}
              </span>
            </div>
            <p className="text-[10px] text-gray-500 mb-1">{kpi.label}</p>
            <p className="text-xl font-bold text-white">{kpi.value}</p>
            {/* Mini sparkline */}
            <div className="flex items-end gap-0.5 h-6 mt-2">
              {kpi.spark.map((h, j) => (
                <motion.div
                  key={j}
                  initial={{ height: 0 }}
                  animate={{ height: `${h}%` }}
                  transition={{ delay: i * 0.1 + j * 0.03 }}
                  className="flex-1 bg-violet-500/30 rounded-sm"
                />
              ))}
            </div>
          </motion.div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid lg:grid-cols-2 gap-4">
        {/* Cost Trend */}
        <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm font-medium text-white">Cost Trend</p>
              <p className="text-xs text-gray-500">Daily billed vs effective cost</p>
            </div>
            <div className="flex items-center gap-3 text-[10px]">
              <span className="flex items-center gap-1 text-gray-400">
                <span className="w-2 h-2 rounded-full bg-violet-500"></span>
                Billed
              </span>
              <span className="flex items-center gap-1 text-gray-400">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                Effective
              </span>
            </div>
          </div>
          <div className="h-28 flex items-end gap-1">
            {[65,70,55,80,75,85,60,90,95,78,72,88,82,75].map((h, i) => (
              <div key={i} className="flex-1 flex flex-col gap-0.5">
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: `${h}%` }}
                  transition={{ delay: i * 0.05 }}
                  className="bg-violet-500 rounded-t"
                />
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: `${h * 0.82}%` }}
                  transition={{ delay: i * 0.05 + 0.02 }}
                  className="bg-emerald-500 rounded-b"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Cost by Service */}
        <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
          <div className="mb-4">
            <p className="text-sm font-medium text-white">Cost by Service</p>
            <p className="text-xs text-gray-500">Top services by spend</p>
          </div>
          <div className="space-y-3">
            {[
              { name: 'Virtual Machines', cost: '$19,840', pct: 42, color: 'bg-violet-500' },
              { name: 'Storage Accounts', cost: '$13,267', pct: 28, color: 'bg-blue-500' },
              { name: 'SQL Database', cost: '$8,528', pct: 18, color: 'bg-emerald-500' },
              { name: 'Networking', cost: '$3,790', pct: 8, color: 'bg-amber-500' },
            ].map((item, i) => (
              <motion.div
                key={item.name}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.1 }}
              >
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-gray-300">{item.name}</span>
                  <span className="text-gray-400">{item.cost}</span>
                </div>
                <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${item.pct}%` }}
                    transition={{ delay: i * 0.1 + 0.2, duration: 0.5 }}
                    className={`h-full ${item.color} rounded-full`}
                  />
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function TopologyView() {
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.3 }}
      className="bg-gray-900 rounded-xl p-6 border border-gray-800 min-h-[340px]"
    >
      <div className="mb-4">
        <p className="text-sm font-medium text-white">Cloud Topology</p>
        <p className="text-xs text-gray-500">Visual map of your infrastructure costs</p>
      </div>
      
      {/* Simple topology visualization */}
      <div className="relative h-64 flex items-center justify-center">
        {/* Center node */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="absolute w-20 h-20 rounded-full bg-violet-600/20 border-2 border-violet-500 flex items-center justify-center z-10"
        >
          <div className="text-center">
            <div className="text-xl">☁️</div>
            <div className="text-[10px] text-violet-400 font-medium">Azure</div>
          </div>
        </motion.div>
        
        {/* Orbiting nodes */}
        {[
          { icon: '🖥️', label: 'Compute', cost: '$19.8k', angle: 0, color: 'violet' },
          { icon: '💾', label: 'Storage', cost: '$13.2k', angle: 72, color: 'blue' },
          { icon: '🗄️', label: 'Database', cost: '$8.5k', angle: 144, color: 'emerald' },
          { icon: '🌐', label: 'Network', cost: '$3.7k', angle: 216, color: 'amber' },
          { icon: '🔐', label: 'Security', cost: '$2.1k', angle: 288, color: 'rose' },
        ].map((node, i) => {
          const radius = 100;
          const x = Math.cos((node.angle * Math.PI) / 180) * radius;
          const y = Math.sin((node.angle * Math.PI) / 180) * radius;
          return (
            <motion.div
              key={node.label}
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: 1, scale: 1, x, y }}
              transition={{ delay: 0.3 + i * 0.1 }}
              className="absolute"
            >
              <div className={`w-16 h-16 rounded-lg bg-${node.color}-600/20 border border-${node.color}-500/50 flex flex-col items-center justify-center`}>
                <span className="text-lg">{node.icon}</span>
                <span className="text-[9px] text-gray-400">{node.cost}</span>
              </div>
            </motion.div>
          );
        })}
        
        {/* Connection lines (decorative) */}
        <svg className="absolute inset-0 w-full h-full" style={{ zIndex: 0 }}>
          <defs>
            <linearGradient id="lineGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="rgb(139, 92, 246)" stopOpacity="0.3" />
              <stop offset="100%" stopColor="rgb(139, 92, 246)" stopOpacity="0" />
            </linearGradient>
          </defs>
        </svg>
      </div>
    </motion.div>
  );
}

function IntelligenceView() {
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.3 }}
    >
      {/* Intelligence Cards */}
      <div className="grid lg:grid-cols-3 gap-4 mb-4">
        {[
          { title: 'Cost per Customer', value: '$12.47', change: '-8%', trend: 'down' },
          { title: 'Cost per Transaction', value: '$0.0023', change: '-12%', trend: 'down' },
          { title: 'Infra Efficiency', value: '94.2%', change: '+3%', trend: 'up' },
        ].map((card, i) => (
          <motion.div
            key={card.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="bg-gray-900 rounded-xl p-4 border border-gray-800"
          >
            <p className="text-[10px] text-gray-500 mb-1">{card.title}</p>
            <div className="flex items-end gap-2">
              <span className="text-2xl font-bold text-white">{card.value}</span>
              <span className={`text-xs font-medium mb-1 ${card.trend === 'down' ? 'text-emerald-400' : 'text-emerald-400'}`}>
                {card.change}
              </span>
            </div>
          </motion.div>
        ))}
      </div>

      {/* AI Insights */}
      <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-lg">🤖</span>
          <div>
            <p className="text-sm font-medium text-white">AI Insights</p>
            <p className="text-xs text-gray-500">Powered by local analysis</p>
          </div>
        </div>
        <div className="space-y-3">
          {[
            { icon: '💡', text: 'Switch to reserved instances could save $2,400/month on VMs', type: 'recommendation' },
            { icon: '📈', text: 'Storage costs trending 15% above forecast - investigate blob lifecycle', type: 'warning' },
            { icon: '✅', text: 'Database costs optimized - 23% below industry benchmark', type: 'success' },
          ].map((insight, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 + i * 0.1 }}
              className={`flex items-start gap-3 p-3 rounded-lg ${
                insight.type === 'warning' ? 'bg-amber-500/10 border border-amber-500/20' :
                insight.type === 'success' ? 'bg-emerald-500/10 border border-emerald-500/20' :
                'bg-violet-500/10 border border-violet-500/20'
              }`}
            >
              <span className="text-lg">{insight.icon}</span>
              <span className="text-xs text-gray-300">{insight.text}</span>
            </motion.div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

function DetectorView() {
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.3 }}
    >
      {/* Alert Summary */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        {[
          { label: 'Critical', count: 1, color: 'red' },
          { label: 'Warning', count: 2, color: 'amber' },
          { label: 'Resolved', count: 8, color: 'emerald' },
        ].map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.1 }}
            className={`bg-${stat.color}-500/10 rounded-xl p-4 border border-${stat.color}-500/20 text-center`}
          >
            <p className={`text-2xl font-bold text-${stat.color}-400`}>{stat.count}</p>
            <p className="text-[10px] text-gray-500">{stat.label}</p>
          </motion.div>
        ))}
      </div>

      {/* Anomaly List */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-800">
          <p className="text-sm font-medium text-white">Active Anomalies</p>
        </div>
        <div className="divide-y divide-gray-800">
          {[
            { severity: 'critical', title: 'Compute spike detected', region: 'us-east-1', impact: '+$2,847', time: '2h ago' },
            { severity: 'warning', title: 'Untagged resources', region: 'global', impact: '$1,234', time: '1d ago' },
            { severity: 'warning', title: 'Storage growth trend', region: 'eu-west-1', impact: '+$412', time: '3d ago' },
          ].map((anomaly, i) => (
            <motion.div
              key={anomaly.title}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 + i * 0.1 }}
              className="px-4 py-3 flex items-center gap-4"
            >
              <div className={`w-2 h-2 rounded-full ${
                anomaly.severity === 'critical' ? 'bg-red-500' : 'bg-amber-500'
              }`} />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-gray-200 truncate">{anomaly.title}</p>
                <p className="text-[10px] text-gray-500">{anomaly.region} · {anomaly.time}</p>
              </div>
              <span className={`text-xs font-medium ${
                anomaly.severity === 'critical' ? 'text-red-400' : 'text-amber-400'
              }`}>
                {anomaly.impact}
              </span>
            </motion.div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

// ============================================================================
// Hero Section
// ============================================================================

function HeroSection() {
  return (
    <section className="relative pt-32 pb-20 overflow-hidden">
      {/* Subtle gradient background */}
      <div className="absolute inset-0 bg-gradient-to-b from-violet-50/50 via-white to-white" />
      
      {/* Subtle grid pattern */}
      <div 
        className="absolute inset-0 opacity-[0.4]"
        style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, rgb(209 213 219) 1px, transparent 0)`,
          backgroundSize: '40px 40px',
        }}
      />

      <div className="relative max-w-6xl mx-auto px-6">
        <motion.div
          initial="hidden"
          animate="visible"
          variants={{
            visible: { transition: { staggerChildren: 0.1 } }
          }}
          className="text-center"
        >
          {/* Badge */}
          <motion.div variants={fadeUp} className="mb-6">
            <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-violet-100 text-violet-700 text-sm font-medium">
              <Code2 size={14} />
              Open Core · Local-First · Sovereign
            </span>
          </motion.div>

          {/* Headline */}
          <motion.h1 
            variants={fadeUp}
            className="text-4xl sm:text-5xl md:text-6xl font-bold text-gray-900 tracking-tight mb-6"
          >
            FinOps that respects
            <br />
            <span className="bg-gradient-to-r from-violet-600 to-indigo-600 bg-clip-text text-transparent">
              your data sovereignty
            </span>
          </motion.h1>

          {/* Subheadline */}
          <motion.p 
            variants={fadeUp}
            className="text-lg md:text-xl text-gray-600 max-w-2xl mx-auto mb-8"
          >
            Process billions of cloud billing records in your browser. 
            Open-source core. Zero data leaves your device.
          </motion.p>

          {/* CTAs */}
          <motion.div 
            variants={fadeUp}
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <Link
              href="/register"
              className="group flex items-center gap-2 px-6 py-3 rounded-lg bg-gray-900 text-white font-medium hover:bg-gray-800 transition-all"
            >
              Start Free
              <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
            </Link>
            <a
              href="https://github.com/focal-finops/focal"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-6 py-3 rounded-lg border border-gray-200 text-gray-700 font-medium hover:bg-gray-50 transition-colors"
            >
              <Github size={16} />
              View on GitHub
            </a>
          </motion.div>

          {/* Trust indicators */}
          <motion.div 
            variants={fadeUp}
            className="mt-12 flex flex-wrap items-center justify-center gap-x-8 gap-y-4 text-sm text-gray-500"
          >
            <span className="flex items-center gap-2">
              <CheckCircle2 size={16} className="text-emerald-500" />
              FOCUS Compatible
            </span>
            <span className="flex items-center gap-2">
              <CheckCircle2 size={16} className="text-emerald-500" />
              Azure, AWS, GCP
            </span>
            <span className="flex items-center gap-2">
              <CheckCircle2 size={16} className="text-emerald-500" />
              MIT Licensed Core
            </span>
          </motion.div>
        </motion.div>

        {/* Hero Visual - Interactive Dashboard Demo */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="mt-16 relative"
        >
          <DashboardDemo />

          {/* Floating elements */}
          <div className="absolute -left-4 top-1/4 px-3 py-2 rounded-lg bg-white border border-gray-100 shadow-lg shadow-gray-200/50 hidden lg:block">
            <div className="flex items-center gap-2 text-sm">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-gray-600">Processing locally</span>
            </div>
          </div>

          <div className="absolute -right-4 top-1/3 px-3 py-2 rounded-lg bg-white border border-gray-100 shadow-lg shadow-gray-200/50 hidden lg:block">
            <div className="flex items-center gap-2 text-sm">
              <Lock size={14} className="text-violet-600" />
              <span className="text-gray-600">Zero data egress</span>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

// ============================================================================
// Open Core Section
// ============================================================================

function OpenCoreSection() {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-100px' });

  return (
    <section id="open-core" className="py-24 bg-gray-50">
      <div className="max-w-6xl mx-auto px-6">
        <motion.div
          ref={ref}
          initial="hidden"
          animate={isInView ? "visible" : "hidden"}
          variants={{ visible: { transition: { staggerChildren: 0.1 } } }}
        >
          <div className="text-center mb-16">
            <motion.span 
              variants={fadeUp}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white border border-gray-200 text-gray-700 text-sm font-medium mb-4"
            >
              <Github size={14} />
              Open Core Model
            </motion.span>
            <motion.h2 
              variants={fadeUp}
              className="text-3xl md:text-4xl font-bold text-gray-900 mb-4"
            >
              Transparency you can trust
            </motion.h2>
            <motion.p 
              variants={fadeUp}
              className="text-lg text-gray-600 max-w-2xl mx-auto"
            >
              Our core analytics engine is fully open-source. Audit the code, 
              self-host if you want, or use our managed platform for convenience.
            </motion.p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {/* Open Source Core */}
            <motion.div
              variants={fadeUp}
              className="relative p-8 rounded-2xl bg-white border border-gray-200"
            >
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-violet-500 to-indigo-500 rounded-t-2xl" />
              
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-xl bg-violet-100 flex items-center justify-center">
                  <Code2 size={24} className="text-violet-600" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-gray-900">Open Source Core</h3>
                  <p className="text-sm text-gray-500">MIT Licensed</p>
                </div>
              </div>

              <ul className="space-y-3 mb-6">
                {[
                  'DuckDB-WASM analytics engine',
                  'FOCUS data format parser',
                  'Browser-based query processor',
                  'Cost visualization components',
                  'Multi-cloud data adapters',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3 text-gray-600">
                    <CheckCircle2 size={18} className="text-emerald-500 mt-0.5 flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>

              <a
                href="https://github.com/focal-finops/focal"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm font-medium text-violet-600 hover:text-violet-700"
              >
                View source code
                <ExternalLink size={14} />
              </a>
            </motion.div>

            {/* Managed Platform */}
            <motion.div
              variants={fadeUp}
              className="relative p-8 rounded-2xl bg-white border border-gray-200"
            >
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-gray-400 to-gray-600 rounded-t-2xl" />
              
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center">
                  <Server size={24} className="text-gray-600" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-gray-900">Managed Platform</h3>
                  <p className="text-sm text-gray-500">Enterprise Features</p>
                </div>
              </div>

              <ul className="space-y-3 mb-6">
                {[
                  'Team collaboration & sharing',
                  'Scheduled reports & alerts',
                  'SSO / SAML authentication',
                  'Priority support & SLAs',
                  'Advanced anomaly detection',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3 text-gray-600">
                    <CheckCircle2 size={18} className="text-gray-400 mt-0.5 flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>

              <Link
                href="/register"
                className="inline-flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900"
              >
                Start free trial
                <ArrowRight size={14} />
              </Link>
            </motion.div>
          </div>

          {/* Comparison note */}
          <motion.div 
            variants={fadeUp}
            className="mt-8 p-6 rounded-xl bg-violet-50 border border-violet-100"
          >
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-lg bg-violet-100 flex items-center justify-center flex-shrink-0">
                <Laptop size={20} className="text-violet-600" />
              </div>
              <div>
                <h4 className="font-semibold text-gray-900 mb-1">
                  Both options keep your data local
                </h4>
                <p className="text-gray-600 text-sm">
                  Whether you self-host the open-source core or use our managed platform, 
                  your billing data is always processed in your browser. The managed platform 
                  only stores metadata like connector configurations—never your actual cost data.
                </p>
              </div>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}

// ============================================================================
// Features Section
// ============================================================================

function FeaturesSection() {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-100px' });

  const features = [
    {
      icon: Shield,
      title: 'Zero Trust by Design',
      description: 'Your billing data never leaves your browser. We use the Valet Key pattern—we help unlock the door, but never see inside.',
      color: 'emerald',
    },
    {
      icon: Zap,
      title: 'Blazing Fast',
      description: 'DuckDB-WASM processes millions of records in seconds. Native SQL performance, right in your browser.',
      color: 'amber',
    },
    {
      icon: Eye,
      title: 'Full Visibility',
      description: 'See every cost anomaly and optimization opportunity across all your cloud providers in one unified view.',
      color: 'violet',
    },
    {
      icon: Database,
      title: 'FOCUS Native',
      description: 'Built for the FinOps FOCUS standard from day one. Works seamlessly with Azure, AWS, and GCP exports.',
      color: 'blue',
    },
    {
      icon: Globe,
      title: 'Multi-Cloud',
      description: 'Unified cost analysis across all major cloud providers. One dashboard, complete visibility.',
      color: 'teal',
    },
    {
      icon: Lock,
      title: 'Compliant by Default',
      description: 'GDPR, SOC 2, and data residency requirements are easy when data never leaves the browser.',
      color: 'rose',
    },
  ];

  const colorMap: Record<string, { bg: string; text: string }> = {
    emerald: { bg: 'bg-emerald-100', text: 'text-emerald-600' },
    amber: { bg: 'bg-amber-100', text: 'text-amber-600' },
    violet: { bg: 'bg-violet-100', text: 'text-violet-600' },
    blue: { bg: 'bg-blue-100', text: 'text-blue-600' },
    teal: { bg: 'bg-teal-100', text: 'text-teal-600' },
    rose: { bg: 'bg-rose-100', text: 'text-rose-600' },
  };

  return (
    <section id="features" className="py-24">
      <div className="max-w-6xl mx-auto px-6">
        <motion.div
          ref={ref}
          initial="hidden"
          animate={isInView ? "visible" : "hidden"}
          variants={{ visible: { transition: { staggerChildren: 0.1 } } }}
        >
          <div className="text-center mb-16">
            <motion.span 
              variants={fadeUp}
              className="inline-block px-3 py-1.5 rounded-full bg-gray-100 text-gray-700 text-sm font-medium mb-4"
            >
              Features
            </motion.span>
            <motion.h2 
              variants={fadeUp}
              className="text-3xl md:text-4xl font-bold text-gray-900 mb-4"
            >
              Enterprise power, local privacy
            </motion.h2>
            <motion.p 
              variants={fadeUp}
              className="text-lg text-gray-600 max-w-2xl mx-auto"
            >
              All the features you need from a FinOps platform, without compromising on data security.
            </motion.p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature) => (
              <motion.div
                key={feature.title}
                variants={fadeUp}
                className="p-6 rounded-2xl bg-white border border-gray-100 hover:border-gray-200 hover:shadow-lg hover:shadow-gray-100/50 transition-all"
              >
                <div className={`w-12 h-12 rounded-xl ${colorMap[feature.color].bg} flex items-center justify-center mb-4`}>
                  <feature.icon size={24} className={colorMap[feature.color].text} />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{feature.title}</h3>
                <p className="text-gray-600 text-sm leading-relaxed">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}

// ============================================================================
// How It Works Section
// ============================================================================

function HowItWorksSection() {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-100px' });

  const steps = [
    {
      number: '1',
      title: 'Connect your cloud',
      description: 'Link your Azure, AWS, or GCP billing exports. We generate secure, read-only credentials that stay in your browser.',
    },
    {
      number: '2',
      title: 'Data streams to your browser',
      description: 'Billing data flows directly from your cloud storage to your browser. Our servers are never in the path.',
    },
    {
      number: '3',
      title: 'Analyze with DuckDB',
      description: 'The open-source DuckDB-WASM engine processes your data locally at native SQL speed. No uploads, no waiting.',
    },
    {
      number: '4',
      title: 'Get actionable insights',
      description: 'Discover cost anomalies, optimization opportunities, and trends—all without your data leaving your device.',
    },
  ];

  return (
    <section id="how-it-works" className="py-24 bg-gray-50">
      <div className="max-w-6xl mx-auto px-6">
        <motion.div
          ref={ref}
          initial="hidden"
          animate={isInView ? "visible" : "hidden"}
          variants={{ visible: { transition: { staggerChildren: 0.1 } } }}
        >
          <div className="text-center mb-16">
            <motion.span 
              variants={fadeUp}
              className="inline-block px-3 py-1.5 rounded-full bg-white border border-gray-200 text-gray-700 text-sm font-medium mb-4"
            >
              How It Works
            </motion.span>
            <motion.h2 
              variants={fadeUp}
              className="text-3xl md:text-4xl font-bold text-gray-900 mb-4"
            >
              Simple setup, sovereign data
            </motion.h2>
            <motion.p 
              variants={fadeUp}
              className="text-lg text-gray-600 max-w-2xl mx-auto"
            >
              Get started in minutes. Your data stays yours throughout the entire process.
            </motion.p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {steps.map((step, index) => (
              <motion.div
                key={step.number}
                variants={fadeUp}
                className="relative"
              >
                {/* Connector line */}
                {index < steps.length - 1 && (
                  <div className="hidden lg:block absolute top-8 left-full w-full h-px bg-gray-200 -translate-x-1/2" />
                )}
                
                <div className="relative">
                  <div className="w-16 h-16 rounded-2xl bg-white border border-gray-200 shadow-sm flex items-center justify-center mb-4">
                    <span className="text-2xl font-bold text-gray-900">{step.number}</span>
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">{step.title}</h3>
                  <p className="text-gray-600 text-sm leading-relaxed">{step.description}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}

// ============================================================================
// CTA Section
// ============================================================================

function CTASection() {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-100px' });

  return (
    <section className="py-24">
      <div className="max-w-4xl mx-auto px-6">
        <motion.div
          ref={ref}
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="relative rounded-3xl bg-gradient-to-br from-gray-900 to-gray-800 p-12 md:p-16 text-center overflow-hidden"
        >
          {/* Background pattern */}
          <div 
            className="absolute inset-0 opacity-10"
            style={{
              backgroundImage: `radial-gradient(circle at 2px 2px, white 1px, transparent 0)`,
              backgroundSize: '32px 32px',
            }}
          />

          <div className="relative z-10">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Ready to take control of your cloud costs?
            </h2>
            <p className="text-lg text-gray-300 mb-8 max-w-xl mx-auto">
              Join teams who trust Focal for sovereign, local-first FinOps. 
              Free to start, open-source at core.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/register"
                className="group flex items-center gap-2 px-6 py-3 rounded-lg bg-white text-gray-900 font-medium hover:bg-gray-100 transition-colors"
              >
                Get Started Free
                <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
              </Link>
              <a
                href="https://github.com/focal-finops/focal"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-6 py-3 rounded-lg border border-white/20 text-white font-medium hover:bg-white/10 transition-colors"
              >
                <Github size={16} />
                Star on GitHub
              </a>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

// ============================================================================
// Footer
// ============================================================================

function Footer() {
  return (
    <footer className="border-t border-gray-100 py-12">
      <div className="max-w-6xl mx-auto px-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center">
              <span className="text-white font-bold text-xs">F</span>
            </div>
            <span className="font-semibold text-gray-900">Focal</span>
            <span className="text-gray-400 text-sm">· Sovereign FinOps</span>
          </div>
          
          <div className="flex items-center gap-6 text-sm text-gray-500">
            <a 
              href="https://github.com/focal-finops/focal" 
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-gray-900 transition-colors flex items-center gap-1"
            >
              <Github size={14} />
              GitHub
            </a>
            <a href="#" className="hover:text-gray-900 transition-colors">Privacy</a>
            <a href="#" className="hover:text-gray-900 transition-colors">Terms</a>
          </div>
          
          <p className="text-sm text-gray-500">
            © {new Date().getFullYear()} Focal. MIT Licensed.
          </p>
        </div>
      </div>
    </footer>
  );
}

// ============================================================================
// Page Component
// ============================================================================

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white text-gray-900">
      <NavBar />
      <main>
        <HeroSection />
        <OpenCoreSection />
        <FeaturesSection />
        <HowItWorksSection />
        <CTASection />
      </main>
      <Footer />
    </div>
  );
}
