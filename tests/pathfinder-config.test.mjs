import test from 'node:test';import assert from 'node:assert/strict';
import {portalOrigin} from '../src/lib/pathfinder.ts';
test('portal URLs allow HTTPS and local Docker but reject credentials, scripts and unsupported subpaths',()=>{
 assert.equal(portalOrigin('http://localhost:8082'),'http://localhost:8082');assert.equal(portalOrigin('https://facilities.example/'),'https://facilities.example');
 for(const url of ['javascript:alert(1)','http://public.example','https://user:password@example.com','https://example.com/path','https://example.com/?token=private'])assert.equal(portalOrigin(url),null);
});
