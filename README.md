# 🦍 Gorilla Simulator

**1 gorila vs. até 1000 homens.** O famoso debate da internet, agora como um
simulador 3D cinematográfico que roda 100% no navegador — sem backend, sem
banco de dados, sem autenticação. Todo o estado vive em memória.

## Rodando

```bash
npm install
npm run dev     # http://localhost:3000
npm run build   # build de produção
```

## Stack

| Camada | Tecnologia |
| --- | --- |
| Framework | Next.js 15 (App Router) + React 19 + TypeScript |
| UI | TailwindCSS 4 + shadcn/ui + Framer Motion |
| 3D | Three.js + @react-three/fiber + @react-three/drei |
| Física | @react-three/rapier (Rapier WASM) |
| Pós-processamento | @react-three/postprocessing (SSAO, Bloom, DoF, ACES, FXAA, Vignette) |
| Estado | Zustand |
| Áudio | three.js PositionalAudio com **sons 100% sintetizados** via WebAudio |

## Como funciona

### Simulação (fora do React)

O estado quente vive em `src/systems/simulation.ts` como **typed arrays
(SoA)** — posições, HP, estados da IA, cooldowns — atualizado imperativamente a
cada frame. O React/Zustand só recebe agregados a ~5 Hz para o HUD. O
`SimulationLoop` faz o *stepping* manual do mundo Rapier com passo fixo
(1/60 s) e sub-steps, o que permite velocidades de 0.5x a 10x e slow motion.

### IA — State Machine

Cada entidade roda `Idle → Searching → Running → Attacking → Recovering → Dead`
(`src/systems/ai.ts`):

- **Homens**: correm até o gorila, cercam-no em ângulos distribuídos (sem
  formar fila), empurram-se via física, atacam continuamente e podem **hesitar**
  quando muitos aliados morrem por perto. Arremessados = `Recovering` até
  aterrissar. Presos atrás de pedras trocam de ângulo de aproximação.
- **Gorila**: persegue o aglomerado mais denso, alterna **swipe** (arco ~200°)
  e **slam** (360°, área maior) conforme o cerco, aplica knockback exagerado,
  ruge periodicamente (medo + empurrão em área) e contorna obstáculos quando a
  perseguição não progride.

### Performance (1000 homens)

- **InstancedMesh**: todos os homens são 6 draw calls (torso, cabeça, braços,
  pernas) + 1 de arma; animação de corrida/soco composta por matriz.
- **Object pool**: rigid bodies criados uma única vez e reutilizados entre
  resets; cadáveres assentados são congelados (`setEnabled(false)`).
- **Spatial hash** para vizinhança O(1) e decisões de IA staggered.
- Pool única de partículas (poeira, impacto, detritos) com ring buffer.

### Combate

Dano = base ± variância, com chance de crítico (2x). Golpes geram partículas,
som espacial, knockback físico e screen shake. Ragdoll simplificado na morte
(rotações liberadas + tombo). Sem sangue — visual cartunesco.

## Configuração e balanceamento

Tudo em [`src/constants/config.ts`](src/constants/config.ts): stats base
(homem: 100 HP / ataque 5 ± 2 / 80 kg / 5 m/s · gorila: 10000 HP / 80 ± 15 /
220 kg / 7 m/s), modificadores (treinados, MMA, medieval, bastões, gorila
enfurecido/cansado), arena, física, partículas e presets.

## Estrutura

```
src/
├── app/                    # Next.js App Router
├── components/
│   ├── game/               # Canvas, Arena, SkyDome, câmera, efeitos, loop
│   │   └── entities/       # Gorilla, Men (instanced), HealthBars
│   ├── panels/             # StartScreen, ControlPanel, HUD, EndScreen
│   └── ui/                 # shadcn/ui
├── systems/                # simulação, IA, combate, física, partículas, áudio
├── store/                  # Zustand
├── constants/              # config de balanceamento
├── types/                  # tipos compartilhados
├── utils/                  # RNG, texturas procedurais, helpers
└── assets/                 # ponto de extensão p/ modelos GLTF (ver abaixo)
```

## Modelos GLTF / Mixamo

Os personagens atuais são **procedurais** (primitivas Three.js) — foi a escolha
para manter o projeto 100% auto-contido e suportar 1000 instâncias baratas.
A arquitetura já separa *dados da simulação* de *representação visual*: para
usar modelos GLTF/Mixamo, coloque os arquivos em `public/models/` e troque o
renderer em `src/components/game/entities/` (os transforms por entidade vêm de
`sim.posX/posY/posZ` + `sim.facing`). Veja `src/assets/models/README.md`.

## Extensões futuras

O design comporta novos tipos de personagem (novos stats em `config.ts` +
renderer em `entities/`), armas, mapas e modos de batalha sem tocar no núcleo
da simulação.
