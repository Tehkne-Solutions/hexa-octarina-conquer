# Sprint 05 — Protocolo autoritativo e cliente Godot mínimo

## Objetivo

Transformar o motor estabilizado na Sprint 04 em uma partida conectável, com servidor responsável pela verdade do jogo e cliente Godot limitado a input, apresentação e reconexão.

## Entregas

- servidor Node.js com WebSocket em `/ws`;
- health check HTTP em `/health`;
- protocolo JSON versionado `1.0`;
- criação e entrada em salas de dois jogadores;
- tokens de sessão que não são expostos nos broadcasts;
- reconexão por patches ou snapshot integral;
- controle de concorrência por `expectedRevision`;
- estado autoritativo de arestas, células, turnos e ações extras;
- cartas macro iniciais: expansão, fortificação e convocação de duelo;
- submissões simultâneas de cartas no Duelo de Célula;
- combo `wet + lightning`, escudo, cura e captura da província;
- cliente Godot 4 que desenha o tabuleiro e envia arestas por clique;
- persistência local da sessão no cliente;
- testes de protocolo, sala, revisão, reconexão e duelo completo.

## Critérios de validação

- um cliente com revisão antiga recebe `REVISION_CONFLICT`;
- um jogador fora do turno recebe `NOT_YOUR_TURN`;
- credenciais inválidas não restauram a sessão;
- um cliente reconectado recebe somente os patches ausentes quando disponíveis;
- o fechamento de célula concede uma ação adicional;
- o duelo só é resolvido após ambas as submissões;
- a vitória do atacante altera a posse da célula no snapshot;
- o token de sessão não aparece em `room.patch` nem no snapshot público;
- os testes Python e Node passam no CI.

## Limites desta sprint

- o servidor Node implementa o primeiro recorte autoritativo jogável, usando uma província por célula;
- o agrupamento completo de células em províncias conectadas continuará sendo comparado com o motor Python na próxima sprint;
- o cliente Godot é uma visão 2D técnica; arena 3D, unidades e efeitos ficam para a camada visual seguinte;
- persistência de salas ainda é em memória.

## Próximo sprint

**Sprint 06 — Paridade de regras, persistência e arena visual**

- adapter de conformidade Python ↔ Node;
- províncias conectadas e cerco automático no servidor;
- Redis/PostgreSQL para sessões e partidas;
- lobby e descoberta de salas;
- arena Godot 3D com pilares, muralhas e unidades provisórias;
- fluxo visual de seleção e resolução de cartas;
- telemetria e replay por event log.

---

Desenvolvido por **Tehkné Solutions**.
