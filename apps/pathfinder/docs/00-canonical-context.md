# Pathfinder Portal — Canonical Context

> Internal source-of-truth for the v2 documentation set. Every other document (specification, user stories, acceptance criteria, TDD plan, sprint plan) draws its product framing, terminology, identifiers, and decisions from this file. If two documents disagree, this file wins.

---

## 1. Product framing

- **Pathfinder** is a white-label web platform for emergency floorplan mapping and 3D facility documentation, **built and owned by Pathfinder LiDAR Solutions**.
- **ELS911 (Emergency Location Services 911)** is the flagship *operator deployment* — the first brand the platform ships under. It is **not** the product; it is one skin.
- The platform is **multi-level**:
  - **Operator** — the company running a Pathfinder deployment under its own brand (Pathfinder LiDAR itself, ELS911, or a future reseller). One deployment = one operator brand. The operator brand is the **drop-in** white-label layer.
  - **Client org** — a customer of the operator (a school district, a 911 center, a university, a hospital, a government agency). Many client orgs live inside one deployment; they are *tenants*, not brands.
- Lineage: v1 is the existing `els911-portal` (vanilla HTML/CSS/JS on Cloudflare Pages). v2 ("Pathfinder") is a SvelteKit rewrite of the **shell** that **ports** v1's proven engines.

## 2. The de-risking principle: *shell rewrite, engine port*

The app shell (auth, routing, dashboards, CRUD, state) is rewritten in SvelteKit. The **imperative engines are ported as framework-agnostic TypeScript modules mounted into thin Svelte wrappers — not rewritten**:

- **2D annotation engine** — PDF.js + canvas, 12+ annotation tools (v1 `viewer.js`, ~196KB).
- **Map / NFPA export engine** — markers, hallway polygons, legend autofit, multi-page print ordering.
- **3D splat viewer** — new, built on Spark (THREE.js).

Rationale: v1's canvas/print logic is battle-tested and full of fiddly correctness (marker placement, legend autofit, jitter, print order). We modernize structure without re-litigating logic that already works. Each engine gets its own unit tests as it is extracted.

## 3. Stack & infrastructure decisions

| Decision | Choice | Note |
|---|---|---|
| Framework | SvelteKit (Svelte 5) | Same as `pathfinder-lidar`; reads well in vim |
| Adapter | `@sveltejs/adapter-cloudflare` | Pages + Functions |
| API | SvelteKit `+server.ts` server routes | Replaces v1 `functions/api/[[route]].js` catch-all |
| Database | Cloudflare D1 (SQLite) | binding `DB` |
| File storage | Cloudflare R2 | binding `DOCUMENTS` |
| Cache / sessions | Cloudflare KV | binding `CACHE` |
| Search | D1 FTS5 virtual tables | facilities, buildings, projects, documents, marker labels |
| Auth | JWT (HS256, Web Crypto) + API keys | ported from v1; MFA/SSO forward-looking |
| 2D rendering | PDF.js (pinned) | ported engine |
| 3D rendering | Spark (THREE.js, WebGL2) | new |
| Splat delivery format | SPZ | master PLY archived cold in R2, never served |
| Deploy | `wrangler pages deploy` (direct) | git push does NOT publish |
| Repo | `github.com/melonmelonz/pathfinder` | **public**; secrets & client data never committed |
| Test CF project | `pathfinder` -> `pathfinder.pages.dev` | isolated from els911-portal production |

## 4. Branding model (white-label / drop-in)

- A single **brand profile** is the source of truth: `brand/<id>/brand.config.ts` + logo/favicon assets.
- Brand profile fields: `productName`, `operatorName`, `operatorLegalName`, `logo`, `logoMark`, `favicon`, color tokens (`--brand-primary`, `--brand-secondary`, `--brand-accent`, neutrals), typography, `supportEmail`, `supportPhone`, `legalFooter`, `domains`.
- Tokens flow to CSS custom properties at load; components reference tokens only — **no hard-coded brand colors anywhere in components**.
- **Default brand = Pathfinder LiDAR.** **`els911` ships as a ready-made profile.** Rebrand = add/swap one profile + drop in a logo; no component edits.
- Resolution: build-time default via env (`BRAND=els911`); runtime per-hostname resolution is a forward-looking option (a domain maps to a brand profile).

### Brand palettes (reference)

**Pathfinder LiDAR (default):** dark slate `#0a131e` / void `#060b12` / navy `#1b3147`; point-cloud ramp far `#3e5366` -> mid `#6e93ad` -> near `#a9cce3` -> hot `#e6f2fb`; accents sky `#6fa8d4`, steel-blue `#3f6e98`, ice `#c4e2f5`. Squared (radius 3px), restrained glow, NOT green. Fonts: Clash Display + Satoshi + JetBrains Mono.

**ELS911:** primary red `#B22234`, navy `#002868`, sky `#3B82F6`, gold `#C8960C`. (From v1 `tokens.css`.)

## 5. Epic map (canonical IDs)

