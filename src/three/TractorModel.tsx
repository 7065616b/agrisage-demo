'use client';

import { RoundedBox } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import {
  BoxGeometry,
  Color,
  DoubleSide,
  ExtrudeGeometry,
  Group,
  InstancedMesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  Object3D,
  Quaternion,
  Shape,
  ShapeGeometry,
  Vector3,
} from 'three';

type TractorModelProps = { moving?: boolean; scale?: number };
type Point = [number, number, number];

const paint = new MeshPhysicalMaterial({ color: '#e9eee9', metalness: 0.22, roughness: 0.34, clearcoat: 0.88, clearcoatRoughness: 0.2 });
const paintLight = new MeshPhysicalMaterial({ color: '#f8f8f2', metalness: 0.12, roughness: 0.28, clearcoat: 0.9, clearcoatRoughness: 0.16 });
const sage = new MeshPhysicalMaterial({ color: '#87a694', metalness: 0.27, roughness: 0.34, clearcoat: 0.76, clearcoatRoughness: 0.24 });
const sageDark = new MeshPhysicalMaterial({ color: '#49695e', metalness: 0.34, roughness: 0.38, clearcoat: 0.64 });
const graphite = new MeshStandardMaterial({ color: '#283336', metalness: 0.55, roughness: 0.42 });
const darkMetal = new MeshStandardMaterial({ color: '#1b2529', metalness: 0.63, roughness: 0.36 });
const rubber = new MeshStandardMaterial({ color: '#20282a', metalness: 0.02, roughness: 0.91 });
const treadRubber = new MeshStandardMaterial({ color: '#171f20', metalness: 0.01, roughness: 0.96 });
const alloy = new MeshStandardMaterial({ color: '#a9b5b2', metalness: 0.82, roughness: 0.31 });
const polished = new MeshStandardMaterial({ color: '#d1dcda', metalness: 0.87, roughness: 0.2 });
const glass = new MeshPhysicalMaterial({ color: '#9eb9b5', metalness: 0.13, roughness: 0.12, transparent: true, opacity: 0.46, depthWrite: false, side: DoubleSide, clearcoat: 1, clearcoatRoughness: 0.1 });
const seatMaterial = new MeshStandardMaterial({ color: '#303b3c', metalness: 0.02, roughness: 0.81 });
const lamp = new MeshStandardMaterial({ color: '#e8f8ed', emissive: new Color('#c8f8df'), emissiveIntensity: 0.54, metalness: 0.05, roughness: 0.22 });
const amber = new MeshStandardMaterial({ color: '#f5a946', emissive: new Color('#e18b28'), emissiveIntensity: 0.34, roughness: 0.26, metalness: 0.08 });
const red = new MeshStandardMaterial({ color: '#a34f43', emissive: new Color('#792e27'), emissiveIntensity: 0.23, roughness: 0.3 });

function Rail({ from, to, radius = 0.035, material = graphite }: { from: Point; to: Point; radius?: number; material?: MeshStandardMaterial | MeshPhysicalMaterial }) {
  const start = useMemo(() => new Vector3(...from), [from]);
  const end = useMemo(() => new Vector3(...to), [to]);
  const delta = useMemo(() => end.clone().sub(start), [start, end]);
  const midpoint = useMemo(() => start.clone().add(end).multiplyScalar(0.5), [start, end]);
  const quaternion = useMemo(() => new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), delta.clone().normalize()), [delta]);
  return <mesh position={midpoint} quaternion={quaternion} material={material} castShadow>
    <cylinderGeometry args={[radius, radius, delta.length(), 8]} />
  </mesh>;
}

