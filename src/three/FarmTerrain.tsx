'use client';
import {useEffect,useLayoutEffect,useMemo,useRef} from 'react';
import {RoundedBox,Line} from '@react-three/drei';
import {ExtrudeGeometry,Object3D,Shape,type InstancedMesh} from 'three';
import type {FarmMap,SimulationState,Zone} from '../types';
import {cellScale,cropPlacements,toWorld,zoneLayout} from './scene-layout';

function Crops({map}:{map:FarmMap}){
 const plants=useMemo(()=>cropPlacements(map),[map]),leaves=useRef<InstancedMesh>(null),stems=useRef<InstancedMesh>(null);
 useLayoutEffect(()=>{
  if(!leaves.current||!stems.current)return;const dummy=new Object3D();
  plants.forEach((plant,i)=>{
   dummy.position.set(plant.position[0],plant.scale*.75+.12,plant.position[2]);dummy.rotation.set(0,plant.rotation,0);dummy.scale.set(plant.scale*.55,plant.scale,plant.scale*.55);dummy.updateMatrix();leaves.current!.setMatrixAt(i,dummy.matrix);
   dummy.position.y=plant.scale*.35+.1;dummy.scale.set(plant.scale*.12,plant.scale*.8,plant.scale*.12);dummy.updateMatrix();stems.current!.setMatrixAt(i,dummy.matrix);
  });leaves.current.instanceMatrix.needsUpdate=true;stems.current.instanceMatrix.needsUpdate=true;
 },[plants]);
 return <group><instancedMesh ref={leaves} args={[undefined,undefined,plants.length]} castShadow><coneGeometry args={[1,1.4,5,1]}/><meshStandardMaterial color="#718655" roughness={.86}/></instancedMesh><instancedMesh ref={stems} args={[undefined,undefined,plants.length]}><cylinderGeometry args={[1,1,1,5]}/><meshStandardMaterial color="#8b965e" roughness={1}/></instancedMesh></group>
}
function Building({map,zone}:{map:FarmMap;zone:Zone}){
 const layout=zoneLayout(map,zone),w=layout.width*.82,d=layout.depth*.82,h=Math.min(1.2,w*.5);
 const roof=useMemo(()=>{const shape=new Shape();shape.moveTo(-w*.55,0);shape.lineTo(0,h*.45);shape.lineTo(w*.55,0);shape.closePath();const geometry=new ExtrudeGeometry(shape,{depth:d*1.12,bevelEnabled:false});geometry.translate(0,0,-d*.56);return geometry},[w,d,h]);
 useEffect(()=>()=>roof.dispose(),[roof]);
 return <group position={[layout.position[0],.12,layout.position[2]]}>
  <RoundedBox args={[w,h,d]} radius={.05} position={[0,h/2,0]} castShadow receiveShadow><meshStandardMaterial color="#d7d6ca" roughness={.75}/></RoundedBox>
  <mesh position={[0,h,0]} geometry={roof} castShadow><meshStandardMaterial color="#4b5353" roughness={.55} metalness={.3}/></mesh>
  <mesh position={[0,h*.35,d*.502]}><boxGeometry args={[w*.42,h*.7,.035]}/><meshStandardMaterial color="#707974" roughness={.6} metalness={.25}/></mesh>
  {[-.31,.31].map(x=><mesh key={x} position={[x*w,h*.67,d*.51]}><boxGeometry args={[w*.16,h*.22,.04]}/><meshPhysicalMaterial color="#98b5b6" metalness={.2} roughness={.17} clearcoat={1}/></mesh>)}
 </group>
}
export default function FarmTerrain({map,state}:{map:FarmMap;state:SimulationState}){
 const cell=cellScale(map),w=map.width*cell,d=map.height*cell;
 const completed=state.route.slice(0,state.routeIndex+1).map(p=>toWorld(map,p,.18));
 const remaining=state.route.slice(state.routeIndex).map(p=>toWorld(map,p,.18));
 return <group>
  <RoundedBox args={[w+.8,.3,d+.8]} radius={.15} position={[0,-.12,0]} receiveShadow castShadow><meshStandardMaterial color="#e4e2d9" roughness={.7}/></RoundedBox>
  <mesh rotation={[-Math.PI/2,0,0]} position={[0,.045,0]} receiveShadow><planeGeometry args={[w,d]}/><meshStandardMaterial color="#bbb89e" roughness={1}/></mesh>
  {map.zones.map(zone=>{const l=zoneLayout(map,zone);return <group key={zone.id}>
   <mesh position={[l.position[0],.06,l.position[2]]} receiveShadow><boxGeometry args={[l.width,.035,l.depth]}/><meshStandardMaterial color={zone.kind==='work'?'#837159':zone.kind==='protected'?'#a5b196':'#cfcbc0'} roughness={1}/></mesh>
   {zone.kind==='protected'&&<Line points={[[l.position[0]-l.width/2,.12,l.position[2]-l.depth/2],[l.position[0]+l.width/2,.12,l.position[2]-l.depth/2],[l.position[0]+l.width/2,.12,l.position[2]+l.depth/2],[l.position[0]-l.width/2,.12,l.position[2]+l.depth/2],[l.position[0]-l.width/2,.12,l.position[2]-l.depth/2]]} color="#617a64" lineWidth={1.7} dashed dashSize={.15} gapSize={.12}/>}
   {zone.kind==='obstacle'&&<Building map={map} zone={zone}/>}
   {zone.kind==='work'&&Array.from({length:Math.max(1,Math.floor(zone.height*2))},(_,i)=><mesh key={i} rotation={[-Math.PI/2,0,0]} position={[l.position[0],.083,l.position[2]-l.depth/2+(i+.5)*cell/2]}><planeGeometry args={[l.width,.018]}/><meshBasicMaterial color="#b0a084"/></mesh>)}
  </group>})}
  <Crops map={map}/>
  <mesh position={toWorld(map,map.base,.1)}><cylinderGeometry args={[cell*.5,cell*.5,.08,32]}/><meshStandardMaterial color="#6d8377" metalness={.25} roughness={.5}/></mesh>
  {completed.length>1&&<Line points={completed} color="#456e59" lineWidth={3}/>}
  {remaining.length>1&&<Line points={remaining} color="#b3955b" lineWidth={2} dashed dashSize={.13} gapSize={.12}/>}
 </group>
}

