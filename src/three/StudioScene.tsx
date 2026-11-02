'use client';
import {useEffect,useRef} from 'react';
import {useFrame,useThree} from '@react-three/fiber';
import {ContactShadows,Environment,Lightformer,OrbitControls} from '@react-three/drei';
import type {Group} from 'three';
import type {OrbitControls as OrbitControlsImpl} from 'three-stdlib';
import type {FarmMap,SimulationState} from '../types';
import TractorModel from './TractorModel';
import FarmTerrain from './FarmTerrain';
import {cellScale,toWorld} from './scene-layout';
export type ViewerMode='tractor'|'farm';
function CameraRig({mode,reset}:{mode:ViewerMode;reset:number}){
 const controls=useRef<OrbitControlsImpl>(null),{camera,size,invalidate}=useThree();
 useEffect(()=>{const fit=Math.max(1,.95/(size.width/Math.max(1,size.height)))*(size.width<600?1.07:1);if(mode==='tractor'){camera.position.set(6.2*fit,3.8*fit,6.6*fit);controls.current?.target.set(0,1.35,0)}else{camera.position.set(15*fit,14.5*fit,18*fit);controls.current?.target.set(0,0,0)}camera.updateProjectionMatrix();controls.current?.update();invalidate()},[mode,reset,size.width,size.height,camera,invalidate]);
 return <OrbitControls ref={controls} makeDefault enableDamping dampingFactor={.12} enablePan={false} minDistance={mode==='tractor'?4:10} maxDistance={mode==='tractor'?17:45} minPolarAngle={.12} maxPolarAngle={Math.PI/2-.025} rotateSpeed={.65} zoomSpeed={.7} regress/>;
}
function FarmVehicle({map,state}:{map:FarmMap;state:SimulationState}){
 const group=useRef<Group>(null),initial=useRef(toWorld(map,state.position,.1)),{invalidate}=useThree();
 const target=toWorld(map,state.position,.1),moving=state.phase==='MOVING'||state.phase==='RETURNING';
 useEffect(()=>{invalidate()},[state.position.x,state.position.y,invalidate]);
 useFrame((_,delta)=>{const g=group.current;if(!g)return;const dx=target[0]-g.position.x,dz=target[2]-g.position.z,alpha=1-Math.exp(-12*Math.min(delta,.05));if(Math.abs(dx)+Math.abs(dz)>.002){g.position.x+=dx*alpha;g.position.z+=dz*alpha;const desired=Math.atan2(-dz,dx),difference=Math.atan2(Math.sin(desired-g.rotation.y),Math.cos(desired-g.rotation.y));g.rotation.y+=difference*Math.min(1,alpha*.7);invalidate()}});
 return <group ref={group} position={initial.current}><TractorModel scale={cellScale(map)*.3} moving={moving}/></group>;
}
export default function StudioScene({map,state,mode,reset}:{map:FarmMap;state:SimulationState;mode:ViewerMode;reset:number}){
 const moving=state.phase==='MOVING'||state.phase==='RETURNING';
 return <>
  <color attach="background" args={['#f4f5f6']}/><fog attach="fog" args={['#f4f5f6',38,85]}/>
  <hemisphereLight args={['#ffffff','#b8b4a9',.75]}/>
  <directionalLight position={[6,10,5]} intensity={3.1} color="#fff9ed" castShadow shadow-mapSize={[2048,2048]} shadow-camera-left={-12} shadow-camera-right={12} shadow-camera-top={12} shadow-camera-bottom={-12} shadow-camera-near={.5} shadow-camera-far={35} shadow-bias={-.0002} shadow-normalBias={.035}/>
  <directionalLight position={[-6,4,-4]} intensity={1.1} color="#dce8f3"/>
  <Environment resolution={128} frames={1} environmentIntensity={.85}>
   <Lightformer form="rect" intensity={3.8} position={[0,7,0]} rotation={[Math.PI/2,0,0]} scale={[9,6,1]}/>
   <Lightformer form="rect" intensity={2.8} position={[-5,3,5]} target={[0,1,0]} scale={[4,5,1]}/>
   <Lightformer form="rect" intensity={4} position={[6,3,-2]} target={[0,1,0]} scale={[2,5,1]}/>
   <Lightformer form="rect" intensity={1.5} position={[-3,2,-6]} target={[0,1,0]} scale={[6,1,1]}/>
  </Environment>
  {mode==='farm'&&<mesh rotation={[-Math.PI/2,0,0]} position={[0,-.045,0]} receiveShadow><planeGeometry args={[180,180]}/><meshStandardMaterial color="#f0f1f2" roughness={.96}/></mesh>}
  {mode==='tractor'?<TractorModel moving={moving}/>:<><FarmTerrain map={map} state={state}/><FarmVehicle map={map} state={state}/></>}
  {/* Keep Drei's internal shadow render targets alive until Canvas teardown. */}
  <group visible={mode==='tractor'}><ContactShadows position={[0,-.025,0]} opacity={.3} scale={12} blur={2.8} far={5} resolution={256} frames={mode==='tractor'?1:0} color="#414851"/></group>
  <CameraRig mode={mode} reset={reset}/>
 </>;
}

