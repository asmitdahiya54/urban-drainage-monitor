import { Html, Line, OrbitControls } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { Bloom, EffectComposer, Vignette } from "@react-three/postprocessing";
import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import * as THREE from "three";
import { OrbitControls as OrbitControlsImpl } from "three-stdlib";

import type { CityLayers, CityPalette, CityZone } from "./types";

type Props = {
  zones: CityZone[];
  layers: CityLayers;
  palette: CityPalette;
  selectedZone: CityZone | null;
  focusNonce: number;
  resetNonce: number;
  reducedMotion: boolean;
  onHover: (zone: CityZone | null) => void;
  onSelect: (zone: CityZone) => void;
  /** Receives the orbit controls so external UI (zoom, compass) can drive the camera. */
  onControlsReady?: (controls: OrbitControlsImpl | null) => void;
  /** Show floating HTML labels above risk beacons. */
  showLabels?: boolean;
};

const RISK_LABEL: Record<CityZone["risk"], string> = {
  HIGH: "High risk",
  MEDIUM: "Medium risk",
  LOW: "Low risk",
};

function HeatLayer({ zones, palette }: { zones: CityZone[]; palette: CityPalette }) {
  return (
    <>
      {zones.map((zone) => {
        const color =
          zone.risk === "HIGH" ? palette.high : zone.risk === "MEDIUM" ? palette.medium : palette.low;
        const radius = 2.2 + Math.min(zone.reportCount, 12) * 0.18;
        return (
          <mesh
            key={`heat-${zone.id}`}
            rotation-x={-Math.PI / 2}
            position={[zone.position[0], 0.03, zone.position[2]]}
          >
            <circleGeometry args={[radius, 40]} />
            <meshBasicMaterial color={color} transparent opacity={0.16} depthWrite={false} />
          </mesh>
        );
      })}
    </>
  );
}

const BUILDINGS = Array.from({ length: 94 }, (_, index) => {
  const row = Math.floor(index / 10);
  const col = index % 10;
  const x = (col - 4.5) * 2.45 + Math.sin(index * 1.7) * 0.28;
  const z = (row - 4) * 2.55 + Math.cos(index * 1.3) * 0.3;
  const nearRoad = Math.abs(x) < 1.45 || Math.abs(z) < 1.5 || Math.abs(x - 7.2) < 1.1;
  const height = nearRoad ? 1.1 + ((index * 7) % 4) * 0.45 : 2 + ((index * 13) % 12) * 0.48;
  return { x, z, height, width: 1.15 + (index % 3) * 0.18, depth: 1.15 + ((index + 1) % 3) * 0.16 };
}).filter((building) => Math.abs(building.x) > 1.2 && Math.abs(building.z) > 1.2);

const DRAINAGE_PATHS: [number, number, number][][] = [
  [
    [-13, 0.12, -6],
    [-8, 0.12, -6],
    [-4, 0.12, -2],
    [0, 0.12, -2],
    [4, 0.12, 2],
    [13, 0.12, 2],
  ],
  [
    [-10, 0.13, 10],
    [-10, 0.13, 3],
    [-6, 0.13, -1],
    [-6, 0.13, -10],
  ],
  [
    [0, 0.14, 12],
    [0, 0.14, 6],
    [4, 0.14, 2],
    [8, 0.14, -2],
    [8, 0.14, -11],
  ],
  [
    [-13, 0.15, 6],
    [-5, 0.15, 6],
    [0, 0.15, 2],
    [6, 0.15, 2],
    [12, 0.15, -4],
  ],
];

