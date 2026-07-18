# Protocolo autoritativo v1

Assinatura: **Tehkné Solutions**

## Transporte

- WebSocket: `/ws`
- Health check HTTP: `/health`
- Lobby público HTTP: `/rooms`
- Todas as mensagens são JSON UTF-8.
- Toda mensagem possui `protocolVersion: "1.0"` e `type`.
- Comandos mutáveis carregam `expectedRevision` para impedir ações sobre estado desatualizado.

## Fronteira pública e privada

`room.patch`, snapshots e lobby são públicos para os participantes da sala e nunca contêm:

- `sessionToken`;
- IDs das cartas na mão;
- sequência de cartas enviada em segredo pelo oponente.

O evento autenticado `player.private_state` é enviado individualmente para cada socket e contém somente os dados de seu proprietário:

```json
{
  "roomId": "A1B2C3D4",
  "revision": 12,
  "playerId": "player-a",
  "name": "Arquiteto",
  "mana": 4,
  "hp": 20,
  "hand": [
    {
      "id": "lightning",
      "name": "Raio Encadeado",
      "kind": "duel",
      "cost": 2,
      "effect": "attack",
      "value": 3,
      "element": "electric",
      "description": "Causa 3 de dano; causa o dobro contra um alvo Molhado.",
      "icon": "ϟ"
    }
  ],
  "duelSubmissions": {
    "duel-1": ["wet", "lightning"]
  }
}
```

`session.established` e `session.reconnected` também incluem `privateState` para inicialização imediata do cliente.

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

O filtro `status` é opcional e aceita `waiting`, `active` ou `finished`. A resposta `lobby.rooms` contém somente código, status, tabuleiro, jogadores, presença, revisão e datas. O servidor também envia `lobby.updated` quando a disponibilidade muda.

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

O servidor responde com `session.established`, incluindo `roomId`, `playerId`, `sessionToken`, snapshot público e estado privado.

### Reconectar

`room.reconnect` envia credenciais e `lastRevision`. O servidor responde:

- `mode: "patches"` quando o histórico incremental está disponível;
- `mode: "snapshot"` quando o cliente ficou mais de 100 revisões para trás.

Após reinício, jogadores aparecem desconectados até autenticarem novamente. Uma reconexão válida gera `player.reconnected` para os demais participantes.

## Ações

### Jogar uma aresta

Tipo: `action.play_edge`

Campos: `roomId`, `playerId`, `sessionToken`, `expectedRevision`, `start` e `end`.

O servidor valida limites, adjacência, duplicidade, turno e ações. Cada célula fechada concede uma ação adicional.

### Jogar carta macro

Tipo: `action.play_card`

Campos adicionais:

- `cardId`;
- `provinceId`, para fortificação ou duelo;
- `start` e `end`, para expansão.

A versão atual suporta `expansion`, `fortify` e `duel`.

### Resolver rodada de duelo

Tipo: `action.resolve_duel_round`

Campos adicionais:

- `duelId`;
- `cardIds`.

Cada participante envia sua sequência em segredo. A resolução ocorre apenas após as duas submissões. Energia, tipo e disponibilidade das cartas são validados antes de alterar o estado.

## Modelo territorial

O snapshot de `board` contém `edges`, `cells` e `provinces`. Células ortogonalmente adjacentes do mesmo proprietário formam uma província persistente. Capturas podem unir a área conquistada a uma província aliada vizinha.

Por compatibilidade, cartas ainda podem apontar para `cell:x,y`; o servidor resolve o ID para a província atual.

Quando uma província perde todas as liberdades para um único oponente e o anel hostil é maior que o território cercado, o servidor abre automaticamente um duelo com `reason: "surround"`.

## Persistência

O modo padrão é SQLite transacional:

```text
HEXA_STORE=sqlite
HEXA_DB_PATH=.data/hexa-octarina.sqlite
```

O banco utiliza:

- WAL;
- `BEGIN IMMEDIATE` para cada gravação de sala;
- upsert do snapshot da sala;
- journal imutável de eventos com chave única;
- rollback integral quando uma etapa falha.

Modos alternativos:

```text
HEXA_STORE=memory
HEXA_STORE=files
HEXA_DATA_DIR=.data/rooms
```

O modo SQLite é adequado a uma instância. Cluster horizontal exige banco compartilhado e coordenação distribuída.

## Eventos do servidor

Eventos de transporte:

- `server.hello`;
- `lobby.rooms`;
- `lobby.updated`;
- `session.established`;
- `session.reconnected`;
- `player.private_state`;
- `command.accepted`;
- `room.patch`;
- `error`;
- `pong`.

Eventos de domínio:

- `player.joined`;
- `player.disconnected`;
- `player.reconnected`;
- `edge.played`;
- `card.played`;
- `duel.cards_submitted`;
- `duel.round_resolved`.

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

Clientes devem tratar `code` como identificador estável e o texto como mensagem humana.
