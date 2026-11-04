import { defineConfig, devices } from '@playwright/test';

// E2E harness (Epic E14). Boots the app via `wrangler pages dev` so server
// routes have the Cloudflare bindings (D1 `DB`, JWT_SECRET from .dev.vars) and
// the seeded test users, then runs the specs in tests/e2e. Screenshots land in
// tests/e2e/__screenshots__.
const PORT = 4173;

export default defineConfig({
	testDir: 'tests/e2e',
	outputDir: 'test-results',
	// All specs share ONE local D1 (miniflare SQLite) behind the dev server, so
	// they run serially - parallel workers cause SQLite write-contention flakes
	// (a full-table reindex racing concurrent writes). Production D1 handles
	// concurrency fine; this is purely a single-file-SQLite test-runner artifact.
	fullyParallel: false,
	workers: 1,
	reporter: [['html', { outputFolder: 'playwright-report', open: 'never' }], ['list']],
	use: {
		baseURL: `http://localhost:${PORT}`,
        launchOptions: {
            ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } : {}),
            args: process.env.PLAYWRIGHT_SOFTWARE_WEBGL === '1' ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : []
        },
		screenshot: 'on',
		trace: 'on-first-retry'
	},
    // Keep software-WebGL integration flows in a fresh browser process after
    // upstream checks; shared D1 still requires a single worker.
    projects: [
        { name: 'chromium', testIgnore: /radar-platform\.spec\.ts/, use: { ...devices['Desktop Chrome'] } },
        { name: 'radar-integration', testMatch: /radar-platform\.spec\.ts/, dependencies: ['chromium'], use: { ...devices['Desktop Chrome'] } }
    ],
	webServer: {
		// Build, apply the local D1 migration, seed the test users, then serve
		// the built worker with the local bindings so login works end to end.
		command: 'npm run e2e:serve',
		port: PORT,
		reuseExistingServer: !process.env.CI,
		timeout: 180_000
	}
});
