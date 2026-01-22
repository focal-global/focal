# Focal - Project Context

> **Source of Truth** for AI assistants and contributors.
> Last Updated: January 22, 2026

---

## 1. Project Overview

**Focal** is a **Sovereign FinOps Hub** built on **Local-First** principles. It empowers organizations to analyze and optimize their cloud spending without sending sensitive billing data to third-party servers.

### Core Principles
- **Data Sovereignty:** Your billing data never leaves your browser for processing.
- **Local-First Analytics:** Heavy computation happens client-side using DuckDB-WASM.
- **Zero Trust Backend:** The server handles authentication and metadata only—never raw billing data.

---

## 1.1 Repository & Hosting Strategy

Focal follows an **Open Core** model with a **Turborepo monorepo** structure for development.

### GitHub Organization: `focal-global`

| Repository | Visibility | Purpose |
|------------|------------|---------|
| `focal-cloud` | 🔒 Private | Monorepo for all development |
| `focal` | 🟢 Public | OSS packages (synced from focal-cloud) |

### Monorepo Structure (`focal-cloud`)

```
focal-cloud/                    # 🔒 PRIVATE - Main development repo
├── apps/
│   └── web/                    # Next.js managed service (this codebase)
│
├── packages/                   # 🟢 PUBLIC (published to npm)
│   ├── core/                   # @focal-global/core - DuckDB engine, FOCUS schema
│   ├── ui/                     # @focal-global/ui - React UI components
│   └── connectors/             # @focal-global/connectors - Azure/AWS/GCP
│
├── tooling/
│   ├── typescript-config/      # Shared TypeScript configs
│   └── eslint-config/          # Shared ESLint configs
│
├── scripts/
│   ├── migrate.sh              # Migration helper
│   └── sync-oss.sh             # Syncs packages/ to public focal repo
│
├── turbo.json                  # Turborepo configuration
├── pnpm-workspace.yaml         # pnpm workspaces
└── LICENSE                     # Apache 2.0
```

### Open Source vs Premium Split

| OSS (`@focal-global/*` packages) | Premium (Private in `apps/web`) |
|----------------------------------|--------------------------------|
| ✅ DuckDB-WASM query engine | 🔒 AI-powered anomaly detection |
| ✅ FOCUS schema & parsing | 🔒 Cost forecasting & budgets |
| ✅ Base UI components | 🔒 Unit economics / custom metrics |
| ✅ Azure/AWS/GCP connectors | 🔒 Multi-tenant team management |
| ✅ Self-hosted Docker deployment | 🔒 SSO (SAML, OIDC) |
| ✅ Basic authentication | 🔒 Slack/Teams integrations |

### npm Packages

```bash
# Users can install OSS packages directly
npm install @focal-global/core @focal-global/ui @focal-global/connectors
```

### Development Workflow

```bash
# In focal-cloud monorepo
pnpm install          # Install all dependencies
pnpm dev              # Run all apps in development
pnpm build            # Build all packages
pnpm dev --filter=web # Run only the web app

# Sync OSS to public repo
./scripts/sync-oss.sh
```

### Hosting Stack (Managed Cloud)

| Component | Service | Purpose |
|-----------|---------|---------|
| Web App | Vercel | Next.js hosting |
| Database | Neon | Serverless Postgres (metadata only) |
| Auth | Better-Auth | Self-hosted authentication |
| Billing | Stripe | Subscription management |
| CDN | Cloudflare R2 | Static assets |

---

## 2. Tech Stack (Strict)

| Layer | Technology | Notes |
|-------|------------|-------|
| **Framework** | Next.js 15 | App Router, Server Actions |
| **Language** | TypeScript | Strict mode enabled |
| **Styling** | Tailwind CSS + Shadcn/ui | Default Dark Mode |
| **ORM** | Drizzle ORM | Type-safe queries |
| **Database** | Neon Postgres | Serverless Postgres |
| **Auth** | Better-Auth | With Organization plugin |
| **Analytics Engine** | DuckDB-WASM | Client-side SQL analytics |
| **Visualization** | Recharts | Cost charts, trends, breakdowns |
| **Local Cache** | IndexedDB | Persistent aggregation cache |
| **Icons** | Lucide React | Consistent icon library |
| **Package Manager** | pnpm | Preferred (or npm) |

---

## 3. Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         BROWSER (Data Plane)                     │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │  React UI   │  │ DuckDB-WASM │  │  IndexedDB / OPFS       │  │
│  │  + React    │◄─┤  Analytics  │◄─┤  (Local Data Cache)     │  │
│  │    Flow     │  │   Engine    │  │                         │  │
│  └─────────────┘  └─────────────┘  └───────────▲─────────────┘  │
│                                                 │                 │
│                                    Direct Fetch │ (SAS Token)    │
│                                                 │                 │
└─────────────────────────────────────────────────┼─────────────────┘
                                                  │
┌─────────────────────────────────────────────────┼─────────────────┐
│                    CLOUD PROVIDERS              │                 │
│  ┌─────────────┐  ┌─────────────┐              │                 │
│  │    Azure    │  │     AWS     │◄─────────────┘                 │
│  │   Storage   │  │     S3      │   Browser fetches directly     │
│  └─────────────┘  └─────────────┘   using short-lived tokens     │
└───────────────────────────────────────────────────────────────────┘

