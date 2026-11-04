// /api/notifications/digest (Epic E9). Collapses unbatched notifications into
// one digest per recipient (the batching the AC requires to avoid fatigue) and
// sends each via Resend when RESEND_API_KEY is configured, then marks them
// batched. Idempotent-ish: only unbatched rows are picked up. Admin/staff (or a
// cron trigger) invoke it.

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { isGlobalScope } from '$lib/server/hierarchy';
import { unbatchedNotifications, markBatched } from '$lib/server/collab';
import { batchNotifications, type PendingNotification } from '$lib/engines/collab/notify';

export const POST: RequestHandler = async ({ locals, platform }) => {
	const env = platform?.env as { DB: D1Database; RESEND_API_KEY?: string; RESEND_FROM?: string } | undefined;
	if (!env?.DB) error(500, 'Database binding unavailable.');
	if (!locals.user) error(401, 'Not authenticated.');
	if (!isGlobalScope(locals.user)) error(403, 'Staff or admin role required.');

	const raw = await unbatchedNotifications(env);
	if (raw.length === 0) return json({ ok: true, digests: 0, sent: 0 });

	const pending: PendingNotification[] = raw.map((n) => ({
		recipientId: n.recipient_id,
		recipientEmail: n.recipient_email,
		actorName: n.actor_name,
		kind: n.kind,
		resourceUrl: n.resource_url,
		excerpt: n.excerpt
	}));
	const digests = batchNotifications(pending);

	let sent = 0;
	const from = env.RESEND_FROM || 'Pathfinder <notify@pathfinder.example>';
	for (const d of digests) {
		if (env.RESEND_API_KEY) {
			const text = [...d.lines, '', 'Open:', ...d.deepLinks].join('\n');
			const res = await fetch('https://api.resend.com/emails', {
				method: 'POST',
				headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, 'content-type': 'application/json' },
				body: JSON.stringify({ from, to: d.recipientEmail, subject: d.subject, text })
			});
			if (res.ok) sent++;
		}
	}

	await markBatched(env, raw.map((n) => n.id));
	// Return the digest envelopes (subject + deep links) so the mention->notify
	// loop is verifiable; the actual email send is the `sent` count above.
	return json({
		ok: true,
		digests: digests.length,
		sent,
		envelopes: digests.map((d) => ({ recipientEmail: d.recipientEmail, subject: d.subject, deepLinks: d.deepLinks }))
	});
};
