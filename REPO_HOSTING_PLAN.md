# Focal Repository & Hosting Plan

## Overview

Focal follows an **Open Core** model with a local-first architecture. This plan outlines the repository structure, what belongs where, and hosting strategies.

---

## Repository Strategy

### Option A: Monorepo (Recommended for Early Stage)

```
focal/
├── apps/
│   ├── web/                 # Next.js app (OSS + Premium)
│   └── docs/                # Documentation site
├── packages/
│   ├── core/                # DuckDB query engine, FOCUS parsing (OSS)
│   ├── ui/                  # Shared UI components (OSS)
│   ├── connectors/          # Cloud connector base classes (OSS)
│   └── analytics/           # Advanced analytics (Premium - private)
├── infra/                   # Terraform/Pulumi for cloud resources
└── examples/                # Example configurations, sample data
```

**Pros:**
- Single source of truth
- Easier dependency management
- Atomic commits across packages
- Simpler CI/CD initially

**Cons:**
- Harder to separate OSS from premium
- Larger clone size
- Access control complexity

---

### Option B: Multi-Repo (Recommended for Scale)

| Repository | Visibility | Purpose |
|------------|------------|---------|
| `focal-oss` | **Public** | Core engine, UI, base connectors |
| `focal-cloud` | **Private** | Managed service, premium features |
| `focal-docs` | **Public** | Documentation site |
| `focal-infra` | **Private** | Infrastructure as code |
| `focal-connectors` | **Public** | Community connectors |

---

## What Goes Where

### 🟢 Open Source (`focal-oss`)

```
focal-oss/
├── src/
│   ├── engine/              # DuckDB-WASM query engine
│   │   ├── duckdb-worker.ts
│   │   ├── focus-schema.ts
│   │   └── query-builder.ts
│   ├── connectors/
│   │   ├── base/            # Abstract connector classes
│   │   ├── azure/           # Azure Cost Management
│   │   ├── aws/             # AWS CUR connector
│   │   └── gcp/             # GCP Billing Export
│   ├── components/
│   │   ├── dashboards/      # Cost dashboards
│   │   ├── charts/          # Recharts wrappers
│   │   └── ui/              # Shadcn components
│   ├── lib/
│   │   ├── focus/           # FOCUS spec parsing
│   │   └── utils/           # Shared utilities
│   └── app/                 # Self-hosted Next.js app
├── docker/
│   ├── Dockerfile
│   └── docker-compose.yml   # Self-hosted deployment
├── examples/
│   └── sample-focus-data/
├── LICENSE                  # Apache 2.0 or MIT
└── README.md
```

**Included:**
- ✅ DuckDB-WASM query engine
- ✅ FOCUS data format support
- ✅ Basic cost dashboards
- ✅ Azure, AWS, GCP connectors (basic)
- ✅ Self-hosted deployment
- ✅ Local file import (Parquet, CSV)
- ✅ Basic authentication (email/password)

---

### 🔒 Premium/Cloud (`focal-cloud`)

```
focal-cloud/
├── src/
│   ├── features/
│   │   ├── ai-analytics/    # AI-powered insights
│   │   ├── anomaly-detection/
│   │   ├── forecasting/     # Cost forecasting
│   │   ├── recommendations/ # RI/SP recommendations
│   │   ├── unit-economics/  # Business metrics
│   │   └── multi-tenant/    # Team/org management
│   ├── connectors/
│   │   ├── datadog/         # Premium connectors
│   │   ├── snowflake/
│   │   └── databricks/
│   ├── integrations/
│   │   ├── slack/
│   │   ├── teams/
│   │   └── pagerduty/
│   └── api/
│       └── control-plane/   # Managed service API
├── infra/
│   ├── terraform/
│   └── kubernetes/
└── LICENSE                  # Proprietary
```

**Included:**
- 🔒 AI-powered anomaly detection
- 🔒 Cost forecasting & budgets
- 🔒 RI/Savings Plan recommendations
- 🔒 Unit economics / custom metrics
- 🔒 Multi-tenant team management
- 🔒 SSO (SAML, OIDC)
- 🔒 Slack/Teams integrations
- 🔒 Premium connectors
- 🔒 Managed cloud hosting
- 🔒 SLA & support

