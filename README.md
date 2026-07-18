# Hexa Octarina Conquer

Jogo tático híbrido de conquista geométrica por **Dots and Boxes**, conexão e cerco inspirados em **Go**, cartas, recursos, províncias e Duelos de Célula em uma arena de fantasia.

## Estado atual — Sprint 11

A versão `0.11.0` possui dez camadas complementares:

- **motor Python de referência**: especificação executável das regras e regressões;
- **servidor Node.js autoritativo**: WebSocket, turnos, províncias, duelos e encerramento de partidas;
- **estado distribuído**: salas e eventos no PostgreSQL com controle otimista de revisão;
- **barramento de cluster**: eventos persistidos e distribuídos por `LISTEN/NOTIFY`;
- **identidade e progressão**: contas, sessões, XP, níveis, rating global e histórico;
- **competição e governança**: temporadas, matchmaking, penalidades e administração protegida;
- **resiliência de partidas**: grace period, leases distribuídos, abandono idempotente e penalidades;
- **espectador e replay**: acompanhamento público ao vivo e histórico autoritativo por revisão;
- **cliente Godot 4 em 3D**: conta, fila ranqueada, arena, cartas, presença e touch;
- **operação e distribuição**: painel web, Prometheus, logs JSON, Docker Compose e APK Android ARM64.

### Implementado

- regras Dots + Go com províncias persistentes, fusão e cerco;
- cartas macro e combate simultâneo TCG;
- separação entre estado público e estado privado autenticado;
- contas com senha protegida por `scrypt` e tokens armazenados somente por hash;
- recuperação por código temporário de uso único e entrega externa por webhook;
- XP, nível, vitórias, derrotas, rating global e histórico idempotente;
- temporadas com rating, vitórias, derrotas e partidas de colocação;
- matchmaking por faixa, região e tamanho do tabuleiro;
- cooldown por ausência na confirmação e abandono da partida;
- administração de temporadas e penalidades por API protegida;
- snapshots e journal de salas no PostgreSQL;
- recarga da sala antes de cada comando e rejeição de escritor obsoleto;
- eventos entre réplicas com payload persistido e notificação por referência;
- presença distribuída com heartbeat, TTL e limpeza;
- leases de reconexão reivindicados com `FOR UPDATE SKIP LOCKED`;
- retorno por qualquer réplica durante o prazo de reconexão;
- abandono autoritativo após vencimento do grace period;
- replay público persistido e deduplicado por sala e revisão;
- WebSocket de espectador sem acesso a mãos ou tokens;
- painel operacional incorporado em `/admin`;
- métricas Prometheus e logs estruturados em JSON;
- cliente Godot e APK Android debug ARM64 versionados como `0.11.0`;
- CI para Python, Node.js, PostgreSQL, duas réplicas, Godot, Android, Docker e conformidade cruzada.

## Motor Python

```bash
python -m pip install -e .
python -m unittest discover -s tests -v
hexa-octarina
```

## Servidor autoritativo

Requer Node.js 24 ou superior.

```bash
cd server
npm install
npm start
```

### Endpoints públicos

```text
GET  /health
GET  /rooms
GET  /presence
GET  /leaderboard
GET  /seasons
GET  /season-leaderboard
GET  /replays
GET  /replays/{roomId}
GET  /metrics
WS   /ws
WS   /spectator?roomId=ROOM_ID
```

Consulta incremental de replay:

```text
GET /replays/ROOM_ID?afterRevision=20&limit=500
```

### Administração

Interface:

```text
GET /admin
```

API protegida:

```text
GET       /admin/overview
GET       /admin/disconnects
GET|POST  /admin/seasons
GET|POST  /admin/penalties
```

Todos os endpoints administrativos exigem:

```text
Authorization: Bearer <HEXA_ADMIN_TOKEN>
```

### Execução totalmente distribuída

```bash
HEXA_STORE=postgres \
HEXA_IDENTITY_STORE=postgres \
HEXA_COMPETITION_STORE=postgres \
HEXA_CLUSTER_BUS=postgres \
HEXA_PRESENCE_STORE=postgres \
HEXA_GOVERNANCE_STORE=postgres \
HEXA_RESILIENCE_STORE=postgres \
DATABASE_URL=postgresql://hexa:senha@localhost:5432/hexa_octarina \
HEXA_ADMIN_TOKEN=uma-chave-administrativa-longa \
npm start
```

Cada comando recarrega o snapshot atual e grava somente quando a revisão persistida ainda corresponde à revisão esperada. Uma réplica atrasada recebe `ROOM_WRITE_CONFLICT` e deve recarregar o estado.

O barramento registra o payload completo em `cluster_events` e transmite somente o ID pelo PostgreSQL `LISTEN/NOTIFY`.

### Reconexão e abandono

Variáveis principais:

```text
HEXA_RECONNECT_GRACE_MS=60000
HEXA_RESILIENCE_MAINTENANCE_MS=5000
HEXA_ABANDONMENT_COOLDOWN_MS=600000
```

Fluxo:

1. o socket fecha e a presença local é removida;
2. se o jogador não estiver em outra réplica, um lease é criado;
3. a sala recebe `player.reconnect_grace`;
4. uma reconexão válida cancela o lease e publica `player.reconnect_restored`;
5. após o prazo, uma réplica reivindica o lease;
6. se o jogador continuar offline, a partida termina por `abandonment`;
7. progressão, temporada e penalidade são registradas uma única vez.

### Espectador

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

O espectador recebe somente estado público. `player.private_state`, mãos e tokens nunca são enviados ou gravados no replay.

### Modos locais

```bash
HEXA_STORE=memory \
HEXA_IDENTITY_STORE=memory \
HEXA_COMPETITION_STORE=memory \
HEXA_CLUSTER_BUS=memory \
HEXA_PRESENCE_STORE=memory \
HEXA_GOVERNANCE_STORE=memory \
HEXA_RESILIENCE_STORE=memory \
npm start
```

### Recuperação de conta

Produção por webhook:

```bash
HEXA_RECOVERY_PROVIDER=webhook \
HEXA_RECOVERY_WEBHOOK_URL=https://automation.example.com/hexa/recovery \
HEXA_RECOVERY_WEBHOOK_SECRET=uma-chave-secreta \
npm start
```

A resposta do protocolo permanece genérica para não revelar se uma conta existe.

### Validação

```bash
cd server
npm run check
npm run test:postgres
```

## Docker Compose

```bash
POSTGRES_PASSWORD=uma-senha-segura \
HEXA_ADMIN_TOKEN=uma-chave-administrativa-longa \
docker compose up --build
```

A composição utiliza PostgreSQL para:

- salas, snapshots e journal;
- contas e progressão global;
- temporadas, fila, recuperação e telemetria;
- barramento entre réplicas;
- presença distribuída;
- penalidades e governança;
- leases de reconexão e replay público.

Todas as réplicas devem apontar para o mesmo `DATABASE_URL` e usar identificadores de instância distintos.

## Cliente Godot 4

Abra `client/godot/project.godot` no Godot 4.6.3.

Jogadores autenticados podem:

- criar conta, entrar ou recuperar acesso;
- visualizar perfil e rankings;
- entrar na fila ranqueada;
- receber cooldown competitivo;
- reconectar durante o grace period;
- acompanhar jogadores online;
- consultar histórico e progressão;
- jogar por mouse ou toque.

Argumentos opcionais:

```bash
godot --path client/godot -- --name=Arquiteto
godot --path client/godot -- --room=A1B2C3D4
godot --path client/godot -- --create
godot --path client/godot -- --region=br
godot --path client/godot -- --server=ws://192.168.0.10:8080/ws
```

## Android

O preset `0.11.0` gera um APK debug ARM64 com Internet, landscape, toque e compressão ETC2/ASTC:

```bash
GODOT_BIN=/caminho/Godot_4.6.3 \
ANDROID_HOME=/caminho/android-sdk \
./scripts/export-android.sh
```

Saída:

```text
build/android/HexaOctarinaConquer-debug.apk
```

O GitHub Actions publica o pacote no artefato `hexa-octarina-android-debug`.

## Estrutura

- `src/hexa_octarina_conquer/`: motor Python de referência;
- `conformance/`: cenários equivalentes Python ↔ Node;
- `server/src/postgres-room-store.js`: snapshots distribuídos e journal;
- `server/src/distributed-room-manager.js`: carregamento por comando e revisão otimista;
- `server/src/cluster-bus.js`: eventos entre réplicas;
- `server/src/presence-store.js`: presença e heartbeat;
- `server/src/governance-store.js`: penalidades e temporadas;
- `server/src/resilience-store.js`: reconexões e replay;
- `server/src/server-sprint11.js`: espectador, painel e manutenção de abandono;
- `server/src/admin-panel.js`: interface operacional incorporada;
- `server/src/recovery-provider.js`: entrega externa da recuperação;
- `server/src/identity-*.js`: contas, sessões e progressão global;
- `server/src/competition-*.js`: temporadas, fila e telemetria;
- `server/test/`: regras, concorrência, cluster, replay, PostgreSQL e WebSocket;
- `client/godot/`: cliente 3D e preset Android;
- `Dockerfile` e `compose.yaml`: execução local e distribuída;
- `docs/sprint-11-reconnect-spectator-replay.md`: arquitetura e operação da Sprint 11;
- `docs/adr/`: decisões arquiteturais.

## Limites atuais

- `LISTEN/NOTIFY` não substitui um broker dedicado para escala extrema ou múltiplas regiões;
- o espectador ainda não possui uma tela dedicada no cliente Godot;
- o replay ainda não executa uma timeline cinematográfica;
- recuperação em produção depende de integrar o webhook a um canal real;
- personagens e cenários finais ainda dependem de assets GLB e animações;
- AAB de release, testes de carga e chaos testing permanecem como próximos endurecimentos.

## Próximo marco

Sprint 12: tela de espectador e replay no Godot, AAB assinado, testes de carga e chaos, moderação, personagens GLB e cena cinematográfica de duelo.

---

Desenvolvido por **Tehkné Solutions**.
