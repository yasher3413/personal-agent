# Billing System Implementation

This document describes the billing system architecture for the Gnomos platform.

## Overview

The billing system manages billing agreements (Contracts) between data center operators (Organizations) and their customers (Tenants). It integrates with Stripe for subscription management and invoice processing using Stripe Connect with direct charges.

## Currency Convention

> **📋 Future Migration:** We plan to migrate ALL monetary amounts to **cents** in a future update for consistency with Stripe and to avoid conversion errors. For now, the quoting system uses dollars while the billing system uses cents.

The system currently uses **two different currency conventions** depending on where you are in the workflow:

| System             | Currency Unit | Reason                                 |
| ------------------ | ------------- | -------------------------------------- |
| **Quoting System** | DOLLARS       | Operator-friendly (easy to read/enter) |
| **Billing System** | CENTS         | Stripe-aligned (no conversion needed)  |

### System Boundary

```
DOLLARS                                    CENTS
───────────────────────────────────────────────────────────────────
CatalogItem → QuoteLine → Quote approved → PricingComponent → ContractCharge → Stripe
                               │
                               └── Conversion point: multiply by 100
```

### Quoting System (DOLLARS)

These entities store amounts in **dollars** for operator convenience:

| Entity      | Field       | Example          | Location               |
| ----------- | ----------- | ---------------- | ---------------------- |
| CatalogItem | `unitPrice` | 500 = $500.00    | `convex/catalog_item/` |
| QuoteLine   | `unitPrice` | 500 = $500.00    | `convex/quote_line/`   |
| QuoteLine   | `amount`    | 1500 = $1,500.00 | `convex/quote_line/`   |
| LineItem    | `unitPrice` | 500 = $500.00    | `convex/line_item/`    |
| LineItem    | `amount`    | 864 = $864.00    | `convex/line_item/`    |

When calling Stripe from the quoting/invoicing system, amounts must be converted:

```typescript
// LineItem.amount is in DOLLARS - convert to cents for Stripe
const stripeInvoice = await createStripeInvoice({
  lineItems: lineItems.map((li) => ({
    amountCents: Math.round(li.amount * 100), // Convert dollars → cents
    // ...
  })),
})
```

### Billing System (CENTS)

These entities store amounts in **cents** to match Stripe:

| Entity                     | Field         | Example         | Location                          |
| -------------------------- | ------------- | --------------- | --------------------------------- |
| PricingComponent           | `unitPrice`   | 50000 = $500.00 | Embedded in Contract              |
| PricingComponent (overage) | `unitPrice`   | 12 = $0.12      | Embedded in Contract              |
| ContractCharge             | `unitPrice`   | 50000 = $500.00 | `convex/billing/contract_charge/` |
| ContractCharge             | `amount`      | 86400 = $864.00 | `convex/billing/contract_charge/` |
| TCreateInvoice             | `amountCents` | 50000 = $500.00 | `integrations/stripe/types.ts`    |
| TInvoiceItem               | `amountCents` | 86400 = $864.00 | `integrations/stripe/types.ts`    |

No conversion needed when calling Stripe from the billing system:

```typescript
// ContractCharge.amount is already in CENTS - pass directly
await attachStripeInvoiceItem(stripeAccountId, invoiceId, {
  amountCents: charge.amount, // No conversion needed
  // ...
})
```

### Conversion: Quote → Contract

When a Quote is approved and becomes a Contract, amounts are converted from dollars to cents:

```typescript
// In convertQuoteLinesToPricingComponents()
const pricingComponent = {
  // QuoteLine.unitPrice is in dollars, PricingComponent.unitPrice is in cents
  basePricing: {
    unitPrice: Math.round(quoteLine.unitPrice * 100), // $500 → 50000
  },
  // ...
}
```

### Converting for Display

When displaying billing system amounts (cents) to users, convert to dollars:

```typescript
const displayAmount = (cents: number, currency = 'USD') =>
  (cents / 100).toLocaleString(undefined, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  })

displayAmount(86400) // "$864.00"
displayAmount(12) // "$0.12"
```

### Summary Table

| Action                  | From    | To      | Conversion |
| ----------------------- | ------- | ------- | ---------- |
| Quote → Contract        | Dollars | Cents   | `× 100`    |
| LineItem → Stripe       | Dollars | Cents   | `× 100`    |
| ContractCharge → Stripe | Cents   | Cents   | None       |
| Display billing amounts | Cents   | Dollars | `÷ 100`    |

## Implementation Status

