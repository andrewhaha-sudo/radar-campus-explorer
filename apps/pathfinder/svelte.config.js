import adapter from '@sveltejs/adapter-cloudflare';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),
	kit: {
		// Cloudflare Pages + Functions deployment target (canonical sec 3).
		// adapter-cloudflare emulates platform bindings in `vite dev` from
		// wrangler.toml + .dev.vars (D1 `DB`, JWT_SECRET), so server routes can
		// read `platform.env` locally just as they do on Pages.
		adapter: adapter({ platformProxy: { configPath: '../../wrangler.toml', persist: { path: '../../.wrangler/state/v3' } } }),

		// CSP for SvelteKit's OWN inline hydration assets. `mode:hash` makes the
		// framework emit a CSP <meta> carrying a sha256 hash per inline <script>
		// it injects, so script-src stays tight without 'unsafe-inline'. The
		// brand-token <style> injected via {@html} in +layout.svelte is not a
		// SvelteKit asset, so style-src keeps 'unsafe-inline' (low risk; keeps
		// the brand layer rendering). hooks.server.ts adds the framing and
		// transport headers (frame-ancestors via X-Frame-Options, HSTS) that a
		// <meta> CSP cannot express, plus a complementary response-header CSP.
		csp: {
			mode: 'hash',
			directives: {
				'script-src': ['self', 'wasm-unsafe-eval'],
                'worker-src': ['self', 'blob:'],
				'style-src': ['self', 'unsafe-inline'],
				'object-src': ['none'],
				'base-uri': ['self']
			}
		}
	}
};

export default config;
