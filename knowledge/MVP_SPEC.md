# Problem intro

First, an introduction to the problem we’re solving: data centers are a commercial real estate business where an entity negotiates a space and an associated energy (and often connectivity) contract to that space and then rents out that space to tenants with hardware needs.

A lot of the financial side of this business is currently ran through Excel spreadsheets, PDFs, some accounting with QuickBooks/Xero and payments by WIRE, with bank info shared through emails. We’re unifying all of those with a dash of specialization for a data center business.

# What we're making here

Unified platform for all data center financial operations. This includes:

quote creation, approvals

contract creation automation (from quotes, otherwise)

quote to invoicing flows

contract to billing flows

metered billing options

automatic invoicing & reconciliation

payment rails for invoices

An operator logs onto the platform and is greeted with a dashboard displaying relevant metrics. From there, the operator can do all of the above.

This means, internally, the software is multi-tenant. Each operator is part of a larger organization (responsible for the data center) and has access to required flows.

There is also a customer portal provided, which allows data center colo tenants to view some live metrics and pay their invoices.

Payment should be routed tenant ↔ colo DC org.

# Reference baseline (from Monite)

We’re essentially rebuilding the AR + payments + reconciliation parts of an embedded finance platform, but specialized for compute. Monite’s own overview frames the domains as Invoicing/AR, Payments, Platform, plus async workflows via queues/workers and a customizable frontend SDK approach, good architectural inspiration for how we modularize.

## 1) Accounts Receivable / Invoicing (MVP / P0)

Monite “AR / Invoicing” → Gnomos “Quote-to-Cash”

Quote lifecycle: draft → approvals → sent → accepted/declined

Contract creation from accepted quote (and manual contract creation as backup)

Metered billing options + recurring base charges (reserved) + usage overages (spot/reserved)

Invoice generation (itemized, auditable) + immutable PDF snapshots

Credit notes + adjustments (disputes, cancellations)

Reminders / collections (payment reminders + overdue reminders)

## 2) Payments acceptance (MVP / P0, with staged methods)

Monite “Payment Links + Payment Page” → Gnomos “Pay Invoice”

Hosted pay page per invoice + shareable payment link

Cards + ACH initially

Payment status engine (pending/paid/failed/refunded/disputed)

Optional: wallets + BNPL (Nice-to-have)

## 3) Reconciliation (MVP / P0)

Monite “Payment Reconciliation” → Gnomos “Auto-match Payments”

Auto-reconcile payment ↔ invoice

Normalization of payment references

Manual reconciliation UI for exceptions

## 4) Approval policies (MVP / P0)

Monite “Approval policies” → Gnomos “Approvals”

Skip approvals (small org) OR enable policy-driven approvals:

triggers (discount %, term length, margin floor, SLA tier)

approver routing (role-based + amount-based)

notifications

## 5) Accounting + CRM integrations (P1, design now)

Monite “Accounting integrations push/pull” → Gnomos “Connectors”

Accounting: QuickBooks / Xero early, NetSuite later (or pilot-driven)

CRM: Salesforce (quote + contract status sync)

DCIM / CIV / telemetry ingestion (usage + power/thermal)

## 6) What we do not take from Monite in Phase 1 (White / Out of scope)

Full Accounts Payable / BillPay

Expense management

E-invoicing compliance networks

Invoice financing / lending rails (later)

# 1) Users & roles

## Operator org (internal)

Sales Rep: create quotes, send to tenant, request approvals

Sales Manager: approves discount/term exceptions

Finance: billing runs, invoice issuance, reconciliation, credits, disputes

Ops: metering/usage validation, SLA tracking, anomaly review

Admin: org settings, integrations, policies

## Tenant org (customer)

Tenant Admin: payment methods, pay invoices, disputes, download documents

Tenant Viewer: view usage + invoices

# 2) End-to-end workflows (system of record)

Workflow 1: Quote → Contract (Operator)

Sales rep creates quote (spot/reserved) from catalog + pricing engine snapshot

Quote goes through approvals (if policy triggered)

Quote sent via share link/email + tenant portal

Tenant accepts → contract auto-created (versioned terms + pricing snapshot stored)

Workflow 2: Metering → Rating → Invoice (Operator)

Usage ingested (telemetry/DCIM/CIV, or CSV for MVP fallback)

Usage validated (missing intervals, anomalies flagged)

Rating engine computes charges:

Reserved: recurring base + SLA adders + overages

Spot: interval-based usage priced dynamically (with stored benchmark inputs)

Finance runs billing:

