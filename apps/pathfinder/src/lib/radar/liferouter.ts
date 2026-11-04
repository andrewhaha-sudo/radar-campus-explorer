/** Optional simulation service. Never forward staff credentials to the router. */
export async function forwardLifeRouter(
 request: Request,
 operation: string,
 origin: string | undefined,
 send: typeof fetch = fetch
): Promise<Response> {
 const reply = (status: number, error: string) => Response.json({ error }, { status });
 if (!['route', 'health'].includes(operation)) return reply(404, 'Unknown routing operation.');
 if ((operation === 'route' && request.method !== 'POST') || (operation === 'health' && request.method !== 'GET'))
  return reply(405, 'Unsupported routing method.');
 if (!origin) return reply(503, 'LifeRouter is not configured. Select Local routing.');
 let base: URL;
 try {
  base = new URL(origin);
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(base.hostname);
  const composeRouter = base.hostname === 'router' && base.port === '8091';
  if ((base.protocol !== 'https:' && !((local || composeRouter) && base.protocol === 'http:')) || base.username || base.password || base.pathname !== '/' || base.search || base.hash)
   return reply(503, 'LifeRouter origin must be an HTTPS origin or the local simulation service.');
 } catch { return reply(503, 'Invalid LifeRouter configuration.'); }
 let body: string | undefined;
 if (operation === 'route') {
  const reader = request.body?.getReader();
  if (!reader) return reply(400, 'A routing request is required.');
  let size = 0;
  const chunks: Uint8Array[] = [];
  try {
   while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 4096) { await reader.cancel(); return reply(413, 'Routing request too large.'); }
    chunks.push(value);
   }
   const bytes = new Uint8Array(size);
   let offset = 0;
   for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
   body = new TextDecoder().decode(bytes);
   JSON.parse(body);
  } catch { return reply(400, 'Invalid routing JSON.'); }
 }
 try {
  const upstream = await send(`${base.origin}/api/liferouter/${operation}`, {
   method: request.method,
   headers: { 'content-type': 'application/json' },
   body,
   redirect: 'error',
   signal: AbortSignal.timeout(12_000)
  });
  if (!(upstream.headers.get('content-type') ?? '').includes('application/json'))
   return reply(502, 'LifeRouter returned an invalid response.');
  return new Response(upstream.body, {
   status: upstream.status,
   headers: { 'content-type': 'application/json', 'cache-control': 'no-store' }
  });
 } catch { return reply(503, 'LifeRouter is unavailable. Start the routing service or select Local routing.'); }
}
