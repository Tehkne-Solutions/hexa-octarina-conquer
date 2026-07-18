# Sprint 11 — Reconexão tolerante, espectador e replay

## Visão geral

A Sprint 11 transforma a desconexão de WebSocket em um evento tolerável e auditável. O jogador não perde a partida imediatamente: o servidor cria um lease distribuído com prazo de retorno. Qualquer réplica pode cancelar esse lease quando a sessão volta ou finalizar o abandono uma única vez após o vencimento.

Toda alteração autoritativa também é gravada em um replay público por revisão. O replay não contém mãos, tokens de sessão, códigos de recuperação nem qualquer estado privado.

Desenvolvido por **Tehkné Solutions**.

## Componentes

### Resilience Store

Adaptadores:

- `memory`: desenvolvimento e testes locais;
- `postgres`: produção com múltiplas réplicas.

Responsabilidades:

- criar e substituir leases de reconexão;
- cancelar leases quando o jogador retorna;
- reivindicar leases vencidos com `FOR UPDATE SKIP LOCKED`;
- garantir que apenas uma réplica finalize o abandono;
- persistir metadados de replay;
- persistir patches públicos por sala e revisão;
- recuperar replay por cursor.

### Reconexão

Fluxo:

1. o socket fecha;
2. a presença da réplica é removida;
3. o servidor verifica se o jogador continua online em outra réplica;
4. se não estiver online, cria um lease com `deadlineAt`;
5. a sala recebe `player.reconnect_grace`;
6. uma reconexão válida cancela o lease e publica `player.reconnect_restored`;
7. após o prazo, uma réplica reivindica o lease;
8. se o jogador ainda estiver offline, a partida termina por `abandonment`;
9. progressão, temporada e penalidade são registradas de forma idempotente.

Variáveis:

```text
HEXA_RESILIENCE_STORE=postgres
HEXA_RECONNECT_GRACE_MS=60000
HEXA_RESILIENCE_MAINTENANCE_MS=5000
HEXA_ABANDONMENT_COOLDOWN_MS=600000
```

### Replay

Endpoints públicos:

```text
GET /replays?limit=50&status=finished
GET /replays/{roomId}?afterRevision=0&limit=500
```

Cada evento contém:

- sala;
- revisão;
- ID e tipo do evento;
- horário;
- patch público autoritativo.

A chave `(room_id, revision)` impede duplicação quando mais de uma réplica observa a mesma atualização.

### Espectador

WebSocket:

```text
ws://localhost:8080/spectator?roomId=ROOM_ID
```

Eventos iniciais:

```text
server.hello
spectator.established
```

Eventos ao vivo:

```text
room.patch
presence.updated
match.progression
player.reconnect_grace
player.reconnect_restored
```

Comandos permitidos:

```text
ping
replay.get
```

O canal não aceita ações de jogo e não recebe `player.private_state`.

### Painel administrativo

Interface:

```text
GET /admin
```

API protegida:

```text
GET /admin/overview
GET /admin/disconnects
GET /admin/seasons
POST /admin/seasons
GET /admin/penalties
POST /admin/penalties
```

O operador informa `HEXA_ADMIN_TOKEN` no navegador. O token permanece em `sessionStorage` e é enviado por `Authorization: Bearer` apenas para o mesmo host.

## PostgreSQL

Tabelas adicionadas:

```text
reconnect_leases
match_replays
replay_events
```

O `reconnect_leases` funciona como fila distribuída. A reivindicação e a remoção ocorrem na mesma transação.

## Health check

O endpoint `/health` passa a incluir:

```json
{
  "version": "0.7.0",
  "resilienceStore": "postgres",
  "spectators": 0
}
```

## Deploy

```bash
POSTGRES_PASSWORD='senha-segura' \
HEXA_ADMIN_TOKEN='segredo-longo' \
docker compose up --build
```

Verificações:

```bash
curl http://localhost:8080/health
curl http://localhost:8080/replays
curl -H "Authorization: Bearer $HEXA_ADMIN_TOKEN" http://localhost:8080/admin/overview
```

## Limites atuais

- o espectador ainda não possui uma tela dedicada no cliente Godot;
- replays guardam eventos e snapshots públicos, mas ainda não executam uma timeline cinematográfica;
- abandono durante indisponibilidade total do PostgreSQL depende da recuperação do banco;
- AAB de release e assinatura de produção permanecem fora desta entrega;
- testes de carga e chaos testing serão o próximo endurecimento operacional.

---

**Tehkné Solutions**
