import { Canvas } from "@react-three/fiber";
import { useEffect, useState } from "react";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";

import { CityScene } from "@/components/city/CityScene";
import type { CityLayers, CityPalette, CityZone } from "@/components/city/types";

function readPalette(): CityPalette {
  const styles = getComputedStyle(document.documentElement);
  const value = (name: string) => styles.getPropertyValue(name).trim();
  return {
    background: value("--city-render-background"),
    ground: value("--city-render-ground"),
    cyan: value("--city-render-cyan"),
    cyanBright: value("--city-render-cyan-bright"),
    building: value("--city-render-building"),
    high: value("--city-render-high"),
    medium: value("--city-render-medium"),
    low: value("--city-render-low"),
  };
}

export type DashboardCityProps = {
  zones: CityZone[];
  layers: CityLayers;
  selectedZone: CityZone | null;
  focusNonce: number;
  resetNonce: number;
  reducedMotion: boolean;
  onSelect: (zone: CityZone) => void;
  onControlsReady: (controls: OrbitControlsImpl | null) => void;
};

export default function DashboardCity(props: DashboardCityProps) {
  const [palette, setPalette] = useState<CityPalette | null>(null);
  useEffect(() => setPalette(readPalette()), []);
  if (!palette) return null;
  return (
    <Canvas
      dpr={[1, 1.5]}
      camera={{ position: [18, 16, 22], fov: 43, near: 0.1, far: 120 }}
      gl={{ antialias: true, powerPreference: "high-performance" }}
    >
      <CityScene
        {...props}
        palette={palette}
        showLabels
        onHover={() => undefined}
      />
    </Canvas>
  );
}
