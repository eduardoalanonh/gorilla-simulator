# Sons

Todos os sons do jogo são sintetizados em tempo de execução via WebAudio
(`src/systems/audio.ts`) — não há arquivos de áudio.

Para usar samples reais, coloque-os em `public/sounds/` e carregue-os no
`AudioManager` com `THREE.AudioLoader`, mantendo o pool de
`THREE.PositionalAudio` existente.
