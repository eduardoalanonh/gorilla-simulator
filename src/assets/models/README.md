# Modelos 3D

Os personagens do jogo são procedurais (primitivas Three.js) para manter o
projeto auto-contido e performático com 1000 instâncias.

Para usar modelos GLTF (ex.: Mixamo):

1. Exporte o personagem do Mixamo como FBX e converta para `.glb`
   (ex.: `npx fbx2gltf`), ou baixe direto em glTF.
2. Coloque os arquivos em `public/models/`.
3. Em `src/components/game/entities/`, carregue com `useGLTF` (drei) e leia os
   transforms por entidade de `sim.posX/posY/posZ`, `sim.facing` e
   `sim.gaitPhase`. Para muitos homens, use `SkinnedMesh` instanciado ou baked
   vertex animation — a simulação não precisa mudar.
