# Sprint 07 — Cartas, combate, SQLite e deploy

## Objetivo

Transformar a arena 3D técnica em um recorte jogável de estratégia + cartas, proteger informações privadas e preparar o servidor para execução persistente em produção.

## Entregas

### Estado privado

- `player.private_state` enviado apenas ao socket autenticado;
- mão completa com nome, custo, tipo, efeito, descrição e ícone;
- mana e HP locais;
- registro somente da própria submissão secreta de duelo;
- snapshots, patches e lobby continuam sem cartas ou tokens.

### Interface Godot

- painel inferior de cartas;
- mana e HP do jogador;
- seleção de província;
- uso de Fortificação e Convocar Duelo;
- modo armado da Expansão Rúnica;
- seleção múltipla de cartas táticas;
- energia, HP, escudo e rodada do duelo;
- bloqueio visual enquanto aguarda o oponente;
- envio de sequência simultânea.

### Feedback audiovisual

- explosões procedurais por evento;
- pulso de conquista;
- impacto de duelo;
- tremor de câmera;
- tons sintetizados em runtime;
- nenhuma dependência de assets externos para o protótipo.

### Persistência transacional

- `SqliteRoomStore` usando `node:sqlite`;
- WAL e synchronous normal;
- uma transação `BEGIN IMMEDIATE` por persistência;
- snapshot e evento gravados juntos;
- rollback em falhas;
- journal de eventos idempotente;
- modos `memory` e `files` preservados.

### Deploy

- Node.js 24;
- Dockerfile de produção;
- usuário sem privilégio;
- volume `/data`;
- health check;
- `compose.yaml`;
- `.env.example`;
- CI com build real da imagem.

## Critérios de validação

- uma mão não aparece no snapshot público;
- cada jogador recebe somente seu estado privado;
- uma submissão secreta não revela cartas ao oponente;
- cartas macro saem da mão após confirmação do servidor;
- a interface envia `action.play_card` e `action.resolve_duel_round`;
- salas e eventos são restaurados do SQLite;
- eventos duplicados não são inseridos novamente;
- falhas de gravação executam rollback;
- o container responde em `/health`;
- Python, Node, conformidade e Docker passam no GitHub Actions.

## Decisões

- SQLite atende o recorte de uma única instância com transações reais e baixo custo operacional.
- O estado público e privado permanecem separados no protocolo para evitar vazamento de estratégia.
- Áudio e efeitos são procedurais nesta fase; assets finais entram quando a direção visual for consolidada.

## Limites

- não existe conta persistente de jogador;
- o banco não é compartilhado entre réplicas;
- o combate ainda ocorre sobre a arena principal;
- não há export Android/iOS automatizado;
- personagens e cenários finais ainda não foram incorporados.

## Próximo marco

Sprint 08:

- identidade e contas;
- progressão persistente;
- PostgreSQL e migrações;
- observabilidade;
- export mobile;
- assets finais e cena cinematográfica de duelo.

---

Desenvolvido por **Tehkné Solutions**.