---

## Hosting Strategy

### Self-Hosted (OSS Users)

```
┌─────────────────────────────────────────────────────────┐
│                    User's Environment                    │
├─────────────────────────────────────────────────────────┤
│  ┌─────────────────┐    ┌─────────────────────────────┐ │
│  │   Docker Host   │    │      User's Browser         │ │
│  │                 │    │                             │ │
│  │  ┌───────────┐  │    │  ┌─────────────────────┐   │ │
│  │  │ Next.js   │◄─┼────┼──│    Focal Web App    │   │ │
│  │  │ (Auth +   │  │    │  │                     │   │ │
│  │  │  Metadata)│  │    │  │  ┌───────────────┐  │   │ │
│  │  └───────────┘  │    │  │  │ DuckDB-WASM   │  │   │ │
│  │                 │    │  │  │ (Data Plane)  │  │   │ │
│  │  ┌───────────┐  │    │  │  └───────────────┘  │   │ │
│  │  │ PostgreSQL│  │    │  │                     │   │ │
│  │  │ (SQLite)  │  │    │  └─────────────────────┘   │ │
│  │  └───────────┘  │    │                             │ │
│  └─────────────────┘    └─────────────────────────────┘ │
│                                    │                     │
│                                    ▼                     │
│                         ┌─────────────────────┐         │
│                         │  Cloud Storage      │         │
│                         │  (User's Azure/AWS) │         │
│                         │  via Valet Key      │         │
│                         └─────────────────────┘         │
└─────────────────────────────────────────────────────────┘
```

**Deployment Options:**
1. **Docker Compose** (simplest)
2. **Kubernetes Helm Chart**
3. **Single Binary** (compiled Next.js + embedded SQLite)

---

### Managed Cloud (Premium)

```
┌──────────────────────────────────────────────────────────────────┐
│                        Focal Cloud                                │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│   ┌─────────────────────────────────────────────────────────┐    │
│   │                    Control Plane                         │    │
│   │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────────┐ │    │
│   │  │ Vercel  │  │ Neon    │  │ Clerk/  │  │  Stripe     │ │    │
│   │  │ Next.js │  │ Postgres│  │ Auth0   │  │  Billing    │ │    │
│   │  └─────────┘  └─────────┘  └─────────┘  └─────────────┘ │    │
│   └─────────────────────────────────────────────────────────┘    │
│                              │                                    │
│                              ▼                                    │
│   ┌─────────────────────────────────────────────────────────┐    │
│   │              Valet Key Service                           │    │
│   │  • Generate SAS tokens for customer storage              │    │
│   │  • Time-limited, read-only access                        │    │
│   │  • Audit logging                                         │    │
│   └─────────────────────────────────────────────────────────┘    │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────────┐
│                      Customer Environment                         │
│  ┌──────────────────┐    ┌──────────────────────────────────┐   │
│  │ Customer Browser │    │       Customer Cloud              │   │
│  │                  │    │                                   │   │
│  │ ┌──────────────┐ │    │  ┌──────────────────────────┐    │   │
│  │ │ DuckDB-WASM  │─┼────┼─►│  Azure Blob / S3 / GCS   │    │   │
│  │ │ Query Engine │ │    │  │  (FOCUS Parquet Files)   │    │   │
│  │ └──────────────┘ │    │  └──────────────────────────┘    │   │
│  └──────────────────┘    └──────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────┘
```

---

## Platform & Service Choices

### Managed Cloud Hosting Stack

