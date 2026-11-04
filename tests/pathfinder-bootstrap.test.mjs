import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {prepareRuntime,createBootstrapSQL,parseUserCount} from '../integrations/pathfinder/bootstrap.mjs';
test('Pathfinder credentials persist without copying demo credentials or resetting existing users',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'pathfinder-test-'));
 try{
  await prepareRuntime(dir);const first=await readFile(join(dir,'.wrangler','radar-jwt'),'utf8');
  await prepareRuntime(dir);assert.equal(await readFile(join(dir,'.wrangler','radar-jwt'),'utf8'),first);
  assert.ok(first.length>=32);
  const sql=await createBootstrapSQL(dir);
  assert.match(sql,/INSERT OR IGNORE INTO users/);assert.doesNotMatch(sql,/ON CONFLICT.*UPDATE|test1234|test@test.com/);
  const credentials=JSON.parse(await readFile(join(dir,'.wrangler','radar-admin.json'),'utf8'));
  assert.ok(credentials.password.length>=24);assert.equal(credentials.email,'admin@campus.local');
  assert.ok(!sql.includes(credentials.password));
  assert.equal(JSON.parse(await readFile(join(dir,'.wrangler','radar-admin.json'),'utf8')).password,credentials.password);
 }finally{await rm(dir,{recursive:true,force:true});}
});

test('Wrangler query notices are tolerated but missing or invalid counts stop startup',()=>{
 assert.equal(parseUserCount('Proxy environment variables detected.\n[ {"results":[{"count":0}]} ]\n'),0);
 assert.equal(parseUserCount('[{"results":[{"count":3}]}]'),3);
 for(const bad of ['Error','[]','[{"results":[]}]','[{"results":[{"count":-1}]}]'])assert.throws(()=>parseUserCount(bad));
});
