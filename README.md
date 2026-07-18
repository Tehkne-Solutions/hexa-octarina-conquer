# Hexa Octarina Conquer

Jogo tático híbrido de conquista geométrica por **Dots and Boxes**, conexão e cerco inspirados em **Go**, cartas, recursos, províncias e Duelos de Célula em uma arena de fantasia.

## Estado atual — Sprint 10

A versão `0.10.0` possui oito camadas complementares:

- **motor Python de referência**: especificação executável das regras e regressões;
- **servidor Node.js autoritativo**: WebSocket, turnos, províncias, duelos e encerramento de partidas;
- **estado distribuído**: salas e eventos no PostgreSQL com controle otimista de revisão;
- **barramento de cluster**: eventos persistidos e distribuídos por `LISTEN/NOTIFY`;
- **identidade e progressão**: contas, sessões, XP, níveis, rating global e histórico;
- **competição e governança**: temporadas, matchmaking, penalidades e administração protegida;
- **cliente Godot 4 em 3D**: conta, recuperação, fila ranqueada, arena, cartas, presença e touch;
- **operação e distribuição**: Prometheus, logs JSON, Docker Compose e APK Android ARM64.

### Implementado

- regras Dots + Go com províncias persistentes, fusão e cerco;
- cartas macro e combate simultâneo TCG;
- separação entre estado público e estado privado autenticado;
- contas com senha protegida por `scrypt` e tokens armazenados somente por hash;
- recuperação por código temporário de uso único;
- entrega de recuperação por webhook, console ou modo desativado;
- invalidação das sessões anteriores após redefinição de senha;
- XP, nível, vitórias, derrotas, rating global e histórico idempotente;
- temporadas com rating, vitórias, derrotas e partidas de colocação separados do perfil global;
- matchmaking com faixa inicial de ±100 pontos e expansão gradual até ±500;
- cooldown por ausência na confirmação do pareamento;
- administração de temporadas e penalidades por API protegida;
- snapshots e journal de salas no PostgreSQL;
- recarga da sala antes de cada comando e rejeição de escritor obsoleto;
- eventos entre réplicas com payload persistido e notificação por referência;
- presença distribuída com heartbeat, TTL e limpeza;
- atualização remota de patches públicos e mãos privadas;
- métricas Prometheus em `/metrics` e logs estruturados em JSON;
- cliente Godot com réplica conectada, presença, ranking sazonal e cooldown;
- unidades procedurais compostas com banners, torres e brilho elemental;
- APK Android debug ARM64 gerado automaticamente no GitHub Actions;
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

Endpoints públicos:

```text
HTTP health:             http://localhost:8080/health
HTTP lobby:              http://localhost:8080/rooms
HTTP presença:           http://localhost:8080/presence
HTTP ranking global:     http://localhost:8080/leaderboard
HTTP temporadas:         http://localhost:8080/seasons
HTTP ranking sazonal:    http://localhost:8080/season-leaderboard
Prometheus:              http://localhost:8080/metrics
WebSocket:               ws://localhost:8080/ws
```

Endpoints administrativos:

```text
GET|POST /admin/seasons
GET|POST /admin/penalties
```

Todos exigem:

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
DATABASE_URL=postgresql://hexa:senha@localhost:5432/hexa_octarina \
HEXA_ADMIN_TOKEN=uma-chave-administrativa-longa \
npm start
```

Cada comando recarrega o snapshot atual, aplica a regra e grava somente quando a revisão persistida ainda corresponde à revisão esperada. Uma instância atrasada recebe `ROOM_WRITE_CONFLICT` e deve reconectar antes de tentar novamente.

O barramento registra o payload completo em `cluster_events` e transmite somente o ID pelo PostgreSQL `LISTEN/NOTIFY`. Cada réplica busca o evento e atualiza seus próprios sockets.

### Modos locais

```bash
HEXA_STORE=sqlite HEXA_DB_PATH=.data/hexa-octarina.sqlite npm start
HEXA_STORE=files HEXA_DATA_DIR=.data/rooms npm start
HEXA_STORE=memory npm start
```

Para uma execução local sem PostgreSQL:

```bash
HEXA_STORE=memory \
HEXA_IDENTITY_STORE=memory \
HEXA_COMPETITION_STORE=memory \
HEXA_CLUSTER_BUS=memory \
HEXA_PRESENCE_STORE=memory \
HEXA_GOVERNANCE_STORE=memory \
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

Desenvolvimento:

```bash
HEXA_RECOVERY_PROVIDER=console npm start
```

