Implementation spec: Unified DC financial ops platform (Stripe Connect + Convex)

This spec is an update based on an interview + the existing repo state (see PR.md for the already-implemented Operator Connect onboarding baseline).

0. Glossary (use these terms consistently)

Platform: gnomos (your Connect platform).

Org: a data center organization in gnomos; one org = one Stripe connected account (acct\_...) configured via Accounts v2. See stripe-connect-accounts-v2-api, stripe-connect-accounts-v2-connected-account-configuration.

Tenant: a colo customer who pays an org.

Contract: an org↔tenant agreement that drives ongoing billing; 1 Contract = 1 Stripe Subscription.

Quote: pre-contract pricing proposal; gnomos-native (no Stripe Quotes in MVP).

Direct charges: create customers/subscriptions/invoices on the connected account (org is merchant of record). See stripe-connect-direct-charges, stripe-connect-subscriptions, stripe-connect-auth, stripe-invoicing-connect.

Destination charges: invoice/subscription on platform + transfer to connected account (platform is merchant of record) — documented only as an escape hatch. See stripe-connect-destination-charges, stripe-connect-subscriptions, stripe-invoicing-connect.

Out-of-band payment: money received outside Stripe rails (wire, check, ACH credit). In Stripe, represent this by paying an invoice with paid_out_of_band=true. See stripe-invoice-pay, stripe-invoicing-overview, stripe-invoicing-integration.

1. Product goals (MVP)

1.1 What we are building

Operator workflow: quote → contract → “turn on billing”.

Billing engine: Stripe Billing subscriptions (for recurring/commit items like cross-connects and commit plans).

Variable/custom charges: computed in gnomos and attached to the subscription invoice as invoice items each billing cycle.

Tenant portal: view invoices, add payment method, pay invoices (embedded), with hosted invoice page as fallback.

Stripe Connect onboarding: already implemented (embedded onboarding in Operator UI) and treated as baseline.

1.2 What we are not building (MVP)

Stripe Quotes.

Stripe Customer Portal (MVP portal lives in gnomos).

Destination-charge fallback implementation (only documented).

Stripe meters / usage-based prices (MVP computes variable $ directly).

Multi-org tenant access from a single login (later).

Strong AR/ledger features (partial payments, credit notes, unapplied cash) (later).

2. Stripe architecture

2.1 Tenancy + money flow

One org = one Stripe connected account (acct\_...) (Express).

Default money flow: direct charges (all billing objects created on the connected account using stripeAccount: acct\_... in the server SDK). This corresponds to Connect authenticated requests (Stripe-Account header). See stripe-connect-auth, stripe-connect-stripe-account-header, stripe-connect-using-connected-accounts.

Platform monetization (MVP): no platform fees taken in Stripe; monetize later.

Disputes/refunds/negative balances (MVP): org bears liability (platform avoids merchant-of-record posture). See stripe-connect-risk-management, stripe-disputes, stripe-refunds, stripe-balance, stripe-connect-accounts-v2-connected-account-configuration.

Destination charges exist as a future escape hatch for:

capability/payment-rail mismatch

break-glass ops override

References: stripe-connect-subscriptions, stripe-connect-auth, stripe-invoicing-connect, stripe-connect-direct-charges, stripe-connect-destination-charges.

2.2 Stripe API posture (v2 + v1)

Prefer Stripe API v2 where available (notably Accounts v2); use v1 where v2 doesn’t exist yet (customers, subscriptions, invoices).

Do not pin an explicit API version in code for /v1 endpoints; use the Stripe account’s default versioning behavior. For /v2 endpoints, Stripe SDKs include an API version automatically; if we ever call /v2 via raw HTTP, we must send Stripe-Version. See stripe-api-v2, stripe-versioning-policy.

In the Stripe Node SDK, this means:

v2: stripe.v2.core.\* (Accounts v2)

v1: stripe.customers, stripe.subscriptions, stripe.invoices, etc.

Notes:

Accounts v2 must be enabled for your platform; otherwise v2 endpoints can return “access blocked” style errors. See stripe-connect-accounts-v2-api, stripe-v2-account-links-create.

References: stripe-api-v2, stripe-connect-accounts-v2-api, stripe-v2-accounts, stripe-v2-accounts-create, stripe-v2-accounts-retrieve, stripe-v2-accounts-update, stripe-v2-account-links-create, stripe-connect-accounts-v2-migrate-integration, stripe-versioning-policy, stripe-connect-accounts-v2-connected-account-configuration, stripe-connect-integration-recommendations.

3. Core billing model

3.1 Quote model (or its absence)

Quotes live in Convex and drive approvals and negotiation.

Quote acceptance creates/updates a Contract (system of record).

One-time-only manual invoicing can be driven directly from an approved quote.

3.2 Contract model (system of record)

Contract defines (see at bottom):

parties: organizationId, tenantId

term + renewal (optional)

billing cadence + anchor rules (“contract terms”), not just start date

net terms (due date rule)

pricing components:

subscription items (recurring/commit)

variable charges computed by gnomos and added as invoice items each cycle

3.3 Stripe mapping

One Contract creates:

Stripe Customer on the org’s connected account (if needed) (see stripe-customers-create, stripe-customers-update, stripe-customers-object)

Stripe Subscription on the connected account (see stripe-subscriptions-create, stripe-subscriptions-update, stripe-subscriptions-object)

Subscription configuration (MVP):

collection_method=send_invoice (net terms) (see stripe-billing-collection-method)

proration is allowed for operator-driven subscription changes (nice-to-have; default Stripe behavior) (see stripe-billing-prorations)

Reference: stripe-connect-subscriptions.

4. Invoice generation + custom charge attachment (the critical loop)

4.1 Subscription invoices are the “base invoice”

