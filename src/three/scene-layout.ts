import type {FarmMap,Point,Zone} from '../types';
export type Vec3=[number,number,number];
export const MAX_CROPS=900;
export const cellScale=(map:FarmMap)=>16/Math.max(map.width,map.height);
export function toWorld(map:FarmMap,point:Point,height=.08):Vec3 {
 const scale=cellScale(map);return [(point.x-(map.width-1)/2)*scale,height,(point.y-(map.height-1)/2)*scale];
}
export function zoneLayout(map:FarmMap,zone:Zone){return {position:toWorld(map,{x:zone.x+(zone.width-1)/2,y:zone.y+(zone.height-1)/2}),width:zone.width*cellScale(map),depth:zone.height*cellScale(map)}}
export function cropPlacements(map:FarmMap):{position:Vec3;cell:Point;scale:number;rotation:number}[]{
 const zones=map.zones.filter(zone=>zone.kind==='work'),count=zones.reduce((n,z)=>n+z.width*z.height*4,0);
 const step=Math.max(1,Math.ceil(Math.sqrt(count/MAX_CROPS))),scale=cellScale(map),items:ReturnType<typeof cropPlacements>=[];
 for(const zone of zones)for(let y=zone.y;y<zone.y+zone.height;y+=step)for(let x=zone.x;x<zone.x+zone.width;x+=step){
  for(const [dx,dy] of [[-.22,-.23],[.22,-.23],[-.22,.23],[.22,.23]]){
   if(items.length>=MAX_CROPS)return items;
   const variation=((x*17+y*31+items.length*7)%11)/10;
   items.push({position:toWorld(map,{x:x+dx,y:y+dy},.1),cell:{x,y},scale:scale*(.17+variation*.06),rotation:((x*13+y*7)%20)/20*Math.PI});
  }
 }
 return items;
}