A resposta do protocolo permanece genérica para não revelar se uma conta existe.

### Comandos WebSocket principais

```text
account.register
account.login
account.profile
account.history
account.recovery.request
account.recovery.confirm
leaderboard.list
season.list
season.leaderboard
matchmaking.enqueue
matchmaking.status
matchmaking.accept
matchmaking.cancel
telemetry.track
room.create
room.join
room.reconnect
action.play_edge
action.play_card
action.resolve_duel_round
match.forfeit
```

Eventos públicos adicionais:

```text
presence.updated
lobby.updated
season.data
room.patch
```

Validação:

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

A composição inicia PostgreSQL e o servidor com:

- salas, snapshots e eventos no PostgreSQL;
- contas e progressão global no PostgreSQL;
- temporadas, fila, recuperação e telemetria no PostgreSQL;
- barramento entre réplicas no PostgreSQL;
- presença distribuída no PostgreSQL;
- penalidades e governança no PostgreSQL;
- health check que confirma todos os adaptadores;
- apenas a porta `8080` publicada pelo servidor.

Para escalar o processo Node horizontalmente, todas as réplicas devem apontar para o mesmo `DATABASE_URL` e usar identificadores de instância distintos.

## Cliente Godot 4

Abra `client/godot/project.godot` no Godot 4.6.3.

Jogadores autenticados podem:

- criar conta, entrar ou recuperar acesso;
- visualizar perfil, ranking global e ranking da temporada;
- entrar na fila ranqueada e acompanhar a expansão da faixa de busca;
- receber cooldown competitivo quando aplicável;
- aceitar automaticamente a sala reservada;
- acompanhar jogadores online na sala;
- consultar histórico e progressão;
- jogar por mouse ou toque.

Visitantes continuam usando o lobby público sem progressão persistente.

Argumentos opcionais:

```bash
godot --path client/godot -- --name=Arquiteto
godot --path client/godot -- --room=A1B2C3D4
godot --path client/godot -- --create
godot --path client/godot -- --region=br
godot --path client/godot -- --server=ws://192.168.0.10:8080/ws
```

## Android

O preset `0.10.0` gera um APK debug ARM64 com Internet, landscape, toque e compressão ETC2/ASTC:

```bash
GODOT_BIN=/caminho/Godot_4.6.3 \
ANDROID_HOME=/caminho/android-sdk \
./scripts/export-android.sh
```

Saída:

```text
build/android/HexaOctarinaConquer-debug.apk
```

O GitHub Actions publica o mesmo pacote no artefato `hexa-octarina-android-debug`.

## Estrutura

- `src/hexa_octarina_conquer/`: motor Python de referência;
- `conformance/`: cenários equivalentes Python ↔ Node;
- `server/src/postgres-room-store.js`: snapshots distribuídos e journal;
- `server/src/distributed-room-manager.js`: carregamento por comando e revisão otimista;
- `server/src/cluster-bus.js`: eventos entre réplicas;
- `server/src/presence-store.js`: presença e heartbeat;
- `server/src/governance-store.js`: penalidades e administração de temporadas;
- `server/src/recovery-provider.js`: entrega externa da recuperação;
- `server/src/identity-*.js`: contas, sessões e progressão global;
- `server/src/competition-*.js`: temporadas, fila, desafios e telemetria;
- `server/test/`: regras, concorrência, cluster, PostgreSQL, WebSocket e observabilidade;
- `client/godot/`: cliente 3D, interface competitiva e preset Android;
- `Dockerfile` e `compose.yaml`: execução local e distribuída;
- `docs/sprint-10-cluster-presenca-governanca.md`: relatório e operação;
- `docs/adr/0005-postgres-cluster-bus.md`: decisão do barramento;
- `docs/adr/`: demais decisões arquiteturais.

## Limites atuais

- `LISTEN/NOTIFY` não substitui um broker dedicado para escala extrema ou múltiplas regiões;
- a penalidade automática cobre ausência na confirmação, mas não abandono durante a batalha;
- a administração ainda é uma API protegida, sem painel web dedicado;
- recuperação em produção depende de integrar o webhook a um canal real;
- personagens e cenários finais ainda dependem de assets GLB e animações produzidos externamente;
- o duelo permanece sobre a arena, sem cena cinematográfica dedicada.

## Próximo marco

Sprint 11: abandono e reconexão com tolerância, espectador, replay, painel administrativo web, integração real de recuperação, personagens GLB, AAB de release, testes de carga e chaos testing.

---

Desenvolvido por **Tehkné Solutions**.
