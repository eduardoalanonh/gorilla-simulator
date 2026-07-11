"use client";

import {
  Bloom,
  DepthOfField,
  EffectComposer,
  FXAA,
  SSAO,
  ToneMapping,
  Vignette,
} from "@react-three/postprocessing";
import { BlendFunction, ToneMappingMode } from "postprocessing";
import { useSimulationStore } from "@/store/simulationStore";

/** Pós-processamento cinematográfico: SSAO, Bloom, DoF, Vignette, ACES, FXAA. */
export function Effects() {
  const postFx = useSimulationStore((s) => s.postFx);

  if (!postFx) {
    return (
      <EffectComposer multisampling={0}>
        <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
        <FXAA />
      </EffectComposer>
    );
  }

  return (
    <EffectComposer multisampling={0} enableNormalPass>
      <SSAO
        blendFunction={BlendFunction.MULTIPLY}
        samples={11}
        radius={0.14}
        intensity={22}
        luminanceInfluence={0.6}
        worldDistanceThreshold={80}
        worldDistanceFalloff={12}
        worldProximityThreshold={0.5}
        worldProximityFalloff={0.2}
      />
      <Bloom
        mipmapBlur
        intensity={0.75}
        luminanceThreshold={0.85}
        luminanceSmoothing={0.2}
      />
      <DepthOfField
        focusDistance={0.018}
        focalLength={0.32}
        bokehScale={2.2}
      />
      <Vignette eskil={false} offset={0.18} darkness={0.55} />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      <FXAA />
    </EffectComposer>
  );
}
