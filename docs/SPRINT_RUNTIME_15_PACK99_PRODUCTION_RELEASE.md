# Sprint Runtime 15 — distribuição de produção do PACK 99

A Runtime 14 valida e instala o PACK 99 dentro do runner do GitHub Actions. Esta sprint transforma esse resultado em uma distribuição permanente consumida pelo deploy real.

## Problemas resolvidos

1. O Render reconstrói o jogo diretamente da `main`; arquivos gerados apenas no runner não entram na imagem Docker.
2. O runtime `full` contém `packages/`, registro e manifesto, mas precisa gerar o índice plano consumido pelos componentes premium em `/assets/runtime/pack99/runtime-index.json`.
3. O PWA não pode pré-cachear centenas de megabytes de PNG/WebP; os payloads precisam ser armazenados sob demanda.
4. Artifacts do GitHub Actions expiram; a produção exige uma URL HTTPS estável.

## Índice premium

`scripts/build_pack99_runtime_index.py`:

- exige runtime `full`;
- exige exatamente 1.037 IDs canônicos;
- rejeita referências pendentes e caminhos fora de `packages/`;
- confirma a existência física de cada payload;
- cria uma entrada canônica por ID;
- cria entradas adicionais para sombra, emissivo, máscara, spritesheet, atlas e preview;
- grava `pack99/runtime-index.json`;
- declara `runtimeMode: full` somente após materialização real.

## Archives determinísticos

`scripts/package_pack99_runtime_release.py`:

- valida manifesto, registro e índice premium;
- confirma todos os payloads indexados;
- rejeita links simbólicos e caminhos inseguros;
- produz ZIP determinístico sem recompressão desnecessária;
- produz SHA-256 e relatório JSON;
- empacota o conteúdo com raiz compatível com o diretório runtime.

Archives oficiais:

- `hoc-pack99-web-full.zip`;
- `hoc-pack99-web-full.zip.sha256`;
- `hoc-pack99-godot-full.zip`;
- `hoc-pack99-godot-full.zip.sha256`.

## GitHub Release

Após a promoção Web/Godot, o workflow publica ou atualiza:

- tag: `pack99-runtime-v1.0.2`;
- título: `HOC PACK 99 — Runtime Integral 1.0.2`;
- archives Web e Godot;
- checksums;
- relatórios dos archives;
- relatório de promoção.

A Release somente é publicada depois de:

- 1.037 IDs canônicos nos dois clientes;
- conjuntos e caminhos idênticos;
- zero referências pendentes;
- índice premium completo;
- ausência do bootstrap no runtime full.

## Docker e Render

O estágio Web do `Dockerfile` tenta baixar o archive Web pela Release pública, baixa também o SHA-256, valida o arquivo, extrai em `client/web/public/assets/runtime` e confirma:

- `profile: full`;
- `assetCount: 1037`;
- `runtimeMode: full`;
- ao menos 1.037 entradas materializadas.

Antes da primeira Release, builds de PR continuam usando o bootstrap para não bloquear a integração. Depois da primeira promoção aprovada, a Runtime 16 tornará a Release obrigatória e removerá os fallbacks.

O secret opcional `RENDER_DEPLOY_HOOK_URL` permite que o workflow acione um novo build imediatamente após publicar a Release. Sem ele, o redeploy precisa ser acionado manualmente no Render.

## PWA

- `assets/runtime/packages/**/*` não entra no precache;
- o índice premium e manifests JSON continuam pequenos e disponíveis;
- payloads são baixados conforme a missão, personagem, carta ou efeito aparece;
- cache `hexa-pack99-runtime` usa estratégia Cache First;
- limite de 256 entradas e limpeza automática por cota evitam ocupar todo o armazenamento do dispositivo.

## Critérios da sprint

- testes do índice e empacotamento em Python 3.10 e 3.13;
- build PWA aprovado sem precache massivo;
- Docker aprovado mesmo antes da Release;
- Release produzida somente após promoção integral;
- archive Web reconhecido pelo Docker como full;
- archive Godot preservado para builds dos clientes nativos;
- assinatura exclusiva da Tehkné Solutions.

## Próxima sprint

Runtime 16:

1. executar a promoção real;
2. publicar a Release;
3. redeploy do Render com o runtime full;
4. validar `data-pack99-full=true` no deploy;
5. tornar a Release obrigatória no Docker;
6. remover os 33 IDs bootstrap, os 17 aliases e os fallbacks;
7. retomar o PACK 11 — Narrative Portraits.

**Tehkné Solutions**
