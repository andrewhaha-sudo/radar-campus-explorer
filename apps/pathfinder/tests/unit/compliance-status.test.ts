// Unit tests for compliance status helpers (E11): NENA missing-field reporting
// (AC-11.1.2) and facility review staleness (AC-11.5.1).

import { describe, it, expect } from 'vitest';
import { requiredFieldsMissing } from '../../src/lib/engines/compliance/ng911';
import { isStale, daysSinceReview, postureSummary } from '../../src/lib/engines/compliance/status';

describe('NENA required-field validation', () => {
	it('reports missing civic fields', () => {
		expect(requiredFieldsMissing({ id: 'f', name: 'x', address: null, zip: null, phone: null, type: null })).toEqual(['address', 'zip', 'state']);
	});
	it('is empty when address, zip and state are present', () => {
		expect(
			requiredFieldsMissing({ id: 'f', name: 'x', address: '1 Main', zip: '16901', phone: null, type: 'school', state: 'PA' })
		).toEqual([]);
	});
});

describe('review staleness', () => {
	const now = '2026-06-17T00:00:00Z';
	it('flags a never-reviewed facility', () => {
		expect(isStale(null, now)).toBe(true);
	});
	it('flags a review older than a year', () => {
		expect(isStale('2025-01-01T00:00:00Z', now)).toBe(true);
	});
	it('passes a recent review', () => {
		expect(isStale('2026-05-01T00:00:00Z', now)).toBe(false);
	});
	it('computes days since review', () => {
		expect(daysSinceReview('2026-06-07T00:00:00Z', now)).toBe(10);
		expect(daysSinceReview(null, now)).toBeNull();
	});
});

describe('posture summary', () => {
	it('lists tracked mandates', () => {
		expect(postureSummary({ alyssasLaw: true, karisLaw: false, stateMandate: 'PA Act 44' })).toMatch(/Alyssa's Law.*PA Act 44/);
		expect(postureSummary({ alyssasLaw: false, karisLaw: false, stateMandate: null })).toMatch(/No specific mandates/);
	});
});
