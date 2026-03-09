# Authentication & Route Protection Architecture

This document describes the authentication, authorization, and route protection architecture for the Operator UI application.

---

## Overview

The Operator UI uses a multi-layered authentication approach:

1. **Clerk** — Identity provider (authentication)
2. **TanStack Router** — Route-level guards (authorization)
3. **Convex** — Backend data access (with RLS)

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           OPERATOR UI                                    │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                         __root.tsx                                │   │
│  │  ┌─────────────────┐    ┌─────────────────────────────────────┐  │   │
│  │  │  ClerkProvider  │ →  │  ConvexProviderWithClerk            │  │   │
│  │  │                 │    │  (auto-syncs auth token to Convex)  │  │   │
│  │  └─────────────────┘    └─────────────────────────────────────┘  │   │
│  │                                                                   │   │
│  │  beforeLoad: fetchClerkAuth() → authPending, authStrict          │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                    │                                     │
│                                    ▼                                     │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                      ROUTE LAYOUTS                               │    │
│  ├─────────────────────────────────────────────────────────────────┤    │
│  │                                                                  │    │
│  │   /_auth/*          Public (sign-in, sign-up)                   │    │
│  │   │                 → Redirects to / if already authenticated    │    │
│  │   │                                                              │    │
│  │   /_protected/*     Protected routes                             │    │
│  │   │                 → Requires isAuthenticated + orgId           │    │
│  │   │                 → Redirects to /sign-in or /onboarding       │    │
│  │   │                                                              │    │
│  │   /onboarding/*     Onboarding flow                              │    │
│  │                     → Requires sessionId                         │    │
│  │                     → Routes based on onboarding status          │    │
│  │                                                                  │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                    │                                     │
│                                    ▼                                     │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                      CONVEX BACKEND                              │    │
│  ├─────────────────────────────────────────────────────────────────┤    │
│  │   ConvexProviderWithClerk automatically includes JWT token       │    │
│  │   ctx.auth.getUserIdentity() returns user info + org claims      │    │
│  │                                                                  │    │
│  │   Auth (with RLS) wrappers: gQuery, gMutation, gAction           │    │
│  │   (Currently stubbed - TODO: enable auth checks)                 │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Route Structure

### File Layout

```
apps/operator-ui/src/routes/
├── __root.tsx              # Root layout (providers, auth context)
├── _auth.tsx               # Auth layout (public pages)
│   └── _auth/
│       ├── sign-in.$.tsx   # Sign-in page
│       └── sign-up.$.tsx   # Sign-up page
├── _protected.tsx          # Protected layout (requires auth + org)
│   └── _protected/
│       └── index.tsx       # Dashboard home (/)
├── onboarding.tsx          # Onboarding layout
│   └── onboarding/
│       ├── accept-invite.tsx
│       ├── choose-organization.tsx
│       ├── connect-stripe.tsx
│       └── create-data-center.tsx
└── chatbot.tsx             # ⚠️ Currently unprotected (see TODO)
```

### Route Protection Matrix

| Route           | Layout       | Auth Required | Org Required | Notes                    |
| --------------- | ------------ | ------------- | ------------ | ------------------------ |
| `/sign-in`      | `_auth`      | ❌            | ❌           | Redirects if auth'd      |
| `/sign-up`      | `_auth`      | ❌            | ❌           | Redirects if auth'd      |
| `/`             | `_protected` | ✅            | ✅           | Dashboard                |
| `/onboarding/*` | `onboarding` | ✅ (session)  | ❌           | Wizard flow              |
| `/chatbot`      | none         | ❌            | ❌           | **TODO: Add protection** |

---

## Authentication Flow

### 1. Root Level (`__root.tsx`)

The root route fetches auth state server-side:

```typescript
beforeLoad: async (ctx) => {
  // Pending allows onboarding flow to work
  const authPending = await fetchClerkAuth({
    data: { allowPendingSession: true },
  })
  // Strict requires fully resolved session
  const authStrict = await fetchClerkAuth({
    data: { allowPendingSession: false },
  })

  // Set token for SSR Convex queries
  if (authPending.token) {
    ctx.context.convexQueryClient.serverHttpClient?.setAuth(authPending.token)
  }

  return { authPending, authStrict }
}
```

### 2. Protected Routes (`_protected.tsx`)

```typescript
beforeLoad: async ({ context: { authStrict } }) => {
  if (!authStrict.isAuthenticated) {
    throw redirect({ to: '/sign-in/$' })
  }
  if (!authStrict.orgId) {
    throw redirect({ to: '/onboarding' })
  }

  const onboardingStatus = await getOnboardingStatus()
  return { onboardingStatus }
}
```

### 3. Onboarding Routes (`onboarding.tsx`)

```typescript
beforeLoad: async ({ context: { authPending }, location }) => {
  const { sessionId, orgId } = authPending

  if (!sessionId) {
    throw redirect({ to: '/sign-in/$' })
  }

  // Only auto-route at /onboarding exactly
  if (location.pathname !== '/onboarding') return

  if (!orgId) {
    const token = await getInviteToken()
    throw redirect({
      to: token
        ? '/onboarding/accept-invite'
        : '/onboarding/choose-organization',
    })
  }

  const status = await getOnboardingStatus()

  if (!status.stripeOnboardingComplete) {
    throw redirect({ to: '/onboarding/connect-stripe' })
  }

  if (!status.hasDataCenters) {
    throw redirect({ to: '/onboarding/create-data-center' })
  }

  throw redirect({ to: '/' })
}
```

---

## Client-Side Convex Authentication

### How It Works

1. `ConvexProviderWithClerk` wraps the app in `__root.tsx`
2. Uses `useAuthWithPending` hook to sync Clerk → Convex
3. Every Convex call automatically includes the JWT token
4. `ctx.auth.getUserIdentity()` in Convex functions returns:

```typescript
{
  tokenIdentifier: "clerk|user_xxx",
  subject: "user_xxx",
  orgId: "org_xxx",        // Clerk org claim
  orgRole: "org:admin",    // Clerk role claim
  // ... other claims
}
```

### Usage

```typescript
// In a protected route component
const tenants = useQuery(api.tenants.queries.list, { orgId })
const createTenant = useMutation(api.tenants.mutations.create)
// Token automatically included - no wrapper needed
```

---

## Server Function Middleware

Located in `apps/operator-ui/src/lib/middleware/`:

### `auth.ts` — Route/Function Auth

```typescript
requireAuth // Requires authenticated user
requireOrg // Requires auth + org membership
requireAdmin // Requires org:admin role
requireOperator // Requires org:admin or org:operator role
```

### `convex-auth.ts` — Convex Token Middleware

```typescript
requireAuthWithConvex // Auth + Convex token
requireOrgWithConvex // Auth + Org + Convex token
```

Usage in server functions:

```typescript
export const getOnboardingStatus = createServerFn({ method: 'GET' })
  .middleware([requireOrgWithConvex])
  .handler(async ({ context }) => {
    const { convexToken, orgId } = context
    // ...
  })
```

---

## Convex Backend Protection (RLS)

### Current State: STUBBED

Located in `packages/db/convex/rls.ts`:

```typescript
// Currently returns true for all operations
return {
  tenants: {
    read: async () => true, // TODO: requireAuth()
    insert: async () => true, // TODO: requireAuth()
    modify: async () => true, // TODO: requireAuth()
  },
  // ... other tables
}
```

### TODO: Enable Auth Checks

```typescript
async function rlsRules(ctx: QueryCtx) {
  const identity = await ctx.auth.getUserIdentity()

  const requireAuth = () => {
    if (!identity) throw new Error('Unauthorized')
  }

  return {
    tenants: {
      read: async () => {
        requireAuth()
        // TODO: Also check identity.orgId matches tenant's org
        return true
      },
      // ...
    },
  }
}
```

---

## Onboarding Status

### Query: `getOrganizationOnboardingStatus`

Returns:

```typescript
{
  hasDataCenters: boolean
  stripeOnboardingComplete: boolean // Organizations always have a Stripe account
}
```

### Onboarding Flow

```
1. Accept Invite / Choose Organization
        ↓
2. Connect Stripe (org-level)
        ↓
3. Create Data Center
        ↓
4. Dashboard (onboarding complete)
```

---

## TODO Items

### High Priority

- [ ] **Protect `/chatbot` route** — Move under `_protected` or add guards
- [ ] **Enable Convex RLS** — Uncomment auth checks in `rls.ts`
- [ ] **Enable onboarding redirect** — Uncomment in `_protected.tsx` lines 46-53

### Future: Onboarding Overlay

Instead of redirecting away from dashboard, implement as overlay:

```typescript
// In _protected.tsx
function ProtectedLayout() {
  const { onboardingStatus } = Route.useRouteContext()
  const isComplete = /* check status */

  return (
    <div className="relative min-h-screen">
      <div className={isComplete ? '' : 'blur-sm pointer-events-none'}>
        <Outlet />
      </div>
      {!isComplete && <OnboardingOverlay status={onboardingStatus} />}
    </div>
  )
}
```

### Schema Changes (Completed)

- ✅ Move `stripeAccount` from DataCenter to Organization level
- ✅ Update `getOrganizationOnboardingStatus` query - now always creates Stripe account
- ✅ Update `vOrganizationOnboardingStatus` validator - simplified to `stripeOnboardingComplete`

---

## Security Layers Summary

| Layer                       | Protection          | Status     |
| --------------------------- | ------------------- | ---------- |
| Route Guards (`beforeLoad`) | UI access control   | ✅ Active  |
| Clerk Provider              | Identity/session    | ✅ Active  |
| ConvexProviderWithClerk     | Token sync          | ✅ Active  |
| Server Function Middleware  | SSR protection      | ✅ Active  |
| Convex RLS                  | Backend data access | ⚠️ Stubbed |

---

## Files Reference

| File                                  | Purpose                         |
| ------------------------------------- | ------------------------------- |
| `routes/__root.tsx`                   | Auth context, providers         |
| `routes/_protected.tsx`               | Protected route guards          |
| `routes/_auth.tsx`                    | Public auth pages               |
| `routes/onboarding.tsx`               | Onboarding flow routing         |
| `lib/middleware/auth.ts`              | Server function auth middleware |
| `lib/middleware/convex-auth.ts`       | Convex token middleware         |
| `features/auth/server/auth.server.ts` | Clerk auth fetching             |
| `features/auth/hooks/use-auth.ts`     | Pending session hook            |
| `packages/db/convex/rls.ts`           | Row-level security rules        |