| Feature                  | Status         | Description                      |
| ------------------------ | -------------- | -------------------------------- |
| Contract Creation        | ✅ Complete    | From quote or manual             |
| Contract Activation      | ✅ Complete    | Creates real Stripe subscription |
| Contract Cancellation    | ✅ Complete    | Cancels Stripe subscription      |
| Billing Run Processing   | ✅ Complete    | Pause → Attach → Finalize        |
| Billing Config Sync      | ✅ Complete    | Syncs changes to Stripe          |
| Webhook Handling         | ✅ Complete    | Full invoice lifecycle           |
| Payment Failure Handling | ✅ Complete    | Structured logging               |
| Account Disconnect       | ✅ Complete    | Marks account disconnected       |
| Flat Pricing             | ✅ Complete    | Fixed price model                |
| Indexed Pricing          | 📋 Schema only | Future enhancement               |
| Tiered Pricing           | 📋 Schema only | Future enhancement               |

## Architecture

```
Quote → Contract (with PricingComponents) → ContractCharges → Invoice
             ↓
       Stripe Subscription (real)
             ↓
       invoice.created webhook
             ↓
       BillingRun → Pause → Attach charges → Finalize
```

## Entity Hierarchy

```
Contract
  └── pricingComponents[] (embedded)
        ├── Recurring → Stripe Product + Price + SubscriptionItem
        ├── Commit → Base + Overage charges
        └── Usage → Per-cycle computed charges

ContractCharge
  └── Created each billing cycle
  └── Attached to Stripe invoice as InvoiceItem

BillingRun
  └── Tracks charge attachment to invoice
  └── Ensures idempotency
```

## Core Entities

### Contract

The core billing agreement between an Organization and a Tenant.

**Location:** `packages/db/convex/billing/contract/`

**Key Fields:**

- `organizationId`: The data center operator (Stripe connected account)
- `tenantId`: The customer being billed
- `dataCenterId`: The facility for this contract
- `status`: Draft → Active → Canceled
- `billing`: Cadence, cycle anchor, net terms, currency
- `pricingComponents`: Embedded array of pricing rules
- `stripe`: Stripe subscription mapping (real IDs)

**Lifecycle:**

1. **Draft**: Contract created (from quote or manually). No Stripe subscription.
2. **Active**: Stripe subscription provisioned with real subscription ID. Billing enabled.
3. **Canceled**: Billing stopped. Stripe subscription canceled.

### PricingComponent (Embedded in Contract)

Defines billing rules that generate charges each cycle.

**Component Types:**

| Type      | Description              | Stripe Mapping                                 |
| --------- | ------------------------ | ---------------------------------------------- |
| Recurring | Fixed charge each cycle  | Stripe Product + Price + SubscriptionItem      |
| Commit    | Base + overage potential | Base may be SubscriptionItem, overage computed |
| Usage     | Fully usage-based        | Always computed per-cycle                      |

**Pricing Models:**

| Model   | Status         | Description                         |
| ------- | -------------- | ----------------------------------- |
| Flat    | ✅ Implemented | Fixed price at contract time        |
| Indexed | 📋 Schema only | Price from rate table at usage time |
| Tiered  | 📋 Schema only | Volume-based pricing                |

### ContractCharge

Actual charge instances for specific billing periods.

**Location:** `packages/db/convex/billing/contract_charge/`

**Key Fields:**

- `contractId`: Parent contract
- `pricingComponentId`: Source component (null for manual charges)
- `periodStart`/`periodEnd`: Billing period
- `description`, `quantity`, `unitPrice`, `amount`, `currency`
- `status`: Pending → Attached → Invoiced (or Canceled)
- `source`: Manual, Computed, or Imported
- `stripeInvoiceItemId`: Real Stripe InvoiceItem ID when attached

**Status Lifecycle:**

1. **Pending**: Created, awaiting next billing run
2. **Attached**: Added to Stripe invoice as real InvoiceItem
3. **Invoiced**: Invoice finalized - charge is immutable
4. **Canceled**: Removed before attachment

### BillingRun

Tracks the process of attaching charges to Stripe invoices.

**Location:** `packages/db/convex/billing/run/`

**Purpose:**

- Ensures idempotency (stripeInvoiceId lookup)
- Tracks processing state
- Links charges to invoices

**Status Lifecycle:**

1. **Pending**: Invoice created, awaiting processing
2. **Processing**: Currently attaching charges via Stripe API
3. **Completed**: All charges attached, invoice finalized
4. **Failed**: Error occurred (can retry)

## Key Flows

### 1. Contract Creation from Quote

```typescript
// 1. Quote approved
// 2. Call createContractFromQuote action
const contractId = await ctx.runAction(
  api.billing.contract.createContractFromQuote,
  {
    quoteId: 'quote_abc',
    billing: {
      cadence: 'Monthly',
      billingCycleAnchor: { type: 'DayOfMonth', dayOfMonth: 1 },
      netTermsDays: 30,
      currency: 'USD',
    },
    startDate: Date.now(),
    autoRenew: true,
  },
)
```

**Flow:**

