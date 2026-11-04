import type { RequestHandler } from './$types';
import { forwardLifeRouter } from '$lib/radar/liferouter';
const handler: RequestHandler = ({ request, params, platform }) =>
 forwardLifeRouter(request, params.operation, platform?.env?.LIFEROUTER_ORIGIN);
export const GET = handler;
export const POST = handler;
