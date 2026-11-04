// Seed unit tests for the white-label brand layer (Epic E1).
// These are the worked example for the per-AC tests described in
// docs/04-tdd-plan.md (T-<AC> ids). They exercise real code in
// src/lib/brand: brand resolution and the brandToCssVars helper.

import { describe, it, expect } from 'vitest';
import { brandToCssVars, resolveBrand, profiles, DEFAULT_BRAND_ID } from '../../src/lib/brand/index';
import { pathfinder } from '../../src/lib/brand/profiles/pathfinder';
import { els911 } from '../../src/lib/brand/profiles/els911';

describe('brand resolution', () => {
	it('defaults to the pathfinder brand', () => {
		expect(DEFAULT_BRAND_ID).toBe('pathfinder');
		expect(resolveBrand(undefined).id).toBe('pathfinder');
		expect(resolveBrand(null).id).toBe('pathfinder');
		expect(resolveBrand('does-not-exist').id).toBe('pathfinder');
	});

	it('resolves els911 by id', () => {
		expect(resolveBrand('els911').id).toBe('els911');
	});

	it('registers upstream profiles and the integrated RADAR profile', () => {
		expect(Object.keys(profiles).sort()).toEqual(['els911', 'pathfinder', 'radar']);
	});

	it('els911 primary color is the brand red #B22234', () => {
		expect(els911.colors.primary).toBe('#B22234');
	});

	it('pathfinder default background is dark slate #0a131e', () => {
		expect(pathfinder.colors.bg).toBe('#0a131e');
	});
});

describe('brandToCssVars', () => {
	it('emits all brand custom properties', () => {
		const css = brandToCssVars(pathfinder);
		expect(css).toContain('--brand-primary');
		expect(css).toContain('--brand-secondary');
		expect(css).toContain('--brand-accent');
		expect(css).toContain('--brand-bg');
		expect(css).toContain('--brand-surface');
		expect(css).toContain('--brand-text');
		expect(css).toContain('--brand-muted');
		expect(css).toContain('--brand-font-display');
		expect(css).toContain('--brand-font-body');
		expect(css).toContain('--brand-font-mono');
	});

	it('maps token values into the declaration', () => {
		const css = brandToCssVars(pathfinder);
		expect(css).toContain(`--brand-primary: ${pathfinder.colors.primary}`);
		expect(css).toContain(`--brand-bg: ${pathfinder.colors.bg}`);
	});

	it('reflects the active brand when resolving els911', () => {
		const css = brandToCssVars(resolveBrand('els911'));
		expect(css).toContain('--brand-primary: #B22234');
		expect(css).toContain('--brand-secondary: #002868');
	});

	it('produces a syntactically terminated declaration block', () => {
		const css = brandToCssVars(pathfinder);
		expect(css.trim().endsWith(';')).toBe(true);
	});
});
