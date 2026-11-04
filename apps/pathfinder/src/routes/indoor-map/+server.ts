import { redirect } from '@sveltejs/kit';
export function GET() { redirect(307, '/indoor-map/index.html'); }
