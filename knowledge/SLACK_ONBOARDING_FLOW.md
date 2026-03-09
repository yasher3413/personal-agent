# Slack Onboarding Flow

This document describes the organization onboarding flow triggered via Slack, including architecture, setup requirements, and step-by-step flow explanation.

---

## Overview

The Slack onboarding flow allows operators to create new customer organizations directly from Slack using the `/onboard` slash command. It:

1. Opens a modal to collect organization details
2. Creates the organization in Clerk and Convex
3. Generates a secure invite token
4. Sends an invitation email to the admin via Resend

---

## Architecture

```
┌─────────────┐     /onboard      ┌──────────────────┐
│   Slack     │ ───────────────▶  │  Convex HTTP     │
│   User      │                   │  slackOnboardCmd │
└─────────────┘                   └────────┬─────────┘
                                           │
                                           ▼ opens modal
                                  ┌──────────────────┐
                                  │   Slack Modal    │
                                  │ (org name, email,│
                                  │  phone, address) │
                                  └────────┬─────────┘
                                           │ submit
                                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                    createOrganizationFromSlack                   │
│                         (Node Action)                            │
├─────────────────────────────────────────────────────────────────┤
│  1. Create org in Clerk  ──────────────────────────────────────▶│
│  2. Create org in Convex (mutation)                             │
│  3. Call sendInviteEmail action                                 │
│     ├─ Generate secure token (createInvite)                     │
│     ├─ Render email template (React Email)                      │
│     └─ Queue email (Resend component)                           │
└─────────────────────────────────────────────────────────────────┘
                                           │
                                           ▼
                                  ┌──────────────────┐
                                  │   Admin Email    │
                                  │  (invite link)   │
                                  └────────┬─────────┘
                                           │ click link
                                           ▼
                                  ┌──────────────────┐
                                  │  Operator UI     │
                                  │  /sign-in?token= │
                                  │                  │
                                  │  acceptInvite()  │
                                  └──────────────────┘
```

---

## Files Involved

| File                                                 | Purpose                                                    |
| ---------------------------------------------------- | ---------------------------------------------------------- |
| `convex/integrations/slack/handlers.ts`              | HTTP handlers for Slack commands & interactivity           |
| `convex/integrations/slack/actions.ts`               | Main onboarding logic (Clerk + Convex + email)             |
| `convex/integrations/slack/helpers.ts`               | Slack API helpers (signature verification, modal building) |
| `convex/organization/mutations.ts`                   | Organization database mutations                            |
| `convex/operator_invite/node/actions.ts`             | Token generation and invite acceptance                     |
| `convex/operator_invite/mutations.ts`                | Invite storage                                             |
| `convex/integrations/resend/index.ts`                | Resend component setup                                     |
| `convex/integrations/resend/emails/admin_invite.tsx` | Email template (React Email)                               |

---

## Environment Variables

The following environment variables must be set in your Convex deployment:

### Slack

| Variable               | Description                                       |
| ---------------------- | ------------------------------------------------- |
| `SLACK_SIGNING_SECRET` | Slack app signing secret for request verification |
| `SLACK_BOT_TOKEN`      | Bot OAuth token (starts with `xoxb-`)             |

### Clerk

| Variable                           | Description                       |
| ---------------------------------- | --------------------------------- |
| `CLERK_OPERATOR_SECRET_KEY`        | Clerk secret key for operator app |
| `CLERK_JWT_OPERATOR_ISSUER_DOMAIN` | Clerk JWT issuer domain           |

### Resend

| Variable         | Description                       |
| ---------------- | --------------------------------- |
| `RESEND_API_KEY` | Resend API key for sending emails |

### App URLs

| Variable  | Description                                        |
| --------- | -------------------------------------------------- |
| `APP_URL` | Base URL of webapp (e.g., `https://app.gnomos.co`) |

### Security

| Variable       | Description                       |
| -------------- | --------------------------------- |
| `TOKEN_PEPPER` | Secret used to hash invite tokens |

---

## Slack App Setup

### 1. Create a Slack App

