# Sprint Runtime 02 — Aplicação efetiva do PACK 99

## Objetivo

Aplicar os assets 2,5D do `HOC_PACK_99_FINAL_RUNTIME` na experiência realmente executada pelo cliente Web e pela arena Godot, mantendo o visual procedural anterior como fallback seguro.

## Bootstrap direto

O runtime passa a carregar arquivos WebP diretamente do repositório, sem ZIP, reconstrução ou instalador durante o build. O registro conserva **33 IDs canônicos** e utiliza **16 payloads binários verificados** nesta primeira aplicação operacional.

Aliases intencionais reduzem o peso inicial sem quebrar contratos:

- Recruta e Berserker reutilizam animações verificadas do Guardião com filtros próprios de facção;
- Ranger mantém `idle` e `hit` próprios e reutiliza temporariamente `walk`, `attack` e `defeat` do Guardião;
- floresta e água reutilizam o tile flat de grama com tratamento de bioma;
- objetivo e movimento válido reutilizam o VFX de seleção com filtros de estado.

O PACK 99 completo permanece a fonte canônica e poderá substituir cada alias sem alteração nos IDs ou no código consumidor.

## Web

- registro em `public/assets/runtime/registry/assets-runtime.json`;
- sprites conectados a Kael, Lyra, Varg, Brakk e unidades do mapa;
- estados `idle`, `walk`, `attack`, `hit` e `defeat`;
- tiles, pilares, arestas e VFX aplicados por overlay;
- combate narrativo acompanha os beats cinematográficos da Sprint UI 14;
- SVGs e elementos procedurais permanecem como fallback para qualquer asset ausente.

## Godot

- `AssetRuntime` valida `packId` e assinatura;
- `AnimatedSprite3D` é montado a partir dos spritesheets;
- texturas são armazenadas em cache;
- `RuntimeBoardDecorator` aplica terreno, pilares, arestas e VFX aos nós existentes;
- eventos de aresta, carta e duelo acionam efeitos do PACK 99;
- meshes procedurais continuam ativos quando um recurso não puder ser carregado.

## Validação prevista no PR

- TypeScript e Vitest;
- build Web/PWA;
- Visual QA da partida e do combate em notebook e celular;
- inicialização Godot;
- Android 8 e Android 14;
- confirmação dos caminhos publicados após o build.

**Tehkné Solutions**
