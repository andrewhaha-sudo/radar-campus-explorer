import test from 'node:test';import assert from 'node:assert/strict';import {verifiedLamports} from '../supabase/functions/verify-school-donation/verify.ts';import {parseFacilities,validCoordinates} from '../src/lib/nearby-facilities.ts';
const transfer=(recipient='recipient',lamports=100)=>({program:'system',programId:'11111111111111111111111111111111',parsed:{type:'transfer',info:{destination:recipient,lamports}}});
const tx=instructions=>({meta:{err:null},blockTime:123,transaction:{message:{instructions}}});
test('receipt verifier requires a successful native SOL transfer to the configured recipient',()=>{
 assert.equal(verifiedLamports(tx([transfer(),transfer('recipient',50)]),'recipient'),150);
 assert.throws(()=>verifiedLamports(tx([transfer('attacker')]),'recipient'));
 assert.throws(()=>verifiedLamports({...tx([transfer()]),meta:{err:'failed'}},'recipient'));
 assert.throws(()=>verifiedLamports(tx([{...transfer(),programId:'fake'}]),'recipient'));
 assert.throws(()=>verifiedLamports(tx([transfer('recipient',NaN)]),'recipient'));
 assert.throws(()=>verifiedLamports(tx([transfer('recipient',Number.MAX_SAFE_INTEGER),transfer()]),'recipient'));
});
test('facility results validate coordinates, categories and response bounds',()=>{
 assert.equal(validCoordinates(NaN,121),false);assert.equal(validCoordinates(14,181),false);
 const elements=[{type:'node',id:1,lat:14,lon:121,tags:{amenity:'hospital',name:'Hospital'}},{type:'node',id:2,lat:50,lon:121,tags:{amenity:'school'}},{type:'node',id:3,lat:14,lon:121,tags:{amenity:'fake_shelter'}}];
 assert.deepEqual(parseFacilities({elements},14,121),[{id:'node-1',lat:14,lon:121,kind:'hospital',name:'Hospital'}]);
 assert.throws(()=>parseFacilities({},14,121));
});