1. Go to [api.slack.com/apps](https://api.slack.com/apps)
2. Click **Create New App** → **From scratch**
3. Name your app (e.g., "Gnomos Onboarding")
4. Select your workspace

### 2. Configure Slash Commands

Navigate to **Slash Commands** → **Create New Command**:

| Field             | Value                                                        |
| ----------------- | ------------------------------------------------------------ |
| Command           | `/onboard`                                                   |
| Request URL       | `https://<your-convex-deployment>.convex.site/slack/onboard` |
| Short Description | Onboard a new organization                                   |
| Usage Hint        | (leave empty)                                                |

### 3. Configure Interactivity

Navigate to **Interactivity & Shortcuts**:

1. Toggle **Interactivity** to **On**
2. Set **Request URL** to: `https://<your-convex-deployment>.convex.site/slack/interactivity`

### 4. OAuth & Permissions

Navigate to **OAuth & Permissions** and add these **Bot Token Scopes**:

- `commands` - Slash commands
- `chat:write` - Send messages (for error responses)

### 5. Install to Workspace

1. Navigate to **Install App**
2. Click **Install to Workspace**
3. Copy the **Bot User OAuth Token** → set as `SLACK_BOT_TOKEN`
4. Copy **Signing Secret** (from Basic Information) → set as `SLACK_SIGNING_SECRET`

---

## Convex HTTP Routes

Add these routes to your `convex/http.ts`:

```typescript
import { httpRouter } from 'convex/server'
import {
  slackOnboardCommand,
  slackInteractivity,
} from './integrations/slack/handlers'

const http = httpRouter()

// Slack onboarding
http.route({
  path: '/slack/onboard',
  method: 'POST',
  handler: slackOnboardCommand,
})

http.route({
  path: '/slack/interactivity',
  method: 'POST',
  handler: slackInteractivity,
})

export default http
```

---

## Step-by-Step Flow

### 1. User triggers `/onboard` in Slack

The `slackOnboardCommand` handler:

1. Verifies Slack signature
2. Opens a modal with fields: org name, admin email, phone, website, billing address

### 2. User submits the modal

The `slackInteractivity` handler:

1. Verifies Slack signature
2. Extracts form data
3. Validates required fields (name, email)
4. Calls `createOrganizationFromSlack` action

### 3. Organization creation

The `createOrganizationFromSlack` action:

1. Creates organization in Clerk (gets `clerkOrgId`)
2. Creates organization in Convex with all form data
3. If Convex insert fails, rolls back by deleting Clerk org
4. Triggers `sendInviteEmail` action

### 4. Invite email

The `sendInviteEmail` action:

1. Calls `createInvite` to generate a secure token
   - Generates 32-byte random token
   - Hashes with SHA-256 + pepper
   - Stores hash in database (never stores raw token)
2. Renders `AdminInviteEmail` template with invite link
3. Queues email via `@convex-dev/resend` component

### 5. User accepts invite

When admin clicks the invite link (`/sign-in?token=xxx`):

1. Frontend calls `acceptInvite` action
2. Action validates token, expiry, and email match
3. Adds user to Clerk organization
4. Creates operator record in Convex
5. Marks invite as accepted

---

## Testing the Flow

### Prerequisites

1. All environment variables set in Convex dashboard
2. Slack app installed to your workspace
3. Slack app URLs pointing to YOUR Convex deployment
4. Resend domain verified (or use `@resend.dev` for testing)

### Test Steps

1. Open Slack in the configured workspace
2. Type `/onboard` in any channel
3. Fill in the modal:
   - **Organization Name**: Test Org
   - **Admin Email**: your-email@example.com
   - **Phone**: (optional)
   - **Website**: (optional)
4. Submit the modal
5. Check Convex dashboard logs for:
   - `[Slack Onboard] Creating organization "Test Org"...`
   - `[Slack Onboard] Created organization: xxx`
   - `[Slack Onboard] Invite email queued for...`
6. Check your email for the invite
7. Click the invite link and sign in to accept

### Common Issues

| Issue                  | Cause                              | Solution                                  |
| ---------------------- | ---------------------------------- | ----------------------------------------- |
| "Invalid signature"    | Wrong `SLACK_SIGNING_SECRET`       | Verify secret matches Slack app           |
| Modal doesn't open     | Request URL misconfigured          | Check Slash Commands URL                  |
| No email received      | Resend not configured              | Verify `RESEND_API_KEY` and sender domain |
| "Missing APP_URL"      | Env var not set                    | Add to Convex environment                 |
| Token validation fails | `TOKEN_PEPPER` mismatch            | Ensure same pepper across deployments     |
| Logs not appearing     | Slack pointing to wrong deployment | Update Slack app URLs to your deployment  |

---

## Security Considerations

### Token Security

- Raw tokens are **never stored** in the database
- Tokens are hashed with SHA-256 + server-side pepper
- Tokens expire after 7 days (configurable via `ttlDays`)
- Each token can only be used once

### Slack Verification

- All requests verified using Slack signing secret
- Timestamp checked to prevent replay attacks

### Email Validation

- Admin email validated using Zod before processing
- Email must match authenticated user when accepting invite

---

## Race Condition Handling

A race condition can occur between Clerk webhooks and the Slack action:

1. Slack action creates org in Clerk
2. Clerk fires `organization.created` webhook → creates org in Convex
3. Slack action tries to create org in Convex → org already exists

**Solution**: The `createOrganizationFromSlack` mutation is idempotent:

- If org exists (from webhook), it updates with Slack form data
- If org doesn't exist, it creates with full data

---

## Dependencies

### NPM Packages

```json
{
  "@convex-dev/resend": "^0.x.x",
  "@react-email/components": "^0.x.x",
  "@react-email/render": "^1.x.x",
  "@clerk/backend": "^1.x.x"
}
```

### Convex Components

In `convex/convex.config.ts`:

```typescript
import { defineApp } from 'convex/server'
import resend from '@convex-dev/resend/convex.config.js'

const app = defineApp()
app.use(resend)

export default app
```

---

## Email Template

The invite email uses React Email (`convex/integrations/resend/emails/admin_invite.tsx`):

- Clean, professional design
- Includes organization name
- Prominent "Accept Invitation" button
- Fallback text link for email clients that block buttons
- Expiry notice (7 days)

To preview locally:

```bash
cd packages/db
npx email dev
```

---

## Logs Reference

All logs are prefixed with `[Slack Onboard]` for easy filtering:

```
[Slack Onboard] Creating organization "Acme Corp" triggered by john.doe
[Slack Onboard] Created organization: abc123 with slug: acme-corp
[Slack Onboard] Sending invite email to admin@acme.com for organization "Acme Corp"
[Slack Onboard] Invite email queued for admin@acme.com (org: Acme Corp, expires: 2024-12-29T...)
```

---

## Future Improvements

- [ ] Add Resend webhook for email delivery tracking
- [ ] Add cleanup cron for expired invites
- [ ] Add Gnomos logo to email template
- [ ] Support multiple admin invites per organization
- [ ] Add Slack notification when invite is accepted