function Wheel({ radius, width, rear = false, side, wheelRef }: { radius: number; width: number; rear?: boolean; side: -1 | 1; wheelRef: (wheel: Group | null) => void }) {
  const lugsRef = useRef<InstancedMesh>(null);
  const boltsRef = useRef<InstancedMesh>(null);
  const lugCount = rear ? 28 : 24;
  const lugGeometry = useMemo(() => new BoxGeometry(rear ? 0.22 : 0.16, rear ? 0.095 : 0.075, width * 0.57), [rear, width]);
  const boltGeometry = useMemo(() => new BoxGeometry(0.045, 0.045, 0.032), []);
  useEffect(() => () => { lugGeometry.dispose(); boltGeometry.dispose(); }, [lugGeometry, boltGeometry]);
  useLayoutEffect(() => {
    const lugs = lugsRef.current;
    const bolts = boltsRef.current;
    const dummy = new Object3D();
    if (lugs) {
      for (let i = 0; i < lugCount; i++) {
        const angle = (i / lugCount) * Math.PI * 2;
        for (let half = 0; half < 2; half++) {
          dummy.position.set(Math.sin(angle) * (radius + 0.018), Math.cos(angle) * (radius + 0.018), (half ? 1 : -1) * width * 0.245);
          dummy.rotation.set(0, (half ? 1 : -1) * 0.44, -angle);
          dummy.updateMatrix();
          lugs.setMatrixAt(i * 2 + half, dummy.matrix);
        }
      }
      lugs.instanceMatrix.needsUpdate = true;
    }
    if (bolts) {
      for (let i = 0; i < 8; i++) {
        const angle = i * Math.PI / 4;
        dummy.position.set(Math.sin(angle) * radius * 0.295, Math.cos(angle) * radius * 0.295, side * (width * 0.5 + 0.052));
        dummy.rotation.set(0, 0, angle);
        dummy.updateMatrix();
        bolts.setMatrixAt(i, dummy.matrix);
      }
      bolts.instanceMatrix.needsUpdate = true;
    }
  }, [lugCount, radius, side, width]);
  return <group ref={wheelRef}>
    <mesh rotation={[Math.PI / 2, 0, 0]} material={rubber} castShadow receiveShadow>
      <cylinderGeometry args={[radius * 0.935, radius * 0.935, width, 48]} />
    </mesh>
    <instancedMesh ref={lugsRef} args={[lugGeometry, treadRubber, lugCount * 2]} castShadow frustumCulled={false} />
    {[-1, 1].map(face => <group key={face} position-z={face * (width * 0.5 + 0.006)} rotation-y={face < 0 ? Math.PI : 0}>
      <mesh material={rubber} castShadow><torusGeometry args={[radius * 0.79, radius * 0.165, 10, 48]} /></mesh>
      <mesh material={graphite}><circleGeometry args={[radius * 0.62, 40]} /></mesh>
      <mesh position-z={0.018} material={alloy} castShadow><torusGeometry args={[radius * 0.445, radius * 0.075, 8, 40]} /></mesh>
      <mesh position-z={0.035} material={sageDark} castShadow><circleGeometry args={[radius * 0.38, 40]} /></mesh>
      <mesh position-z={0.06} material={polished} castShadow><circleGeometry args={[radius * 0.155, 32]} /></mesh>
    </group>)}
    <instancedMesh ref={boltsRef} args={[boltGeometry, polished, 8]} frustumCulled={false} />
  </group>;
}