| Component | Service | Cost Estimate | Notes |
|-----------|---------|---------------|-------|
| **Web App** | Vercel | $20-150/mo | Pro plan, Edge functions |
| **Database** | Neon | $0-69/mo | Serverless Postgres |
| **Auth** | Better-Auth (self) | $0 | Or Clerk ($25+/mo) |
| **Billing** | Stripe | 2.9% + $0.30 | Per transaction |
| **Analytics** | PostHog | $0-450/mo | Product analytics |
| **Monitoring** | Sentry | $26/mo | Error tracking |
| **CDN/Assets** | Cloudflare R2 | ~$0.015/GB | Static assets |
| **Email** | Resend | $0-20/mo | Transactional email |
| **Docs** | Vercel/Mintlify | $0-150/mo | Documentation |

**Monthly Baseline:** ~$100-500/mo (startup phase)

---

### OSS Distribution

| Channel | Purpose |
|---------|---------|
| **GitHub Releases** | Binary releases, Docker images |
| **Docker Hub** | Official Docker images |
| **npm** | `@focal/core`, `@focal/ui` packages |
| **Helm Charts** | Kubernetes deployment |

---

## GitHub Organization Structure

```
github.com/focalfinops/
├── focal              # Main OSS repository (or focal-oss)
├── focal-cloud        # Private - managed service
├── focal-docs         # Documentation
├── focal-helm         # Kubernetes Helm charts
├── .github            # Org-wide GitHub config
└── awesome-focal      # Community resources
```

---

## CI/CD Strategy

### OSS Repository

```yaml
# .github/workflows/ci.yml
name: CI
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - run: pnpm install
      - run: pnpm test
      - run: pnpm build

  docker:
    needs: test
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - uses: docker/build-push-action@v5
        with:
          push: true
          tags: focalfinops/focal:latest
```

### Cloud Repository

```yaml
# .github/workflows/deploy.yml
name: Deploy to Vercel
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          vercel-args: '--prod'
```

---

## Versioning Strategy

### Semantic Versioning

```
v1.0.0 - Major.Minor.Patch

Major: Breaking changes
Minor: New features (backward compatible)
Patch: Bug fixes
```

### Release Channels

| Channel | Branch | Purpose |
|---------|--------|---------|
| `stable` | `main` | Production releases |
| `beta` | `beta` | Pre-release testing |
| `nightly` | `develop` | Cutting edge |

---

## License Strategy

| Component | License | Rationale |
|-----------|---------|-----------|
| **Core Engine** | Apache 2.0 | Permissive, enterprise-friendly |
| **UI Components** | MIT | Maximum adoption |
| **Premium Features** | Proprietary | Revenue source |
| **Documentation** | CC BY 4.0 | Open docs |

---

## Recommended Starting Point

For Focal's current stage, I recommend:

### Phase 1: Single Monorepo (Now)

```
focal/
├── src/                    # Current Next.js app
│   ├── core/               # Extract to package later
│   └── ...
├── docs/                   # Add documentation
├── docker/                 # Add Docker support
└── LICENSE                 # Apache 2.0
```

**Actions:**
1. Keep current repo as-is
2. Add Docker Compose for self-hosting
3. Create documentation site
4. Publish to GitHub as `focalfinops/focal`

### Phase 2: Split Premium (When Revenue)

When you have paying customers:
1. Extract premium features to `focal-cloud` (private)
2. Keep OSS in `focal` (public)
3. Use git submodules or pnpm workspaces

### Phase 3: Full Multi-Repo (At Scale)

When you have:
- Multiple contributors
- Enterprise customers needing isolation
- Complex CI/CD requirements

---

## Domain & Branding

| Asset | Recommendation |
|-------|----------------|
| **Domain** | `focal.dev` or `focalfinops.com` |
| **GitHub Org** | `focalfinops` |
| **npm Scope** | `@focal` |
| **Docker Hub** | `focalfinops/focal` |
| **Twitter/X** | `@focalfinops` |
| **Discord** | `discord.gg/focal` |

---

## Next Steps

- [ ] Create GitHub organization `focalfinops`
- [ ] Add Apache 2.0 LICENSE file
- [ ] Create Docker Compose for self-hosting
- [ ] Set up GitHub Actions CI
- [ ] Create documentation site structure
- [ ] Register domain (focal.dev)
- [ ] Set up Vercel project for managed hosting
- [ ] Create product roadmap (public)
