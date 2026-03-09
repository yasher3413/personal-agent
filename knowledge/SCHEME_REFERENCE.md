# Convex Database Schema Reference

This document provides a complete overview of all tables and their fields in the Convex database.

## Table of Contents

- [Tenants](#tenants)
- [Invoices](#invoices)
- [Quotes](#quotes)
- [Quote Line Items](#quote-line-items)
- [Line Items](#line-items)
- [Catalog Items](#catalog-items)
- [Data Centers](#data-centers)

---

## Tenants

**Table Name:** `tenants`  
**File:** `convex/tenant/validators.ts`

### Core Fields

| Field            | Type                                       | Required | Description                                              |
| ---------------- | ------------------------------------------ | -------- | -------------------------------------------------------- |
| `clerkUserId`    | `string`                                   | ❌       | Clerk user ID from customer UI                           |
| `organizationId` | `Id<"organizations">`                      | ✅       | Reference to the organization the tenant belongs to      |
| `dataCenterIds`  | `Id<"dataCenters">[]`                      | ✅       | References to data centers the tenant is associated with |
| `name`           | `string`                                   | ✅       | Tenant/customer name                                     |
| `email`          | `string`                                   | ✅       | Tenant email                                             |
| `phone`          | `string`                                   | ❌       | Tenant phone number                                      |
| `type`           | `"Enterprise" \| "Scale-up" \| "Research"` | ✅       | Tenant type classification                               |
| `status`         | `"Active" \| "Inactive"`                   | ✅       | Current status                                           |
| `contractStart`  | `number`                                   | ✅       | Contract start date (timestamp in milliseconds)          |
| `billingCountry` | `string`                                   | ✅       | Billing country code (e.g., "US", "CA")                  |
| `taxExempt`      | `boolean`                                  | ✅       | Whether tenant is tax exempt                             |
| `partnerCode`    | `string`                                   | ❌       | Partner referral code                                    |

### Nested Objects

#### `billingProfile` (required)

| Field             | Type     | Description                              |
| ----------------- | -------- | ---------------------------------------- |
| `billDay`         | `number` | Day of month to bill (1-31)              |
| `paymentTerms`    | `string` | Payment terms (e.g., "Net 30", "Net 15") |
| `taxJurisdiction` | `string` | Tax jurisdiction (e.g., "US-CA", "CA")   |
| `currency`        | `string` | Currency code (e.g., "USD", "CAD")       |

#### `contacts` (required)

Array of contact objects:
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | `string` | ✅ | Contact type (e.g., "Primary", "Billing", "Technical") |
| `name` | `string` | ✅ | Contact name |
| `email` | `string` | ✅ | Contact email |
| `phone` | `string` | ❌ | Contact phone number |

#### `billingAddress` (required)

| Field          | Type     | Required | Description           |
| -------------- | -------- | -------- | --------------------- |
| `addressLine1` | `string` | ✅       | Street address line 1 |
| `addressLine2` | `string` | ❌       | Street address line 2 |
| `city`         | `string` | ✅       | City                  |
| `state`        | `string` | ✅       | State/province        |
| `zip`          | `string` | ✅       | ZIP/postal code       |
| `country`      | `string` | ✅       | Country code          |

#### `financials` (optional)

| Field                  | Type     | Required | Description           |
| ---------------------- | -------- | -------- | --------------------- |
| `creditLimit`          | `number` | ❌       | Credit limit amount   |
| `balanceDue`           | `number` | ✅       | Current balance due   |
| `aging.bucket_0_30`    | `number` | ✅       | Amount due 0-30 days  |
| `aging.bucket_31_60`   | `number` | ✅       | Amount due 31-60 days |
| `aging.bucket_61_90`   | `number` | ✅       | Amount due 61-90 days |
| `aging.bucket_90_plus` | `number` | ✅       | Amount due 90+ days   |

#### `paymentMethods` (optional)

Array of payment method objects:
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `pmId` | `string` | ✅ | Payment method ID |
| `type` | `string` | ✅ | Payment type ("Card", "ACH", "Wire") |
| `last4` | `string` | ❌ | Last 4 digits (for cards) |
| `brand` | `string` | ❌ | Card brand (e.g., "Visa", "Mastercard") |
| `isDefault` | `boolean` | ✅ | Whether this is the default payment method |

#### `links` (optional)

| Field       | Type       | Description           |
| ----------- | ---------- | --------------------- |
| `contracts` | `string[]` | Array of contract IDs |
| `meters`    | `string[]` | Array of meter IDs    |

#### `stripeCustomer` (optional)

| Field                    | Type                  | Required | Description               |
| ------------------------ | --------------------- | -------- | ------------------------- |
| `stripeAccountId`        | `string`              | ✅       | Stripe Connect account ID |
| `stripeCustomerId`       | `string`              | ✅       | Stripe customer ID        |
| `defaultPaymentMethodId` | `string`              | ❌       | Default payment method ID |
| `syncedAt`               | `number`              | ✅       | Last sync timestamp       |
| `syncSource`             | `"local" \| "stripe"` | ✅       | Source of last sync       |

### Metadata Fields

| Field         | Type                     | Required | Description                                     |
| ------------- | ------------------------ | -------- | ----------------------------------------------- |
| `tags`        | `string[]`               | ❌       | Array of tags for categorization                |
| `externalIds` | `Record<string, string>` | ❌       | External system IDs (e.g., Salesforce, HubSpot) |

### System Fields (auto-generated)

| Field           | Type            | Description        |
| --------------- | --------------- | ------------------ |
| `_id`           | `Id<"tenants">` | Unique document ID |
| `_creationTime` | `number`        | Creation timestamp |

### Indexes

- `by_clerk_user_id`: Index on `clerkUserId` field
- `by_organization`: Index on `organizationId` field
- `by_type`: Index on `type` field
- `by_status`: Index on `status` field
- `search_name`: Full-text search index on `name` field

---

## Invoices

**Table Name:** `invoices`  
**File:** `convex/invoice/validators.ts`

### Core Fields

| Field            | Type                                                 | Required | Description                        |
| ---------------- | ---------------------------------------------------- | -------- | ---------------------------------- |
| `invoiceNumber`  | `string`                                             | ✅       | Human-readable invoice number      |
| `tenantId`       | `Id<"tenants">`                                      | ✅       | Reference to tenant                |
| `organizationId` | `Id<"organizations">`                                | ✅       | Reference to organization          |
| `dataCenterId`   | `Id<"dataCenters">`                                  | ✅       | Reference to data center           |
| `currency`       | `string`                                             | ✅       | Currency code (e.g., "USD", "CAD") |
| `status`         | `"Draft" \| "Deleted" \| "Open" \| "Paid" \| "Void"` | ✅       | Invoice status                     |
| `poNumber`       | `string`                                             | ❌       | Purchase order number              |

### Date Fields

#### Billing Period & Deadlines

| Field            | Type     | Required | Description                                    |
| ---------------- | -------- | -------- | ---------------------------------------------- |
| `periodStart`    | `number` | ✅       | First day of service being billed (timestamp)  |
| `periodEnd`      | `number` | ✅       | Last day of service being billed (timestamp)   |
| `issuedAt`       | `number` | ✅       | When invoice was created/finalized (timestamp) |
| `paymentDueDate` | `number` | ✅       | Payment deadline (timestamp)                   |

#### Status Transition Timestamps

| Field       | Type     | Required | Description                          |
| ----------- | -------- | -------- | ------------------------------------ |
| `sentAt`    | `number` | ❌       | When invoice was sent (Draft → Open) |
| `paidAt`    | `number` | ❌       | When payment was received (→ Paid)   |
| `deletedAt` | `number` | ❌       | When soft-deleted (Draft → Deleted)  |
| `voidedAt`  | `number` | ❌       | When cancelled (→ Void)              |

### Payment

| Field        | Type     | Required | Description                              |
| ------------ | -------- | -------- | ---------------------------------------- |
| `paymentUrl` | `string` | ❌       | Secure payment URL (generated when Open) |

### Line Items

| Field         | Type                | Required | Description                     |
| ------------- | ------------------- | -------- | ------------------------------- |
| `lineItemIds` | `Id<"lineItems">[]` | ✅       | Array of line item document IDs |

### Totals

#### `totalAmount` (required)

| Field        | Type     | Description              |
| ------------ | -------- | ------------------------ |
| `subtotal`   | `number` | Subtotal before tax/fees |
| `tax`        | `number` | Tax amount               |
| `fees`       | `number` | Fee amount               |
| `discount`   | `number` | Discount amount          |
| `totalDue`   | `number` | Total amount due         |
| `balanceDue` | `number` | Remaining balance due    |

### Invoice Content

| Field    | Type     | Required | Description                  |
| -------- | -------- | -------- | ---------------------------- |
| `memo`   | `string` | ❌       | Free-text notes              |
| `footer` | `string` | ❌       | Legal/SLA/payment terms text |

### Billing Context

#### `subBrand` (optional)

| Field            | Type             | Required | Description                           |
| ---------------- | ---------------- | -------- | ------------------------------------- |
| `name`           | `string`         | ✅       | Billing entity name                   |
| `logoStorageId`  | `Id<"_storage">` | ❌       | Logo storage ID                       |
| `billingAddress` | `BillingAddress` | ✅       | Billing address (see Tenants section) |

#### `dataCenterLocation` (optional)

| Field     | Type             | Required | Description         |
| --------- | ---------------- | -------- | ------------------- |
| `name`    | `string`         | ✅       | Data center name    |
| `address` | `BillingAddress` | ✅       | Data center address |

### Storage Fields

| Field                   | Type               | Required | Description                     |
| ----------------------- | ------------------ | -------- | ------------------------------- |
| `logoStorageId`         | `Id<"_storage">`   | ❌       | Brand logo displayed on invoice |
| `attachmentStorageIds`  | `Id<"_storage">[]` | ❌       | Supplemental file attachments   |
| `generatedPdfStorageId` | `Id<"_storage">`   | ❌       | Generated invoice PDF           |

### Metadata Fields

| Field         | Type                     | Required | Description         |
| ------------- | ------------------------ | -------- | ------------------- |
| `tags`        | `string[]`               | ❌       | Array of tags       |
| `externalIds` | `Record<string, string>` | ❌       | External system IDs |

### System Fields (auto-generated)

| Field           | Type             | Description        |
| --------------- | ---------------- | ------------------ |
| `_id`           | `Id<"invoices">` | Unique document ID |
| `_creationTime` | `number`         | Creation timestamp |

### Indexes

- `by_stripe_invoice_id`: Composite index on `stripe.stripeAccountId` and `stripe.stripeInvoiceId`
- `by_organization`: Index on `organizationId` field
- `by_data_center`: Index on `dataCenterId` field
- `by_invoice_number`: Index on `invoiceNumber` field
- `by_tenant_and_status`: Composite index on `tenantId` and `status`
- `by_status_and_due_date`: Composite index on `status` and `paymentDueDate`

---

## Quotes

**Table Name:** `quotes`  
**File:** `convex/quote/validators.ts`

### Fields

| Field              | Type                                                            | Required | Description                                 |
| ------------------ | --------------------------------------------------------------- | -------- | ------------------------------------------- |
| `tenantId`         | `Id<"tenants">`                                                 | ✅       | Reference to tenant                         |
| `organizationId`   | `Id<"organizations">`                                           | ✅       | Reference to organization                   |
| `dataCenterId`     | `Id<"dataCenters">`                                             | ✅       | Reference to data center                    |
| `status`           | `"Draft" \| "Pending" \| "Expired" \| "Rejected" \| "Approved"` | ✅       | Quote status                                |
| `sentAt`           | `number`                                                        | ❌       | When quote was sent to customer (timestamp) |
| `approvedAt`       | `number`                                                        | ❌       | When quote was approved (timestamp)         |
| `expiryDate`       | `number`                                                        | ❌       | Quote expiration date (timestamp)           |
| `expiryJobId`      | `Id<"_scheduled_functions">`                                    | ❌       | Scheduled function ID for expiry            |
| `rejectedAt`       | `number`                                                        | ❌       | When quote was rejected (timestamp)         |
| `quoteLineItemIds` | `Id<"quoteLineItems">[]`                                        | ✅       | Array of quote line item document IDs       |
| `totalValue`       | `number`                                                        | ✅       | Total quote value                           |
| `notes`            | `string`                                                        | ❌       | Additional notes                            |

### System Fields (auto-generated)

| Field           | Type           | Description        |
| --------------- | -------------- | ------------------ |
| `_id`           | `Id<"quotes">` | Unique document ID |
| `_creationTime` | `number`       | Creation timestamp |

### Indexes

- `by_organization`: Index on `organizationId` field
- `by_data_center`: Index on `dataCenterId` field
- `by_status`: Index on `status` field
- `by_tenant_and_status`: Composite index on `tenantId` and `status`

---

## Quote Line Items

**Table Name:** `quoteLineItems`  
**File:** `convex/quote_line/validators.ts`

Quote line items are proposed line items for quotes, optionally based on catalog items. When a quote is approved, these can be converted to actual line items.

### Fields

| Field                | Type                      | Required | Description                                              |
| -------------------- | ------------------------- | -------- | -------------------------------------------------------- |
| `catalogItemId`      | `Id<"catalogItems">`      | ❌       | Reference to catalog item (template)                     |
| `serviceName`        | `string`                  | ✅       | Name of the service (e.g., "Rack Unit", "Full Cabinet")  |
| `lineNo`             | `number`                  | ✅       | Line number/sequence                                     |
| `sku`                | `string`                  | ❌       | SKU/product code                                         |
| `description`        | `string`                  | ✅       | Line item description                                    |
| `chargeType`         | `"MRC" \| "OTC" \| "NRC"` | ✅       | Charge type (Monthly Recurring, One-Time, Non-Recurring) |
| `periodStart`        | `number`                  | ❌       | Service period start (timestamp)                         |
| `periodEnd`          | `number`                  | ❌       | Service period end (timestamp)                           |
| `quantity`           | `number`                  | ✅       | Quantity                                                 |
| `unitPrice`          | `number`                  | ✅       | Unit price                                               |
| `amount`             | `number`                  | ✅       | Total amount (quantity × unitPrice - discount)           |
| `discountPercentage` | `number`                  | ❌       | Discount percentage                                      |
| `taxCode`            | `string`                  | ❌       | Tax code                                                 |

### System Fields (auto-generated)

| Field           | Type                   | Description        |
| --------------- | ---------------------- | ------------------ |
| `_id`           | `Id<"quoteLineItems">` | Unique document ID |
| `_creationTime` | `number`               | Creation timestamp |

### Indexes

- `by_catalog_item`: Index on `catalogItemId` field
- `by_charge_type`: Index on `chargeType` field

### Relationship Pattern

To get quote lines for a quote, use the quote's `quoteLineItemIds` array:

```typescript
// Get quote with its lines
const quote = await ctx.db.get(quoteId)
const lines = await Promise.all(
  quote.quoteLineItemIds.map((id) => ctx.db.get(id)),
)
```

---

## Line Items

**Table Name:** `lineItems`  
**File:** `convex/line_item/validators.ts`

### Fields

| Field                | Type                      | Required | Description                                              |
| -------------------- | ------------------------- | -------- | -------------------------------------------------------- |
| `billingId`          | `string`                  | ❌       | ID of parent billing document (invoice/quote)            |
| `chargeRefId`        | `string`                  | ❌       | Reference to recurring/one-time charge ID                |
| `lineNo`             | `number`                  | ✅       | Line number/sequence                                     |
| `sku`                | `string`                  | ❌       | SKU/product code                                         |
| `description`        | `string`                  | ✅       | Line item description                                    |
| `chargeType`         | `"MRC" \| "OTC" \| "NRC"` | ✅       | Charge type (Monthly Recurring, One-Time, Non-Recurring) |
| `periodStart`        | `number`                  | ❌       | Service period start (timestamp)                         |
| `periodEnd`          | `number`                  | ❌       | Service period end (timestamp)                           |
| `quantity`           | `number`                  | ✅       | Quantity                                                 |
| `unitPrice`          | `number`                  | ✅       | Unit price                                               |
| `amount`             | `number`                  | ✅       | Total amount (quantity × unitPrice)                      |
| `discountPercentage` | `number`                  | ❌       | Discount percentage                                      |
| `taxCode`            | `string`                  | ❌       | Tax code                                                 |

### System Fields (auto-generated)

| Field           | Type              | Description        |
| --------------- | ----------------- | ------------------ |
| `_id`           | `Id<"lineItems">` | Unique document ID |
| `_creationTime` | `number`          | Creation timestamp |

### Indexes

- `by_billing`: Index on `billingId` field
- `by_charge_type`: Index on `chargeType` field
- `by_sku`: Index on `sku` field

---

## Catalog Items

**Table Name:** `catalogItems`  
**File:** `convex/catalog_item/validators.ts`

### Fields

| Field          | Type                | Required | Description                                     |
| -------------- | ------------------- | -------- | ----------------------------------------------- |
| `serviceName`  | `string`            | ✅       | Name of the service/product                     |
| `sku`          | `string`            | ✅       | Stock Keeping Unit / product code               |
| `description`  | `string`            | ✅       | Product description                             |
| `unitPrice`    | `number`            | ✅       | Price per unit                                  |
| `dataCenterId` | `Id<"dataCenters">` | ✅       | Reference to data center providing this service |

### System Fields (auto-generated)

| Field           | Type                 | Description        |
| --------------- | -------------------- | ------------------ |
| `_id`           | `Id<"catalogItems">` | Unique document ID |
| `_creationTime` | `number`             | Creation timestamp |

### Indexes

- `by_sku`: Index on `sku` field
- `by_data_center`: Index on `dataCenterId` field

---

## Data Centers

**Table Name:** `dataCenters`  
**File:** `convex/data_center/validators.ts`

### Fields

| Field            | Type                     | Required | Description                                              |
| ---------------- | ------------------------ | -------- | -------------------------------------------------------- |
| `organizationId` | `Id<"organizations">`    | ✅       | Reference to the organization the data center belongs to |
| `name`           | `string`                 | ✅       | Data center name                                         |
| `code`           | `string`                 | ✅       | Data center code (e.g., "SJC1", "YVR1")                  |
| `status`         | `"Active" \| "Inactive"` | ✅       | Data center status                                       |

#### `address` (required)

| Field     | Type     | Required | Description     |
| --------- | -------- | -------- | --------------- |
| `street`  | `string` | ✅       | Street address  |
| `city`    | `string` | ✅       | City            |
| `state`   | `string` | ✅       | State/province  |
| `zip`     | `string` | ✅       | ZIP/postal code |
| `country` | `string` | ✅       | Country code    |

#### `stripeAccount` (optional)

| Field                | Type                  | Required | Description                    |
| -------------------- | --------------------- | -------- | ------------------------------ |
| `stripeAccountId`    | `string`              | ✅       | Stripe Connect account ID      |
| `chargesEnabled`     | `boolean`             | ✅       | Whether charges are enabled    |
| `payoutsEnabled`     | `boolean`             | ✅       | Whether payouts are enabled    |
| `onboardingComplete` | `boolean`             | ✅       | Whether onboarding is complete |
| `detailsSubmitted`   | `boolean`             | ✅       | Whether details are submitted  |
| `defaultCurrency`    | `string`              | ❌       | Default currency code          |
| `syncedAt`           | `number`              | ✅       | Last sync timestamp            |
| `syncSource`         | `"local" \| "stripe"` | ✅       | Source of last sync            |

### System Fields (auto-generated)

| Field           | Type                | Description        |
| --------------- | ------------------- | ------------------ |
| `_id`           | `Id<"dataCenters">` | Unique document ID |
| `_creationTime` | `number`            | Creation timestamp |

### Indexes

- `by_stripe_account_id`: Index on `stripeAccount.stripeAccountId` field
- `by_organization`: Index on `organizationId` field

---

## Quick Reference: File Locations

To view the actual schema definitions:

1. **Main Schema File:** `convex/schema.ts` - Lists all tables and indexes
2. **Table Definitions:**
   - `convex/tenant/validators.ts` - Tenants table
   - `convex/invoice/validators.ts` - Invoices table
   - `convex/quote/validators.ts` - Quotes table
   - `convex/quote_line/validators.ts` - Quote Line Items table
   - `convex/line_item/validators.ts` - Line Items table
   - `convex/catalog_item/validators.ts` - Catalog Items table
   - `convex/data_center/validators.ts` - Data Centers table

3. **Generated Types:** `convex/_generated/dataModel.d.ts` - TypeScript types for all tables (auto-generated)

---

## Notes

- All timestamps are in milliseconds (Unix timestamp)
- All `_id` fields are Convex document IDs (type `Id<"tableName">`)
- Optional fields marked with `v.optional()` can be `undefined`
- Arrays are always required but can be empty `[]`
- Nested objects are defined as separate validators for reusability

### Relationship Patterns

**One-directional (parent → child via array):**

- `Invoice.lineItemIds` → `LineItem` (line items don't reference invoice)
- `Quote.quoteLineItemIds` → `QuoteLine` (quote lines don't reference quote)

This pattern provides simpler data integrity with a single source of truth. To find items for a parent, use the parent's array. To find the parent of an item, query parents that contain the item ID.

**Many-to-many via array:**

- `Tenant.dataCenterIds` → `DataCenter[]` (tenants can be associated with multiple data centers)