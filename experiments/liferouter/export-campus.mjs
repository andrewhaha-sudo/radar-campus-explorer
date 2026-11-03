/** Original RADAR adapter to LifeRouter's documented PNG/config interface.
 * The scale below is a deliberately fictional simulation scale, not calibration.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { scenes, places, allRooms } from '../../src/components/map/campus-data.ts';
import { isWalkable } from '../../src/components/map/navigation.ts';
if (!process.argv.includes('--demo')) throw new Error('Pass --demo: these illustration coordinates are NOT surveyed meters.');
const out = resolve(dirname(fileURLToPath(import.meta.url)), 'generated');
mkdirSync(out, { recursive: true });
const cellPixels = 4, demoMetersPerPixel = 0.05;
const cols = 512, rows = 314, ids = Object.keys(scenes);
function crc32(buf) { let c=0xffffffff; for(const b of buf){c^=b;for(let i=0;i<8;i++) c=(c>>>1)^((c&1)?0xedb88320:0);}return (c^0xffffffff)>>>0; }
function chunk(type,data){const t=Buffer.from(type),n=Buffer.alloc(4),crc=Buffer.alloc(4);n.writeUInt32BE(data.length);crc.writeUInt32BE(crc32(Buffer.concat([t,data])));return Buffer.concat([n,t,data,crc]);}
function png(pixels){const h=Buffer.alloc(13);h.writeUInt32BE(cols,0);h.writeUInt32BE(rows,4);h[8]=8;h[9]=3;const scan=Buffer.alloc((cols+1)*rows);for(let y=0;y<rows;y++)pixels.copy(scan,y*(cols+1)+1,y*cols,(y+1)*cols);return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',h),chunk('PLTE',Buffer.from([0,0,0,255,0,0])),chunk('IDAT',deflateSync(scan)),chunk('IEND',Buffer.alloc(0))]);}
const masks = new Map();
for (const id of ids) {
 const mask=Buffer.alloc(cols*rows),s=scenes[id];
 for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){
  // Entire cell must be walkable; never open a corridor by sampling only its centre.
  let free=true;for(let dy=0;dy<cellPixels&&free;dy++)for(let dx=0;dx<cellPixels;dx++)if(!isWalkable({x:x*cellPixels+dx+.5,y:y*cellPixels+dy+.5},s.walkable)){free=false;break;}
  mask[y*cols+x]=free?1:0;
 }
 masks.set(id,mask);writeFileSync(resolve(out,id+'.png'),png(mask));
}
function endpoint(id,p){const x=Math.floor(p.x/cellPixels),y=Math.floor(p.y/cellPixels);assert.equal(masks.get(id)[y*cols+x],1,`${id}: blocked endpoint ${JSON.stringify(p)}`);return [(x+.5)*cellPixels*demoMetersPerPixel,(y+.5)*cellPixels*demoMetersPerPixel];}
const portals=[];
function portal(a,pa,b,pb){portals.push({from:endpoint(a,pa),fromlayer:ids.indexOf(a),to:endpoint(b,pb),tolayer:ids.indexOf(b),traversalcost:15,bidirectional:true});}
for(const [id,s] of Object.entries(scenes))if(s.stairs && ids.indexOf(id)<ids.indexOf(s.stairs.to))portal(id,s.stairs.point,s.stairs.to,scenes[s.stairs.to].stairs.point);
for(const p of places)if(p.interior && p.arrival)portal('campus',p.arrival,p.interior,scenes[p.interior].exit);
const rooms=allRooms.map(r=>({id:r.id,scene:r.scene,layer:ids.indexOf(r.scene),demoMeters:endpoint(r.scene,r.point)}));
assert.equal(rooms.length,35);assert.equal(portals.length,10);
const config={app:{serverurl:'nats://127.0.0.1:4222'},grid:{rows,cols,pxpercell:1,cellsizem:cellPixels*demoMetersPerPixel,wallauracells:0,layers:ids.map(id=>({name:id,img:'./'+id+'.png'})),portals},pathfinding:{freemoveheight:0}};
// JSON is valid YAML; absolute run location is deliberately not embedded.
writeFileSync(resolve(out,'campus-demo.yaml'),JSON.stringify(config,null,2)+'\n');
writeFileSync(resolve(out,'manifest.json'),JSON.stringify({mode:'SIMULATION ONLY',physicalCalibration:false,sourcePixelsPerCell:cellPixels,demoMetersPerPixel,engineCommit:'99e468e4ae7b382832dcf0026914c4d08ce53ff0',layers:ids,rooms,portalCount:portals.length,unlinkedBuildings:['Building 6: outdoor entrance unassigned'],checks:['35 room endpoints on free cells','10 stair/entrance portal pairs on free cells','whole-cell walkability sampling']},null,2)+'\n');
console.log(`Exported ${ids.length} masks, ${portals.length} bidirectional portals, ${rooms.length} rooms to ${out}. SIMULATION ONLY.`);
