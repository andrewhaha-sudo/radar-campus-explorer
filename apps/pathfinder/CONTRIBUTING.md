# Contributing to Pathfinder

Pathfinder is the open-source Community Edition of a white-label platform for
emergency floorplan mapping and 3D facility documentation. Contributions are
welcome.

## Run it locally

Requires Node 20+ and npm.

```
npm install
npm run dev        # local dev server
npm run build      # production build (Cloudflare adapter)
npm run preview    # serve the production build
```

Select a brand at build/dev time with the `VITE_BRAND` env var
(default `pathfinder`):

```
VITE_BRAND=els911 npm run dev
```

## Test-first rule

This project is test-driven. Write or update the failing test before the
implementation. Each acceptance criterion (AC-<story>.<n>) maps to a test
(T-<AC>); see `docs/`. The seed examples live in:

- `tests/unit/brand.test.ts` (Vitest)
- `tests/e2e/landing.spec.ts`, `tests/e2e/login.spec.ts` (Playwright)

```
npm run test:unit   # vitest run
npm run test:e2e    # playwright test (installs browsers on first run)
npm run check       # svelte-check type checking
```

## White-label rule

Components reference `var(--brand-*)` custom properties only. Never hard-code
brand colors, names, or contact details in a component. To add an operator
brand: add a profile in `src/lib/brand/profiles/<id>.ts`, register it in
`src/lib/brand/index.ts`, and build with `VITE_BRAND=<id>`.

## Commit messages

- Conventional Commits: `type(scope): summary` (e.g. `feat(brand): add reseller profile`).
- Plain ASCII only. No em dashes, smart quotes, or arrow glyphs - the
  Cloudflare Pages deploy action rejects unicode in commit messages.
- Keep the subject under ~72 chars; explain the why in the body.

## Never commit

- Secrets, API keys, tokens, or `.dev.vars` (already gitignored).
- Real school, facility, or responder data. Use synthetic fixtures only.
- Cloudflare resource IDs (D1/R2/KV) - keep those in the dashboard or local
  env, not in `wrangler.toml`.

## Accessibility

Target WCAG 2.1 AA. Use real labels, visible focus styles, sufficient
contrast, and keyboard-reachable controls.
