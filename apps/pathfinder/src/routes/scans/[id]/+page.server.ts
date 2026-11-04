// 3D scan viewer (Epic E8). Loads a served media asset (splat or walkthrough),
// its anchored 3D markers and named viewpoints, plus sibling assets in the same
// building for floor-switching and capture-date version comparison.

import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getMedia, listMedia } from '$lib/server/media';
import { listMarkers3d, listViewpoints } from '$lib/server/scans3d';
import { isGlobalScope } from '$lib/server/hierarchy';

export const load: PageServerLoad = async ({ locals, platform, params }) => {
	const env = platform?.env;
	if (!env?.DB) error(500, 'Database binding unavailable.');
	if (!locals.user) error(401, 'Not authenticated.');

	const media = await getMedia(env, locals.user, params.id);
	if (!media) error(404, 'Scan not found.');
	if (media.served === 0) error(403, 'This asset is archived and not viewable.');

	const [markers, viewpoints, siblings] = await Promise.all([
		listMarkers3d(env, locals.user, params.id),
		listViewpoints(env, locals.user, params.id),
		media.building_id
			? listMedia(env, locals.user, { buildingId: media.building_id })
			: Promise.resolve([])
	]);

	// Other viewable 3D/video assets in this building, for floor + version switch.
	const related = (siblings ?? []).filter(
		(m) => m.served === 1 && (m.type === 'splat' || m.type === 'walkthrough_video')
	);

	return {
		media,
		markers: markers ?? [],
		viewpoints: viewpoints ?? [],
		related,
		canEdit: isGlobalScope(locals.user),
		fileUrl: `/api/media/${params.id}`
	};
};
