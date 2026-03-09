# Table Implementation Guide

This guide explains how to implement data tables using our table system built on TanStack Table with Convex cursor-based pagination.

## Architecture Overview

```
src/tables/
├── components/
│   ├── cells/           # Reusable cell renderers (BadgeCell, TextCell, etc.)
│   ├── primitives/      # Low-level table HTML components
│   ├── data-table.tsx   # Main table wrapper component
│   ├── table-column-header.tsx
│   ├── table-pagination.tsx        # Page-number pagination (client-side)
│   └── table-pagination-simple.tsx # Prev/Next pagination (server-side)
├── hooks/
│   ├── use-cursor-pagination.ts    # Generic Convex cursor pagination
│   └── use-data-table.ts           # TanStack Table wrapper
└── lib/
    ├── constants.ts
    ├── types.ts
    └── utils.ts
```

## Quick Start

### 1. Create Your Convex Query

In `packages/db/convex/{entity}/queries.ts`:

```typescript
import { gQuery } from '../functions'
import { v } from 'convex/values'

export const listForTable = gQuery({
  args: {
    cursor: v.optional(v.union(v.string(), v.null())),
    pageSize: v.optional(v.number()),
    order: v.optional(v.union(v.literal('asc'), v.literal('desc'))),
  },
  handler: async (ctx, args) => {
    const operator = ctx.requireOperator()
    const { order = 'desc', pageSize = 25, cursor } = args

    return await ctx.db
      .query('yourTable')
      .withIndex('by_organization', (q) =>
        q.eq('organizationId', operator.organizationId),
      )
      .order(order)
      .paginate({
        numItems: pageSize,
        cursor: cursor ?? null,
      })
  },
})
```

### 2. Create Query Factory

In `apps/operator/src/lib/convex/queries.ts`:

```typescript
import { convexQuery } from '@convex-dev/react-query'
import { api } from '@gnomos/db/api'

export const yourEntityForTableQuery = (args: {
  cursor?: null | string
  pageSize?: number
  order?: 'asc' | 'desc'
}) => {
  return convexQuery(api.yourEntity.queries.listForTable, args)
}
```

### 3. Create Feature Page Hook

In `apps/operator/src/features/{entity}/hooks/use-{entity}-page.ts`:

```typescript
import type { TYourEntity } from '@gnomos/db/convex'
import { yourEntityForTableQuery } from '@/lib/convex'
import { useCursorPagination } from '@/tables/hooks'

interface UseEntityPageOptions {
  order?: 'asc' | 'desc'
  pageSize?: number
}

export function useEntityPage(options: UseEntityPageOptions = {}) {
  const { order = 'desc', pageSize = 25 } = options

  const pagination = useCursorPagination<TYourEntity>({
    queryFn: (cursor) =>
      yourEntityForTableQuery({
        pageSize,
        cursor,
        order,
      }),
  })

  return {
    ...pagination,
    pageSize,
  }
}
```

### 4. Define Columns

In `apps/operator/src/features/{entity}/components/table/columns.tsx`:

```typescript
import { createColumnHelper } from '@tanstack/react-table'
import type { TYourEntity } from '@gnomos/db/convex'
import { TableColumnHeader } from '@/tables'
import { BadgeCell, TextCell, DateCell } from '@/tables/components/cells'

const columnHelper = createColumnHelper<TYourEntity>()

export const entityColumns = [
  columnHelper.accessor('name', {
    header: ({ column }) => <TableColumnHeader column={column} title="Name" />,
    cell: (info) => <TextCell value={info.getValue()} />,
    enableSorting: false, // Set to true if you implement server-side sorting
  }),

  columnHelper.accessor('status', {
    header: ({ column }) => <TableColumnHeader column={column} title="Status" />,
    cell: (info) => {
      const status = info.getValue()
      return (
        <BadgeCell
          variant={status === 'Active' ? 'success' : 'error'}
          label={status}
        />
      )
    },
    enableSorting: false,
  }),

  columnHelper.accessor('createdAt', {
    header: ({ column }) => <TableColumnHeader column={column} title="Created" />,
    cell: (info) => <DateCell date={info.getValue()} />,
    enableSorting: false,
  }),
]
```

### 5. Create Table Widget

In `apps/operator/src/features/{entity}/widgets/{entity}-table.tsx`:

