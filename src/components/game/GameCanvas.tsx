"use client";

import { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { Physics } from "@react-three/rapier";
import { PHYSICS } from "@/constants/config";
import { useSimulationStore } from "@/store/simulationStore";
import { getArenaPreset } from "@/systems/rocks";
import { Arena } from "./Arena";
import { SkyDome } from "./SkyDome";
import { Men } from "./entities/Men";
import { Monster } from "./entities/Monsters";
import { HealthBars } from "./entities/HealthBars";
import { CowRenderer } from "./CowRenderer";
import { ParticlesRenderer } from "./ParticlesRenderer";
import { ProjectilesRenderer } from "./ProjectilesRenderer";
import { DamageNumbersRenderer } from "./DamageNumbersRenderer";
import { AudioRig } from "./AudioRig";
import { SimulationLoop } from "./SimulationLoop";
import { CameraRig } from "./CameraRig";
import { Effects } from "./Effects";

export function GameCanvas() {
  const showColliders = useSimulationStore((s) => s.showColliders);
  const arenaId = useSimulationStore((s) => s.arenaId);
  const preset = getArenaPreset(arenaId);
  // GPUs de celular: limita o devicePixelRatio para manter 60 fps
  const isTouch =
    typeof window !== "undefined" &&
    window.matchMedia("(pointer: coarse)").matches;

  return (
    <Canvas
      flat
      shadows
      dpr={isTouch ? [1, 1.3] : [1, 1.6]}
      gl={{ antialias: false, powerPreference: "high-performance" }}
      camera={{ position: [22, 13, 26], fov: 42, near: 0.5, far: 700 }}
      className="!fixed inset-0"
      style={{ touchAction: "none" }}
    >
      <color attach="background" args={["#0c0a14"]} />
      <fogExp2
        key={`fog-${preset.id}`}
        attach="fog"
        args={[preset.fogColor, preset.fogDensity]}
      />

      <SkyDome />

      {/* Iluminação cinematográfica por cenário */}
      <ambientLight intensity={preset.sky.ambientIntensity} color="#8a93c4" />
      <hemisphereLight
        intensity={preset.sky.hemiIntensity}
        color="#6a6fae"
        groundColor="#4a3826"
      />
      {/* Luz de herói sobre o centro da arena */}
      <pointLight
        position={[0, 20, 6]}
        intensity={220}
        distance={55}
        decay={1.9}
        color={preset.sky.moon ? "#c3d4ff" : "#ffd9a8"}
      />
      <directionalLight
        key={`sun-${preset.id}`}
        position={[-58, 32, -38]}
        intensity={preset.sky.sunIntensity}
        color={preset.sky.sunColor}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-(preset.radius + 18)}
        shadow-camera-right={preset.radius + 18}
        shadow-camera-top={preset.radius + 18}
        shadow-camera-bottom={-(preset.radius + 18)}
        shadow-camera-near={5}
        shadow-camera-far={300}
        shadow-bias={-0.0004}
        shadow-normalBias={0.35}
      />

      <Suspense fallback={null}>
        <Physics
          paused
          debug={showColliders}
          gravity={[0, PHYSICS.gravity, 0]}
          timeStep={PHYSICS.fixedStep}
        >
          <Arena />
          <Men />
          <Monster />
          <HealthBars />
          <CowRenderer />
          <SimulationLoop />
        </Physics>
        <ParticlesRenderer />
        <ProjectilesRenderer />
        <DamageNumbersRenderer />
        <AudioRig />
        <CameraRig />
        <Effects />
      </Suspense>
    </Canvas>
  );
}
