# Hexa Octarina Conquer

Jogo tático híbrido de conquista geométrica por **Dots and Boxes**, conexão e cerco inspirados em **Go**, cartas, recursos, províncias e Duelos de Célula em uma arena de fantasia.

## Estado atual — Sprint 09

A versão `0.9.0` possui sete camadas complementares:

- **motor Python de referência**: especificação executável das regras e regressões;
- **servidor Node.js autoritativo**: WebSocket, turnos, províncias, duelos e encerramento de partidas;
- **estado distribuído**: salas e eventos persistidos no PostgreSQL com controle otimista de revisão;
- **identidade e progressão**: contas, sessões, XP, níveis, rating global e histórico;
- **competição sazonal**: temporadas, ranking próprio, matchmaking por rating, região e tamanho do tabuleiro;
- **cliente Godot 4 em 3D**: conta, recuperação, fila ranqueada, arena, cartas, combate e touch;
- **operação e distribuição**: Prometheus, logs JSON, Docker Compose e APK Android ARM64.

### Implementado

- regras Dots + Go com províncias persistentes, fusão e cerco;
- cartas macro e combate simultâneo TCG;
- separação entre estado público e estado privado autenticado;
- contas com senha protegida por `scrypt` e tokens armazenados somente por hash;
- recuperação por código temporário de uso único;
- invalidação das sessões anteriores após redefinição de senha;
- XP, nível, vitórias, derrotas, rating global e histórico idempotente;
- temporadas com rating, vitórias, derrotas e partidas de colocação separados do perfil global;
- matchmaking com faixa inicial de ±100 pontos, expansão gradual até ±500, região e tabuleiro;
- aceite explícito de pareamento com sala reservada;
- snapshots e journal de salas no PostgreSQL;
- recarga da sala antes de cada comando e rejeição de escritor obsoleto;
- modos locais em SQLite, arquivos JSON ou memória;
- telemetria de cliente autenticada ou visitante;
- métricas Prometheus em `/metrics` e logs estruturados em JSON;
- cliente Godot com ranking global, ranking sazonal, histórico, fila e recuperação;
- APK Android debug ARM64 gerado automaticamente no GitHub Actions;
- CI para Python, Node.js, PostgreSQL, Godot, Android, Docker e conformidade cruzada.

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

Endpoints:

```text
HTTP health:             http://localhost:8080/health
HTTP lobby:              http://localhost:8080/rooms
HTTP ranking global:     http://localhost:8080/leaderboard
HTTP temporadas:         http://localhost:8080/seasons
HTTP ranking sazonal:    http://localhost:8080/season-leaderboard
Prometheus:              http://localhost:8080/metrics
WebSocket:               ws://localhost:8080/ws
```

### Execução totalmente distribuída

```bash
HEXA_STORE=postgres \
HEXA_IDENTITY_STORE=postgres \
HEXA_COMPETITION_STORE=postgres \
DATABASE_URL=postgresql://hexa:senha@localhost:5432/hexa_octarina \
npm start
```

Cada comando recarrega o snapshot atual, aplica a regra e grava somente quando a revisão persistida ainda corresponde à revisão esperada. Uma instância atrasada recebe `ROOM_WRITE_CONFLICT` e deve reconectar antes de tentar novamente.

### Modos locais

```bash
HEXA_STORE=sqlite HEXA_DB_PATH=.data/hexa-octarina.sqlite npm start
HEXA_STORE=files HEXA_DATA_DIR=.data/rooms npm start
HEXA_STORE=memory npm start
```

Identidade local:

```bash
HEXA_IDENTITY_STORE=sqlite \
HEXA_IDENTITY_DB_PATH=.data/hexa-identity.sqlite \
HEXA_COMPETITION_STORE=memory \
npm start
```

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

Validação:

```bash
cd server
npm run check
npm run test:postgres
```

## Docker Compose

```bash
POSTGRES_PASSWORD=uma-senha-segura docker compose up --build
```

A composição inicia PostgreSQL e o servidor com:

- salas e eventos no PostgreSQL;
- contas e progressão global no PostgreSQL;
- temporadas, fila, recuperação e telemetria no PostgreSQL;
- health check que confirma os três adaptadores distribuídos;
- apenas a porta `8080` publicada pelo servidor.

Para escalar o processo Node horizontalmente, todas as réplicas devem apontar para o mesmo `DATABASE_URL`. A entrega usa controle otimista no banco; a distribuição em tempo real de eventos entre sockets conectados a réplicas diferentes ainda requer um barramento de mensagens.

## Cliente Godot 4

Abra `client/godot/project.godot` no Godot 4.6.3.

Jogadores autenticados podem:

- criar conta, entrar ou recuperar acesso;
- visualizar perfil, ranking global e ranking da temporada;
- entrar na fila ranqueada e acompanhar a expansão da faixa de busca;
- aceitar automaticamente a sala reservada;
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

O preset `0.9.0` gera um APK debug ARM64 com Internet, landscape, toque e compressão ETC2/ASTC:

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
- `server/src/identity-*.js`: contas, sessões e progressão global;
- `server/src/competition-*.js`: temporadas, fila, recuperação e telemetria;
- `server/test/`: regras, concorrência, PostgreSQL, WebSocket e observabilidade;
- `client/godot/`: cliente 3D, interface competitiva e preset Android;
- `Dockerfile` e `compose.yaml`: execução local e distribuída;
- `docs/sprint-09-distribuicao-matchmaking-temporadas.md`: relatório da entrega;
- `docs/competitive-protocol-v1.md`: contrato competitivo aditivo;
- `docs/adr/`: decisões arquiteturais.

## Limites atuais

- sockets conectados a réplicas Node diferentes ainda não recebem broadcasts cruzados sem Redis/NATS/PubSub;
- o matchmaking não possui penalidade por abandono de fila ou ausência no aceite;
- recuperação em produção depende de integrar um canal externo para entregar o código;
- não há moderação, e-mail verificado ou painel administrativo;
- personagens, cenários e efeitos finais ainda são majoritariamente procedurais;
- o duelo permanece sobre a arena, sem cena cinematográfica dedicada.

## Próximo marco

Sprint 10: barramento de eventos entre réplicas, presença distribuída, penalidades competitivas, administração de temporadas, canal real de recuperação e evolução visual dos assets.

---

Desenvolvido por **Tehkné Solutions**.
