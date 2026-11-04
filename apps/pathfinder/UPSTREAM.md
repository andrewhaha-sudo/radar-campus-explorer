# Pathfinder platform integration

Complete upstream source imported from https://github.com/melonmelonz/pathfinder
at d07b3fcf96c3dd04f9ffc5e59120a61d93e99e5a under AGPL-3.0-or-later.

Local additions connect the RADAR campus, brand, shared draft publishing, PDFs
and root build/runtime. Database migrations and core engines are preserved.
Cloudflare resource identifiers are local placeholders, not the upstream
operator's resources. The nested deploy command delegates to the root platform.
See ../../docs/PATHFINDER-PLATFORM.md for runtime and deployment requirements.

The scan runtime now allows its embedded Wasm/blob worker on scan pages only,
surfaces failed loads, supplies the stored filename to the decoder and reloads
when switching scans. The integrated navigation wraps at phone widths.

The annotation engine is now canonical for both the Svelte viewer and React
device-draft editor. Internal imports use explicit TypeScript extensions for
Node 24 tests. The optional same-origin LifeRouter proxy is a local addition.