1. Validate quote is approved
2. Fetch quote lines
3. Convert MRC lines to pricing components
4. Create contract in Draft status

### 2. Contract Activation (Stripe Integration)

```typescript
// Activate contract and provision Stripe subscription
const contractId = await ctx.runAction(api.billing.contract.activateContract, {
  contractId: 'contract_123',
})
```

**Flow:**

1. Validate contract is in Draft status
2. Ensure tenant has Stripe customer on connected account
3. For each Recurring component:
   - Create Stripe Product
   - Create Stripe Price with billing interval
4. Create Stripe Subscription with all price IDs
5. Update contract to Active with real Stripe subscription ID

### 3. Contract Cancellation (Stripe Integration)

```typescript
// Cancel contract and Stripe subscription
await ctx.runAction(api.billing.contract.cancelContractWithStripe, {
  contractId: 'contract_123',
  cancelImmediately: false, // or true for immediate cancellation
})
```

**Flow:**

1. Validate contract can be canceled
2. If Active with subscription, call `cancelStripeSubscription`:
   - `cancelImmediately: true` → Immediate cancellation
   - `cancelImmediately: false` → Cancel at period end
3. Update contract to Canceled status

### 4. Billing Config Sync

When billing configuration changes on an Active contract, changes are synced to Stripe:

```typescript
// Update contract billing config
await ctx.runMutation(api.billing.contract.updateContract, {
  id: contractId,
  patch: {
    billing: { netTermsDays: 45, ... }
  }
});
// Automatically schedules syncSubscriptionToStripe action
```

**Synced Fields:**

- `days_until_due` (net terms)
- `collection_method`

### 5. Manual Charge Creation

```typescript
// Operator adds a custom charge
const chargeId = await ctx.runMutation(
  api.billing.contract_charge.createCharge,
  {
    contractId: 'contract_123',
    periodStart: 1704067200000,
    periodEnd: 1706745600000,
    description: 'Cross-connect installation - Port A1',
    quantity: 1,
    unitPrice: 250,
  },
)
```

### 6. Billing Run Processing (Stripe Integration)

Triggered automatically by `invoice.created` webhook:

```
1. Stripe generates subscription invoice
2. invoice.created webhook fires
3. handleSubscriptionInvoiceCreated called
4. BillingRun created (or existing found via stripeInvoiceId)
5. processBillingRun action executes:
   a. pauseStripeInvoice() - Set auto_advance=false
   b. For each pending charge:
      - attachStripeInvoiceItem() - Create real InvoiceItem
      - Store stripeInvoiceItemId on charge
   c. finalizeStripeInvoice() - Finalize for collection
6. Charges marked as Invoiced
7. BillingRun marked as Completed
```

## Module Structure

```
packages/db/convex/billing/
├── contract/               # Core contract entity
│   ├── validators.ts       # Contract, PricingComponent schemas
│   ├── queries.ts          # getById, listByOrganization, etc.
│   ├── mutations.ts        # CRUD + pricing component management + Stripe sync scheduling
│   ├── actions.ts          # createContractFromQuote, activateContract, cancelContractWithStripe, syncSubscriptionToStripe
│   ├── helpers.ts          # Period calculation, quote conversion, Stripe helpers
│   └── index.ts            # Re-exports
│
├── contract_charge/        # Per-cycle charge instances
│   ├── validators.ts       # ContractCharge schema
│   ├── queries.ts          # Query functions
│   ├── mutations.ts        # CRUD + billing run mutations
│   ├── helpers.ts          # Amount calculations, currency formatting
│   └── index.ts            # Re-exports
│
├── run/                    # Billing run orchestration
│   ├── validators.ts       # BillingRun schema
│   ├── queries.ts          # Query functions
│   ├── mutations.ts        # Status management
│   ├── actions.ts          # processBillingRun (with real Stripe calls)
│   ├── helpers.ts          # Utility functions
│   └── index.ts            # Re-exports
│
├── rate_table/             # For indexed pricing (stub)
│   ├── validators.ts       # RateTable, RateEntry schemas
│   └── index.ts            # Re-exports + stub helpers
│
├── usage_record/           # For timestamped usage (stub)
│   ├── validators.ts       # UsageRecord schema
│   └── index.ts            # Re-exports + stub helpers
│
├── usage_source/           # For external data (stub)
│   ├── validators.ts       # UsageSource schema
│   └── index.ts            # Re-exports + stub helpers
│
└── index.ts                # Main module re-exports
```

## Stripe Integration

### Direct Charges Model

All billing uses Stripe's direct charges model on connected accounts:

- Subscriptions created on the organization's connected account
- Invoices sent from the organization to the tenant
- Payments go directly to the connected account
- Uses `stripeAccount` header for all API calls

### Key Stripe Helpers

Located in `packages/db/convex/integrations/stripe/helpers.ts`:

