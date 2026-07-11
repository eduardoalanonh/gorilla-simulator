"use client";

import { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { Physics } from "@react-three/rapier";
import { PHYSICS } from "@/constants/config";
import { useSimulationStore } from "@/store/simulationStore";
import { Arena } from "./Arena";
import { SkyDome } from "./SkyDome";
import { Men } from "./entities/Men";
import { Gorilla } from "./entities/Gorilla";
import { HealthBars } from "./entities/HealthBars";
import { ParticlesRenderer } from "./ParticlesRenderer";
import { AudioRig } from "./AudioRig";
import { SimulationLoop } from "./SimulationLoop";
import { CameraRig } from "./CameraRig";
import { Effects } from "./Effects";

export function GameCanvas() {
  const showColliders = useSimulationStore((s) => s.showColliders);

  return (
    <Canvas
      flat
      shadows
      dpr={[1, 1.6]}
      gl={{ antialias: false, powerPreference: "high-performance" }}
      camera={{ position: [22, 13, 26], fov: 42, near: 0.5, far: 700 }}
      className="!fixed inset-0"
    >
      <color attach="background" args={["#0c0a14"]} />
      <fogExp2 attach="fog" args={["#1c1425", 0.0062]} />

      <SkyDome />

      {/* Iluminação cinematográfica: sol poente quente + preenchimento frio */}
      <ambientLight intensity={0.38} color="#8a93c4" />
      <hemisphereLight intensity={0.55} color="#6a6fae" groundColor="#4a3826" />
      {/* Luz de herói sobre o centro da arena */}
      <pointLight
        position={[0, 20, 6]}
        intensity={220}
        distance={55}
        decay={1.9}
        color="#ffd9a8"
      />
      <directionalLight
        position={[-58, 32, -38]}
        intensity={3.4}
        color="#ffb168"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-75}
        shadow-camera-right={75}
        shadow-camera-top={75}
        shadow-camera-bottom={-75}
        shadow-camera-near={5}
        shadow-camera-far={220}
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
          <Gorilla />
          <HealthBars />
          <SimulationLoop />
        </Physics>
        <ParticlesRenderer />
        <AudioRig />
        <CameraRig />
        <Effects />
      </Suspense>
    </Canvas>
  );
}
