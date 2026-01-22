# GitHub Copilot Instructions for Focal

## Role

You are an expert **Next.js 15** and **TypeScript** developer working on **Focal**, a Local-First FinOps platform. You have deep knowledge of modern React patterns, server components, and client-side data processing.

---

## Project Context

Focal follows a **Local-First** architecture where:
- The **server** (Control Plane) handles authentication and metadata only
- The **browser** (Data Plane) handles all heavy billing data processing via DuckDB-WASM
- Sensitive billing data **never** passes through our Next.js API routes

Always refer to `CONTEXT.md` in the project root for the full architecture overview.

---

## Tech Stack Rules

### Package Manager
- **Always use `pnpm`** for package management
- If `pnpm` is unavailable, fall back to `npm` (never `yarn`)

### TypeScript
- Use **strict mode** TypeScript
- Prefer explicit types over `any`
- Use `satisfies` operator for type narrowing when appropriate
- Prefer `interface` for object shapes, `type` for unions/intersections

### Next.js 15
- Use **App Router** conventions (`app/` directory)
- Prefer **Server Components** by default
- Add `'use client'` directive only when necessary (hooks, browser APIs, interactivity)
- Use **Server Actions** for mutations instead of API routes when possible
- Use `next/navigation` for routing (`useRouter`, `redirect`, `usePathname`)

### Styling
- Use **Tailwind CSS** for all styling
- Follow **mobile-first** responsive design
- Default to **dark mode** styling (`dark:` variants as base)
- Use CSS variables from Shadcn/ui theme system

### UI Components
- Use **Shadcn/ui** components as the foundation
- Add new components with: `npx shadcn@latest add [component-name]`
- Never modify files in `components/ui/` directly—extend via wrapper components
- Use **Lucide React** (`lucide-react`) for all icons

### Database & ORM
- **ALWAYS use Drizzle ORM** syntax for database queries
- Never write raw SQL strings unless absolutely necessary
- Define schemas in `src/lib/db/schema.ts`
- Use Drizzle's type inference: `typeof users.$inferSelect`

```typescript
// ✅ Correct: Drizzle ORM
const user = await db.query.users.findFirst({
  where: eq(users.id, userId),
  with: { organization: true }
});

// ❌ Avoid: Raw SQL
const user = await db.execute(sql`SELECT * FROM users WHERE id = ${userId}`);
```

### Authentication
- Use **Better-Auth** for all authentication
- Server-side: Use `auth` from `src/lib/auth.ts`
- Client-side: Use `authClient` from `src/lib/auth-client.ts`
- Access session in Server Components via `auth.api.getSession()`
- Access session in Client Components via `useSession()` hook

```typescript
// Server Component
import { auth } from '@/lib/auth';
const session = await auth.api.getSession({ headers: await headers() });

// Client Component
import { authClient } from '@/lib/auth-client';
const { data: session } = authClient.useSession();
```

### Analytics Engine
- Use **DuckDB-WASM** for all billing data queries
- Run DuckDB in a **Web Worker** to avoid blocking the main thread
- Cache query results in **IndexedDB** or **OPFS**
- Prefer **Parquet** format for data storage/transfer

---

## Code Patterns

### File Naming
- React components: `PascalCase.tsx` (e.g., `CostDashboard.tsx`)
- Utilities/hooks: `camelCase.ts` (e.g., `useDuckDB.ts`)
- Route files: `page.tsx`, `layout.tsx`, `loading.tsx`, `error.tsx`

### Component Structure
```typescript
// Prefer this order in components:
// 1. Imports
// 2. Types/Interfaces
// 3. Component function
// 4. Helper functions (if small, otherwise separate file)

interface Props {
  title: string;
  onAction: () => void;
}

export function MyComponent({ title, onAction }: Props) {
  // hooks first
  const [state, setState] = useState(false);
  
  // derived values
  const computed = useMemo(() => /* ... */, []);
  
  // handlers
  const handleClick = () => { /* ... */ };
  
  // render
  return <div>{/* ... */}</div>;
}
```

### Server Actions
```typescript
'use server';

import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { revalidatePath } from 'next/cache';

export async function createConnector(formData: FormData) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error('Unauthorized');
  
  // Drizzle query
  await db.insert(connectors).values({ /* ... */ });
  
  revalidatePath('/dashboard/connectors');
}
```

### Error Handling
- Use `try/catch` for async operations
- Return typed error objects instead of throwing in Server Actions
- Use error boundaries for React component errors

```typescript
// Server Action with typed return
type ActionResult<T> = 
  | { success: true; data: T }
  | { success: false; error: string };

export async function fetchData(): Promise<ActionResult<Data>> {
  try {
    const data = await db.query./* ... */;
    return { success: true, data };
  } catch (error) {
    return { success: false, error: 'Failed to fetch data' };
  }
}
```

---

## Critical Rules

### 🚫 Never Do
1. **Never send billing data to API routes** — process in browser with DuckDB
2. **Never use raw SQL** when Drizzle ORM can handle it
3. **Never use `any` type** — find or create proper types
4. **Never modify `components/ui/*`** — create wrapper components instead
5. **Never use `yarn`** — use `pnpm` or `npm` only

### ✅ Always Do
1. **Always validate auth** before database operations
2. **Always use Server Components** unless client features are needed
3. **Always add loading states** for async operations
4. **Always handle errors gracefully** with user feedback
5. **Always follow the Valet Key pattern** for cloud data access

---

## Common Tasks

### Adding a New Page
```bash
# Create route
mkdir -p src/app/(dashboard)/new-feature
touch src/app/(dashboard)/new-feature/page.tsx
```

### Adding a Shadcn Component
```bash
npx shadcn@latest add button
npx shadcn@latest add card
npx shadcn@latest add dialog
```

### Creating a Database Migration
```bash
pnpm db:generate   # After schema changes
pnpm db:migrate    # Apply migrations
```

### Running the Project
```bash
pnpm install       # Install dependencies
pnpm dev           # Start development server
```

---

## References

- [Next.js 15 Docs](https://nextjs.org/docs)
- [Drizzle ORM Docs](https://orm.drizzle.team/docs/overview)
- [Better-Auth Docs](https://www.better-auth.com/docs)
- [Shadcn/ui Docs](https://ui.shadcn.com)
- [DuckDB-WASM Docs](https://duckdb.org/docs/api/wasm/overview)
- [Tailwind CSS Docs](https://tailwindcss.com/docs)
