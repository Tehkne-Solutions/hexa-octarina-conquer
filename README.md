# Hexa Octarina Conquer

Jogo tático híbrido definido no GDD: conquista geométrica por **Dots and Boxes**, conexão e cerco inspirados em **Go**, progressão territorial, cartas, recursos e Duelos de Célula em uma arena de fantasia.

## Estado atual — Sprint 08

O projeto possui seis camadas complementares:

- **motor Python de referência**: especificação executável das regras e regressões;
- **servidor Node.js autoritativo**: salas, WebSocket, turnos, províncias, duelos e encerramento de partidas;
- **identidade e progressão**: contas, sessões, XP, níveis, rating, ranking e histórico;
- **persistência**: SQLite para instância única e PostgreSQL para identidade compartilhada;
- **cliente Godot 4 em 3D**: contas, matchmaking, arena, cartas, combate e interface mobile;
- **operação e distribuição**: métricas Prometheus, logs JSON, Docker e APK Android.

### Implementado

- regras Dots + Go com províncias persistentes e cerco;
- cartas macro e combate simultâneo TCG;
- estado público e privado separados por sessão;
- contas com senha protegida por `scrypt` e tokens armazenados por hash;
- modo visitante preservado;
- conta opcionalmente vinculada ao jogador da sala;
- encerramento autoritativo por desistência;
- XP, nível, vitórias, derrotas e rating calculado de forma idempotente;
- ranking e histórico de partidas;
- adaptadores de identidade em memória, SQLite e PostgreSQL;
- métricas Prometheus em `/metrics`;
- health check enriquecido e logs estruturados em JSON;
- interface Godot para cadastro, login, perfil, ranking e histórico;
- preset Android ARM64, controles touch e geração automatizada do APK debug;
- CI para Python, Node.js, SQLite, PostgreSQL, Godot, Android, Docker e conformidade cruzada.

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
HTTP health:      http://localhost:8080/health
HTTP lobby:       http://localhost:8080/rooms
HTTP ranking:     http://localhost:8080/leaderboard
Prometheus:       http://localhost:8080/metrics
WebSocket:        ws://localhost:8080/ws
```

### Estado das salas

```bash
HEXA_STORE=sqlite HEXA_DB_PATH=.data/hexa-octarina.sqlite npm start
HEXA_STORE=memory npm start
HEXA_STORE=files HEXA_DATA_DIR=.data/rooms npm start
```

### Contas e progressão

SQLite local:

```bash
HEXA_IDENTITY_STORE=sqlite \
HEXA_IDENTITY_DB_PATH=.data/hexa-identity.sqlite \
npm start
```

PostgreSQL:

```bash
HEXA_IDENTITY_STORE=postgres \
DATABASE_URL=postgresql://hexa:senha@localhost:5432/hexa_octarina \
npm start
```

Comandos WebSocket de identidade:

```text
account.register
account.login
account.profile
account.history
leaderboard.list
match.forfeit
```

Validação completa:

```bash
cd server
npm run check
```

## Executar com Docker e PostgreSQL

```bash
POSTGRES_PASSWORD=uma-senha-segura docker compose up --build
```

A composição inicia:

- PostgreSQL para contas, progressão e histórico;
- servidor autoritativo com SQLite para snapshots das salas;
- volume persistente para cada armazenamento;
- health checks dos dois serviços.

## Cliente Godot 4

Abra `client/godot/project.godot` no Godot 4.6.3.

Na abertura, o jogador pode:

- criar uma conta;
- entrar em uma conta existente;
- continuar como visitante;
- consultar perfil, ranking e histórico;
- entrar automaticamente em uma sala disponível;
- jogar por mouse ou toque.

Argumentos opcionais:

```bash
godot --path client/godot -- --name=Arquiteto
godot --path client/godot -- --room=A1B2C3D4
godot --path client/godot -- --create
godot --path client/godot -- --server=ws://192.168.0.10:8080/ws
```

## Exportar Android

O preset gera APK debug ARM64 com Internet habilitada:

```bash
GODOT_BIN=/caminho/Godot_4.6.3 \
ANDROID_HOME=/caminho/android-sdk \
./scripts/export-android.sh
```

Saída padrão:

```text
build/android/HexaOctarinaConquer-debug.apk
```

O GitHub Actions também publica o APK como artefato `hexa-octarina-android-debug`.

## Estrutura

- `src/hexa_octarina_conquer/`: motor Python de referência;
- `conformance/`: cenários equivalentes Python ↔ Node;
- `server/src/identity-*.js`: contas, sessões e progressão;
- `server/src/metrics.js`: métricas Prometheus;
- `server/src/logger.js`: logs estruturados;
- `server/test/`: regras, identidade, PostgreSQL, WebSocket e observabilidade;
- `client/godot/`: cliente 3D, interface de conta e preset Android;
- `Dockerfile` e `compose.yaml`: execução persistente;
- `docs/sprint-08-identidade-ranking-postgres-android.md`: relatório da entrega;
- `docs/adr/`: decisões arquiteturais.

## Limites atuais

- o estado autoritativo das salas ainda usa SQLite e exige afinidade de instância;
- contas PostgreSQL estão prontas, mas o estado da partida ainda não foi migrado para banco compartilhado;
- a arena continua com personagens e cenários procedurais;
- o duelo ainda acontece sobre a arena, sem cena cinematográfica dedicada;
- recuperação de senha, e-mail verificado e moderação ainda não fazem parte do recorte.

## Próximo marco

Sprint 09: estado distribuído de partidas, matchmaking por rating, temporadas, recuperação de conta, telemetria de cliente e assets visuais finais.

---

Desenvolvido por **Tehkné Solutions**.
