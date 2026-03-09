# TanStack Start Cookie Module Bug Fix

## Issue

When running the operator-ui dev server, the following error appeared in the browser console:

```
Uncaught (in promise) SyntaxError: The requested module
'/node_modules/cookie/dist/index.js' does not provide an export named 'parse'
```

This prevented the application from loading.

## Root Cause

This is a **known bug in TanStack Start** starting from version `1.134.7`:

- **GitHub Issue**: https://github.com/TanStack/router/issues/5738
- **Affected versions**: `@tanstack/react-start@1.134.7` and later (including 1.142.x)

### Technical Details

Starting with `@tanstack/react-start@1.134.7`, server-side modules are incorrectly bundled into the client bundle. When using Clerk SDK (`@clerk/tanstack-react-start`), the `cookie` package gets pulled into the client build.

The `cookie` package versions 0.7+ and 1.0+ changed their export structure from named exports to default exports:

```js
// Old (0.6.x) - Named exports (works)
export { parse, serialize }

// New (0.7+, 1.0+) - Default export (breaks)
export default { parse, serialize }
```

When TanStack Start incorrectly bundles server code into the client, Vite tries to pre-bundle the `cookie` module, and the ESM export mismatch causes the error.

## Fix

Pin TanStack packages to version `1.134.6` (before the bug was introduced) in `apps/operator-ui/package.json`:

```json
{
  "dependencies": {
    "@tanstack/react-start": "1.134.6",
    "@tanstack/react-router": "1.134.4",
    "@tanstack/router-plugin": "1.134.4",
    "@tanstack/react-router-devtools": "1.134.4"
  }
}
```

### Steps to Apply Fix

1. Install pinned versions in operator-ui:

   ```bash
   cd apps/operator-ui
   bun add @tanstack/react-start@1.134.6 @tanstack/react-router@1.134.4 @tanstack/router-plugin@1.134.4 @tanstack/react-router-devtools@1.134.4
   ```

2. Hard clean all caches:

   ```bash
   cd ../..  # back to root
   rm -rf node_modules .tanstack .vinxi bun.lock
   rm -rf apps/operator-ui/node_modules apps/operator-ui/.vinxi apps/operator-ui/.tanstack
   rm -rf apps/customer-ui/node_modules apps/customer-ui/.vinxi apps/customer-ui/.tanstack
   ```

3. Reinstall dependencies:

   ```bash
   bun install
   ```

4. Start dev server:
   ```bash
   bun run dev
   ```

## What NOT to Do

The following workarounds were attempted but **did not fix** the issue:

- ❌ Adding `cookie` to `optimizeDeps.include` in vite.config.ts
- ❌ Adding `ssr.noExternal: ['cookie']` in vite.config.ts
- ❌ Adding `cookie: "0.6.0"` override in root package.json

These workarounds address the symptom (ESM export mismatch) but not the root cause (server modules being bundled into client).

## Future Resolution

Monitor the GitHub issue for an upstream fix:
https://github.com/TanStack/router/issues/5738

Once fixed, the TanStack packages can be upgraded. Test thoroughly after any upgrade.

## Date Documented

December 22, 2025