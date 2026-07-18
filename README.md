# Hexa Octarina Conquer

Jogo tático híbrido definido no GDD: conquista geométrica por **Dots and Boxes**, conexão e cerco inspirados em **Go**, progressão territorial, cartas, recursos e Duelos de Célula em uma arena de fantasia.

## Estado atual — Sprint 07

O projeto possui cinco camadas complementares:

- **motor Python de referência**: especificação executável das regras e regressões;
- **servidor Node.js autoritativo**: salas, lobby, SQLite, WebSocket, turnos, províncias e duelos;
- **suíte de conformidade Python ↔ Node**: executa cenários canônicos nos dois motores e compara os resultados;
- **cliente Godot 4 em 3D**: matchmaking, reconexão, arena procedural, mão de cartas e combate;
- **empacotamento de produção**: Docker, health check e volume persistente.

### Implementado

- arestas validadas por limite, ortogonalidade e duplicidade;
- posse da célula atribuída a quem fecha o quarto lado;
- bônus por cada célula fechada, inclusive duas em uma única aresta;
- células aliadas conectadas agrupadas em províncias persistentes;
- preservação de unidade, nível, HP e fortificação durante fusões;
- captura e união automática com territórios aliados adjacentes;
- cerco territorial abrindo automaticamente um Duelo de Célula;
- suporte territorial alterando HP e energia no combate;
- cartas macro de expansão, fortificação e convocação de duelo;
- duelo simultâneo com energia, escudo, cura, status e combo `wet + lightning`;
- estado privado autenticado com a mão completa apenas para seu proprietário;
- HUD Godot com cartas, alvo de província, HP, mana, energia e confirmação de rodada;
- efeitos procedurais, pulsos, impacto, tremor de câmera e áudio sintetizado;
- lobby público por HTTP e WebSocket, sem exposição de credenciais;
- tokens privados e reconexão incremental por revisão;
- persistência transacional SQLite com journal de eventos;
- modos alternativos em memória ou arquivos JSON;
- migração de snapshots legados da Sprint 05;
- arena 3D procedural com plataformas, pilares, muralhas e unidades;
- CI para Python, Node.js, SQLite, conformidade e imagem Docker.

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
HTTP health: http://localhost:8080/health
HTTP lobby:  http://localhost:8080/rooms
WebSocket:    ws://localhost:8080/ws
```

### Persistência

SQLite é o modo padrão:

```bash
HEXA_STORE=sqlite HEXA_DB_PATH=.data/hexa-octarina.sqlite npm start
```

Modos alternativos:

```bash
HEXA_STORE=memory npm start
HEXA_STORE=files HEXA_DATA_DIR=.data/rooms npm start
```

Validação completa:

```bash
cd server
npm run check
```

## Executar com Docker

```bash
docker compose up --build
```

O serviço expõe a porta `8080`, grava o banco no volume `hexa_octarina_data` e possui health check interno.

## Cliente Godot 4

Abra `client/godot/project.godot` no Godot 4. A cena inicial é a arena procedural 3D.

Sem argumentos, o cliente procura uma sala em espera e entra automaticamente; quando nenhuma existe, cria uma nova.

```bash
godot --path client/godot -- --name=Arquiteto
godot --path client/godot -- --name=Conjurador --room=A1B2C3D4
godot --path client/godot -- --name=Arquiteto --create
godot --path client/godot -- --server=ws://192.168.0.10:8080/ws
```

Na arena:

- cartas macro são usadas pelo painel inferior;
- Expansão Rúnica arma a próxima seleção de dois pilares;
- Fortificação e Duelo usam a província selecionada no painel;
- durante um duelo, cartas táticas podem ser combinadas dentro do limite de energia;
- a resolução permanece oculta até ambos enviarem suas sequências.

A cena 2D anterior permanece como ferramenta de diagnóstico.

## Estrutura

- `src/hexa_octarina_conquer/`: motor de referência Python;
- `tests/`: regressões do motor e pacote Godot;
- `conformance/`: cenários executados igualmente nos dois motores;
- `server/src/`: servidor autoritativo, lobby e persistência;
- `server/test/`: protocolo, salas, estado privado, SQLite, WebSocket e conformidade;
- `client/godot/`: cliente e arena procedural 3D;
- `Dockerfile` e `compose.yaml`: execução multiplayer persistente;
- `docs/protocol-v1.md`: contrato de transporte;
- `docs/sprint-07-cartas-combate-sqlite-deploy.md`: relatório desta entrega;
- `docs/adr/`: decisões arquiteturais.

## Limites atuais

- SQLite atende uma instância única; cluster horizontal exigirá PostgreSQL ou coordenação distribuída;
- a arena ainda usa geometria procedural, sem personagens e cenários finais;
- o cliente não possui contas, ranking ou progressão permanente;
- o duelo utiliza o HUD da arena, sem uma cena cinematográfica separada.

## Próximo marco

Sprint 08: contas e progressão, PostgreSQL, observabilidade, export mobile e assets visuais finais.

---

Desenvolvido por **Tehkné Solutions**.
