# Security Policy

Pathfinder handles sensitive-but-unclassified facility safety data (floorplans, exits, utility
shutoffs, 3D scans). We take security seriously.

## Reporting a vulnerability

Please report security issues **privately**. Do not open a public issue for a vulnerability.

- Use GitHub's **Report a vulnerability** (Security advisories) on this repository, or
- Contact Pathfinder LiDAR Solutions through https://pathfinder-lidar.pages.dev.

Include steps to reproduce, affected files/endpoints, and impact. We aim to acknowledge within a
few business days and will coordinate disclosure.

## Scope

In scope: authentication/authorization, session/cookie handling, SQL injection, secret exposure,
access-control bypass between organizations/tenants, XSS/CSRF, and exposure of facility data.

## Handling rules (also enforced in `AGENTS.md`)

- **Secrets and real facility data never enter the repository.** Code is public; `JWT_SECRET`,
  `STRIPE_SECRET_KEY`, and similar live only in Cloudflare secrets / `.dev.vars` (gitignored).
- All database access uses parameterized queries.
- Authorization is enforced server-side on every data route; client-supplied roles are never trusted.
- The application fails closed if a real `JWT_SECRET` is not configured in production.

## Current posture

Authentication has been security-audited. Hardening in place: PBKDF2-SHA256 (100k iterations) with
constant-time comparison, HS256 JWT with pinned algorithm and fail-closed secret, httpOnly/Secure/
SameSite cookies, short token TTL with token-version revocation, KV-backed login rate limiting,
anti-enumeration decoy hashing, input length caps, and security response headers (CSP, HSTS,
X-Frame-Options, X-Content-Type-Options, Referrer-Policy).