function Body() {
  const hoodGeometry = useMemo(() => {
    const profile = new Shape();
    profile.moveTo(0.06, 1.27);
    profile.lineTo(2.16, 1.3);
    profile.lineTo(2.22, 1.74);
    profile.lineTo(1.88, 1.88);
    profile.lineTo(0.15, 2.03);
    profile.closePath();
    return new ExtrudeGeometry(profile, { depth: 1.43, bevelEnabled: true, bevelThickness: 0.055, bevelSize: 0.055, bevelSegments: 3, steps: 1, curveSegments: 2 });
  }, []);
  const sideWindow = useMemo(() => {
    const shape = new Shape();
    shape.moveTo(-1.48, 1.69);
    shape.lineTo(0.01, 1.69);
    shape.lineTo(-0.17, 2.89);
    shape.lineTo(-1.44, 2.89);
    shape.closePath();
    return new ShapeGeometry(shape);
  }, []);
  const frontGlass = useMemo(() => {
    const geometry = new BoxGeometry(0.018, 1.23, 1.23);
    return geometry;
  }, []);
  useEffect(() => () => { hoodGeometry.dispose(); sideWindow.dispose(); frontGlass.dispose(); }, [hoodGeometry, sideWindow, frontGlass]);
  return <>
    {/* Axle, transmission, and raised main casting */}
    <RoundedBox args={[3.52, 0.45, 1.12]} radius={0.13} smoothness={3} position={[-0.09, 1.18, 0]} material={graphite} castShadow />
    <RoundedBox args={[1.75, 0.51, 1.25]} radius={0.12} smoothness={3} position={[-0.8, 1.36, 0]} material={sageDark} castShadow />
    <mesh rotation={[Math.PI / 2, 0, 0]} position={[-1.15, 0.88, 0]} material={darkMetal} castShadow><cylinderGeometry args={[0.16, 0.16, 2.13, 16]} /></mesh>
    <mesh rotation={[Math.PI / 2, 0, 0]} position={[1.35, 0.59, 0]} material={darkMetal} castShadow><cylinderGeometry args={[0.12, 0.12, 1.91, 16]} /></mesh>
    <Rail from={[-0.45, 1.07, -0.61]} to={[1.31, 0.6, -0.8]} radius={0.045} material={darkMetal} />
    <Rail from={[-0.45, 1.07, 0.61]} to={[1.31, 0.6, 0.8]} radius={0.045} material={darkMetal} />
    {/* Hood, crisp waistline, and inset sage side blades */}
    <mesh geometry={hoodGeometry} position-z={-0.715} material={paintLight} castShadow receiveShadow />
    <RoundedBox args={[1.71, 0.11, 1.51]} radius={0.05} smoothness={3} position={[0.98, 2.015, 0]} material={paint} castShadow />
    {[-1, 1].map(side => <group key={side}>
      <RoundedBox args={[1.63, 0.19, 0.026]} radius={0.065} smoothness={3} position={[1.07, 1.69, side * 0.78]} material={sage} castShadow />
      <RoundedBox args={[1.24, 0.033, 0.03]} radius={0.014} smoothness={2} position={[0.97, 1.545, side * 0.79]} material={sageDark} />
      <RoundedBox args={[0.28, 0.045, 0.035]} radius={0.018} smoothness={2} position={[1.94, 1.89, side * 0.764]} material={darkMetal} />
      {/* Curved impression of a rear fender, with a separate arch lip. */}
      <mesh position={[-1.13, 0.89, side * 1.01]} rotation={[0, 0, -0.06]} material={paintLight} castShadow>
        <torusGeometry args={[0.91, 0.105, 10, 24, Math.PI]} />
      </mesh>
      <RoundedBox args={[0.74, 0.16, 0.4]} radius={0.07} smoothness={3} position={[-1.69, 1.64, side * 0.87]} rotation={[0, 0, -0.12]} material={paintLight} castShadow />
      <RoundedBox args={[0.48, 0.17, 0.32]} radius={0.06} smoothness={3} position={[1.42, 1.12, side * 0.78]} rotation={[0, 0, 0.18]} material={paintLight} castShadow />
      {/* Perforated access steps sit between the wheels. */}
      <RoundedBox args={[0.7, 0.055, 0.36]} radius={0.025} smoothness={2} position={[-0.05, 0.74, side * 0.88]} material={graphite} castShadow />
      <RoundedBox args={[0.6, 0.055, 0.34]} radius={0.025} smoothness={2} position={[-0.19, 0.54, side * 0.88]} material={alloy} castShadow />
      <Rail from={[-0.36, 0.53, side * 1.02]} to={[-0.36, 1.42, side * 0.82]} radius={0.022} material={alloy} />
      <Rail from={[0.2, 0.74, side * 1.02]} to={[0.2, 1.48, side * 0.82]} radius={0.022} material={alloy} />
    </group>)}
    {/* Front face: deep intake, paired LED projectors and thin bumper. */}
    <RoundedBox args={[0.1, 0.58, 1.38]} radius={0.075} smoothness={3} position={[2.22, 1.57, 0]} material={sageDark} castShadow />
    <RoundedBox args={[0.02, 0.38, 0.78]} radius={0.02} smoothness={2} position={[2.28, 1.54, 0]} material={darkMetal} />
    {[-2, -1, 0, 1, 2].map(i => <mesh key={i} position={[2.298, 1.54 + i * 0.065, 0]} material={alloy}><boxGeometry args={[0.018, 0.015, 0.72]} /></mesh>)}
    {[-1, 1].map(side => <group key={side}>
      <RoundedBox args={[0.045, 0.18, 0.24]} radius={0.035} smoothness={3} position={[2.29, 1.74, side * 0.5]} material={graphite} />
      <RoundedBox args={[0.02, 0.1, 0.16]} radius={0.026} smoothness={3} position={[2.324, 1.74, side * 0.5]} material={lamp} />
      <RoundedBox args={[0.045, 0.064, 0.2]} radius={0.025} smoothness={3} position={[2.29, 1.37, side * 0.52]} material={amber} />
    </group>)}
    <RoundedBox args={[0.18, 0.14, 1.5]} radius={0.035} smoothness={2} position={[2.35, 1.18, 0]} material={graphite} castShadow />
    <RoundedBox args={[0.2, 0.09, 0.42]} radius={0.03} smoothness={2} position={[2.43, 1.06, 0]} material={alloy} castShadow />
    {/* Rear hitch and PTO connection. */}
    <RoundedBox args={[0.53, 0.14, 0.72]} radius={0.05} smoothness={2} position={[-2.02, 1.07, 0]} material={graphite} castShadow />
    <mesh rotation={[0, 0, Math.PI / 2]} position={[-2.28, 0.96, 0]} material={alloy} castShadow><cylinderGeometry args={[0.1, 0.1, 0.26, 16]} /></mesh>
    <Rail from={[-1.87, 1.1, -0.47]} to={[-2.24, 0.73, -0.32]} radius={0.04} material={darkMetal} />
    <Rail from={[-1.87, 1.1, 0.47]} to={[-2.24, 0.73, 0.32]} radius={0.04} material={darkMetal} />
    <RoundedBox args={[0.32, 0.08, 0.7]} radius={0.025} smoothness={2} position={[-2.28, 0.69, 0]} material={alloy} castShadow />
    {/* Cab base, interior, and sculpted roof. */}
    <RoundedBox args={[1.71, 0.18, 1.39]} radius={0.06} smoothness={3} position={[-0.69, 1.63, 0]} material={graphite} castShadow />
    <RoundedBox args={[1.64, 0.06, 1.2]} radius={0.02} smoothness={2} position={[-0.7, 1.73, 0]} material={darkMetal} />
    <RoundedBox args={[0.47, 0.13, 0.48]} radius={0.07} smoothness={3} position={[-0.95, 1.91, 0]} material={seatMaterial} castShadow />
    <RoundedBox args={[0.16, 0.6, 0.5]} radius={0.07} smoothness={3} position={[-1.19, 2.22, 0]} material={seatMaterial} castShadow />
    <Rail from={[-0.31, 1.78, 0]} to={[-0.44, 2.27, 0]} radius={0.035} material={graphite} />
    <mesh rotation={[0.24, Math.PI / 2, 0]} position={[-0.48, 2.32, 0]} material={darkMetal}><torusGeometry args={[0.22, 0.025, 8, 24]} /></mesh>
    <RoundedBox args={[1.71, 0.18, 1.48]} radius={0.095} smoothness={4} position={[-0.73, 3.08, 0]} material={paintLight} castShadow />
    <RoundedBox args={[1.44, 0.025, 1.14]} radius={0.018} smoothness={2} position={[-0.73, 3.18, 0]} material={sageDark} />
    {/* Side glass and the slim structural pillars. */}
    {[-1, 1].map(side => <group key={side}>
      <mesh geometry={sideWindow} position-z={side * 0.685} material={glass} />
      <Rail from={[-1.47, 1.66, side * 0.69]} to={[-1.47, 2.99, side * 0.69]} radius={0.037} />
      <Rail from={[-1.47, 2.99, side * 0.69]} to={[-0.13, 2.99, side * 0.69]} radius={0.037} />
      <Rail from={[-0.13, 2.99, side * 0.69]} to={[0.09, 1.67, side * 0.69]} radius={0.039} />
      <Rail from={[-0.74, 1.67, side * 0.695]} to={[-0.74, 2.99, side * 0.695]} radius={0.023} material={alloy} />
      <Rail from={[-1.47, 1.72, side * 0.7]} to={[0.07, 1.72, side * 0.7]} radius={0.027} />
      <RoundedBox args={[0.18, 0.035, 0.044]} radius={0.014} smoothness={2} position={[-0.58, 2.02, side * 0.724]} material={alloy} />
      <RoundedBox args={[0.45, 0.31, 0.07]} radius={0.055} smoothness={3} position={[0.15, 2.53, side * 0.91]} material={graphite} castShadow />
      <RoundedBox args={[0.37, 0.24, 0.02]} radius={0.04} smoothness={3} position={[0.16, 2.54, side * 0.955]} material={alloy} />
      <Rail from={[-0.02, 2.44, side * 0.69]} to={[0.07, 2.42, side * 0.88]} radius={0.026} />
      <RoundedBox args={[0.17, 0.14, 0.16]} radius={0.028} smoothness={2} position={[-1.53, 2.94, side * 0.57]} material={amber} />
      <RoundedBox args={[0.06, 0.2, 0.29]} radius={0.022} smoothness={2} position={[-1.56, 1.86, side * 0.58]} material={red} />
    </group>)}
    <mesh geometry={frontGlass} position={[-0.032, 2.36, 0]} rotation={[0, 0, 0.165]} material={glass} />
    <Rail from={[0.07, 1.68, -0.68]} to={[-0.13, 2.99, -0.68]} radius={0.037} />
    <Rail from={[0.07, 1.68, 0.68]} to={[-0.13, 2.99, 0.68]} radius={0.037} />
    <Rail from={[-0.13, 2.99, -0.69]} to={[-0.13, 2.99, 0.69]} radius={0.035} />
    <Rail from={[0.07, 1.72, -0.69]} to={[0.07, 1.72, 0.69]} radius={0.03} />
    <Rail from={[-1.49, 1.67, -0.68]} to={[-1.49, 2.98, -0.68]} radius={0.04} />
    <Rail from={[-1.49, 1.67, 0.68]} to={[-1.49, 2.98, 0.68]} radius={0.04} />
    <mesh position={[-1.49, 2.35, 0]} material={glass}><boxGeometry args={[0.018, 1.25, 1.29]} /></mesh>
    {/* Upright exhaust and low profile beacon. */}
    <mesh position={[0.12, 2.21, -0.53]} material={darkMetal} castShadow><cylinderGeometry args={[0.075, 0.09, 0.45, 16]} /></mesh>
    <mesh position={[0.12, 2.49, -0.53]} material={alloy} castShadow><cylinderGeometry args={[0.09, 0.075, 0.12, 16]} /></mesh>
    <mesh position={[0.12, 2.57, -0.53]} material={darkMetal} castShadow><cylinderGeometry args={[0.077, 0.077, 0.05, 16]} /></mesh>
    <mesh position={[-1.23, 3.22, 0]} material={graphite}><cylinderGeometry args={[0.12, 0.13, 0.07, 18]} /></mesh>
    <mesh position={[-1.23, 3.29, 0]} material={amber}><cylinderGeometry args={[0.105, 0.115, 0.11, 18]} /></mesh>
    <mesh position={[-1.23, 3.355, 0]} material={polished}><cylinderGeometry args={[0.105, 0.105, 0.018, 18]} /></mesh>
  </>;
}

export default function TractorModel({ moving = false, scale = 1 }: TractorModelProps) {
  const wheelGroups = useRef<(Group | null)[]>([]);
  useFrame((state, delta) => {
    if (!moving) return;
    const step = Math.min(delta, 0.05);
    wheelGroups.current.forEach((wheel, index) => {
      if (wheel) wheel.rotation.z -= step * (index < 2 ? 1.5 : 2.28);
    });
    state.invalidate();
  });
  return <group scale={scale}>
    <Body />
    {([-1, 1] as const).map((side, index) => <group key={`rear-${side}`} position={[-1.15, 0.88, side * 0.98]}>
      <Wheel radius={0.88} width={0.57} rear side={side} wheelRef={wheel => { wheelGroups.current[index] = wheel; }} />
    </group>)}
    {([-1, 1] as const).map((side, index) => <group key={`front-${side}`} position={[1.35, 0.59, side * 0.87]}>
      <Wheel radius={0.58} width={0.43} side={side} wheelRef={wheel => { wheelGroups.current[index + 2] = wheel; }} />
    </group>)}
  </group>;
}