┌───────────────────────────────────────────────────────────────────┐
│                   NEXT.JS SERVER (Control Plane)                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐   │
│  │ Better-Auth │  │   Drizzle   │  │   SAS Token Minting     │   │
│  │   (Auth)    │  │    ORM      │  │   (Valet Key Pattern)   │   │
│  └─────────────┘  └──────┬──────┘  └─────────────────────────┘   │
│                          │                                        │
│                          ▼                                        │
│                   ┌─────────────┐                                 │
│                   │    Neon     │                                 │
│                   │  Postgres   │                                 │
│                   │ (Metadata)  │                                 │
│                   └─────────────┘                                 │
└───────────────────────────────────────────────────────────────────┘
```

### Control Plane (Server)
- **Responsibilities:** Authentication, Authorization, Metadata storage, SAS Token generation
- **Data Stored:** User profiles, Organization settings, Connector configurations, Saved views
- **Never Handles:** Raw billing data, Cost exports, Usage metrics

### Data Plane (Browser)
- **Responsibilities:** Fetching billing data, SQL analytics, Visualization rendering
- **Storage:** IndexedDB / OPFS for local caching with Storage Manager control
- **Engine:** DuckDB-WASM for high-performance SQL queries

### Storage Management (Local-First)
- **Storage Controller:** TypeScript class managing browser storage (`src/lib/storage-controller.ts`)
- **Persistence Modes:** 
  - `PERSISTENT`: Save data to OPFS (default, recommended)
  - `EPHEMERAL`: Memory-only, no disk writes (faster, temporary)
- **Retention Settings:** Auto-cleanup (30 days, 6 months, forever)
- **Storage Monitoring:** `navigator.storage.estimate()` API for usage tracking
- **Purge Function:** Nuclear option to delete all local data and reload clean
- **Breakdown Analysis:** Categorized storage (Billing Data 80%, Indexes 10%, Cache 10%)

### Aggregation Cache System (NEW)
All cached data stays in the browser - this does NOT break Local-First security.

```
┌─────────────────────────────────────────────────────────────────┐
│                    BROWSER CACHE LAYERS                          │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │ InMemoryCache   │  │ IndexedDBCache  │  │  DuckDB Tables  │  │
│  │ (Fast, volatile)│  │ (Persistent)    │  │  (Query source) │  │
│  │ TTL: minutes    │  │ TTL: hours/days │  │  (Raw data)     │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  │
│           │                    │                    │            │
│           └────────────────────┴────────────────────┘            │
│                              │                                    │
│                    ┌─────────▼─────────┐                         │
│                    │ useCachedQuery()  │                         │
│                    │ Hook (SWR pattern)│                         │
│                    └───────────────────┘                         │
└─────────────────────────────────────────────────────────────────┘
```

**Cache Types & TTLs:**

| Type | TTL | Purpose |
|------|-----|---------|
| `kpi` | 15 min | Dashboard KPI cards |
| `daily_costs` | 4 hours | Daily cost aggregations |
| `service_breakdown` | 4 hours | Cost by service |
| `resource_costs` | 4 hours | Top resources by cost |
| `monthly_costs` | 24 hours | Monthly summaries |
| `anomalies` | 1 hour | Detected anomalies |

**Usage Pattern:**

```tsx
import { useCachedQuery } from '@/hooks/use-cached-query';

