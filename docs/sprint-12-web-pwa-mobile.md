# Sprint 12 — Web Mobile PWA

Assinatura: **Tehkné Solutions**

## Decisão

O canal primário de teste e distribuição passa a ser uma aplicação web mobile instalável como PWA. O cliente Godot é preservado como laboratório visual/3D e deixa de bloquear a validação funcional em aparelhos físicos.

## Motivos

- eliminar instalação manual de APK durante desenvolvimento;
- publicar correções sem reinstalação;
- reduzir o tamanho inicial e o tempo de entrada;
- manter uma única regra autoritativa no servidor Node;
- permitir testes imediatos por URL em Android, iOS e desktop;
- preservar experiência standalone, ícone, orientação e tela inicial.

## Stack

- React 19 + TypeScript;
- Vite;
- PWA/Workbox;
- SVG responsivo para o tabuleiro;
- WebSocket v1 existente;
- deploy estático em HTTPS;
- backend autoritativo Node/PostgreSQL separado.

## Entrega inicial

- autenticação e visitante;
- criação, lobby e entrada por código;
- restauração da sessão;
- tabuleiro touch-first;
- linhas, células, províncias e unidades;
- mão privada;
- cartas macro;
- seleção e resolução de duelo;
- estado de conexão;
- instalação na tela inicial;
- cache offline do shell;
- atualização automática.

## Critérios

1. `npm test` sem falhas.
2. `npm run build` sem falhas.
3. `manifest.webmanifest` presente.
4. service worker gerado.
5. nenhum token ou mão do oponente renderizado.
6. layout utilizável em 360×800 e landscape.
7. ações enviadas com `expectedRevision`.
8. reconexão preserva `roomId`, `playerId`, `sessionToken` e revisão.

## Próxima etapa

- deploy de preview;
- PNGs maskable 192/512;
- testes E2E em navegador mobile;
- matchmaking ranqueado;
- espectador e replay;
- animações e efeitos sonoros web;
- otimização para conexões lentas;
- telemetria e captura de erros.
