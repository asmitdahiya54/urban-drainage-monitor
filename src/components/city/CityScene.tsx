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
          zone.risk === "HIGH"
            ? palette.high
            : zone.risk === "MEDIUM"
              ? palette.medium
              : palette.low;
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

/* ---------- Procedural metropolis (deterministic) ---------- */
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const CITY_HALF = 64;
const MAJOR = [-50, -31, -7.25, 4.75, 24, 44];
const MAJOR_Z = [-47, -26, -7.4, 4.7, 22, 41];
function withMinors(majors: number[]) {
  const all: { at: number; major: boolean }[] = [];
  const edges = [-CITY_HALF, ...majors, CITY_HALF];
  for (let i = 0; i < edges.length - 1; i += 1) {
    if (i > 0) all.push({ at: edges[i]!, major: true });
    const gap = edges[i + 1]! - edges[i]!;
    const minors = gap > 22 ? 2 : gap > 11 ? 1 : 0;
    for (let m = 1; m <= minors; m += 1) {
      all.push({
        at: edges[i]! + (gap * m) / (minors + 1) + Math.sin(edges[i]! * 3.1 + m) * 1.1,
        major: false,
      });
    }
  }
  return all;
}
const ROADS_X = withMinors(MAJOR);
const ROADS_Z = withMinors(MAJOR_Z);
// Diagonal avenue for an organic, non-grid structure.
const DIAG_A = new THREE.Vector2(-CITY_HALF, -40);
const DIAG_B = new THREE.Vector2(CITY_HALF, 30);

function roadWidth(major: boolean) {
  return major ? 1.6 : 0.8;
}
function distToDiagonal(x: number, z: number) {
  const ab = DIAG_B.clone().sub(DIAG_A);
  const t = THREE.MathUtils.clamp(
    new THREE.Vector2(x, z).sub(DIAG_A).dot(ab) / ab.lengthSq(),
    0,
    1,
  );
  return new THREE.Vector2(x, z).distanceTo(DIAG_A.clone().add(ab.multiplyScalar(t)));
}

type Building = {
  x: number;
  z: number;
  w: number;
  d: number;
  h: number;
  tone: number;
  roof: boolean;
};

function generateBuildings(): Building[] {
  const rand = mulberry32(1207);
  const xs = [{ at: -CITY_HALF, major: true }, ...ROADS_X, { at: CITY_HALF, major: true }];
  const zs = [{ at: -CITY_HALF, major: true }, ...ROADS_Z, { at: CITY_HALF, major: true }];
  const out: Building[] = [];
  for (let i = 0; i < xs.length - 1; i += 1) {
    for (let j = 0; j < zs.length - 1; j += 1) {
      const x0 = xs[i]!.at + roadWidth(xs[i]!.major) / 2 + 0.55;
      const x1 = xs[i + 1]!.at - roadWidth(xs[i + 1]!.major) / 2 - 0.55;
      const z0 = zs[j]!.at + roadWidth(zs[j]!.major) / 2 + 0.55;
      const z1 = zs[j + 1]!.at - roadWidth(zs[j + 1]!.major) / 2 - 0.55;
      if (x1 - x0 < 1 || z1 - z0 < 1) continue;
      const park = rand() < 0.05;
      if (park) continue;
      let x = x0;
      while (x < x1 - 0.9) {
        const w = Math.min(0.9 + rand() * 2.6, x1 - x);
        let z = z0;
        while (z < z1 - 0.9) {
          const d = Math.min(0.9 + rand() * 2.6, z1 - z);
          const cx = x + w / 2;
          const cz = z + d / 2;
          z += d + 0.3 + rand() * 0.35;
          if (rand() < 0.08) continue;
          if (distToDiagonal(cx, cz) < 1.9) continue;
          const dist = Math.hypot(cx * 1.1, cz);
          let h: number;
          if (dist < 16) h = 2.2 + rand() * 4.5 + (rand() < 0.18 ? 3.5 : 0);
          else if (dist < 34) h = 1 + rand() * 2.4 + (rand() < 0.08 ? 2.5 : 0);
          else h = 0.4 + rand() * 1.3 + (rand() < 0.04 ? 1.5 : 0);
          out.push({
            x: cx,
            z: cz,
            w: w * (0.82 + rand() * 0.14),
            d: d * (0.82 + rand() * 0.14),
            h,
            tone: rand(),
            roof: h > 2.4 && rand() < 0.35,
          });
        }
        x += w + 0.3 + rand() * 0.35;
      }
    }
  }
  return out;
}
const BUILDINGS = generateBuildings();

function makeWindowTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 128;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, 64, 128);
  const rand = mulberry32(99);
  for (let y = 4; y < 124; y += 6) {
    for (let x = 4; x < 60; x += 7) {
      const lit = rand();
      if (lit < 0.45) continue;
      const v = Math.floor(40 + lit * 150);
      ctx.fillStyle = `rgb(${v},${v},${v})`;
      ctx.fillRect(x, y, 4, 3);
    }
  }
  // Soft vertical edge glow
  ctx.fillStyle = "rgb(150,150,150)";
  ctx.fillRect(0, 0, 1, 128);
  ctx.fillRect(63, 0, 1, 128);
  ctx.fillRect(0, 0, 64, 1);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function makeRadialTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext("2d")!;
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, "rgba(255,255,255,0.9)");
  g.addColorStop(0.35, "rgba(255,255,255,0.35)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(canvas);
}
let radialTexture: THREE.Texture | null = null;
function getRadialTexture() {
  radialTexture ??= makeRadialTexture();
  return radialTexture;
}

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
// Trunk mains follow the major roads; branches follow some minor streets.
const DRAIN_MAINS: [number, number, number][][] = [
  ...MAJOR.map(
    (x) =>
      [
        [x + 0.55, 0.1, -CITY_HALF],
        [x + 0.55, 0.1, CITY_HALF],
      ] as [number, number, number][],
  ),
  ...MAJOR_Z.map(
    (z) =>
      [
        [-CITY_HALF, 0.1, z + 0.55],
        [CITY_HALF, 0.1, z + 0.55],
      ] as [number, number, number][],
  ),
  [
    [DIAG_A.x, 0.1, DIAG_A.y],
    [DIAG_B.x, 0.1, DIAG_B.y],
  ],
];
const DRAIN_BRANCHES: [number, number, number][][] = ROADS_X.filter(
  (r, i) => !r.major && i % 2 === 0,
)
  .map(
    (r) =>
      [
        [r.at, 0.09, -30],
        [r.at, 0.09, 30],
      ] as [number, number, number][],
  )
  .concat(
    ROADS_Z.filter((r, i) => !r.major && i % 2 === 1).map(
      (r) =>
        [
          [-30, 0.09, r.at],
          [30, 0.09, r.at],
        ] as [number, number, number][],
    ),
  );

