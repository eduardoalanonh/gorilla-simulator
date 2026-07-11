"use client";

import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { useThree } from "@react-three/fiber";
import { audioManager } from "@/systems/audio";

/** Anexa o AudioListener à câmera e inicializa a síntese procedural. */
export function AudioRig() {
  const camera = useThree((s) => s.camera);
  const scene = useThree((s) => s.scene);
  const listener = useMemo(() => new THREE.AudioListener(), []);

  useEffect(() => {
    camera.add(listener);
    audioManager.init(listener, scene);
    return () => {
      camera.remove(listener);
    };
  }, [camera, scene, listener]);

  return null;
}