Stripe generates the draft invoice for each subscription billing period.

Stripe is the lifecycle source-of-truth; Convex mirrors state via webhooks.

Reference: stripe-subscription-invoices, stripe-invoices-api, stripe-invoice-object.

4.2 Attaching custom/variable charges to the subscription invoice

MVP requirement: computed “custom model” charges must land on the same invoice Stripe generates for the subscription. $

Recommended approach:

On invoice.created (subscription invoice), immediately “pause” the invoice by setting auto_advance=false to prevent Stripe from finalizing/sending automatically (see stripe-invoices-update).

Compute contract-period charges in gnomos (commit/overage + any custom models).

Create Stripe invoice items targeting that invoice (pass the invoice param) (see stripe-invoice-items-create).

Finalize the invoice once all custom items are attached (see stripe-invoices-finalize).

Send the invoice email from gnomos (include hosted invoice link + in-app payment CTA).

This yields deterministic “we attached everything before finalization” behavior, and keeps Stripe as the status source-of-truth.

Note: Stripe already delays invoice finalization/collection when webhooks don’t acknowledge invoice.created successfully, but we still set auto_advance=false to make the “attachment window” explicit and controlled. See stripe-billing-subscriptions-webhooks, stripe-invoices-api, stripe-invoicing-workflow-transitions, stripe-event-types.

Correction policy (MVP):

If late/corrected usage arrives for a prior period, apply a roll-forward adjustment on the next invoice (do not rewrite historical invoices). Retro corrections are deferred.

4.3 Invoice email delivery (MVP)

gnomos sends invoice emails (not Stripe).

Stripe hosted invoice page (hosted_invoice_url) is included as fallback, and also useful for “view in Stripe”.

References: stripe-invoicing-send-email, stripe-invoice-object, stripe-hosted-invoice-page.

5. Tenant payment UX (embedded primary, hosted fallback)

We do what we can on operator side first.

5.1 Card/ACH debit (Stripe rails, in-app)

MVP payment pattern is SetupIntent-first:

Tenant adds a payment method in-app via SetupIntent (Payment Element). (See stripe-setup-intents, stripe-setup-intents-create, stripe-payment-element.)

Tenant clicks “Pay invoice”.

Server calls stripe.invoices.pay(invoiceId, { payment_method }) on the connected account. (See stripe-invoice-pay.)

Stripe emits invoice/payment events; Convex mirrors them.

References: stripe-paymentmethods-create, stripe-paymentmethods-attach, stripe-paymentmethod-object, stripe-ach, stripe-bank-debits.

5.2 Wire/check/ACH credit (out-of-band)

Tenant pays outside Stripe rails (wire/check/ACH credit).

Operator marks the Stripe invoice paid out-of-band:

stripe.invoices.pay(invoiceId, { paid_out_of_band: true })

For MVP, record minimal metadata (free-form note). Later, require remittance reference + received date + attachment.

References: stripe-invoice-pay, stripe-invoicing-overview, stripe-invoicing-integration.

6. Webhooks + synchronization (Convex)

Use Convex HTTP Actions for Stripe webhooks (already implemented patterns exist in packages/db/convex/integrations/stripe/webhook.ts).

MVP event set:

Connect: account.updated (keep org Stripe status fresh)

Customers: customer.updated (default payment method changes)

Invoices: invoice.created, invoice.finalized, invoice.paid, invoice.payment_failed, invoice.voided

Payments: payment_intent.succeeded, payment_intent.payment_failed

Important behavior note: out-of-band invoice payment triggers invoice.paid, but not invoice.payment_succeeded. See stripe-invoicing-integration.

References: stripe-webhooks-quickstart, stripe-webhooks-signatures, stripe-events, stripe-event-types, stripe-billing-subscriptions-webhooks, stripe-invoicing-integration.

7. Data model (Convex) — delta from current repo

This repo already has: organizations, tenants, quotes, invoices, line items, and Stripe sync primitives.

Add (MVP):

contracts (org↔tenant, contract terms, Stripe subscription IDs)

contractPricingComponents (recurring/commit components + variable pricing definitions)

usageDailyAggregates (daily aggregates used for month-end rating)

billingRuns / invoiceAttachmentJobs (idempotency for “attach computed items to invoice X”)

Guiding principle: Stripe remains the invoice lifecycle truth; Convex stores derived state + internal workflow state.

7.1 Example: contracts schema (Convex)

Example table definition (mirrors the existing Table(...) pattern used in this repo, e.g. packages/db/convex/quote/validators.ts):

import { Table } from 'convex-helpers/server'
import { Infer, v } from 'convex/values'
import { Organization } from '../organization'
import { Tenant } from '../tenant'

export const vContractStatus = v.union(
v.literal('Draft'),
v.literal('Active'),
v.literal('Canceled')
)

export const vBillingCadence = v.union(
v.literal('Monthly'),
v.literal('Quarterly'),
v.literal('Annual')
)

export const Contract = Table('contracts', {
organizationId: Organization.\_id,
tenantId: Tenant.\_id,

status: vContractStatus,

// Contract term
startDate: v.number(),
endDate: v.optional(v.number()),
autoRenew: v.optional(v.boolean()),

billing: v.object({
cadence: vBillingCadence,
billingCycleAnchor: v.object({
type: v.union(v.literal('ContractStart'), v.literal('DayOfMonth')),
dayOfMonth: v.optional(v.number()),
}),
netTermsDays: v.number(),
}),

// Stripe mapping (direct charges on connected account)
stripe: v.object({
stripeCustomerId: v.optional(v.string()),
stripeSubscriptionId: v.optional(v.string()),
}),

activatedAt: v.optional(v.number()),
canceledAt: v.optional(v.number()),
})

export type TContract = Infer<typeof Contract.doc>