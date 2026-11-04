// Harness + brand + a11y AC coverage (E1/E12/E14):
// AC-1.1.2/1.4.1 brand colours come from CSS vars, not hard-coded in components;
// AC-1.2.1 a brand swap changes the palette; AC-12.4.1 brand text meets WCAG AA;
// AC-12.4.2 a VPAT exists; AC-14.2.1 ported engines ship unit tests;
// AC-14.4.1 CI runs both suites; AC-14.5.1 deploy targets the pathfinder project.

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { contrastRatio, meetsAA } from '../../src/lib/engines/a11y/contrast';
import { pathfinder } from '../../src/lib/brand/profiles/pathfinder';
import { els911 } from '../../src/lib/brand/profiles/els911';

function walk(dir: string, out: string[] = []): string[] {
	for (const n of readdirSync(dir)) {
		const p = join(dir, n);
		if (statSync(p).isDirectory()) walk(p, out);
		else out.push(p);
	}
	return out;
}

describe('AC-1.1.2 / AC-1.4.1 no hard-coded brand colours in components/routes', () => {
	it('the brand palette hexes appear only in the brand profiles', () => {
		const brandHexes = Object.values(pathfinder.colors).map((h) => h.toLowerCase());
		const files = walk('src').filter(
			(f) => (f.endsWith('.svelte') || (f.endsWith('.ts') && !f.includes('/brand/'))) && !f.includes('/engines/')
		);
		const offenders: string[] = [];
		for (const f of files) {
			const src = readFileSync(f, 'utf8').toLowerCase();
			for (const hex of brandHexes) if (src.includes(hex)) offenders.push(`${f} -> ${hex}`);
		}
		expect(offenders).toEqual([]); // components reference var(--brand-*), not literals
	});
});

describe('AC-1.2.1 a brand swap changes the palette', () => {
	it('els911 differs from pathfinder and both define every token', () => {
		expect(els911.colors.primary).not.toBe(pathfinder.colors.primary);
		for (const k of Object.keys(pathfinder.colors)) {
			expect(els911.colors).toHaveProperty(k);
		}
	});
});

describe('AC-12.4.1 brand tokens meet WCAG AA contrast', () => {
	it('body text on background is AA', () => {
		expect(meetsAA(pathfinder.colors.text, pathfinder.colors.bg)).toBe(true);
		expect(meetsAA(els911.colors.text, els911.colors.bg)).toBe(true);
	});
	it('primary on background meets the 3:1 UI threshold', () => {
		expect(contrastRatio(pathfinder.colors.primary, pathfinder.colors.bg)).toBeGreaterThanOrEqual(3);
	});
});

describe('AC-12.4.2 / AC-14.4.1 / AC-14.5.1 / AC-14.2.1 delivery harness artifacts', () => {
	it('a VPAT/ACR document exists', () => {
		expect(existsSync('docs/07-vpat-accessibility.md')).toBe(true);
	});
	it('CI runs both the unit and e2e suites', () => {
		const ci = readFileSync('.github/workflows/ci.yml', 'utf8');
		expect(ci).toMatch(/test:unit/);
		expect(ci).toMatch(/test:e2e/);
	});
	it('integrated deploy delegates to the root project and cannot target upstream resources', () => {
        const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
        expect(pkg.scripts.deploy).toBe('node ../../scripts/platform.mjs deploy');
        const root = readFileSync('../../wrangler.toml', 'utf8');
        expect(root).toMatch(/name\s*=\s*"radar-campus-explorer"/);
        expect(root).not.toContain('33c6c16e-5849-4aec-8afa-49ee6fdf87d7');
        expect(root).not.toContain('6576675808314bfd99b080eef61c6c7c');
    });
	it('each ported engine area ships unit tests (AC-14.2.1)', () => {
		const tests = readdirSync('tests/unit').join(' ');
		for (const area of ['annotate-engine', 'map-engine', 'splat-viewer', 'media-policy']) {
			expect(tests).toContain(area);
		}
	});
});
