import { describe, it, expect, vi } from 'vitest';
import { forwardLifeRouter } from '../../src/lib/radar/liferouter';
describe('unified LifeRouter bridge', () => {
 it('returns an explicit unavailable state without a configured service', async () => {
  const send=vi.fn();const response=await forwardLifeRouter(new Request('https://radar.test/api/liferouter/route',{method:'POST',body:'{}'}),'route',undefined,send);
  expect(response.status).toBe(503);expect(send).not.toHaveBeenCalled();
 });
 it('forwards simulation requests without staff cookies and only to the configured route', async () => {
  const send=vi.fn().mockResolvedValue(new Response('{"engine":"LifeRouter","simulation":true}',{headers:{'content-type':'application/json'}}));
  const request=new Request('https://radar.test/api/liferouter/route',{method:'POST',headers:{cookie:'staff=private',authorization:'Bearer private'},body:'{"start":{},"goal":{}}'});
  expect((await forwardLifeRouter(request,'route','http://127.0.0.1:8091',send)).status).toBe(200);
  expect(send.mock.calls[0][0]).toBe('http://127.0.0.1:8091/api/liferouter/route');
  expect(send.mock.calls[0][1].headers).toEqual({'content-type':'application/json'});
  expect(send.mock.calls[0][1].redirect).toBe('error');
 });
 it('allows the configured Compose service but rejects arbitrary insecure origins', async () => {
  const send=vi.fn().mockResolvedValue(new Response('{}',{headers:{'content-type':'application/json'}}));
  expect((await forwardLifeRouter(new Request('https://radar.test'),'health','http://router:8091',send)).status).toBe(200);
  send.mockClear();
  expect((await forwardLifeRouter(new Request('https://radar.test'),'health','http://example.org',send)).status).toBe(503);
  expect(send).not.toHaveBeenCalled();
 });
 it('rejects oversized requests, unsupported operations and invalid JSON before forwarding', async () => {
  const send=vi.fn();
  expect((await forwardLifeRouter(new Request('https://radar.test',{method:'POST',body:'x'.repeat(4097)}),'route','http://127.0.0.1:8091',send)).status).toBe(413);
  expect((await forwardLifeRouter(new Request('https://radar.test'),'other','http://127.0.0.1:8091',send)).status).toBe(404);
  expect((await forwardLifeRouter(new Request('https://radar.test',{method:'POST',body:'bad'}),'route','http://127.0.0.1:8091',send)).status).toBe(400);
  expect(send).not.toHaveBeenCalled();
 });
});