| Epic | Title | Summary |
|---|---|---|
| **E1** | White-Label Brand Layer | Drop-in brand profiles; Pathfinder default + ELS911 profile; token-driven theming |
| **E2** | Identity, Roles & Access | JWT + API keys; RBAC admin/staff/client; org-scoped; audit log; MFA/SSO forward |
| **E3** | Org Hierarchy & Dashboards | Org -> District -> Facility -> Building; roll-up dashboards; breadcrumb switchers |
| **E4** | Project & Review Workflow | Projects, status, progress, members; version loop; approvals |
| **E5** | 2D Floorplan Annotation Engine | Ported PDF.js + canvas; 12+ tools; JSON export |
| **E6** | Safety Mapping & NFPA Export | Markers; NFPA 170 symbol library; legend autofit; batch PDF export; z-axis floor labels |
| **E7** | Unified Scan Library & Media | `media_assets`; versioning; R2 multipart upload; point-cloud cold archive |
| **E8** | 3D Scan Viewer | mp4 walkthrough + Spark splat viewer; 3D measurement; anchored markers; floor switching; viewpoints; version compare |
| **E9** | Collaboration | Anchored comment threads; resolve workflow; @mentions; activity feed; batched email; share links |
| **E10** | Global Search | FTS5 across facilities/buildings/projects/documents/markers |
| **E11** | Compliance & Trust | NG911/NENA GIS export; immutable audit logs; FERPA/DPA posture; trust page; compliance metadata |
| **E12** | Accessibility | WCAG 2.1 AA (2.2 forward); keyboard nav; SR labels; non-visual map alternatives; VPAT |
| **E13** | Admin & Platform Ops | User mgmt; API keys; audit viewer; settings; observability |
| **E14** | Quality & Delivery Harness | TDD: Vitest + Playwright screenshots; CI; deploy to CF test |

## 6. Identifier conventions

- **Epic:** `E<n>` (E1..E14).
- **Functional requirement:** `FR-<n>`. **Non-functional:** `NFR-<n>`.
- **User story:** `US-<epic>.<n>` (e.g. `US-3.2` = 2nd story of epic E3).
- **Acceptance criterion:** `AC-<story>.<n>` (e.g. `AC-3.2.1`). Written Given/When/Then.
- **Test:** `T-<AC>` (e.g. `T-3.2.1`) — the failing test that proves the AC.
- **Sprint:** `S<n>` (S0..S7).
- Traceability chain: **Epic -> US -> AC -> Test -> Sprint.**

## 7. Sprint map (canonical)

| Sprint | Theme | Primary epics |
|---|---|---|
| **S0** | Baseline (retroactive) — document v1 engine + schema as the inherited foundation | E5, E6 (partial), E4 (partial), E2 (partial) |
| **S1** | Foundation — SvelteKit scaffold, CF adapter, brand layer, auth port, test harness, AGENTS.md | E1, E2, E14 |
| **S2** | Hierarchy — org/district/facility/building + roll-up dashboards + search-ready nav | E3 |
| **S3** | Engine port — 2D annotation + map/NFPA export into Svelte wrappers | E5, E6 |
| **S4** | Scan library — `media_assets`, R2 multipart upload, point-cloud archive | E7 |
| **S5** | 3D viewer — mp4 player + Spark splat viewer + measurement + 3D markers | E8 |
| **S6** | Search & collaboration — FTS5 global search, batch map export, comment/resolve/@mention/notifications | E10, E6, E9 |
| **S7** | Compliance, accessibility, migration & launch — NG911 export, audit, WCAG 2.1 AA, v1->v2 data migration, deploy | E11, E12, E13 |

## 8. Data model additions (over v1 schema)

v1 tables retained (additively): `users`, `projects`, `project_members`, `documents`, `annotations`, `project_notes`, `annotation_comments`, `map_markers`, `map_crops`, `api_keys`, `activity_log`, `audit_log`.

New/changed for v2:
- `orgs`, `districts`, `facilities`, `buildings` — hierarchy. `projects.building_id` FK.
- `brands` — operator brand profiles (or file-based config; DB optional for runtime resolution).
- `media_assets` — supersedes flat `documents.doc_type`: `floorplan_pdf | point_cloud | splat | walkthrough_video | reference_image`, with `version`, `r2_key`, `storage_tier` (hot/cold), `capture_date`, `surveyor`.
- `scan_markers_3d` — markers anchored in 3D scenes (position, normal, viewpoint, type, label, description).
- `viewpoints` — named camera bookmarks per scan.
- `export_jobs` — queued/tracked batch PDF map exports.
- `search_index` — FTS5 virtual table.
- `compliance_meta` — per-facility: last-reviewed date, last responder tour, mandate flags (Alyssa's/Kari's/state), drill links, z-axis floor labels.

## 8b. Open-core editions & integrations

Pathfinder is open-core. See `docs/06-editions-and-integrations.md` for the full matrix.

- **Community Edition (CE)** - open source (AGPL-3.0), self-host, single-brand. Includes the 2D annotation engine (E5 full), NFPA mapping + single-map export (E6 core), mp4 walkthrough viewing (E8 baseline), projects/roles/audit (E2/E4 core).
- **Pathfinder Pro** - commercial hosted SaaS by Pathfinder LiDAR, paying users from day one. Adds white-label multi-brand (E1 full), interactive 3D splat viewer + measurement + 3D markers (E8 full), district hierarchy (E3 full), collaboration at scale (E9 full), global search (E10), compliance/NG911 export (E11), SSO/MFA, batch export, Stripe billing.
- Dual-licensed (Pathfinder LiDAR owns copyright): CE AGPL-3.0; Pro commercial (`COMMERCIAL.md`).

**Third-party services:** core = Cloudflare + Resend (email). Adopt now for Pro = **Stripe** (billing, launch-blocking), Cloudflare Turnstile (bot protection), Sentry/CF Observability. Forward/partner = RapidSOS (PSAP), Mapbox/Google geocoding (NG911 GIS), WorkOS/OIDC SSO, Clever/ClassLink SIS. Offline pipeline (not APIs): FJD Trion Model, SplatTransform, SuperSplat.

## 9. Voice & format rules for the doc set

- Plain ASCII only (no em dashes, no smart quotes, no arrows-as-glyphs except where tables use `->`). This keeps CF Pages deploy commit messages safe and renders cleanly in PDF.
- Concrete over abstract; cite the research briefs (`docs/research/`) where a claim is grounded.
- Acceptance criteria are testable behaviors, never implementation detail.
- Cross-reference by ID, not by page.