function Dashboard() {
  const { data, isLoading, isFromCache, refetch } = useCachedQuery({
    cacheKey: 'dashboard:costs:30d',
    queryFn: async () => {
      // DuckDB query only runs if not cached
      const result = await db.query('SELECT ...');
      return result;
    },
    ttl: 4 * 60 * 60 * 1000, // 4 hours
    staleTime: 30 * 60 * 1000, // Background refresh if >30 min old
  });

  // First visit: ~500ms (DuckDB query)
  // Repeat visits: ~10ms (from IndexedDB)
}
```

### Valet Key Pattern
1. Client requests access to cloud billing data
2. Server validates permissions and mints a short-lived SAS token
3. Client uses token to fetch data directly from cloud storage
4. Data is processed entirely in the browser via DuckDB-WASM

---

## 3.1 Authentication System

Focal uses **Better-Auth** for authentication with support for multiple providers and SSO readiness.

### Authentication Methods

| Method | Status | Notes |
|--------|--------|-------|
| **Email/Password** | ✅ Active | Primary method, bcrypt hashing |
| **Google OAuth** | ✅ Ready | Requires `GOOGLE_CLIENT_ID/SECRET` |
| **Microsoft OAuth** | ✅ Ready | Azure AD, supports enterprise SSO |
| **GitHub OAuth** | ✅ Ready | Good for developer accounts |

### Configuration Files

- **Server:** `src/lib/auth.ts` - Better-Auth configuration
- **Client:** `src/lib/auth-client.ts` - Client hooks and utilities

### Auth Routes

| Route | Purpose |
|-------|---------|
| `/login` | Sign in with email/password or social |
| `/register` | Create new account |
| `/forgot-password` | Request password reset email |
| `/reset-password` | Set new password (via email link) |
| `/api/auth/*` | Better-Auth API endpoints |

### Session Configuration

```typescript
session: {
  expiresIn: 60 * 60 * 24 * 7, // 7 days
  updateAge: 60 * 60 * 24,      // Refresh every 24 hours
  cookieCache: {
    enabled: true,
    maxAge: 60 * 5,             // 5 minute cache
  },
}
```

### Password Reset Flow

1. User requests reset via `/forgot-password`
2. Server calls `sendResetPassword` callback (configure email service)
3. Email contains link to `/reset-password?token=xxx`
4. User sets new password via `authClient.resetPassword()`

### OAuth Setup

**Google:**
```env
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret
```

**Microsoft (Azure AD):**
```env
MICROSOFT_CLIENT_ID=your-client-id
MICROSOFT_CLIENT_SECRET=your-client-secret
MICROSOFT_TENANT_ID=common  # or specific tenant
```

**GitHub:**
```env
GITHUB_CLIENT_ID=your-client-id
GITHUB_CLIENT_SECRET=your-client-secret
```

### Account Linking

Better-Auth supports linking multiple auth providers to a single account:

```typescript
// Link Google to existing account
await authClient.linkSocial({ provider: 'google' });
```

### Server-Side Auth Check

```typescript
// Server Component or Server Action
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';

const session = await auth.api.getSession({ headers: await headers() });
if (!session) {
  redirect('/login');
}
```

### Client-Side Auth Check

```typescript
// Client Component
import { authClient } from '@/lib/auth-client';

const { data: session, isPending } = authClient.useSession();
```

### Test Credentials (Development)

```
Email:    test@focal.dev
Password: password123
```

Run `npx tsx src/db/seed.ts` to create/reset the test user.

---

## 4. Database Schema Summary

### Core Tables (Neon Postgres via Drizzle)

```
┌──────────────────┐     ┌──────────────────┐
│      User        │     │     Account      │
├──────────────────┤     ├──────────────────┤
│ id (PK)          │     │ id (PK)          │
│ name             │◄────┤ userId (FK)      │
│ email            │     │ provider         │
│ emailVerified    │     │ providerAccountId│
│ image            │     │ accessToken      │
│ createdAt        │     │ refreshToken     │
│ updatedAt        │     └──────────────────┘
└──────────────────┘
         │
         │ (via Member)
         ▼
┌──────────────────┐     ┌──────────────────┐
│   Organization   │     │     Member       │
├──────────────────┤     ├──────────────────┤
│ id (PK)          │◄────┤ organizationId   │
│ name             │     │ userId (FK)      │
│ slug             │     │ role             │
│ logo             │     │ createdAt        │
│ createdAt        │     └──────────────────┘
│ metadata         │
└──────────────────┘
         │
         ▼
┌──────────────────┐     ┌──────────────────┐
│  DataConnector   │     │    SavedView     │
├──────────────────┤     ├──────────────────┤
│ id (PK)          │     │ id (PK)          │
│ organizationId   │     │ organizationId   │
│ name             │     │ name             │
│ provider (enum)  │     │ type             │
│ config (JSON)    │     │ config (JSON)    │
│ status           │     │ createdBy        │
│ lastSyncAt       │     │ createdAt        │
│ createdAt        │     │ updatedAt        │
└──────────────────┘     └──────────────────┘
```

### Enums
- **Provider:** `azure`, `aws`, `gcp`
- **Member Role:** `owner`, `admin`, `member`
- **Connector Status:** `active`, `inactive`, `error`

---

## 5. Currency Handling (CRITICAL)

**All cost values in Focal MUST respect the user's currency settings.**

### Currency Detection Flow
1. **FOCUS Data** contains `BillingCurrency` column (e.g., "NOK", "USD", "EUR")
2. **Spectrum Provider** auto-detects currency when loading data → `unifiedView.detectedCurrency`
3. **User Settings** may override display currency → stored in localStorage via `loadCurrencySettings()`
4. **Components** should use detected currency OR user override, never hardcode "USD"

### Implementation Pattern

```tsx
// ✅ CORRECT: Always use detected or user-preferred currency
import { formatCurrency, loadCurrencySettings } from '@/lib/currency';
import { useSpectrum } from '@/components/providers/spectrum-provider';

function MyComponent() {
  const { unifiedView } = useSpectrum();
  const [currencySettings, setCurrencySettings] = useState(null);
  
  useEffect(() => {
    setCurrencySettings(loadCurrencySettings());
  }, []);
  
  // Priority: User setting > Detected from data > Fallback USD
  const currency = currencySettings?.displayCurrency || 
                   unifiedView?.detectedCurrency || 
                   'USD';
  
  return <span>{formatCurrency(1234.56, currency)}</span>;
}

// ❌ WRONG: Hardcoding currency
<span>{formatCurrency(1234.56, 'USD')}</span>
```

### Key Currency Functions (`src/lib/currency.ts`)

| Function | Purpose |
|----------|---------|
| `formatCurrency(value, code)` | Format number as currency with proper locale |
| `loadCurrencySettings()` | Load user preferences from localStorage |
| `saveCurrencySettings(settings)` | Save user preferences |
| `detectCurrencyFromData(rows)` | Auto-detect currency from FOCUS rows |
| `getCurrencyFromRow(row)` | Get currency from a single data row |

### BigInt Safety

DuckDB may return large numbers (e.g., ResourceId) as BigInt. Always use safe conversions:

```tsx
// ✅ Safe number conversion
function safeNumber(value: unknown): number {
  if (typeof value === 'bigint') {
    if (value <= BigInt(Number.MAX_SAFE_INTEGER)) {
      return Number(value);
    }
    return 0; // Too large, return fallback
  }
  return Number(value) || 0;
}

// In SQL queries, cast to safe types:
SELECT CAST(SUM(BilledCost) AS DOUBLE) as BilledCost,
       COUNT(DISTINCT CAST(ResourceId AS VARCHAR)) as ResourceCount
```

### DuckDB GROUP BY Pattern (CRITICAL)

**DuckDB does NOT allow aliases in GROUP BY when using COALESCE.** Use column position numbers instead:

```sql
-- ❌ WRONG: Alias in GROUP BY causes "Binder Error"
SELECT 
  ResourceId,
  COALESCE(RegionName, 'Unknown') as RegionName,  -- alias
  SUM(BilledCost) as TotalCost
FROM unified_billing_view
GROUP BY ResourceId, RegionName  -- Error: "Alias with name 'RegionName' exists..."

-- ✅ CORRECT: Use column positions in GROUP BY
SELECT 
  ResourceId,                                           -- Position 1
  COALESCE(RegionName, 'Unknown') as ResourceRegion,   -- Position 2 (renamed alias)
  SUM(BilledCost) as TotalCost                         -- Position 3
FROM unified_billing_view
GROUP BY 1, 2  -- Use column positions instead of names
```

**Rules:**
1. Rename any COALESCE alias to avoid conflicts (e.g., `RegionName` → `ResourceRegion`)
2. Use column position numbers (1, 2, 3...) in GROUP BY clause
3. Access renamed fields in code (e.g., `row.ResourceRegion` instead of `row.RegionName`)
4. **IMPORTANT:** FOCUS schema uses `RegionName`, NOT `Region`

### FOCUS Column Name Mapping (CRITICAL)

The FOCUS specification uses different column names than you might expect:

| Common Name | FOCUS Column | Notes |
|-------------|--------------|-------|
| Region | `RegionName` | NOT `Region` |
| Usage Quantity | `ConsumedQuantity` | NOT `UsageQuantity` |
| Pricing Quantity | `PricingQuantity` | For pricing-based calculations |
| Tags | `Tags` | JSON string, parse with `JSON.parse()` |

```sql
-- ✅ CORRECT FOCUS columns
SELECT 
  RegionName,                                    -- NOT Region
  SUM(CAST(ConsumedQuantity AS DOUBLE)) as Qty, -- NOT UsageQuantity  
  SUM(CAST(BilledCost AS DOUBLE)) as Cost
FROM unified_billing_view
GROUP BY 1
```

---

## 5.1 Unified Scan Frequency System

All DETECT module dashboards (Anomaly Detection, Waste Hunter, AI Analytics) share a unified scan frequency configuration.

### Configuration (`src/modules/detector/shared/scan-config.ts`)

| Frequency | Interval | Description |
|-----------|----------|-------------|
| `manual` | 0 | Only scan when user clicks "Scan Now" |
| `1h` | 1 hour | Good for high-activity accounts |
| `6h` | 6 hours | Balanced frequency |
| `12h` | 12 hours | Twice daily checks |
| `24h` | 24 hours | **Default** - Recommended for daily data updates |

### Storage Keys
```typescript
const SCAN_SETTINGS_KEYS = {
  anomaly: 'focal:anomaly-scan-settings',
  waste: 'focal:waste-scan-settings',
  aiAnalytics: 'focal:ai-analytics-scan-settings',
};
```

### Usage Pattern

```tsx
import {
  SCAN_FREQUENCY_OPTIONS,
  SCAN_SETTINGS_KEYS,
  type ScanFrequency,
  loadScanSettings,
  saveScanSettings,
  calculateNextScan,
  isScanDue,
  formatTimeUntil,
} from '@/modules/detector/shared';

function DetectorDashboard() {
  const [scanFrequency, setScanFrequency] = useState<ScanFrequency>('24h');
  const [lastScan, setLastScan] = useState<Date | null>(null);
  const [nextScheduledScan, setNextScheduledScan] = useState<Date | null>(null);

  // Load settings on mount
  useEffect(() => {
    const settings = loadScanSettings(SCAN_SETTINGS_KEYS.waste);
    if (settings?.frequency) setScanFrequency(settings.frequency);
    if (settings?.lastScan) setLastScan(settings.lastScan);
  }, []);

  // Save settings when changed
  useEffect(() => {
    saveScanSettings(SCAN_SETTINGS_KEYS.waste, {
      frequency: scanFrequency,
      lastScan: lastScan || undefined,
    });
    if (lastScan && scanFrequency !== 'manual') {
      setNextScheduledScan(calculateNextScan(scanFrequency, lastScan));
    }
  }, [scanFrequency, lastScan]);

  // Auto-scan check
  useEffect(() => {
    if (scanFrequency === 'manual') return;
    if (isScanDue(scanFrequency, lastScan) && !isScanning) {
      runScan();
    }
  }, [scanFrequency, lastScan]);
}
```

---

## 5.2 Shared Anomaly Detection System

The anomaly detection system provides centralized cost anomaly detection that is shared across all dashboards.

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    ANOMALY DETECTION SYSTEM                      │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │ AnomalyEngine   │  │ localStorage    │  │ useAnomalies    │  │
│  │ (Detection)     │  │ (Cache 4h TTL)  │  │ (Shared Hook)   │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  │
│           │                    │                    │            │
│           └────────────────────┴────────────────────┘            │
│                              │                                    │
│    ┌─────────────────────────┴─────────────────────────┐        │
│    │                                                    │        │
│    ▼                                                    ▼        │
│  ┌──────────────────┐  ┌──────────────────┐  ┌────────────────┐ │
│  │ Anomaly Detection│  │ Engineering      │  │ Other          │ │
│  │ Dashboard        │  │ Dashboard        │  │ Dashboards     │ │
│  │ (Full Control)   │  │ (Summary View)   │  │ (Summary View) │ │
│  └──────────────────┘  └──────────────────┘  └────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### Detection Methods

| Method | Description |
|--------|-------------|
| `statistical` | Z-score and IQR outlier detection |
| `time-series` | Moving average deviation detection |
| `pattern-based` | New resource and pattern break detection |

### Severity Levels

| Severity | Impact Threshold | Description |
|----------|-----------------|-------------|
| `critical` | >300% increase | Immediate attention required |
| `high` | >200% increase | Needs investigation |
| `medium` | >100% increase | Monitor closely |
| `low` | >50% increase | Worth reviewing |

### Shared Hook Usage

```tsx
// For dashboards that just need summary data
import { useAnomalySummary } from '@/hooks/use-anomalies';

function EngineeringDashboard() {
  const { summary, recentAnomalies, isLoading } = useAnomalySummary();
  
  // summary contains: { total, critical, high, medium, low, totalImpact, topServices }
  // recentAnomalies contains top 5 critical/high severity anomalies
  
  return (
    <Card onClick={() => router.push('/dashboard/detector/anomalies')}>
      <CardTitle>Cost Anomalies</CardTitle>
      <div>{summary.total}</div>
      <Badge>{summary.critical} critical</Badge>
    </Card>
  );
}
```

### Cross-Dashboard Linking

Anomalies link between dashboards using URL parameters:

```tsx
// From any dashboard to Anomaly Detection with resource filter
router.push(`/dashboard/detector/anomalies?resource=${encodeURIComponent(resourceId)}`);
```

### Cache Key

```typescript
const ANOMALY_CACHE_KEY = 'focal:anomaly-cache';
// Structure: { anomalies: AnomalyResult[], timestamp: number }
// TTL: 4 hours
```

---

## 7. User Management & Role-Based Access Control

### User Profile System

Focal provides comprehensive user profile management with the following capabilities:

- **Personal Information:** First name, last name, title, department
- **Preferences:** Timezone, locale, currency, theme settings
- **Privacy & Notifications:** Granular control over email notifications and privacy settings
- **Profile Completion:** Onboarding workflow with progress tracking
- **Activity Logging:** Complete audit trail of user actions

### Role-Based Access Control (RBAC)

| Role | Description | Permissions |
|------|-------------|-------------|
| **Owner** | Organization owner | Full access, can manage all users and settings |
| **Admin** | Organization admin | User management, role assignment, activity monitoring |
| **Member** | Regular user | Access to analytics and personal profile management |
| **Super Admin** | Platform super admin | System-wide administration across organizations |

### Admin User Management Features

- **User Search & Filtering:** Real-time search across all organization users
- **Role Management:** Change user roles with proper authorization checks  
- **User Status Control:** Activate/deactivate users (super admin only)
- **Activity Monitoring:** View comprehensive audit logs with metadata
- **Bulk Operations:** Support for managing multiple users at once
- **Permission Validation:** Server-side checks ensure proper authorization

### Database Schema Extensions

```sql
-- Extended user table
ALTER TABLE user ADD COLUMN firstName VARCHAR;
ALTER TABLE user ADD COLUMN lastName VARCHAR;
ALTER TABLE user ADD COLUMN title VARCHAR;
ALTER TABLE user ADD COLUMN department VARCHAR;
ALTER TABLE user ADD COLUMN timezone VARCHAR DEFAULT 'UTC';
ALTER TABLE user ADD COLUMN locale VARCHAR DEFAULT 'en-US';
ALTER TABLE user ADD COLUMN currency VARCHAR DEFAULT 'USD';
ALTER TABLE user ADD COLUMN preferences JSON; -- UserPreferences interface
ALTER TABLE user ADD COLUMN isActive BOOLEAN DEFAULT true;
ALTER TABLE user ADD COLUMN isSuperAdmin BOOLEAN DEFAULT false;
ALTER TABLE user ADD COLUMN profileCompletedAt TIMESTAMP;
ALTER TABLE user ADD COLUMN onboardingCompletedAt TIMESTAMP;

-- Activity logging table
CREATE TABLE userActivity (
  id VARCHAR PRIMARY KEY,
  userId VARCHAR REFERENCES user(id),
  action VARCHAR NOT NULL,
  description VARCHAR,
  metadata JSON,
  ipAddress VARCHAR,
  userAgent VARCHAR,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Server Actions

| Action | Purpose | Authorization |
|--------|---------|---------------|
| `getCurrentUserProfile` | Get current user profile | Authenticated users |
| `updateUserProfile` | Update user profile | Own profile only |
| `completeOnboarding` | Mark onboarding complete | Own profile only |
| `searchUsers` | Search organization users | Admin+ only |
| `updateUserRole` | Change user role | Owner only |
| `toggleUserActive` | Activate/deactivate user | Super Admin only |
| `logUserActivity` | Log user actions | System/authenticated users |
| `getUserActivityLog` | Get user activity history | Admin+ (own) or Admin+ (others) |

### Security Features

- **Permission Validation:** All admin operations validate user permissions server-side
- **Activity Logging:** Comprehensive audit trail for all user management actions
- **Session Validation:** Better-Auth session validation on all operations
- **Role Hierarchy:** Owners > Admins > Members with proper inheritance
- **Data Privacy:** Users can only see their own sensitive information unless admin

---

## 8. Visualization Components

### Chart Components (`src/components/charts/`)

| Component | Purpose | Props |
|-----------|---------|-------|
| `CostTrendChart` | Time series area/line chart | `data`, `costTypes`, `currency`, `height` |
| `CostBreakdownChart` | Pie/donut chart for allocation | `data`, `currency`, `donut`, `showLegend` |
| `CostTreemap` | Hierarchical treemap | `data`, `currency`, `height`, `colors` |
| `CostTopologyGraph` | React Flow cost hierarchy | `nodes`, `currency`, `height`, `onNodeClick` |
| `SparklineChart` | Mini inline trend chart | `data`, `width`, `height`, `trendColor` |
| `BudgetGauge` | Progress bar for budgets | `value`, `max`, `currency`, `thresholds` |
| `KPICard` | Key metric display card | `title`, `value`, `currency`, `previousValue` |

### Dashboard Components (`src/components/dashboards/`)

| Component | Purpose | Features |
|-----------|---------|----------|
| `CostOverviewDashboard` | Executive summary view | KPIs, trends, breakdowns, top resources |

### Usage Example

```tsx
import { CostTrendChart, CostBreakdownChart, KPICard } from '@/components/charts';

// Time series trend
<CostTrendChart
  data={[{ date: '01/15', billedCost: 1000, effectiveCost: 900 }]}
  costTypes={['billedCost', 'effectiveCost']}
  currency="NOK"
  height={300}
/>

// Pie/Donut breakdown
<CostBreakdownChart
  data={[{ name: 'Compute', value: 5000 }, { name: 'Storage', value: 2000 }]}
  currency="NOK"
  donut={true}
/>

// KPI Card with trend
<KPICard
  title="Total Cost"  value={12500.75}
  currency="NOK"
  previousValue={11200.50}
/>
```

---

## 9. Navigation System & Breadcrumbs

### Dynamic Breadcrumb Navigation

Focal features a dynamic breadcrumb system that shows the complete folder structure/path of where the user is navigating, replacing the static "Dashboard" breadcrumb with contextual navigation.

#### Features
- **Dynamic Path Display:** Shows full navigation path (e.g., "Dashboard > Sources" or "Dashboard > Intelligence > Unit Economics")
- **Icons & Labels:** Each breadcrumb item displays an appropriate icon and label
- **Clickable Navigation:** Non-current breadcrumb items are clickable for easy navigation
- **Mobile Responsive:** Adapts with shorter labels on smaller screens
- **Tab Support:** Supports URL parameters for sub-sections (e.g., Settings tabs)

#### Route Configuration (`src/components/dynamic-breadcrumb.tsx`)

```typescript
const ROUTE_CONFIG = {
  'dashboard': { label: 'Dashboard', shortLabel: 'Home', icon: Home },
  'analytics': { label: 'Analytics', shortLabel: 'Analytics', icon: BarChart3 },
  'sources': { label: 'Data Sources', shortLabel: 'Sources', icon: Database },
  'connectors': { label: 'Connectors', shortLabel: 'Connectors', icon: Workflow },
  'detector': { label: 'Anomaly Detector', shortLabel: 'Detector', icon: AlertTriangle },
  'intelligence': { label: 'Intelligence', shortLabel: 'AI', icon: Brain },
  'unit-economics': { label: 'Unit Economics', shortLabel: 'Unit Econ', icon: Target },
  'settings': { label: 'Settings', shortLabel: 'Settings', icon: Settings },
  // Settings sub-sections for future tab navigation
  'profile': { label: 'Profile Settings', shortLabel: 'Profile', icon: User },
  'admin': { label: 'User Management', shortLabel: 'Admin', icon: Users },
  'storage': { label: 'Storage Management', shortLabel: 'Storage', icon: HardDrive },
  // Add more routes as needed
};
```

#### Implementation Examples

```tsx
// Usage in AppHeader
import { DynamicBreadcrumb } from '@/components/dynamic-breadcrumb';

<DynamicBreadcrumb />

// Breadcrumb will automatically show:
// - '/dashboard' → "Dashboard"
// - '/dashboard/sources' → "Data Sources"  
// - '/dashboard/intelligence/unit-economics' → "Dashboard > Intelligence > Unit Economics"
// - '/dashboard/settings?tab=profile' → "Dashboard > Settings > Profile Settings"
```

#### Mobile Adaptations
- **Responsive Labels:** Shows `shortLabel` on small screens, full `label` on larger screens
- **Icon Consistency:** All breadcrumb items show their associated icon
- **Collapsible:** Long paths gracefully handle screen space constraints

### Sidebar Navigation Structure

The app sidebar follows a hierarchical FinOps domain organization:

- **HEADQUARTERS:** Core dashboards (Cockpit, Topology)
- **INTELLIGENCE:** Analytics and insights (Intelligence Hub, Unit Economics)
- **DETECT:** Optimization and anomaly detection (Detector Hub, Anomalies)
- **CONTROLLER:** Operational controls (Premium features)
- **DATA ENGINE:** Configuration and data management (Sources, Connectors, Settings)

This provides users with clear mental models of functionality grouped by operational domain.

---  value={150000}
  currency="NOK"
  previousValue={140000}
  sparklineData={[100, 120, 115, 130, 150]}
/>
```

---

## 6. FinOps Hub Navigation Structure

The sidebar is organized into 5 collapsible groups covering all FinOps domains:

### HEADQUARTERS (Core Views)
| Route | Name | Status | Description |
|-------|------|--------|-------------|
| `/dashboard` | Cockpit | ✅ Implemented | Executive dashboard with KPIs and trends |
| `/dashboard/topology` | Topology | ✅ Implemented | Visual map of cloud infrastructure costs |

### INTELLIGENCE (Analytics)
| Route | Name | Status | Description |
|-------|------|--------|-------------|
| `/dashboard/analytics` | Explorer | ✅ Implemented | Deep-dive cost analysis with FOCUS queries |
| `/dashboard/unit-economics` | Unit Economics | 🔜 Coming Soon | Cost per unit, customer, or transaction |
| `/dashboard/k8s` | Kubernetes | 🔜 Coming Soon | Container and Kubernetes cost allocation |
| `/dashboard/green-ops` | Sustainability | 🔜 Coming Soon | Carbon footprint and sustainability metrics |

### DETECT (Optimization)
| Route | Name | Status | Description |
|-------|------|--------|-------------|
| `/dashboard/detector` | Detector Hub | ✅ Implemented | Central hub for anomaly detection |
| `/dashboard/detector/anomalies` | Anomalies | ✅ Implemented | AI-powered cost anomaly detection with drill-down |
| `/dashboard/waste` | Waste Hunter | ✅ Implemented | Find and eliminate unused resources (idle VMs, untagged resources, stale snapshots) |
| `/dashboard/ai-spend` | AI Analytics | ✅ NEW | Track AI/ML model training, inference, and GPU costs |
| `/dashboard/simulator` | Savings Simulator | ✅ Implemented | Model what-if scenarios (RI, Spot, Right-sizing) |

### CONTROLLER (Operations) - Premium
| Route | Name | Status | Description |
|-------|------|--------|-------------|
| `/dashboard/wallet` | Wallet | 🔐 Premium | Bank integration and payment tracking |
| `/dashboard/guardrails` | Guardrails | 🔐 Premium | Budget alerts and kill switches |
| `/dashboard/automations` | Automations | 🔐 Premium | Automated cost optimization workflows |

### DATA ENGINE (Configuration)
| Route | Name | Status | Description |
|-------|------|--------|-------------|
| `/dashboard/sources` | Sources | ✅ Implemented | Manage cloud data sources and imports |
| `/dashboard/connectors` | Connectors | ✅ Implemented | Configure cloud provider connections |
| `/dashboard/tagging` | Virtual Tagging | 🔜 Coming Soon | Apply tags without modifying cloud resources |
| `/dashboard/settings` | Settings | ✅ Enhanced | Platform configuration, local storage, profile management, and admin controls |

---

## 9. Implementation Status

### Phase 1: Foundation
- [x] Project scaffolding (Next.js 15 + TypeScript)
- [x] Tailwind CSS + Shadcn/ui setup (Dark mode default)
- [x] Drizzle ORM + Neon Postgres connection
- [x] Better-Auth integration (Email/Password + OAuth)
- [x] Organization plugin setup (Multi-tenancy)
- [x] Base UI shell (Sidebar, Header, Layout)
- [x] FinOps Hub navigation with collapsible groups

### Phase 2: Spectrum Engine (DuckDB)
- [x] DuckDB-WASM initialization
- [x] Web Worker setup for off-main-thread processing
- [x] IndexedDB/OPFS persistence layer
- [x] Query builder abstraction
- [x] Data import pipeline (Parquet, CSV)
- [x] FOCUS Query Library (59 FinOps use cases)
- [x] Unified View system for multi-source queries

### Phase 3: Connectors
- [x] Azure Cost Management connector
  - [x] SAS token generation (Server Action)
  - [x] Blob Storage direct fetch
  - [x] Cost export schema mapping
- [ ] AWS Cost Explorer connector
  - [ ] Pre-signed URL generation
  - [ ] S3 direct fetch
  - [ ] CUR schema mapping
- [ ] Connector health monitoring

### Phase 4: Visualization ✅
- [x] Cost dashboard components (KPICard, BudgetGauge)
- [x] Time-series charts (CostTrendChart with Recharts)
- [x] Cost breakdown charts (CostBreakdownChart - Pie/Donut)
- [x] Treemap visualization (CostTreemap)
- [x] Sparkline charts for inline trends
- [x] Cost Overview Dashboard (executive summary)
- [x] Multi-persona dashboards (Executive, Finance, Engineering)
- [x] Dashboard selector component
- [x] Analytics page with chart view toggle
- [x] React Flow topology graph (CostTopologyGraph)
- [x] Drill-down views (DrillDownPanel with hierarchical navigation)
- [x] Saved views & sharing (SavedViewsPanel with shareable URLs)

### Phase 5: Advanced Features
- [x] Local storage management (Storage Controller & Manager UI)
- [x] OPFS-based data persistence with user control
- [x] Storage usage monitoring and breakdown analysis
- [x] Data retention policies and auto-cleanup
- [x] Nuclear data purge functionality
- [x] **User Management System** ✅ **COMPLETED**
  - [x] Profile settings with avatar upload functionality
  - [x] Complete profile forms (personal info, preferences, notifications)
  - [x] User preferences (timezone, locale, currency, theme)
  - [x] Privacy and notification controls with granular settings
  - [x] Profile completion tracking and onboarding workflow
  - [x] Admin user management dashboard with real-time search
  - [x] Role-based access control (Owner/Admin/Member/Super Admin)
  - [x] User status management (activate/deactivate users)
  - [x] Role assignment with proper authorization checks
  - [x] Activity logging and comprehensive audit trail system
  - [x] Activity monitoring interface for admins
  - [x] Server actions for all user management operations
  - [x] Form validation with React Hook Form + Zod
  - [x] Profile picture upload with base64 encoding
  - [x] Pagination and bulk operations support
- [x] **Anomaly Detection Dashboard** ✅ **COMPLETED**
  - [x] Full-featured anomaly detection with drill-down capability
  - [x] Cost trend visualization (AreaChart)
  - [x] Severity distribution chart (BarChart)
  - [x] Service breakdown analysis
  - [x] Drill-down dialog with 4 tabs (Overview, Cost Trend, Details, Related)
  - [x] Search and filter functionality (by severity, service, date)
  - [x] Related anomalies discovery
  - [x] Real-time anomaly scanning with progress indicators
  - [x] Configurable scan frequency (seconds to hours)
- [x] **Waste Hunter Module** ✅ **NEW**
  - [x] 7+ waste detection rules (idle-compute, untagged, stale-snapshot, unused-storage, idle-database, old-generation, unused-ip)
  - [x] Severity classification (critical, high, medium, low)
  - [x] Confidence scoring for each detection
  - [x] Drill-down with Overview/Evidence/Actions tabs
  - [x] Category breakdown charts (Compute, Storage, Network, etc.)
  - [x] Actionable recommendations per waste opportunity
  - [x] Savings potential calculation
- [x] **AI Analytics Module** ✅ **NEW**
  - [x] AI service category detection (LLM, ML Training, ML Inference, GPU Compute, Cognitive Services, Vector DB, Model Hosting)
  - [x] Pattern matching for major AI services (OpenAI, Azure OpenAI, Bedrock, SageMaker, Vertex AI, etc.)
  - [x] Model extraction from resource names (GPT-4, Claude, Gemini, Llama, etc.)
  - [x] Cost breakdown by AI category (Pie/Bar charts)
  - [x] Trend analysis with LLM/Training/Inference split
  - [x] Efficiency metrics (cost per 1K tokens, inference per training ratio)
  - [x] Optimization recommendations (off-peak, batching, model selection)
  - [x] Top models by cost tracking
- [x] **Savings Simulator Module** ✅ **NEW**
  - [x] 8 simulation templates (Reserved Instances, Spot Instances, Right-sizing, Scheduled Scaling, Storage Tiering, Region Migration, License Optimization, Custom)
  - [x] What-if scenario modeling with interactive UI
  - [x] Risk assessment (low/medium/high) for each scenario
  - [x] Effort estimation and time-to-implement
  - [x] Cost projection charts (1 month to 3 years)
  - [x] Break-even analysis for commitment scenarios
  - [x] Custom scenario creator with resource selection
  - [x] Priority-based recommendations
  - [x] Annual and 3-year savings projections
- [x] **Local Aggregation Cache** ✅ **COMPLETED**
  - [x] IndexedDBCacheProvider for persistent browser storage
  - [x] AggregationCacheService with typed cache entries
  - [x] TTL-based expiration (configurable per cache type)
  - [x] Cache categories: daily_costs, monthly_costs, service_breakdown, resource_costs, anomalies, kpi
  - [x] useCachedQuery hook with stale-while-revalidate pattern
  - [x] Background refresh for stale data
  - [x] Cache statistics and management utilities
- [ ] Budget alerts
- [ ] Recommendations engine
- [ ] Export & reporting

---

## 10. Key File Locations

```
focal/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── (auth)/             # Auth routes (login, register)
│   │   ├── dashboard/          # Protected dashboard routes
│   │   │   ├── analytics/      # FOCUS query analytics
│   │   │   ├── connectors/     # Data connector management
│   │   │   ├── detector/       # Anomaly detection hub
│   │   │   │   └── anomalies/  # Anomaly dashboard with drill-down
│   │   │   ├── intelligence/   # Intelligence hub
│   │   │   │   └── unit-economics/  # Unit economics analysis
│   │   │   ├── settings/       # Settings with tabs (profile, team, storage)
│   │   │   ├── sources/        # Data source browser
│   │   │   └── topology/       # Cost topology visualization
│   │   ├── api/                # API routes (minimal)
│   │   └── layout.tsx          # Root layout
│   ├── components/
│   │   ├── ui/                 # Shadcn/ui components
│   │   ├── settings/           # Settings page components
│   │   │   ├── storage-manager.tsx        # Local storage management UI
│   │   │   ├── profile-settings-form.tsx  # User profile management
│   │   │   └── team-settings.tsx          # Team/organization management
│   │   ├── charts/             # Recharts & React Flow components
│   │   │   ├── CostTrendChart.tsx
│   │   │   ├── CostBreakdownChart.tsx
│   │   │   ├── CostTreemap.tsx
│   │   │   ├── CostTopologyGraph.tsx    # React Flow topology
│   │   │   ├── SparklineChart.tsx
│   │   │   ├── BudgetGauge.tsx
│   │   │   ├── KPICard.tsx
│   │   │   └── DrillDownPanel.tsx       # Hierarchical drill-down
│   │   ├── dashboards/         # Pre-built dashboard layouts
│   │   │   └── CostOverviewDashboard.tsx
│   │   ├── SavedViewsPanel.tsx # Saved views & sharing UI
│   │   └── providers/          # React context providers
│   │       └── spectrum-provider.tsx  # DuckDB-WASM provider
│   ├── engine/                 # Spectrum Engine (DuckDB)
│   │   ├── core/               # Core DuckDB-WASM initialization
│   │   ├── ingestion/          # Data ingestion pipeline
│   │   │   └── cache.ts        # InMemoryCacheProvider & IndexedDBCacheProvider
│   │   ├── enrichment/         # Data enrichment steps (virtual tags, green ops)
│   │   └── services/           # Engine services
│   │       └── aggregation-cache.ts  # Typed aggregation caching service
│   ├── modules/                # Feature modules
│   │   └── detector/           # Anomaly detection module
│   │       ├── shared/            # Shared DETECT module utilities ✅ NEW
│   │       │   ├── index.ts       # Module exports
│   │       │   └── scan-config.ts # Unified scan frequency configuration
│   │       ├── anomaly-detection/
│   │       │   ├── dashboard.tsx  # Full anomaly dashboard with drill-down
│   │       │   └── engine.ts      # Local AI anomaly detection engine
│   │       ├── waste-hunter/      # Waste detection module ✅ NEW
│   │       │   ├── dashboard.tsx  # Waste hunter dashboard with drill-down
│   │       │   └── engine.ts      # 7+ detection rules (idle, untagged, stale, etc.)
│   │       ├── ai-analytics/      # AI spend tracking module ✅ NEW
│   │       │   ├── dashboard.tsx  # AI spend dashboard with model breakdown
│   │       │   └── engine.ts      # AI service pattern detection (LLM, ML, GPU)
│   │       └── savings-simulator/ # What-if analysis module ✅ NEW
│   │           ├── dashboard.tsx  # Interactive scenario modeling UI
│   │           └── engine.ts      # 8 simulation templates (RI, Spot, Right-sizing, etc.)
│   ├── lib/
│   │   ├── auth.ts             # Better-Auth server config
│   │   ├── auth-client.ts      # Better-Auth client
│   │   ├── currency.ts         # Currency formatting & detection
│   │   ├── focus-queries.ts    # 59 FOCUS use case queries
│   │   ├── storage-controller.ts # Local storage management & OPFS control
│   │   └── utils.ts            # Utility functions
│   ├── db/
│   │   ├── index.ts            # Drizzle client
│   │   └── schema.ts           # Database schema
│   ├── actions/                # Server Actions
│   │   ├── azure.ts            # Azure SAS token generation
│   │   ├── connectors.ts       # Connector CRUD
│   │   ├── data-sources.ts     # Data source CRUD
│   │   ├── saved-views.ts      # Saved views CRUD & sharing
│   │   └── user-management.ts  # User profile & admin operations
│   └── hooks/                  # React hooks
│       ├── use-cached-query.ts # Caching hook with stale-while-revalidate
│       └── use-mobile.ts       # Mobile detection hook
├── drizzle/                    # Migrations
├── public/
│   └── duckdb/                 # DuckDB-WASM workers
└── CONTEXT.md                  # This file
```

---

## 11. Environment Variables

```env
# Database (Neon)
DATABASE_URL=

# Better-Auth
BETTER_AUTH_SECRET=
BETTER_AUTH_URL=

# OAuth Providers (optional)
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# Azure (for SAS token minting)
AZURE_STORAGE_ACCOUNT=
AZURE_STORAGE_KEY=

# AWS (for pre-signed URLs)
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_REGION=
```

---

## 12. Commands Reference

```bash
# Development
pnpm dev                        # Start dev server
pnpm build                      # Production build
pnpm start                      # Start production server

# Database
pnpm db:generate                # Generate migrations
pnpm db:migrate                 # Run migrations
pnpm db:push                    # Push schema (dev only)
pnpm db:studio                  # Open Drizzle Studio

# UI Components
npx shadcn@latest add [name]    # Add Shadcn component
```

---

*This document should be updated as the project evolves.*
