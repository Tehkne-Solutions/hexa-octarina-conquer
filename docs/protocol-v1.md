# Protocolo autoritativo v1

Assinatura: **Tehkné Solutions**

## Transporte

- WebSocket: `/ws`
- Health check HTTP: `/health`
- Lobby público HTTP: `/rooms`
- Todas as mensagens são JSON UTF-8.
- Toda mensagem possui `protocolVersion: "1.0"` e `type`.
- Comandos mutáveis carregam `expectedRevision` para impedir ações sobre estado desatualizado.

## Lobby público

### Listar salas pelo WebSocket

```json
{
  "protocolVersion": "1.0",
  "type": "lobby.list",
  "requestId": "lobby-1",
  "payload": {
    "status": "waiting"
  }
}
```

O filtro `status` é opcional e aceita `waiting`, `active` ou `finished`. A resposta `lobby.rooms` contém somente informações públicas:

- código da sala;
- status;
- tamanho do tabuleiro;
- quantidade e nomes dos jogadores;
- presença online;
- revisão e datas de criação/atualização.

`sessionToken`, mão de cartas e demais dados privados nunca aparecem no lobby. O servidor também envia `lobby.updated` quando a disponibilidade das salas muda.

O endpoint HTTP `GET /rooms` retorna a mesma lista pública sem cache.

## Sessão

### Criar sala

```json
{
  "protocolVersion": "1.0",
  "type": "room.create",
  "requestId": "req-1",
  "payload": {
    "playerName": "Arquiteto",
    "boardSize": 5
  }
}
```

### Entrar em sala

```json
{
  "protocolVersion": "1.0",
  "type": "room.join",
  "requestId": "req-2",
  "payload": {
    "roomId": "A1B2C3D4",
    "playerName": "Conjurador"
  }
}
```

O servidor responde com `session.established`, incluindo `roomId`, `playerId`, `sessionToken` e um snapshot integral. O token nunca aparece em broadcasts.

### Reconectar

`room.reconnect` envia as credenciais e `lastRevision`. O servidor responde:

- `mode: "patches"` quando o histórico incremental ainda está disponível;
- `mode: "snapshot"` quando o cliente ficou mais de 100 revisões para trás.

Após reinício do servidor, jogadores persistidos aparecem desconectados até autenticarem novamente. Uma reconexão válida gera o evento `player.reconnected` para os demais participantes.

## Ações

### Jogar uma aresta

Tipo: `action.play_edge`

Payload obrigatório:

- `roomId`
- `playerId`
- `sessionToken`
- `expectedRevision`
- `start: [x, y]`
- `end: [x, y]`

O servidor valida limites, adjacência ortogonal, duplicidade, jogador ativo e quantidade de ações. Cada célula fechada concede uma ação adicional; uma aresta capaz de fechar duas células concede dois bônus.

### Jogar carta macro

Tipo: `action.play_card`

Campos adicionais:

- `cardId`
- `provinceId`, quando aplicável;
- `start` e `end`, para `expansion`.

A versão atual suporta `expansion`, `fortify` e `duel`.

### Resolver rodada de duelo

Tipo: `action.resolve_duel_round`

Campos adicionais:

- `duelId`
- `cardIds`

Cada participante envia sua sequência. A resolução ocorre somente após as duas submissões. Energia e disponibilidade de cartas são validadas antes de alterar o estado.

## Modelo territorial

O snapshot de `board` contém:

```json
{
  "boardSize": 5,
  "currentPlayerId": "player-a",
  "turnNumber": 8,
  "actionsRemaining": 1,
  "edges": [],
  "cells": [
    {
      "id": "cell:0,0",
      "x": 0,
      "y": 0,
      "ownerId": "player-a",
      "provinceId": "province-1"
    }
  ],
  "provinces": [
    {
      "id": "province-1",
      "ownerId": "player-a",
      "cellIds": ["cell:0,0", "cell:1,0"],
      "unit": {
        "kind": "fortress",
        "level": 2,
        "hp": 8,
        "element": "physical"
      },
      "protectedTurns": 0
    }
  ]
}
```

Células ortogonalmente adjacentes do mesmo proprietário são agrupadas em uma província. Capturas podem unir a área conquistada a uma província aliada vizinha. Por compatibilidade, cartas ainda podem apontar para IDs antigos no formato `cell:x,y`; o servidor resolve esse ID para a província atual.

Quando uma província perde todas as liberdades para um único oponente, o servidor abre automaticamente um duelo com `reason: "surround"`. O posicionamento territorial concede suporte ao atacante e ao defensor.

## Persistência

A implementação padrão salva cada sala em um arquivo JSON separado:

- diretório padrão: `.data/rooms`;
- variável de ambiente: `HEXA_DATA_DIR`;
- gravação por arquivo temporário e renomeação atômica;
- snapshots corrompidos são movidos para quarentena;
- snapshots legados da Sprint 05 são migrados para o modelo de províncias.

Essa persistência é indicada para uma única instância do servidor. Um ambiente com múltiplas réplicas exigirá banco compartilhado e coordenação distribuída.

## Eventos do servidor

- `server.hello`
- `lobby.rooms`
- `lobby.updated`
- `session.established`
- `session.reconnected`
- `command.accepted`
- `room.patch`
- `error`
- `pong`

Eventos de domínio relevantes incluem:

- `player.joined`
- `player.disconnected`
- `player.reconnected`
- `edge.played`
- `card.played`
- `duel.cards_submitted`
- `duel.round_resolved`

## Patches

Cada `room.patch` contém:

```json
{
  "roomId": "A1B2C3D4",
  "revision": 10,
  "event": {
    "id": "A1B2C3D4:10",
    "type": "duel.round_resolved",
    "at": 1700000000000,
    "payload": {}
  },
  "state": {
    "status": "active",
    "board": {},
    "players": [],
    "duels": []
  }
}
```

## Erros estáveis

- `UNSUPPORTED_PROTOCOL`
- `INVALID_MESSAGE`
- `INVALID_SESSION`
- `SESSION_REQUIRED`
- `SESSION_MISMATCH`
- `ROOM_NOT_FOUND`
- `ROOM_FULL`
- `REVISION_CONFLICT`
- `NOT_YOUR_TURN`
- `INVALID_EDGE`
- `EDGE_EXISTS`
- `INVALID_PROVINCE`
- `PROVINCE_NOT_FOUND`
- `CARD_NOT_IN_HAND`
- `NOT_ENOUGH_MANA`
- `NOT_ENOUGH_DUEL_ENERGY`
- `DUEL_NOT_FOUND`

Clientes devem tratar o `code` como identificador estável e o texto como mensagem humana.
