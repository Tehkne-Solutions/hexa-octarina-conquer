# Sprint UI 09 — Espectador e Replay

## Objetivo

Integrar ao shell web uma experiência pública para acompanhar partidas ao vivo e rever partidas encerradas, reutilizando o tabuleiro, os patches e o armazenamento de resiliência já existentes.

## Fluxo

1. O botão **Assistir** aparece na navegação desktop, mobile e na home.
2. O Observatório consulta `GET /replays` para montar o salão público.
3. Partidas encerradas são abertas por `GET /replays/:roomId`.
4. Partidas ativas também conectam ao WebSocket `/spectator?roomId=...`.
5. Cada patch público produz uma revisão na timeline.
6. O tabuleiro é reconstruído localmente sem habilitar ações.
7. Ao pausar um fluxo ao vivo, novos eventos permanecem no buffer; **AO VIVO** retorna à última revisão.

## Controles

- início do replay;
- evento significativo anterior;
- reproduzir e pausar;
- próximo evento significativo;
- final ou retorno ao vivo;
- velocidades 0,5×, 1×, 2× e 4×;
- scrub por revisão;
- timeline clicável.

## Eventos destacados

- início de partida;
- jogada de aresta ou carta;
- conquista de célula ou província;
- fortificação;
- duelo;
- troca de rodada;
- encerramento da partida;
- atualizações de presença aparecem como eventos secundários.

## Privacidade

O cliente reconstrói somente `RoomSnapshot`, que contém estado público:

- tabuleiro;
- jogadores públicos;
- HP e mana públicos;
- tamanho da mão;
- duelos e resultado públicos.

Nunca são consumidos ou exibidos:

- cartas da mão;
- cartas submetidas em duelo;
- estado privado do jogador;
- tokens de sessão;
- access tokens;
- senhas;
- e-mail ou dados de conta.

Mesmo que um payload inesperado inclua propriedades adicionais, `sanitizePublicSnapshot` remonta o snapshot por uma allowlist pública antes da renderização.

## Arquitetura

- `replay-state.ts`: tipos, sanitização, reconstrução e navegação por eventos;
- `replay-client.ts`: HTTP público e WebSocket de espectador;
- `SpectatorReplayScreen.tsx`: salão, tabuleiro, controles e timeline;
- `SpectatorReplayPortal.tsx`: integração ao shell sem criar um segundo cliente;
- `sprint-ui-09.css`: layout responsivo;
- `replay-state.test.ts`: regressões de reconstrução e privacidade.

## Visual QA

A matriz passa a capturar:

- espectador em notebook 1366×768;
- espectador em celular 390×844.

O cenário visual usa um replay determinístico e não depende de existir uma partida pública no ambiente de CI.

## Critérios de validação

- nenhuma ação do tabuleiro fica habilitada;
- replay ordenado por revisão;
- saltos alcançam eventos significativos;
- pausa não perde eventos ao vivo;
- modo mobile sem overflow horizontal;
- apenas dados públicos aparecem no DOM;
- build e testes da PWA aprovados;
- campanha, multiplayer e servidor não sofrem regressão.

---

**Tehkné Solutions**
