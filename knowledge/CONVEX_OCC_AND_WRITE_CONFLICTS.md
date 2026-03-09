# Convex OCC, Atomicity & Write Conflict Patterns

This document explains Optimistic Concurrency Control (OCC), transaction atomicity, and write conflict patterns in Convex. Use this as a reference when designing mutations that handle concurrent writes.

---

## Overview

Convex uses **Optimistic Concurrency Control (OCC)** instead of pessimistic locking. This means:

1. **No locks acquired** — Transactions execute without waiting for locks
2. **Conflict detection at commit** — Convex checks if any documents in your "read set" changed since you read them
3. **Automatic retry** — Deterministic mutations are re-executed automatically on conflict
4. **Serializable isolation** — True serializability, not just snapshot isolation (no anomalies)

---

## Key Concepts

### Atomicity

All writes in a mutation either succeed together or fail together. Convex guarantees this automatically.

```typescript
// ✅ SAFE: Both writes are atomic
export const transfer = mutation({
  args: { from: v.id('accounts'), to: v.id('accounts'), amount: v.number() },
  handler: async (ctx, { from, to, amount }) => {
    const fromAccount = await ctx.db.get(from)
    const toAccount = await ctx.db.get(to)
    if (!fromAccount || !toAccount) throw new Error('Account not found')
    if (fromAccount.balance < amount) throw new Error('Insufficient funds')

    await ctx.db.patch(from, { balance: fromAccount.balance - amount })
    await ctx.db.patch(to, { balance: toAccount.balance + amount })
    // Both writes commit together or neither does
  },
})
```

### The Read Set

Every document your mutation reads becomes part of the **read set**. At commit time, Convex verifies none of these documents changed. If any did, the mutation is retried.

```typescript
// Read set = [Alice's account, Bob's account]
const alice = await ctx.db.get(aliceId) // Read #1
const bob = await ctx.db.get(bobId) // Read #2

// If either document changed between read and commit → conflict → retry
await ctx.db.patch(aliceId, { balance: alice.balance - 5 })
await ctx.db.patch(bobId, { balance: bob.balance + 5 })
```

### Automatic Retries

Because Convex mutations are **deterministic** (no side effects like HTTP calls), they can be safely retried. You write code as if it always succeeds on the first try.

> **Important**: Actions are NOT automatically retried. Only queries and mutations benefit from OCC retry.

---

## Write Conflict Error

When a mutation fails too many times due to conflicts, you'll see:

```
Documents read from or written to the table "tableName" changed while this
mutation was being run and on every subsequent retry. Another call to
"mutationName" changed the document with ID "xxx".
```

### Common Causes

| Pattern         | Problem                            | Solution                                |
| --------------- | ---------------------------------- | --------------------------------------- |
| Hot document    | Many mutations update the same doc | Sharding, aggregate table, or queue     |
| Full table scan | `ctx.db.query("table").collect()`  | Use indexed queries with `.withIndex()` |
| Mutation loops  | Action calling mutation in a loop  | Batch into single mutation or use queue |
| Counter updates | Incrementing a single counter doc  | Sharded counter pattern                 |

---

## Rules for Avoiding Write Conflicts

### 1. Minimize the Read Set

Only read documents you actually need. Broader reads = more conflict surface.

```typescript
// ❌ BAD: Reads entire table — any insert/update conflicts
const allTasks = await ctx.db.query('tasks').collect()
await ctx.db.patch(counterId, { value: allTasks.length })

// ✅ GOOD: Only reads the specific counter document
const counter = await ctx.db.get(counterId)
await ctx.db.patch(counterId, { value: counter.value + 1 })
```

### 2. Always Use Indexed Queries

Indexed queries have a smaller read set than table scans.

```typescript
// ❌ BAD: Table scan — entire table is in read set
const tasks = await ctx.db
  .query('tasks')
  .filter((q) => q.eq(q.field('status'), 'active'))
  .collect()

// ✅ GOOD: Only documents matching index are in read set
const tasks = await ctx.db
  .query('tasks')
  .withIndex('by_status', (q) => q.eq('status', 'active'))
  .collect()
```

### 3. Never Call Mutations in a Loop from Actions

Each mutation call is a separate transaction. Rapid sequential calls to the same data = conflicts.

```typescript
// ❌ BAD: 100 separate mutations fighting for the same counter
export const processItems = action({
  handler: async (ctx) => {
    for (const item of items) {
      await ctx.runMutation(internal.items.increment, { id: counterId })
    }
  },
})

// ✅ GOOD: Single mutation that handles all items
export const processItems = action({
  handler: async (ctx) => {
    await ctx.runMutation(internal.items.incrementBy, {
      id: counterId,
      amount: items.length,
    })
  },
})
```

### 4. Avoid Hot Documents

A "hot document" is one that many concurrent mutations read/write.

```typescript
// ❌ BAD: Every user action updates the same stats document
export const recordAction = mutation({
  handler: async (ctx) => {
    const stats = await ctx.db.get(globalStatsId)
    await ctx.db.patch(globalStatsId, {
      totalActions: stats.totalActions + 1,
    })
  },
})

// ✅ GOOD: Write to per-user or per-session documents, aggregate later
export const recordAction = mutation({
  args: { userId: v.id('users') },
  handler: async (ctx, { userId }) => {
    await ctx.db.insert('userActions', {
      userId,
      timestamp: Date.now(),
    })
  },
})
```

---

## High-Throughput Patterns

### Pattern 1: Sharded Counter

Spread writes across multiple documents, aggregate on read.

