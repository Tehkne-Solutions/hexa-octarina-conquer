# Protocolo autoritativo v1

Assinatura: **Tehkné Solutions**

## Transporte

- WebSocket: `/ws`
- Health check HTTP: `/health`
- Todas as mensagens são JSON UTF-8.
- Toda mensagem possui `protocolVersion: "1.0"` e `type`.
- Comandos mutáveis carregam `expectedRevision` para impedir ações sobre estado desatualizado.

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

O servidor valida limites, adjacência ortogonal, duplicidade, jogador ativo e quantidade de ações.

### Jogar carta macro

Tipo: `action.play_card`

Campos adicionais:

- `cardId`
- `provinceId`, quando aplicável;
- `start` e `end`, para `expansion`.

A versão inicial suporta `expansion`, `fortify` e `duel`.

### Resolver rodada de duelo

Tipo: `action.resolve_duel_round`

Campos adicionais:

- `duelId`
- `cardIds`

Cada participante envia sua sequência. A resolução ocorre somente após as duas submissões. Energia e disponibilidade de cartas são validadas antes de alterar o estado.

## Eventos do servidor

- `server.hello`
- `session.established`
- `session.reconnected`
- `command.accepted`
- `room.patch`
- `error`
- `pong`

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
- `ROOM_NOT_FOUND`
- `ROOM_FULL`
- `REVISION_CONFLICT`
- `NOT_YOUR_TURN`
- `INVALID_EDGE`
- `EDGE_EXISTS`
- `CARD_NOT_IN_HAND`
- `NOT_ENOUGH_MANA`
- `NOT_ENOUGH_DUEL_ENERGY`
- `DUEL_NOT_FOUND`

Clientes devem tratar o `code` como identificador estável e o texto como mensagem humana.
