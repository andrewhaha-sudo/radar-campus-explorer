# Pathfinder Portal — Editions & Third-Party Integrations

> Version 0.1 - 2026-06-15 - Owner: Pathfinder LiDAR Solutions - Status: Draft for review

This document defines the open-core product model (a free open-source edition plus a paid commercial edition with paying users from day one) and the third-party services the platform uses or should adopt.

---

## 1. Open-core model

Pathfinder ships in two editions from a single codebase lineage:

- **Pathfinder Community Edition (CE)** - open source (AGPL-3.0), self-hostable, single-brand. A genuinely useful floorplan review + safety-mapping portal a school district or fire department could run themselves.
- **Pathfinder Pro** - commercial, hosted SaaS operated by Pathfinder LiDAR Solutions, with paying customers from launch. Pro adds the white-label/multi-tenant, 3D scan hosting, collaboration-at-scale, compliance, and enterprise-auth capabilities that the research identifies as the monetizable differentiators.

Pathfinder LiDAR owns the copyright and therefore dual-licenses: CE under AGPL-3.0 (so anyone running a modified version as a network service must publish their changes), and Pro under a commercial license (see `COMMERCIAL.md`). This protects the hosted-SaaS moat while keeping the core honestly open.

### 1.1 Why this split

The competitive research (research/01) shows the market is full of heavy bundled platforms. CE earns trust, adoption, and contributions with a real tool. Pro monetizes exactly the capabilities that are expensive to operate (3D splat hosting, large-file storage, compliance exports, multi-tenant white-label) and that institutional buyers will pay for - the same wedge incumbents leave open.

## 2. Edition feature matrix

Mapped to the canonical epics (E1-E14). "Core" = a usable subset; "Full" = the complete capability.

| Capability (epic) | Community Edition | Pathfinder Pro |
|---|---|---|
| White-label brand layer (E1) | Single brand (self-host your own) | **Full multi-brand / drop-in operator branding; resell under any brand** |
| Identity, roles & access (E2) | JWT + roles (admin/staff/client), audit log | **+ SSO/SAML/OIDC, MFA, SCIM provisioning** |
| Org hierarchy & dashboards (E3) | Single org; basic project list | **District > Facility > Building hierarchy + roll-up dashboards** |
| Project & review workflow (E4) | Full | Full + approvals/SLA reporting |
| 2D annotation engine (E5) | **Full** (ported, all tools) | Full |
| Safety mapping & NFPA export (E6) | NFPA markers + legend + single-map PDF export | **+ Batch export pipeline, templated multi-building runs** |
| Unified scan library & media (E7) | Local/self-managed storage, basic versioning | **Managed R2 hosting, multipart upload, cold archive, quotas** |
| 3D scan viewer (E8) | **mp4 walkthrough playback** | **+ Interactive Gaussian-splat viewer, 3D measurement, anchored 3D markers, floor switching, viewpoints, version compare** |
| Collaboration (E9) | In-app comment threads + resolve | **+ @mentions, batched email notifications, external share links** |
| Global search (E10) | Per-project search | **Cross-org FTS5 global search** |
| Compliance & trust (E11) | Audit log (in-app) | **NG911/NENA GeoJSON export, immutable audit export, compliance metadata, trust page, DPA** |
| Accessibility (E12) | WCAG 2.1 AA UI | WCAG 2.1 AA UI + maintained VPAT/ACR |
| Admin & platform ops (E13) | User + API-key management | **+ Multi-tenant admin, usage metering, billing** |
| Quality & delivery harness (E14) | Full (open test suite) | Full |
| Billing & subscriptions | n/a (self-host) | **Stripe-based subscriptions, metered storage** |
| Support | Community (issues/discussions) | **Priority support + SLA** |

## 3. Third-party services & integrations

### 3.1 In use / core stack

| Service | Role | Edition | Notes |
|---|---|---|---|
| Cloudflare (Pages, Workers, D1, R2, KV) | Hosting, DB, object storage, cache | Both | Core platform; CE can self-host on a free CF account |
| Resend | Transactional email (invites, password reset, notifications, @mentions) | Both (CE optional) | v1 already wired `RESEND_API_KEY` / `RESEND_FROM` |

### 3.2 Adopt now (priority - required for Pro launch)

| Service | Role | Why now |
|---|---|---|
| **Stripe** | Subscriptions, Checkout, Customer Portal, usage/metered billing via webhooks (Workers) | Pro has paying users from day one - billing is launch-blocking |
| **Cloudflare Turnstile** | Bot/abuse protection on login + public forms | Free, native to the stack, low effort |
| **Sentry** (or Cloudflare Observability + Logpush) | Error monitoring, performance, release health | Production reliability for paying customers |

### 3.3 Forward / partner integrations (Pro, market-driven)

| Service | Role | Trigger |
|---|---|---|
| **RapidSOS** | Push verified maps/location data to PSAPs (NG911 clearinghouse) | The universal 911-buyer integration (research/01); pursue partner program |
| **Geocoding** (Mapbox or Google Maps) | Facility address -> coordinates for NG911/NENA GIS export and map context | When NG911 GeoJSON export (E11) ships |
| **SSO / Identity** (WorkOS, or self-hosted OIDC/SAML) | Enterprise SSO + MFA + SCIM | First enterprise gov/edu customer requiring SSO |
| **SIS integration** (Clever / ClassLink) | School roster sync for reunification/account provisioning | K-12 reunification feature work |
| **Antivirus / content scanning** | Scan uploaded PDFs/media before serving | Before opening uploads to untrusted client users at scale |

### 3.4 Offline pipeline (not runtime APIs)

| Tool | Role |
|---|---|
| FJD Trion Model | Point cloud -> Gaussian splat generation + mp4 walkthrough export (desktop) |
| PlayCanvas SplatTransform (CLI) | Convert PLY -> SPZ (web delivery format) |
| SuperSplat editor | Clean floaters/outliers before delivery |

### 3.5 Secrets these imply

All set as Cloudflare secrets / env vars, never committed (see `AGENTS.md`):
`JWT_SECRET`, `RESEND_API_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `TURNSTILE_SECRET_KEY`, `SENTRY_DSN`, and (forward) `RAPIDSOS_*`, `MAPBOX_TOKEN`, SSO client secrets.

## 4. Decisions & open questions

- **Decision:** CE = AGPL-3.0; Pro = commercial dual-license. Single repo public; Pro-only modules may live behind a feature flag or a separate private package - to be finalized in S1.
- **Decision:** Stripe is the billing provider for Pro.
- **Open:** Whether Pro-only code ships in the public repo behind flags, or in a private overlay repo. Recommendation: keep CE complete and honest in public; gate Pro features by license/flag, with server-enforced entitlement checks.
- **Open:** RapidSOS and SSO vendor selection deferred until first customer demand.
