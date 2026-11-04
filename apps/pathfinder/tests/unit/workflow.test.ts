// Unit tests for the project review workflow state machine (Epic E4).

import { describe, it, expect } from 'vitest';
import {
	canTransition,
	availableTransitions,
	progressForStatus,
	isValidStatus,
	isValidMemberRole
} from '../../src/lib/engines/workflow/status';

describe('project status transitions', () => {
	it('allows the legal edges', () => {
		expect(canTransition('draft', 'in_review')).toBe(true);
		expect(canTransition('in_review', 'approved')).toBe(true);
		expect(canTransition('in_review', 'draft')).toBe(true);
		expect(canTransition('approved', 'archived')).toBe(true);
		expect(canTransition('archived', 'draft')).toBe(true);
	});

	it('rejects illegal edges', () => {
		expect(canTransition('draft', 'approved')).toBe(false); // must pass review
		expect(canTransition('approved', 'draft')).toBe(false); // reopen review first
		expect(canTransition('archived', 'approved')).toBe(false);
	});

	it('lists available transitions with labels', () => {
		const t = availableTransitions('in_review');
		expect(t.map((x) => x.to).sort()).toEqual(['approved', 'draft']);
		expect(t.find((x) => x.to === 'approved')?.label).toBe('Approve');
	});

	it('maps status to canonical progress', () => {
		expect(progressForStatus('draft')).toBe(10);
		expect(progressForStatus('in_review')).toBe(60);
		expect(progressForStatus('approved')).toBe(100);
	});

	it('validates status + member role', () => {
		expect(isValidStatus('approved')).toBe(true);
		expect(isValidStatus('bogus')).toBe(false);
		expect(isValidMemberRole('reviewer')).toBe(true);
		expect(isValidMemberRole('admin')).toBe(false);
	});
});