| Helper                       | Description                                         |
| ---------------------------- | --------------------------------------------------- |
| `createStripeProduct()`      | Create product on connected account                 |
| `createStripePrice()`        | Create recurring price for product                  |
| `createStripeSubscription()` | Create subscription with price items                |
| `cancelStripeSubscription()` | Cancel immediately or at period end                 |
| `pauseStripeInvoice()`       | Set auto_advance=false to prevent auto-finalization |
| `attachStripeInvoiceItem()`  | Add InvoiceItem to invoice                          |
| `finalizeStripeInvoice()`    | Finalize invoice for collection                     |

### Webhook Handling

Located in `packages/db/convex/integrations/stripe/webhook.ts`:

**Handled Events:**

- `account.updated` - Sync account status
- `account.application.deauthorized` - Mark account disconnected
- `invoice.created` - Trigger billing run
- `invoice.finalized`, `invoice.paid`, `invoice.payment_failed` - Sync invoice status
- `payment_intent.succeeded`, `payment_intent.payment_failed` - Handle payments

**Key Handlers:**

```typescript
// invoice.created triggers billing run
case "invoice.created": {
  await syncInvoiceToConvex(ctx, invoice, stripeAccountId);
  await handleSubscriptionInvoiceCreated(ctx, invoice, stripeAccountId);
  break;
}

// account.application.deauthorized marks account disconnected
case "account.application.deauthorized": {
  if (stripeAccountId) {
    await ctx.runMutation(
      internal.organization.mutations.markStripeDisconnected,
      { stripeAccountId }
    );
  }
  break;
}
```

### Error Handling

Payment failures and errors are logged with structured JSON for monitoring:

```typescript
console.error(
  JSON.stringify({
    level: 'warning',
    event: 'payment_intent.payment_failed',
    message: 'Payment failed for invoice',
    context: {
      paymentIntentId,
      invoiceId,
      errorMessage,
      errorCode,
      failedAt: Date.now(),
    },
  }),
)
```

## Future Enhancements

### Indexed/Dynamic Pricing

Schema is ready for indexed pricing where rates are determined at time of usage:

- **RateTables**: Store historical rate data
- **RateEntries**: Individual rate values with timestamps
- **UsageRecords**: Timestamped usage data
- **UsageSources**: External API integration

**Calculation:** `sum(usage_at_time_t × rate_at_time_t)` for all timestamps

### Automated Usage Import

The `UsageSource` entity supports future pull-based integration:

1. Configure external API in UsageSource
2. System pulls usage data periodically
3. Creates UsageRecords with timestamps
4. Billing calculates charges from records

### Sentry Integration

Error handling is ready for Sentry integration. Replace structured `console.error` calls with:

```typescript
import * as Sentry from '@sentry/node'

Sentry.captureMessage('Invoice missing stripeInvoiceId', {
  level: 'warning',
  extra: { invoiceId, paymentIntentId },
})
```

### Payment Failure Notifications

Skeleton is in place for payment failure notifications:

```typescript
// In handlePaymentIntentFailed:
// await ctx.scheduler.runAfter(0, internal.notifications.sendPaymentFailedEmail, {
//   invoiceId,
//   tenantId: invoice.tenantId,
//   organizationId: invoice.organizationId,
//   errorMessage,
// });
```

## Best Practices

### Adding Return Types

All Convex handlers require explicit return types to avoid TypeScript instantiation errors:

```typescript
// ✅ Correct
handler: async (ctx, args): Promise<Id<'contracts'>> => {
  // ...
}

// ❌ Will cause TypeScript errors
handler: async (ctx, args) => {
  // ...
}
```

### Typing runQuery/runMutation

Always type the result of `ctx.runQuery` and `ctx.runMutation`:

```typescript
const contract: TContract | null = await ctx.runQuery(
  internal.billing.contract.queries.getByIdInternal,
  { id: contractId },
)
```

### Idempotency

All billing operations should be idempotent:

- BillingRun uses `stripeInvoiceId` for lookup
- `getOrCreate` pattern for billing runs
- Check charge status before attaching
- Stripe API calls are idempotent by design

### Currency Handling

The billing system uses **cents** while the quoting system uses **dollars** (see [Currency Convention](#currency-convention) above).

When working with the billing system (Contract, PricingComponent, ContractCharge):

```typescript
// unitPriceCents is in cents - function converts to dollars for display
formatOverageDescription(
  componentName,
  overageQuantity,
  unit,
  unitPriceCents, // e.g., 12 = $0.12
  currency, // Uses contract's currency (e.g., "USD")
)
// Returns: "Power Overage (7,200 kWh @ $0.12)"
```

When working with the quoting system (CatalogItem, QuoteLine, LineItem), amounts are already in dollars and must be converted to cents before sending to Stripe.