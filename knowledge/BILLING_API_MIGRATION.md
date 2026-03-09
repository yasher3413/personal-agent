# API Path Migration Guide

This document describes the API path changes from the billing system refactor.

## Convex API Path Changes

### Billing Modules (Phase 1)

The billing modules have been reorganized under `billing/` to consolidate related functionality.

| Old Path             | New Path                     |
| -------------------- | ---------------------------- |
| `api.quote.*`        | `api.billing.quote.*`        |
| `api.invoice.*`      | `api.billing.invoice.*`      |
| `api.quote_line.*`   | `api.billing.quote_line.*`   |
| `api.line_item.*`    | `api.billing.line_item.*`    |
| `api.catalog_item.*` | `api.billing.catalog_item.*` |

### Actor Modules (Phase 1.5)

User/identity modules have been reorganized under `actor/`.

| Old Path                | New Path                      |
| ----------------------- | ----------------------------- |
| `api.operator.*`        | `api.actor.operator.*`        |
| `api.operator_invite.*` | `api.actor.operator_invite.*` |
| `api.organization.*`    | `api.actor.organization.*`    |
| `api.tenant.*`          | `api.actor.tenant.*`          |
| `api.tenant_invite.*`   | `api.actor.tenant_invite.*`   |

### Agent Modules (Phase 1.5)

AI/chat system modules have been reorganized under `agent/`.

| Old Path                         | New Path                               |
| -------------------------------- | -------------------------------------- |
| `api.chat.*`                     | `api.agent.chat.*`                     |
| `api.chat_thread.*`              | `api.agent.chat_thread.*`              |
| `api.message_queue.*`            | `api.agent.message_queue.*`            |
| `api.phone_verification.*`       | `api.agent.phone_verification.*`       |
| `api.processed_webhook_events.*` | `api.agent.processed_webhook_events.*` |

### Entity Modules (Phase 1.5)

Business domain entities have been reorganized under `entity/`.

| Old Path               | New Path                      |
| ---------------------- | ----------------------------- |
| `api.data_center.*`    | `api.entity.data_center.*`    |
| `api.energy.*`         | `api.entity.energy.*`         |
| `api.feedback.*`       | `api.entity.feedback.*`       |
| `api.checklist_item.*` | `api.entity.checklist_item.*` |

### Internal API Paths

The same pattern applies to `internal.*` paths:

| Old Path                 | New Path                        |
| ------------------------ | ------------------------------- |
| `internal.quote.*`       | `internal.billing.quote.*`      |
| `internal.operator.*`    | `internal.actor.operator.*`     |
| `internal.chat.*`        | `internal.agent.chat.*`         |
| `internal.data_center.*` | `internal.entity.data_center.*` |

## Import Path Changes

Direct imports from `@gnomos/db/convex` remain unchanged - the package re-exports validators and types from the new locations.

### Within `packages/db/convex/`

Imports should now use direct paths to validators instead of barrel files:

```typescript
// Before
import { Quote } from '../quote'
import { Tenant } from '../tenant'
import { DataCenter } from '../data_center'

// After
import { Quote } from '../billing/quote/validators'
import { Tenant } from '../actor/tenant/validators'
import { DataCenter } from '../entity/data_center/validators'
```

### Frontend Code (`apps/operator/` and `apps/customer/`)

Update API references in convex query/mutation calls:

```typescript
// Before
const quote = useQuery(api.quote.queries.getQuote, { id: quoteId })
const tenant = useQuery(api.tenant.queries.getTenant, { id: tenantId })

// After
const quote = useQuery(api.billing.quote.queries.getQuote, { id: quoteId })
const tenant = useQuery(api.actor.tenant.queries.getTenant, { id: tenantId })
```

## Removed Barrel Files

The following barrel files (index.ts re-exports) were removed. Imports should use direct module paths:

- `convex/quote/index.ts` → Use `convex/billing/quote/validators.ts`
- `convex/invoice/index.ts` → Use `convex/billing/invoice/validators.ts`
- `convex/tenant/index.ts` → Use `convex/actor/tenant/validators.ts`
- `convex/operator/index.ts` → Use `convex/actor/operator/validators.ts`
- `convex/data_center/index.ts` → Use `convex/entity/data_center/validators.ts`
- `convex/integrations/stripe/index.ts` → Use direct imports from `helpers.ts`, `resolver.ts`, `types.ts`
- `convex/integrations/linq/index.ts` → Use direct imports from `client.ts`, `webhook.ts`, `types.ts`

## Retained Index Files

Some index files were retained because they contain actual implementation code or aggregate exports from multiple modules:

- `convex/index.ts` - Package export point for `@gnomos/db/convex`
- `convex/integrations/clerk/index.ts` - Clerk client initialization
- `convex/integrations/resend/index.ts` - Resend client initialization
- `convex/agent/chat/agent/tools/index.ts` - Tool registration with logic
- `convex/analytics/*/helpers/index.ts` - Helper aggregation

## Notes

- This migration is **Phase 1 of 3**. Phase 2 will add the new billing engine alongside the existing system. Phase 3 will swap out the old system.
- All changes are behavior-preserving - no functional changes were made.
- The Convex dev server (`bun run dev:convex`) will regenerate `_generated/api.d.ts` with the new paths after the changes.