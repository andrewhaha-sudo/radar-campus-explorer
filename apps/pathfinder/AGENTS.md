# AGENTS.md - Pathfinder Portal

Context guardrail for AI coding agents and contributors. Read this before doing anything.
(Claude Code reads `CLAUDE.md`, a symlink to this file.)

Pathfinder is a white-label emergency floorplan-mapping and 3D facility-documentation
portal by Pathfinder LiDAR Solutions. SvelteKit (Svelte 5) on Cloudflare. See `docs/` for the full
spec, user stories, acceptance criteria, TDD plan, sprint plan, and integrations.

> **NO EDITIONS (decided 2026-08-18).** The Community / Pro split is abolished. Every feature
> is fully enabled for everyone - do not gate anything, and do not ask where a feature belongs.
> `docs/06-editions-and-integrations.md` still describes the old split and is historical only;
> its integrations list remains current.

## Commands

```
npm run dev          # local dev server
npm run check        # svelte-check (type/diagnostics) - must be clean
npm run test:unit    # Vitest unit/integration - must pass before commit
npm run test:e2e     # Playwright E2E (captures screenshots to tests/e2e/__screenshots__/)
npm run build        # production build
npm run deploy       # wrangler pages deploy .svelte-kit/cloudflare  (DIRECT deploy)
```

## Boundaries

### Always
- Write the failing test FIRST (red-green-refactor). Every acceptance criterion (`AC-x.y.z` in
  `docs/03-acceptance-criteria.md`) maps to a test `T-AC-x.y.z`. UI-visible ACs capture a Playwright
  screenshot named for the AC.
- Reference brand colors only via `var(--brand-*)` CSS custom properties. Never hard-code a brand color
  in a component - the white-label layer (`src/lib/brand/`) is the single source of truth.
- Keep commit messages plain ASCII (no em dashes, arrows, or smart quotes) - wrangler/CF Pages deploys
  fail on unicode in commit messages.
- Use Conventional Commits (`feat:`, `fix:`, `docs:`, `test:`, `chore:`).
- Run `npm run check` and `npm run test:unit` green before every commit.

### Ask first
- Adding a new third-party service/API or dependency (see `docs/06-editions-and-integrations.md` for the
  sanctioned list: Cloudflare, Resend, Stripe, Turnstile, Sentry; forward: RapidSOS, Mapbox, SSO, SIS).
- Changing the D1 schema (write a migration; never edit a shipped migration in place).

### Never
- **Never commit secrets or real facility data.** Code is public; `JWT_SECRET`, `RESEND_API_KEY`,
  `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `TURNSTILE_SECRET_KEY`, `SENTRY_DSN` etc. live in
  Cloudflare secrets / `.dev.vars` (gitignored). No real school floorplans, addresses, or scans in the repo.
- Never rewrite the ported engines (2D annotation, map/NFPA export) from scratch - port and wrap them
  (see "shell rewrite, engine port" in `docs/00-canonical-context.md`).
- Never `git push` without checking `git remote -v` first.
- Never rely on `git push` to deploy - this is a DIRECT-deploy project (`wrangler pages deploy`).

## Project structure

```
src/lib/brand/        White-label brand layer (types, profiles/, resolver). VITE_BRAND selects active.
src/lib/components/    Shared Svelte components (token-driven, no hard-coded brand colors).
src/lib/engines/       Ported framework-agnostic TS engines: 2d-annotate/, map-export/, splat-viewer/.
src/routes/            SvelteKit routes; +server.ts files are the API (replaces v1 catch-all).
tests/unit/            Vitest. tests/e2e/  Playwright (+ __screenshots__/).
docs/                  Spec (01), user stories (02), acceptance criteria (03), TDD plan (04),
                       sprint plan (05), editions+integrations (06), research/, pdf/ (generated).
```

Stack versions: SvelteKit + `@sveltejs/adapter-cloudflare`, Svelte 5, Vite, Vitest, Playwright.
3D = Spark (THREE.js, WebGL2); splats delivered as SPZ. 2D = PDF.js (pinned).

## Decision table

| Situation | Do this |
|---|---|
| Logic / engine math / schema / API handler | Vitest unit/integration test |
| User-visible flow or `[screenshot]`-tagged AC | Playwright E2E + screenshot |
| Need brand color in a component | `var(--brand-primary)` etc., never a hex literal |
| New brand needed | Add `src/lib/brand/profiles/<id>.ts`, set `VITE_BRAND` - no component edits |
| Storing a splat | Deliver SPZ; archive master PLY in cold R2, never serve PLY to clients |

## Conventions that differ from defaults

- ASCII-only in all committed text (code, comments, commits, docs).
- Direct deploy, not git-triggered.
- Test-first is enforced, not aspirational: a PR with a skipped/failing in-scope test does not merge.
