import maplibregl from 'maplibre-gl';
import { MapView } from '../upstream/js/map.js';
import { coordinate } from './campus.js';
// Reuse upstream extrusion, floor visibility and route rendering methods with
// local RADAR artwork instead of the original school servers and basemap.
export class RadarMap extends MapView {
 async init(){
  this.map=new maplibregl.Map({container:this.container,style:{version:8,sources:{},layers:[{id:'background',type:'background',paint:{'background-color':'#e9edf4'}}]},center:[0.003,-0.001],zoom:17,pitch:0,attributionControl:false});
  this.map.addControl(new maplibregl.NavigationControl(),'top-right');
  this.map.addControl(new maplibregl.AttributionControl({customAttribution:'RADAR illustration | Indoor Map (OSL-3.0)'}));
  await new Promise((resolve,reject)=>{this.map.once('load',resolve);this.map.once('error',e=>reject(e.error));});
  return this;
 }
 async addFloor(floor){
  const image=await new Promise((resolve,reject)=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=()=>reject(Error('Floor artwork unavailable'));i.src=floor.image;});
  const c=document.createElement('canvas');c.width=floor.crop.width;c.height=floor.crop.height;
  const ctx=c.getContext('2d');
  const pieces=floor.artworkPieces?.length?floor.artworkPieces:[{source:floor.crop,target:floor.crop}];
  for(const p of pieces)ctx.drawImage(image,p.source.x,p.source.y,p.source.width,p.source.height,p.target.x-floor.crop.x,p.target.y-floor.crop.y,p.source.width,p.source.height);
  const w=floor.crop.width*0.00001,h=floor.crop.height*0.00001;
  this.map.addSource(`art-${floor.id}`,{type:'image',url:c.toDataURL(),coordinates:[[0,0],[w,0],[w,-h],[0,-h]]});
  this.map.addLayer({id:`art-${floor.id}`,type:'raster',source:`art-${floor.id}`,layout:{visibility:'none'},paint:{'raster-fade-duration':0}});
  const features=floor.rooms.map(r=>{const d=r.door;return {type:'Feature',properties:{height:2,min_height:0},geometry:{type:'Polygon',coordinates:[[coordinate({x:d.x,y:d.y},floor),coordinate({x:d.x+d.width,y:d.y},floor),coordinate({x:d.x+d.width,y:d.y+d.height},floor),coordinate({x:d.x,y:d.y+d.height},floor),coordinate({x:d.x,y:d.y},floor)]]}};});
  this.addBuildingLayer({type:'FeatureCollection',features},floor.id,0);
  this.map.setLayoutProperty(`building-layer-${floor.id}-0`,'visibility','none');
 }
 showFloor(floor){
  this.displayBuilding(floor.id,0);
  for(const layer of this.map.getStyle().layers)if(layer.id.startsWith('art-'))this.map.setLayoutProperty(layer.id,'visibility',layer.id===`art-${floor.id}`?'visible':'none');
  this.fit(floor);
 }
 fit(floor){this.map.fitBounds([[0,-floor.crop.height*0.00001],[floor.crop.width*0.00001,0]],{padding:45,duration:0});}
}
