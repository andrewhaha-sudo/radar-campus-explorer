// Root layout load (Epic E2). Exposes the current user (or null) to the shell
// so the header can show the right auth affordance. Populated by hooks.server.ts.

import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }) => {
	return { user: locals.user };
};