```typescript
import { entityColumns } from '../components/table'
import { useEntityPage } from '../hooks'
import { DataTable, TablePaginationSimple, useDataTable } from '@/tables'

export function EntityTable() {
  const {
    canPreviousPage,
    previousPage,
    canNextPage,
    isLoading,
    nextPage,
    data,
  } = useEntityPage({ pageSize: 25 })

  const { table } = useDataTable({
    getRowId: (row) => row._id,
    columns: entityColumns,
    manualPagination: true, // Server-side pagination
    data,
  })

  return (
    <div className="flex flex-col gap-4">
      <DataTable
        emptyMessage="No items found."
        showPagination={false}
        isLoading={isLoading}
        table={table}
      />

      <TablePaginationSimple
        canPreviousPage={canPreviousPage}
        onPreviousPage={previousPage}
        canNextPage={canNextPage}
        className="justify-end"
        onNextPage={nextPage}
      />
    </div>
  )
}
```

## Available Cell Components

Import from `@/tables/components/cells`:

| Component         | Props                                                         | Description                         |
| ----------------- | ------------------------------------------------------------- | ----------------------------------- |
| `TextCell`        | `value: string`                                               | Simple text display                 |
| `DateCell`        | `date: Date \| number \| string`, `formatString?: string`     | Formatted date                      |
| `BadgeCell`       | `label: string`, `variant: 'success' \| 'error' \| 'warning'` | Status badge                        |
| `IconTextCell`    | `value: string`                                               | Text with deterministic flower icon |
| `RowActionButton` | `onClick`, `icon`, `label`                                    | Single action button                |
| `RowActionsMenu`  | `actions: RowAction[]`                                        | Dropdown menu with multiple actions |

### RowActionsMenu Example

```typescript
columnHelper.display({
  id: 'actions',
  cell: ({ row }) => (
    <RowActionsMenu
      actions={[
        {
          label: 'Edit',
          onClick: () => handleEdit(row.original),
          icon: <HugeiconsIcon icon={Edit01Icon} className="size-4" />,
        },
        {
          label: 'Delete',
          onClick: () => handleDelete(row.original._id),
          destructive: true,
          icon: <HugeiconsIcon icon={Delete01Icon} className="size-4" />,
        },
      ]}
    />
  ),
})
```

## Hook APIs

### `useCursorPagination<TData>`

Generic hook for Convex cursor-based pagination.

```typescript
const {
  data, // TData[] - Current page data
  isLoading, // boolean
  isError, // boolean
  error, // Error | null

  canPreviousPage, // boolean
  previousPage, // () => void
  canNextPage, // boolean
  nextPage, // () => void
  resetToFirstPage, // () => void - Call when filters change

  pageIndex, // number - Current page (0-indexed)
  continueCursor, // string | null
} = useCursorPagination({
  queryFn: (cursor) => yourQuery({ cursor, ...otherArgs }),
})
```

### `useDataTable<TData>`

TanStack Table wrapper with controlled/uncontrolled state support.

```typescript
const { table, sorting, setSorting, ... } = useDataTable({
  data: TData[],
  columns: ColumnDef<TData>[],

  // Server-side flags
  manualPagination?: boolean,
  manualSorting?: boolean,
  manualFiltering?: boolean,

  // Required for manual pagination
  pageCount?: number,
  rowCount?: number,

  // Custom row ID (recommended for Convex)
  getRowId?: (row) => string,

  // Feature toggles
  enableRowSelection?: boolean,
  enableMultiSort?: boolean,
  enableGlobalFilter?: boolean,
})
```

## Pagination Options

### Server-Side (Cursor-Based)

Use `TablePaginationSimple` with `useCursorPagination`:

```typescript
<TablePaginationSimple
  canPreviousPage={canPreviousPage}
  onPreviousPage={previousPage}
  canNextPage={canNextPage}
  onNextPage={nextPage}
/>
```

### Client-Side (Page Numbers)

Use `TablePagination` with `useDataTable` (no `manualPagination`):

```typescript
const { table } = useDataTable({
  data: allData, // All data loaded client-side
  columns,
  // manualPagination: false (default)
})

<DataTable table={table} showPagination={true} />
```

## Row Click Handler

```typescript
<DataTable
  table={table}
  onRowClick={(row) => navigate(`/entity/${row._id}`)}
/>
```

## File Organization

```
features/{entity}/
├── components/
│   └── table/
│       ├── columns.tsx    # Column definitions
│       └── index.ts       # Re-export columns
├── hooks/
│   ├── use-{entity}-page.ts  # Pagination hook
│   └── index.ts
└── widgets/
    ├── {entity}-table.tsx    # Table widget
    └── index.ts
```

## Tips

1. **Always set `getRowId`** when using Convex data to use `_id` instead of array index
2. **Set `enableSorting: false`** on columns until you implement server-side sorting
3. **Call `resetToFirstPage()`** when filters change to avoid stale cursor issues
4. **Use `manualPagination: true`** for server-side pagination to disable client-side row models