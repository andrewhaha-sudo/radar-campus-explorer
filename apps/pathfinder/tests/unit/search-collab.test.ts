// Unit tests for search query building (E10), result ranking, @-mention parsing
// and notification batching (E9).

import { describe, it, expect } from 'vitest';
import { toFtsMatch, rankHits, parseMentions, type SearchHit } from '../../src/lib/engines/search/query';
import { batchNotifications, type PendingNotification } from '../../src/lib/engines/collab/notify';

describe('FTS match building', () => {
	it('quotes each token and prefix-matches the last', () => {
		expect(toFtsMatch('lincoln high')).toBe('"lincoln" "high"*');
		expect(toFtsMatch('  egress  ')).toBe('"egress"*');
	});
	it('neutralises FTS operators / injection attempts', () => {
		// stars and quotes the user typed are stripped, so no operator survives
		expect(toFtsMatch('a* OR "x"')).toBe('"a" "OR" "x"*');
	});
	it('returns empty for blank queries', () => {
		expect(toFtsMatch('   ')).toBe('');
		expect(toFtsMatch('')).toBe('');
	});
});

describe('result ranking', () => {
	it('orders by rank, then entity-type priority, then title', () => {
		const hits: SearchHit[] = [
			{ entity_type: 'document', entity_id: 'd', title: 'B', url: '/d', rank: 1 },
			{ entity_type: 'facility', entity_id: 'f', title: 'A', url: '/f', rank: 1 },
			{ entity_type: 'building', entity_id: 'b', title: 'A', url: '/b', rank: 0 }
		];
		expect(rankHits(hits).map((h) => h.entity_id)).toEqual(['b', 'f', 'd']);
	});
});

describe('mention parsing', () => {
	it('extracts unique lower-cased handles', () => {
		expect(parseMentions('hey @Jane and @bob_91, cc @Jane')).toEqual(['jane', 'bob_91']);
	});
	it('ignores emails and mid-word @', () => {
		expect(parseMentions('mail me at a@b.com')).toEqual([]);
	});
});

describe('notification batching', () => {
	const base = { resourceUrl: '/d/1#c', excerpt: 'check this' };
	it('produces one digest per recipient with a summary subject', () => {
		const pending: PendingNotification[] = [
			{ recipientId: 'u1', recipientEmail: 'a@x.com', actorName: 'Sam', kind: 'mention', ...base },
			{ recipientId: 'u1', recipientEmail: 'a@x.com', actorName: 'Sam', kind: 'reply', resourceUrl: '/d/2#c', excerpt: 'and this' },
			{ recipientId: 'u2', recipientEmail: 'b@x.com', actorName: 'Sam', kind: 'mention', ...base }
		];
		const digests = batchNotifications(pending);
		expect(digests).toHaveLength(2);
		expect(digests[0].recipientId).toBe('u1');
		expect(digests[0].subject).toMatch(/1 mention, 1 reply/);
		expect(digests[0].deepLinks).toHaveLength(2);
		expect(digests[1].subject).toContain('mentioned you');
	});
});