function Buildings({ palette, zones }: { palette: CityPalette; zones: CityZone[] }) {
  const solidRef = useRef<THREE.InstancedMesh>(null);
  const roofRef = useRef<THREE.InstancedMesh>(null);
  const windowTexture = useMemo(() => makeWindowTexture(), []);
  const buildings = useMemo(
    () =>
      BUILDINGS.flatMap((b) => {
        let h = b.h;
        for (const zone of zones) {
          const d = Math.hypot(b.x - zone.position[0], b.z - zone.position[2]);
          if (d < 2.3) return [];
          if (d < 5.5) h = Math.min(h, 1.2 + d * 0.35);
        }
        return [{ ...b, h }];
      }),
    [zones],
  );
  const roofs = useMemo(() => buildings.filter((b) => b.roof), [buildings]);

  useEffect(() => {
    const dummy = new THREE.Object3D();
    const base = new THREE.Color(palette.building);
    const tint = new THREE.Color(palette.cyan);
    const color = new THREE.Color();
    buildings.forEach((b, index) => {
      dummy.position.set(b.x, b.h / 2, b.z);
      dummy.scale.set(b.w, b.h, b.d);
      dummy.updateMatrix();
      solidRef.current?.setMatrixAt(index, dummy.matrix);
      color
        .copy(base)
        .lerp(tint, b.tone * 0.18)
        .multiplyScalar(0.75 + b.tone * 0.6);
      solidRef.current?.setColorAt(index, color);
    });
    roofs.forEach((b, index) => {
      dummy.position.set(b.x, b.h + 0.18, b.z);
      dummy.scale.set(b.w * 0.45, 0.36, b.d * 0.45);
      dummy.updateMatrix();
      roofRef.current?.setMatrixAt(index, dummy.matrix);
    });
    if (solidRef.current) {
      solidRef.current.count = buildings.length;
      solidRef.current.instanceMatrix.needsUpdate = true;
      if (solidRef.current.instanceColor) solidRef.current.instanceColor.needsUpdate = true;
    }
    if (roofRef.current) {
      roofRef.current.count = roofs.length;
      roofRef.current.instanceMatrix.needsUpdate = true;
    }
  }, [buildings, roofs, palette]);

  return (
    <group>
      <instancedMesh ref={solidRef} args={[undefined, undefined, BUILDINGS.length]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial
          color="#ffffff"
          emissive={palette.cyan}
          emissiveMap={windowTexture}
          emissiveIntensity={0.85}
          metalness={0.55}
          roughness={0.38}
        />
      </instancedMesh>
      <instancedMesh ref={roofRef} args={[undefined, undefined, BUILDINGS.length]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial
          color={palette.building}
          emissive={palette.cyan}
          emissiveIntensity={0.12}
          metalness={0.7}
          roughness={0.4}
        />
      </instancedMesh>
    </group>
  );
}

function Roads({ palette }: { palette: CityPalette }) {
  const diagLen = DIAG_A.distanceTo(DIAG_B);
  const diagAngle = Math.atan2(DIAG_B.y - DIAG_A.y, DIAG_B.x - DIAG_A.x);
  return (
    <group>
      {ROADS_X.map((road) => (
        <group key={`rx-${road.at}`}>
          <mesh position={[road.at, 0.03, 0]}>
            <boxGeometry args={[roadWidth(road.major), 0.04, CITY_HALF * 2]} />
            <meshStandardMaterial color={palette.ground} metalness={0.5} roughness={0.55} />
          </mesh>
          {road.major && (
            <Line
              points={[
                [road.at, 0.06, -CITY_HALF],
                [road.at, 0.06, CITY_HALF],
              ]}
              color={palette.cyan}
              lineWidth={0.6}
              transparent
              opacity={0.4}
            />
          )}
        </group>
      ))}
      {ROADS_Z.map((road) => (
        <group key={`rz-${road.at}`}>
          <mesh position={[0, 0.032, road.at]}>
            <boxGeometry args={[CITY_HALF * 2, 0.04, roadWidth(road.major)]} />
            <meshStandardMaterial color={palette.ground} metalness={0.5} roughness={0.55} />
          </mesh>
          {road.major && (
            <Line
              points={[
                [-CITY_HALF, 0.065, road.at],
                [CITY_HALF, 0.065, road.at],
              ]}
              color={palette.cyan}
              lineWidth={0.6}
              transparent
              opacity={0.4}
            />
          )}
        </group>
      ))}
      <mesh
        position={[(DIAG_A.x + DIAG_B.x) / 2, 0.034, (DIAG_A.y + DIAG_B.y) / 2]}
        rotation-y={-diagAngle}
      >
        <boxGeometry args={[diagLen, 0.04, 1.8]} />
        <meshStandardMaterial color={palette.ground} metalness={0.5} roughness={0.55} />
      </mesh>
      <Line
        points={[
          [DIAG_A.x, 0.07, DIAG_A.y],
          [DIAG_B.x, 0.07, DIAG_B.y],
        ]}
        color={palette.cyan}
        lineWidth={0.6}
        transparent
        opacity={0.4}
      />
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
  const flowRefs = useRef<(THREE.Material & { dashOffset?: number })[]>([]);
  useFrame((_, delta) => {
    if (reducedMotion) return;
    for (const material of flowRefs.current) {
      if (material && "dashOffset" in material)
        material.dashOffset = (material.dashOffset ?? 0) - delta * 1.4;
    }
  });
  const active = [...DRAINAGE_PATHS, ...DRAIN_MAINS.slice(2, 4), ...DRAIN_MAINS.slice(8, 10)];
  return (
    <group>
      {DRAIN_BRANCHES.map((points, index) => (
        <Line
          key={`b-${index}`}
          points={points}
          color={palette.cyan}
          lineWidth={0.9}
          transparent
          opacity={0.35}
        />
      ))}
      {DRAIN_MAINS.map((points, index) => (
        <Line
          key={`m-${index}`}
          points={points}
          color={palette.cyanBright}
          lineWidth={1.4}
          transparent
          opacity={0.55}
        />
      ))}
      {active.map((points, index) => (
        <Line
          key={`a-${index}`}
          ref={(line) => {
            if (line) flowRefs.current[index] = line.material as THREE.Material;
          }}
          points={points}
          color={palette.cyanBright}
          lineWidth={2.2}
          dashed
          dashSize={0.9}
          gapSize={0.7}
          transparent
          opacity={0.9}
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
      <mesh rotation-x={-Math.PI / 2} position-y={0.08} scale={selected ? 1.2 : 1}>
        <planeGeometry
          args={[
            zone.risk === "HIGH" ? 11 : zone.risk === "MEDIUM" ? 8.5 : 6.5,
            zone.risk === "HIGH" ? 11 : zone.risk === "MEDIUM" ? 8.5 : 6.5,
          ]}
        />
        <meshBasicMaterial
          color={color}
          map={getRadialTexture()}
          transparent
          opacity={0.55}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
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
    const values = new Float32Array(420 * 3);
    for (let index = 0; index < 420; index += 1) {
      const angle = index * 2.399;
      const radius = 4 + (index % 37) * 1.3;
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
  const targetPosition = useRef(new THREE.Vector3(16, 19, 20));
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
    targetPosition.current.set(16, 19, 20);
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
      <fogExp2 attach="fog" args={[palette.background, 0.021]} />
      <ambientLight intensity={0.52} color={palette.cyan} />
      <directionalLight position={[8, 18, 12]} intensity={1.1} color={palette.cyanBright} />
      <pointLight position={[-9, 8, -6]} intensity={35} distance={32} color={palette.cyan} />
      <hemisphereLight args={[palette.cyanBright, palette.ground, 0.35]} />

      <mesh rotation-x={-Math.PI / 2} position-y={-0.06}>
        <planeGeometry args={[220, 220]} />
        <meshStandardMaterial color={palette.ground} metalness={0.8} roughness={0.35} />
      </mesh>
      <gridHelper
        args={[140, 70, palette.cyan, palette.cyan]}
        position={[0, 0.005, 0]}
        material-transparent
        material-opacity={0.07}
      />
      {layers.roads !== false && <Roads palette={palette} />}
      {layers.heat === true && <HeatLayer zones={props.zones} palette={palette} />}
      {layers.buildings && <Buildings palette={palette} zones={props.zones} />}
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
        minDistance={5}
        maxDistance={58}
        minPolarAngle={0.48}
        maxPolarAngle={1.37}
        target={[0, 1.5, 0]}
      />
      <CameraController {...props} controlsRef={controlsRef} />
      <EffectComposer multisampling={0}>
        <Bloom intensity={0.75} luminanceThreshold={0.45} luminanceSmoothing={0.5} mipmapBlur />
        <Vignette offset={0.28} darkness={0.58} />
      </EffectComposer>
    </>
  );
}
