import { redirect } from '@sveltejs/kit';
import { getDocument } from '$lib/server/documents';
import registry from '$lib/radar/registry.json';
import type { PageServerLoad } from './$types';
export const load: PageServerLoad = async ({locals,platform}) => {
 if(!locals.user)redirect(303,'/login');
 if(!platform?.env?.DB)return {floors:[],available:false};
 const user=locals.user,env=platform.env;
 const rows=await Promise.all(registry.map(async floor=>({floor,document:await getDocument(env,user,floor.documentId)})));
 return {floors:rows.filter(row=>row.document).map(row=>row.floor),available:true};
};
