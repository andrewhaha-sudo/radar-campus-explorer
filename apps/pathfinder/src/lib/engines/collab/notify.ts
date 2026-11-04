// Collaboration notification batching (Epic E9). Pure: collapses many pending
// mention/reply notifications into one digest per recipient so a busy thread
// does not fan out one email per comment (the "notification fatigue" the AC
// guards against). The Resend send happens server-side; this only decides what
// to send. No DB, no network.

export interface PendingNotification {
	recipientId: string;
	recipientEmail: string;
	actorName: string;
	kind: 'mention' | 'reply' | 'resolve';
	resourceUrl: string;
	excerpt: string;
}

export interface Digest {
	recipientId: string;
	recipientEmail: string;
	subject: string;
	lines: string[];
	deepLinks: string[];
}

/**
 * Group pending notifications into one digest per recipient. Subject summarises
 * the count + kinds; lines describe each event; deepLinks are the unique URLs
 * to surface. Recipients are emitted in first-seen order, deterministically.
 */
export function batchNotifications(pending: PendingNotification[]): Digest[] {
	const order: string[] = [];
	const groups = new Map<string, PendingNotification[]>();
	for (const n of pending) {
		if (!groups.has(n.recipientId)) {
			groups.set(n.recipientId, []);
			order.push(n.recipientId);
		}
		groups.get(n.recipientId)!.push(n);
	}

	return order.map((rid) => {
		const items = groups.get(rid)!;
		const mentions = items.filter((i) => i.kind === 'mention').length;
		const replies = items.filter((i) => i.kind === 'reply').length;
		const resolves = items.filter((i) => i.kind === 'resolve').length;
		const parts: string[] = [];
		if (mentions) parts.push(`${mentions} mention${mentions > 1 ? 's' : ''}`);
		if (replies) parts.push(`${replies} repl${replies > 1 ? 'ies' : 'y'}`);
		if (resolves) parts.push(`${resolves} resolved`);
		const subject =
			items.length === 1
				? `${items[0].actorName} ${verb(items[0].kind)} you on Pathfinder`
				: `Pathfinder: ${parts.join(', ')}`;
		const deepLinks = [...new Set(items.map((i) => i.resourceUrl))];
		return {
			recipientId: rid,
			recipientEmail: items[0].recipientEmail,
			subject,
			lines: items.map((i) => `${i.actorName} ${verb(i.kind)}: "${i.excerpt}"`),
			deepLinks
		};
	});
}

function verb(kind: PendingNotification['kind']): string {
	return kind === 'mention' ? 'mentioned' : kind === 'reply' ? 'replied to' : 'resolved a thread with';
}
