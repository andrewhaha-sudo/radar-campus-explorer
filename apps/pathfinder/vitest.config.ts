import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { fileURLToPath } from 'node:url';

// Unit-test config (Epic E14). Kept separate from vite.config.ts so the
// SvelteKit plugin's vite types are not mixed with vitest's bundled vite.
// The svelte plugin is included so `.svelte.ts` rune modules (e.g. the toast
// store) compile under test. E2E is owned by Playwright (playwright.config.ts).
export default defineConfig({
	plugins: [svelte({ compilerOptions: { runes: true } })],
	resolve: {
		// Use the browser/runes build of svelte in tests, and mirror $lib.
		conditions: ['browser'],
		alias: {
			$lib: fileURLToPath(new URL('./src/lib', import.meta.url))
		}
	},
	test: {
		include: ['tests/unit/**/*.{test,spec}.{js,ts}'],
		environment: 'node'
	}
});
