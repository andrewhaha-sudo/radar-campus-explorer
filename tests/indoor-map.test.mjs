import test from 'node:test';
import assert from 'node:assert/strict';
import { indoorFloors, routeBetween, coordinate } from '../apps/indoor-map/src/campus.js';
test('Indoor Map retains every campus floor, room, and Pathfinder link', () => {
 assert.equal(indoorFloors.length,11);
 assert.equal(indoorFloors.flatMap(f=>f.rooms).length,35);
 assert.ok(indoorFloors.every(f=>f.documentId===`radar-doc-${f.id}`));
 assert.deepEqual(coordinate({x:100,y:100},{crop:{x:100,y:100}}),[0,0]);
});
test('routes follow the existing walkable geometry and support stairs', () => {
 const f=indoorFloors.find(f=>f.id==='b1');
 const same=routeBetween(f.rooms[0].id,f.rooms[1].id);
 assert.ok(same.segments[0].points.length>=2);
 const upper=indoorFloors.find(f=>f.id==='b2');
 const multi=routeBetween(f.rooms[0].id,upper.rooms[0].id);
 assert.deepEqual(multi.segments.map(s=>s.floorId),['b1','b2']);
 assert.match(multi.message,/stairs/i);
 assert.throws(()=>routeBetween('missing',upper.rooms[0].id),/room/i);
 const other=indoorFloors.find(f=>f.id==='c1');
 assert.throws(()=>routeBetween(f.rooms[0].id,other.rooms[0].id),/same building/i);
});
