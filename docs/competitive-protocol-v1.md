# Protocolo competitivo v1

Extensão aditiva do protocolo WebSocket `1.0` do Hexa Octarina Conquer.

Todas as mensagens seguem:

```json
{
  "protocolVersion": "1.0",
  "type": "command.name",
  "requestId": "client-1",
  "payload": {}
}
```

## Temporadas

### `season.list`

Não requer autenticação.

Resposta `season.data`:

```json
{
  "current": {
    "id": "season-2026-07",
    "name": "Temporada Fundadores",
    "startsAt": 0,
    "endsAt": 0,
    "status": "active"
  },
  "seasons": []
}
```

### `season.leaderboard`

```json
{
  "limit": 25,
  "seasonId": "season-2026-07"
}
```

`seasonId` é opcional. A resposta `season.leaderboard` contém rating, vitórias, derrotas, partidas de colocação e posição.

## Matchmaking

Todos os comandos exigem `accountId` e `accessToken`.

### `matchmaking.enqueue`

```json
{
  "accountId": "account-id",
  "accessToken": "token",
  "region": "br",
  "boardSize": 5
}
```

A fila considera:

- temporada ativa;
- região;
- tamanho do tabuleiro;
- diferença de rating;
- tempo de espera.

A faixa começa em ±100 e cresce 50 pontos a cada 15 segundos, limitada a ±500.

Resposta `matchmaking.state` enquanto procura:

```json
{
  "state": "queued",
  "ticket": {},
  "searchWindow": 100
}
```

Resposta quando pareado:

```json
{
  "state": "matched",
  "role": "host",
  "match": {
    "id": "queue-match-id",
    "roomId": "A1B2C3D4",
    "seasonId": "season-2026-07",
    "hostAccountId": "account-a",
    "guestAccountId": "account-b",
    "expiresAt": 0
  }
}
```

### `matchmaking.status`

Consulta a fila ou atribuição ativa.

### `matchmaking.accept`

```json
{
  "accountId": "account-id",
  "accessToken": "token",
  "matchId": "queue-match-id"
}
```

O anfitrião cria a sala reservada. O convidado entra na mesma sala. A resposta final é `session.established` com o bloco adicional `matchmaking`.

Um convidado que aceite antes da criação da sala recebe `MATCH_HOST_PENDING` e pode repetir o aceite.

### `matchmaking.cancel`

Remove o ticket ainda não pareado.

## Recuperação de conta

### `account.recovery.request`

```json
{
  "handle": "jogador"
}
```

A resposta é sempre genérica para não revelar se a conta existe:

```json
{
  "accepted": true,
  "expiresAt": 0
}
```

Em desenvolvimento, `recoveryCode` pode ser incluído. Em produção, o código deve ser entregue por um provedor externo.

### `account.recovery.confirm`

```json
{
  "handle": "jogador",
  "recoveryCode": "CODIGO",
  "newPassword": "nova-senha-segura"
}
```

O código:

- expira em 15 minutos;
- permite até cinco tentativas;
- é removido após uso;
- invalida todas as sessões anteriores quando a senha muda.

A resposta de sucesso é uma nova `account.session`.

## Telemetria

### `telemetry.track`

Pode ser visitante ou autenticada.

```json
{
  "accountId": "account-id",
  "accessToken": "token",
  "sessionId": "mobile-session-id",
  "eventName": "mobile.matchmaking.claimed",
  "data": {
    "roomId": "A1B2C3D4"
  }
}
```

O objeto `data` é limitado a 8 KiB. A resposta é `telemetry.accepted`.

## Concorrência de salas

No modo `HEXA_STORE=postgres`, o servidor lê a sala antes de cada comando e grava com a revisão previamente observada.

Quando outra instância já alterou a sala, o comando recebe:

```json
{
  "code": "ROOM_WRITE_CONFLICT",
  "details": {
    "roomId": "A1B2C3D4",
    "expectedRevision": 10,
    "currentRevision": 11
  }
}
```

O cliente deve reconectar, aplicar snapshot ou patches atuais e somente então reenviar uma nova intenção do usuário.

---

Tehkné Solutions
