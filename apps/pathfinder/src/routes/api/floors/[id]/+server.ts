// /api/floors/[id] (Epic E15, AC-15.1.x / AC-15.2.1).
//
//   GET    one floor with its current plan
//   PATCH  edit the label (free text, verbatim), the optional NG911 level, the
//          printed plan geometry (plan scale and north rotation), or clear
//          needs_review once a human has verified marker positions
//   DELETE remove the floor, its plan versions and its markers
//
// PATCH deliberately cannot move a floor in the stack: ordering belongs to
// PUT /api/buildings/[id]/floors, which sees the whole list at once.

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { audit } from '$lib/server/session';
import { isGlobalScope } from '$lib/server/hierarchy';
import { getFloor, updateFloor, deleteFloor } from '$lib/server/floors';

export const GET: RequestHandler = async ({ locals, platform, params }) => {
	const env = platform?.env;
	if (!env?.DB) error(500, 'Database binding unavailable.');
	if (!locals.user) error(401, 'Not authenticated.');
	const floor = await getFloor(locals.user, params.id, env);
	if (!floor) error(404, 'Floor not found.');
	return json({ floor });
};

export const PATCH: RequestHandler = async ({ locals, platform, params, request }) => {
	const env = platform?.env;
	if (!env?.DB) error(500, 'Database binding unavailable.');
	if (!locals.user) error(401, 'Not authenticated.');
	if (!(await getFloor(locals.user, params.id, env))) error(404, 'Floor not found.');
	if (!isGlobalScope(locals.user)) error(403, 'Staff or admin role required.');

	let body: {
		label?: unknown;
		level?: unknown;
		needsReview?: unknown;
		planScale?: unknown;
		northDeg?: unknown;
	};
	try {
		body = await request.json();
	} catch {
		error(400, 'Malformed request body.');
	}

	const patch: {
		label?: string;
		level?: number | null;
		needsReview?: boolean;
		planScale?: number | null;
		northDeg?: number;
	} = {};
	if (body.label !== undefined) {
		if (typeof body.label !== 'string' || body.label.trim() === '')
			error(400, 'A floor label is required.');
		patch.label = body.label.trim();
	}
	if (body.level !== undefined) {
		if (body.level === null || body.level === '') patch.level = null;
		else if (Number.isInteger(Number(body.level))) patch.level = Number(body.level);
		else error(400, 'level must be an integer.');
	}
	if (body.needsReview !== undefined) {
		if (typeof body.needsReview !== 'boolean') error(400, 'needsReview must be a boolean.');
		patch.needsReview = body.needsReview;
	}
	// Plan geometry. Clearing the scale is explicit (null or ""), and anything
	// else must be a positive width: the export draws a scale bar from this
	// number, so a bad value is rejected here rather than quietly stored.
	if (body.planScale !== undefined) {
		if (body.planScale === null || body.planScale === '') patch.planScale = null;
		else {
			const scale = Number(body.planScale);
			if (!Number.isFinite(scale) || scale <= 0)
				error(400, 'planScale must be a positive width in millimetres, or null.');
			patch.planScale = scale;
		}
	}
	if (body.northDeg !== undefined) {
		// Any rotation is legal; floors.ts folds it into one clockwise turn.
		const deg = Number(body.northDeg);
		if (body.northDeg === null || body.northDeg === '' || !Number.isFinite(deg))
			error(400, 'northDeg must be a number of degrees.');
		patch.northDeg = deg;
	}

	if (!(await updateFloor(locals.user, params.id, patch, env))) error(404, 'Floor not found.');
	await audit(env, locals.user.id, 'floor.update', `floor:${params.id}`, request);
	return json({ floor: await getFloor(locals.user, params.id, env) });
};

export const DELETE: RequestHandler = async ({ locals, platform, params, request }) => {
	const env = platform?.env;
	if (!env?.DB) error(500, 'Database binding unavailable.');
	if (!locals.user) error(401, 'Not authenticated.');
	if (!(await getFloor(locals.user, params.id, env))) error(404, 'Floor not found.');
	if (!isGlobalScope(locals.user)) error(403, 'Staff or admin role required.');

	if (!(await deleteFloor(locals.user, params.id, env))) error(404, 'Floor not found.');
	await audit(env, locals.user.id, 'floor.delete', `floor:${params.id}`, request);
	return json({ ok: true });
};