function Buildings({ palette }: { palette: CityPalette }) {
  const solidRef = useRef<THREE.InstancedMesh>(null);
  const edgeRef = useRef<THREE.InstancedMesh>(null);

  useEffect(() => {
    const dummy = new THREE.Object3D();
    BUILDINGS.forEach((building, index) => {
      dummy.position.set(building.x, building.height / 2, building.z);
      dummy.scale.set(building.width, building.height, building.depth);
      dummy.updateMatrix();
      solidRef.current?.setMatrixAt(index, dummy.matrix);
      edgeRef.current?.setMatrixAt(index, dummy.matrix);
    });
    if (solidRef.current) solidRef.current.instanceMatrix.needsUpdate = true;
    if (edgeRef.current) edgeRef.current.instanceMatrix.needsUpdate = true;
  }, []);

  return (
    <group>
      <instancedMesh ref={solidRef} args={[undefined, undefined, BUILDINGS.length]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshPhysicalMaterial
          color={palette.building}
          emissive={palette.cyan}
          emissiveIntensity={0.22}
          metalness={0.72}
          roughness={0.28}
          transparent
          opacity={0.72}
        />
      </instancedMesh>
      <instancedMesh ref={edgeRef} args={[undefined, undefined, BUILDINGS.length]} scale={1.018}>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial color={palette.cyanBright} wireframe transparent opacity={0.22} />
      </instancedMesh>
    </group>
  );
}

function Roads({ palette }: { palette: CityPalette }) {
  const roads = [-7.25, -1.25, 4.75, 10.75];
  return (
    <group>
      {roads.map((offset) => (
        <group key={`road-x-${offset}`}>
          <mesh position={[offset, 0.035, 0]}>
            <boxGeometry args={[1.05, 0.05, 27]} />
            <meshStandardMaterial color={palette.ground} metalness={0.4} roughness={0.65} />
          </mesh>
          <Line
            points={[
              [offset, 0.07, -13],
              [offset, 0.07, 13],
            ]}
            color={palette.cyan}
            lineWidth={0.55}
            transparent
            opacity={0.42}
          />
        </group>
      ))}
      {[-7.4, -1.35, 4.7, 10.7].map((offset) => (
        <group key={`road-z-${offset}`}>
          <mesh position={[0, 0.04, offset]}>
            <boxGeometry args={[27, 0.05, 1.05]} />
            <meshStandardMaterial color={palette.ground} metalness={0.4} roughness={0.65} />
          </mesh>
          <Line
            points={[
              [-13, 0.075, offset],
              [13, 0.075, offset],
            ]}
            color={palette.cyan}
            lineWidth={0.55}
            transparent
            opacity={0.42}
          />
        </group>
      ))}
    </group>
  );
}

function DrainageNetwork({
  palette,
  reducedMotion,
}: {
  palette: CityPalette;
  reducedMotion: boolean;
}) {
  const flowRef = useRef<THREE.Group>(null);
  useFrame((state, delta) => {
    if (!flowRef.current || reducedMotion) return;
    flowRef.current.position.y = 0.015 + Math.sin(state.clock.elapsedTime * 2) * 0.012;
    flowRef.current.rotation.y += delta * 0.008;
  });
  return (
    <group ref={flowRef}>
      {DRAINAGE_PATHS.map((points, index) => (
        <Line
          key={index}
          points={points}
          color={palette.cyanBright}
          lineWidth={2.1}
          transparent
          opacity={0.86}
        />
      ))}
    </group>
  );
}

function RiskBeacon({
  zone,
  palette,
  selected,
  reducedMotion,
  onHover,
  onSelect,
}: {
  zone: CityZone;
  palette: CityPalette;
  selected: boolean;
  reducedMotion: boolean;
  onHover: (zone: CityZone | null) => void;
  onSelect: (zone: CityZone) => void;
}) {
  const group = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);
  const color =
    zone.risk === "HIGH" ? palette.high : zone.risk === "MEDIUM" ? palette.medium : palette.low;

  useFrame((state, delta) => {
    if (!group.current) return;
    const target = selected || hovered ? 1.16 : 1;
    group.current.scale.lerp(new THREE.Vector3(target, target, target), 1 - Math.exp(-8 * delta));
    if (!reducedMotion) group.current.rotation.y = state.clock.elapsedTime * 0.32;
  });

  return (
    <group
      ref={group}
      position={zone.position}
      onPointerOver={(event) => {
        event.stopPropagation();
        setHovered(true);
        onHover(zone);
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={() => {
        setHovered(false);
        onHover(null);
        document.body.style.cursor = "default";
      }}
      onClick={(event) => {
        event.stopPropagation();
        onSelect(zone);
      }}
    >
      <mesh rotation-x={Math.PI / 2} position-y={0.12}>
        <torusGeometry args={[0.92, 0.055, 10, 44]} />
        <meshBasicMaterial color={color} transparent opacity={0.9} />
      </mesh>
      <mesh rotation-x={Math.PI / 2} position-y={0.13} scale={selected ? 1.45 : 1.1}>
        <ringGeometry args={[1.05, 1.12, 48]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={selected ? 0.45 : 0.2}
          side={THREE.DoubleSide}
        />
      </mesh>
      <mesh position-y={1.8}>
        <cylinderGeometry args={[0.035, 0.11, 3.6, 8]} />
        <meshBasicMaterial color={color} transparent opacity={0.72} />
      </mesh>
      <mesh position-y={3.7}>
        <octahedronGeometry args={[0.27, 0]} />
        <meshBasicMaterial color={color} />
      </mesh>
      <pointLight
        color={color}
        intensity={selected || hovered ? 7 : 3.5}
        distance={5}
        position={[0, 1.2, 0]}
      />
    </group>
  );
}

function Particles({ palette, reducedMotion }: { palette: CityPalette; reducedMotion: boolean }) {
  const points = useRef<THREE.Points>(null);
  const positions = useMemo(() => {
    const values = new Float32Array(260 * 3);
    for (let index = 0; index < 260; index += 1) {
      const angle = index * 2.399;
      const radius = 5 + (index % 37) * 0.52;
      values[index * 3] = Math.cos(angle) * radius;
      values[index * 3 + 1] = 0.6 + ((index * 17) % 110) / 10;
      values[index * 3 + 2] = Math.sin(angle) * radius;
    }
    return values;
  }, []);
  useFrame((_, delta) => {
    if (points.current && !reducedMotion) points.current.rotation.y += delta * 0.012;
  });
  return (
    <points ref={points}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        color={palette.cyanBright}
        size={0.055}
        transparent
        opacity={0.42}
        sizeAttenuation
      />
    </points>
  );
}

function CameraController({
  selectedZone,
  focusNonce,
  resetNonce,
  controlsRef,
  reducedMotion,
}: {
  selectedZone: CityZone | null;
  focusNonce: number;
  resetNonce: number;
  controlsRef: RefObject<OrbitControlsImpl | null>;
  reducedMotion: boolean;
}) {
  const { camera } = useThree();
  const targetPosition = useRef(new THREE.Vector3(18, 16, 22));
  const targetLook = useRef(new THREE.Vector3(0, 1.5, 0));
  const moving = useRef(false);

  useEffect(() => {
    if (!selectedZone) return;
    targetLook.current.set(selectedZone.position[0], 1.2, selectedZone.position[2]);
    targetPosition.current.set(selectedZone.position[0] + 7.5, 8, selectedZone.position[2] + 9);
    moving.current = true;
  }, [selectedZone, focusNonce]);

  useEffect(() => {
    targetLook.current.set(0, 1.5, 0);
    targetPosition.current.set(18, 16, 22);
    moving.current = true;
  }, [resetNonce]);

  useFrame((_, delta) => {
    if (!moving.current) return;
    const amount = reducedMotion ? 1 : 1 - Math.exp(-3.2 * delta);
    camera.position.lerp(targetPosition.current, amount);
    if (controlsRef.current) {
      controlsRef.current.target.lerp(targetLook.current, amount);
      controlsRef.current.update();
    }
    if (camera.position.distanceTo(targetPosition.current) < 0.04) moving.current = false;
  });
  return null;
}

export function CityScene(props: Props) {
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const { palette, layers, onControlsReady } = props;
  useEffect(() => {
    onControlsReady?.(controlsRef.current);
    return () => onControlsReady?.(null);
  }, [onControlsReady]);
  return (
    <>
      <color attach="background" args={[palette.background]} />
      <fogExp2 attach="fog" args={[palette.background, 0.023]} />
      <ambientLight intensity={0.52} color={palette.cyan} />
      <directionalLight position={[8, 18, 12]} intensity={1.1} color={palette.cyanBright} />
      <pointLight position={[-9, 8, -6]} intensity={35} distance={32} color={palette.cyan} />

      <mesh rotation-x={-Math.PI / 2} position-y={-0.06}>
        <planeGeometry args={[42, 42]} />
        <meshStandardMaterial color={palette.ground} metalness={0.65} roughness={0.52} />
      </mesh>
      <gridHelper
        args={[40, 40, palette.cyan, palette.cyan]}
        position={[0, 0.005, 0]}
        material-transparent
        material-opacity={0.12}
      />
      {layers.roads !== false && <Roads palette={palette} />}
      {layers.heat === true && <HeatLayer zones={props.zones} palette={palette} />}
      {layers.buildings && <Buildings palette={palette} />}
      {layers.drainage && <DrainageNetwork palette={palette} reducedMotion={props.reducedMotion} />}
      {layers.risk &&
        props.zones.map((zone) => (
          <RiskBeacon
            key={zone.id}
            zone={zone}
            palette={palette}
            selected={props.selectedZone?.id === zone.id}
            reducedMotion={props.reducedMotion}
            onHover={props.onHover}
            onSelect={props.onSelect}
          />
        ))}
      {layers.risk &&
        props.showLabels &&
        props.zones.map((zone) => (
          <Html
            key={`label-${zone.id}`}
            position={[zone.position[0], zone.position[1] + 4.6, zone.position[2]]}
            center
            zIndexRange={[20, 0]}
          >
            <button
              type="button"
              onClick={() => props.onSelect(zone)}
              className="city-marker-label"
              data-risk={zone.risk}
            >
              <span className="city-marker-title">{zone.issue}</span>
              <span className="city-marker-sub">
                {zone.name} · {RISK_LABEL[zone.risk]}
              </span>
            </button>
          </Html>
        ))}
      <Particles palette={palette} reducedMotion={props.reducedMotion} />

      <OrbitControls
        ref={controlsRef}
        makeDefault
        enableDamping
        dampingFactor={0.075}
        minDistance={10}
        maxDistance={42}
        minPolarAngle={0.48}
        maxPolarAngle={1.37}
        target={[0, 1.5, 0]}
      />
      <CameraController {...props} controlsRef={controlsRef} />
      <EffectComposer multisampling={0}>
        <Bloom intensity={0.7} luminanceThreshold={0.4} luminanceSmoothing={0.5} mipmapBlur />
        <Vignette offset={0.28} darkness={0.58} />
      </EffectComposer>
    </>
  );
}
