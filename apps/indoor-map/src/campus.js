import { scenes } from '../../../src/components/map/campus-data.ts';
import { findPath } from '../../../src/components/map/navigation.ts';
export const indoorFloors=Object.entries(scenes).filter(([id])=>id!=='campus').map(([id,scene])=>({...scene,id,documentId:`radar-doc-${id}`}));
// Local illustration coordinates, deliberately not a geographic survey.
export function coordinate(point,floor){return [(point.x-floor.crop.x)*0.00001,(floor.crop.y-point.y)*0.00001];}
export function routeBetween(fromId,toId){
 const fromFloor=indoorFloors.find(f=>f.rooms.some(r=>r.id===fromId));
 const toFloor=indoorFloors.find(f=>f.rooms.some(r=>r.id===toId));
 if(!fromFloor||!toFloor) throw Error('Choose two existing rooms.');
 if(fromFloor.buildingId!==toFloor.buildingId) throw Error('Choose rooms in the same building. Use Campus explorer to travel between buildings.');
 const from=fromFloor.rooms.find(r=>r.id===fromId),to=toFloor.rooms.find(r=>r.id===toId);
 const segment=(f,a,b)=>{const points=findPath(a,b,f.walkable);if(!points)throw Error('No connected walking path is available.');return {floorId:f.id,points};};
 if(fromFloor.id===toFloor.id)return {segments:[segment(fromFloor,from.point,to.point)],message:`Walk from ${from.name} to ${to.name}.`};
 if(fromFloor.stairs?.to!==toFloor.id||!toFloor.stairs)throw Error('No registered stair connection between these floors.');
 return {segments:[segment(fromFloor,from.point,fromFloor.stairs.point),segment(toFloor,toFloor.stairs.point,to.point)],message:`Walk to the stairs on ${fromFloor.name}, then continue on ${toFloor.name} to ${to.name}. Stairs required; accessibility is not verified.`};
}
