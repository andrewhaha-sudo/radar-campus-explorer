import 'maplibre-gl/dist/maplibre-gl.css';
import './style.css';
import { RadarMap } from './map.js';
import { indoorFloors, routeBetween, coordinate } from './campus.js';
import { Utils } from '../upstream/js/utils.js';
import maplibregl from 'maplibre-gl';
const el=id=>document.getElementById(id);
const option=(value,text)=>{const o=document.createElement('option');o.value=value;o.textContent=text;return o;};
const rooms=indoorFloors.flatMap(f=>f.rooms.map(r=>({...r,floor:f})));
for(const f of indoorFloors)el('floor').append(option(f.id,f.name));
for(const r of rooms)for(const id of ['from','to'])el(id).append(option(r.id,`${r.floor.name}: ${r.name}`));
el('to').selectedIndex=1;
let view,current,route=null,markers=[],three=false;
const loaded=new Map();
const controls=[...document.querySelectorAll('aside input, aside select, aside button')];
controls.forEach(control=>control.disabled=true);
let generation=0;
async function selectFloor(id){
 const ticket=++generation; const floor=indoorFloors.find(f=>f.id===id);if(!floor)return;
 el('map-status').textContent='Loading floor...';el('floor').value=id;
 try{
 if(!loaded.has(id))loaded.set(id,view.addFloor(floor).catch(error=>{loaded.delete(id);throw error;}));
 await loaded.get(id);
 if(ticket!==generation)return;
 current=floor;view.showFloor(floor);
 markers.forEach(m=>m.remove());markers=[];
 for(const r of floor.rooms){const b=document.createElement('button');b.className='room-marker';b.textContent=r.name;b.title=`Route to ${r.name}`;b.onclick=()=>{el('to').value=r.id;el('route-status').textContent=`Destination: ${r.name}`;};markers.push(new maplibregl.Marker({element:b}).setLngLat(coordinate(r.point,floor)).addTo(view.map));}
 el('document').href=`/documents/${floor.documentId}`;
 drawRoute();el('map-status').textContent=`${floor.name} - ${floor.rooms.length} rooms`;
 document.body.dataset.floor=id;
 }catch(e){el('map-status').textContent=e.message;}
}
function drawRoute(){
 const segment=route?.segments.find(s=>s.floorId===current.id);
 const pairs=(segment?.points??[]).map(p=>{const [lon,lat]=coordinate(p,current);return [lat,lon];});
 // Upstream helper expects latitude/longitude and returns GeoJSON order.
 view.drawRoute(pairs.length?Utils.locationArrayToGeoJSON(pairs):{type:'FeatureCollection',features:[]});
}
el('floor').onchange=()=>selectFloor(el('floor').value);
el('mode').onclick=()=>{three=!three;view.map.easeTo({pitch:three?55:0,duration:250});el('mode').textContent=three?'Show 2D':'Show 3D';el('mode').setAttribute('aria-pressed',String(three));};
el('reset').onclick=()=>view.fit(current);
el('clear').onclick=()=>{route=null;drawRoute();el('steps').replaceChildren();el('route-status').textContent='Path cleared.';};
el('route').onclick=async()=>{
 try{route=routeBetween(el('from').value,el('to').value);el('steps').replaceChildren();for(const s of route.segments){const li=document.createElement('li'),b=document.createElement('button');b.textContent=indoorFloors.find(f=>f.id===s.floorId).name;b.onclick=()=>selectFloor(s.floorId);li.append(b);el('steps').append(li);}el('route-status').textContent=route.message;await selectFloor(route.segments[0].floorId);}
 catch(e){route=null;el('steps').replaceChildren();if(current)drawRoute();el('route-status').textContent=e.message;}
};
el('search').oninput=()=>{const q=el('search').value.trim().toLowerCase();el('results').replaceChildren();if(!q)return;for(const r of rooms.filter(r=>`${r.name} ${r.id} ${r.floor.name}`.toLowerCase().includes(q)).slice(0,12)){const li=document.createElement('li'),b=document.createElement('button');b.textContent=`${r.name} - ${r.floor.name}`;b.onclick=()=>{el('to').value=r.id;selectFloor(r.floor.id);};li.append(b);el('results').append(li);}};
try{view=await new RadarMap().init();await selectFloor('a1');document.body.dataset.ready='true';controls.forEach(control=>control.disabled=false);}
catch(e){el('map-status').textContent=`Map unavailable: ${e.message}. Campus explorer and shared floorplans remain available.`;}
window.addEventListener('pagehide',()=>view?.map.remove(),{once:true});