```typescript
// Schema
defineTable('shardedCounters', {
  shardKey: v.string(), // e.g., "activeUsers:0", "activeUsers:1", etc.
  counterId: v.string(),
  value: v.number(),
})

// Write: Pick random shard
export const increment = mutation({
  args: { counterId: v.string() },
  handler: async (ctx, { counterId }) => {
    const shardIndex = hashString(counterId) % 10 // 10 shards
    const shardKey = `${counterId}:${shardIndex}`

    const shard = await ctx.db
      .query('shardedCounters')
      .withIndex('by_shardKey', (q) => q.eq('shardKey', shardKey))
      .unique()

    if (shard) {
      await ctx.db.patch(shard._id, { value: shard.value + 1 })
    } else {
      await ctx.db.insert('shardedCounters', { shardKey, counterId, value: 1 })
    }
  },
})

// Read: Sum all shards
export const getCount = query({
  args: { counterId: v.string() },
  handler: async (ctx, { counterId }) => {
    const shards = await ctx.db
      .query('shardedCounters')
      .withIndex('by_counterId', (q) => q.eq('counterId', counterId))
      .collect()

    return shards.reduce((sum, shard) => sum + shard.value, 0)
  },
})
```

### Pattern 2: Append-Only with Aggregation

Instead of updating, insert events and aggregate periodically.

```typescript
// Write: Always insert, never update
export const trackEvent = mutation({
  args: { eventType: v.string(), value: v.number() },
  handler: async (ctx, { eventType, value }) => {
    await ctx.db.insert('events', {
      eventType,
      value,
      timestamp: Date.now(),
    })
  },
})

// Periodic aggregation (via cron or scheduled function)
export const aggregateEvents = internalMutation({
  handler: async (ctx) => {
    const events = await ctx.db
      .query('events')
      .withIndex('by_timestamp')
      .take(1000) // Process in batches

    // Aggregate and store summary, then delete processed events
  },
})
```

### Pattern 3: Separate Active Count

Keep a denormalized count that's updated less frequently.

```typescript
// Store count separately, update via cron
export const syncActiveCount = internalMutation({
  handler: async (ctx) => {
    const activeCount = await ctx.db
      .query('sessions')
      .withIndex('by_status', (q) => q.eq('status', 'active'))
      .collect()
      .then((sessions) => sessions.length)

    await ctx.db.patch(statsId, { activeSessions: activeCount })
  },
})
```

---

## Waitlist Pattern (High-Concurrency Example)

When building features that limit concurrent users (e.g., waitlists, rate limiting):

### Key Optimizations

1. **Store a denormalized counter** — Don't count active sessions on every request
2. **Use batch updates** — Cron job updates waitlist status periodically, not per-request
3. **Minimize per-client queries** — Send global data (firstWaitingPosition) to all clients, let them compute their position

```typescript
// ✅ Good: Check counter, don't count every time
export const createSession = mutation({
  args: { sessionId: v.string() },
  handler: async (ctx, { sessionId }) => {
    const stats = await ctx.db.get(waitlistStatsId)
    const status = stats.activeCount < MAX_ACTIVE ? 'active' : 'waiting'

    await ctx.db.insert('sessions', {
      sessionId,
      status,
      position: stats.nextPosition,
    })

    if (status === 'active') {
      await ctx.db.patch(waitlistStatsId, {
        activeCount: stats.activeCount + 1,
        nextPosition: stats.nextPosition + 1,
      })
    } else {
      await ctx.db.patch(waitlistStatsId, {
        nextPosition: stats.nextPosition + 1,
      })
    }
  },
})

// Periodic cleanup via cron — not per-request
export const updateWaitlist = internalMutation({
  handler: async (ctx) => {
    // 1. Delete stale waiting sessions
    // 2. Delete stale active sessions
    // 3. Promote waiting → active up to freed slots
    // 4. Update activeCount
  },
})
```

---

## Checklist: Before Shipping a Mutation

- [ ] **Indexed queries only** — No `.filter()` on large tables
- [ ] **Minimal read set** — Only read documents you need
- [ ] **No hot documents** — No single doc updated by many concurrent mutations
- [ ] **Batched writes** — Don't call mutations in loops from actions
- [ ] **Denormalized counts** — Use counters instead of `.collect().length`
- [ ] **Consider sharding** — For very high-throughput counters/aggregates

---

## Debugging Write Conflicts

1. **Check the error message** — It tells you which table and which mutation caused the conflict
2. **Look for hot documents** — Is the same document being updated by many concurrent callers?
3. **Check for table scans** — Are you using `.filter()` instead of `.withIndex()`?
4. **Review action loops** — Is an action calling the same mutation repeatedly?
5. **Consider timing** — Do you have a cron job and user mutations hitting the same data?

---

## Further Reading

- [Convex OCC and Atomicity](https://docs.convex.dev/database/advanced/occ)
- [Write Conflict Error Reference](https://docs.convex.dev/error#1)
- [Waitlist Pattern (Stack)](https://stack.convex.dev/waitlist)
- [Sharded Counter Component](https://www.convex.dev/components) — Pre-built high-throughput counter

---

## Summary Rules

| Rule                        | Why                                          |
| --------------------------- | -------------------------------------------- |
| Always use `.withIndex()`   | Smaller read set, fewer conflicts            |
| Avoid reading entire tables | Every doc becomes a conflict point           |
| Shard hot documents         | Spread writes across multiple docs           |
| Batch mutations in actions  | One transaction > many fighting transactions |
| Denormalize counts          | Don't recompute on every request             |
| Use crons for cleanup       | Periodic batch updates > per-request updates |