dry run preview → lock run → invoices generated (PDF snapshot)

Workflow 3: Pay → Reconcile → Close loop (Tenant ↔ Operator)

Tenant views invoice breakdown + drilldowns (GPU-hour, kWh, etc.)

Tenant pays via hosted pay page / link (card/ACH)

Payment status updates in real-time

Auto-reconcile payment ↔ invoice; exceptions handled manually

Dispute path: dispute opened → credit note/adjustment → re-issue invoice if needed

# 5) Functional requirements (comprehensive, prioritized)

## P0 (MVP must-have)

Operator Setup & Governance

Multi-tenant org model (operator orgs, tenant customers)

RBAC + audit log for any financial action

Branding + invoice identity settings

Customer catalog CRUD

Compute catalog CRUD (SKUs + adders)

Currencies + basic taxes

Invoice numbering + compliance flags + PDF language

## Quoting

Quote builder (spot + reserved)

Quote versioning + expiry + assumptions snapshot

Approval workflow + audit trail

Quote delivery (portal + PDF)

## Contracting

Auto-contract creation from accepted quote

Manual contract creation/editing (restricted permissions)

Amendments (minimal “superseding quote” model)

## Metering + Rating

Usage event model + ingestion pipeline (CSV + 1 real connector)

Usage validation + anomaly flags

Rating engine v0 (benchmarked pricing model interface + stored snapshot)

## Invoicing + Adjustments

Billing runs (manual trigger + scheduled)

Invoice creation + immutable PDF snapshot + itemized lines

Credit notes (create, send, PDF, apply)

Payment reminders + overdue reminders

## Payments + Reconciliation

Hosted pay page + invoice payment link

Cards + ACH

Payment status engine + webhook handling

Auto-reconcile payments to invoices + manual match

Disputes tracking

## Tenant Portal

Invoice list + invoice detail drilldown

Pay invoice + payment history

Dispute initiation + document downloads

# P1 (Nice-to-have / Pilot-driven)

Advanced recurring schedules + proration edge cases

Delivery notes / usage statements packaged for procurement

Rich collections workflows (dunning sequences, escalation)

Deep accounting integrations push/pull

Salesforce bidirectional sync

Agentic interface in WhatsApp/iMessage (command + approvals + audit)

“Gnomos as team member/bookkeeper” ingestion of inbox + historical invoices (requires careful permissions + legal/security posture)

# 6) Non-functional requirements (what keeps us enterprise-grade)

Monite’s tech overview is a useful bar for reliability/security expectations (even if we don’t implement everything Day 1): they target uptime + p99 latency targets and define RPO/RTO. 

NFRs for MVP

Auditability: immutable invoice PDFs + versioned pricing assumptions

Security: encryption at rest + transit, secrets mgmt, least-privilege RBAC

Reliability targets: 99.9% service uptime target for pilot; background job retries + dead-letter

Performance: keep quote generation + invoice rendering responsive under load

Data integrity: idempotent ingestion + deterministic rating runs

Architecture direction (inspired by Monite, but lean)

Monite describes microservices by domain behind an API gateway with async flows via RabbitMQ/workers and a React SDK approach. 
For Gnomos MVP: start as a modular monolith (domains + event bus + job queue) and graduate services later once workflows stabilize.

# 7) Data model (minimum set that makes the product “real”)

Org (Operator org)

User / Role / Permission

Customer (Tenant org + billing contacts)

CatalogItem (GPU/CPU/storage/kWh/cooling/etc.)

Quote (+ versions, approvals, assumptions snapshot)

Contract (+ terms, SLA, pricing model refs)

UsageEvent (immutable, dimensioned)

RatingRun (inputs, outputs, hashes, versioned algo ID)

Invoice (+ line items + PDF artifact + status)

CreditNote (+ references invoice lines)

Payment (+ provider refs, status)

ReconciliationMatch (payment ↔ invoice)

Dispute (+ evidence)

# 8) Success metrics

Product:

Time to generate a quote

Quote → contract conversion rate

Invoice accuracy (manual adjustments avoided)

Business:

Revenue processed through Gnomos

Active operators onboarded

Retention of operators and tenants

Open Questions / Risks:

Standardization of usage data across providers

Pricing model complexity vs usability

Payment risk and chargebacks

Regulatory implications at scale

# 9) Definition of Done (MVP)

Operators can quote, bill, and get paid end-to-end

Tenants can clearly understand and pay for compute usage

System replaces spreadsheets + manual invoicing workflows

Ready for first production customers