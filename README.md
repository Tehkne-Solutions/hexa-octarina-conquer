# Hexa Octarina Conquer

Jogo tático híbrido definido no GDD: conquista geométrica por **Dots and Boxes**, conexão e cerco inspirados em **Go**, progressão territorial, cartas, recursos e Duelos de Célula em uma arena de fantasia.

## Estado atual — Sprint 06

O projeto agora possui quatro camadas complementares:

- **motor Python de referência**: especificação executável das regras e regressões;
- **servidor Node.js autoritativo**: salas, lobby, persistência, WebSocket, turnos, províncias e duelos;
- **suíte de conformidade Python ↔ Node**: executa cenários canônicos nos dois motores e compara os resultados;
- **cliente Godot 4 em 3D**: matchmaking, reconexão, arena procedural e jogadas por seleção de pilares.

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
- lobby público por HTTP e WebSocket, sem exposição de credenciais;
- tokens privados e reconexão incremental por revisão;
- persistência atômica das salas e recuperação após reinício;
- migração de snapshots legados da Sprint 05;
- arena 3D procedural com plataformas, pilares, muralhas e unidades;
- CI para Python, Node.js e conformidade cruzada.

## Motor Python

```bash
python -m pip install -e .
python -m unittest discover -s tests -v
hexa-octarina
```

## Servidor autoritativo

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

As salas são persistidas por padrão em `.data/rooms`. Para mudar o diretório:

```bash
HEXA_DATA_DIR=/caminho/seguro npm start
```

Validação completa:

```bash
cd server
npm run check
```

O comando executa testes do servidor, transporte WebSocket, persistência e cenários de conformidade contra o motor Python.

## Cliente Godot 4

Abra `client/godot/project.godot` no Godot 4. A cena inicial é a arena procedural 3D.

Por padrão, o cliente conecta em:

```text
ws://127.0.0.1:8080/ws
```

Sem argumentos, o cliente procura uma sala em espera e entra automaticamente; quando nenhuma existe, cria uma nova.

Parâmetros disponíveis:

```bash
godot --path client/godot -- --name=Arquiteto
godot --path client/godot -- --name=Conjurador --room=A1B2C3D4
godot --path client/godot -- --name=Arquiteto --create
godot --path client/godot -- --server=ws://192.168.0.10:8080/ws
```

A cena 2D anterior permanece no repositório como ferramenta de diagnóstico.

## Estrutura

- `src/hexa_octarina_conquer/`: motor de referência Python;
- `tests/`: regressões do motor Python;
- `conformance/`: cenários executados igualmente nos dois motores;
- `server/src/`: servidor autoritativo, lobby e persistência;
- `server/test/`: protocolo, salas, WebSocket, províncias, persistência e conformidade;
- `client/godot/`: cliente técnico e arena procedural 3D;
- `docs/protocol-v1.md`: contrato de transporte;
- `docs/sprint-06-paridade-persistencia-arena3d.md`: relatório desta entrega;
- `docs/adr/`: decisões arquiteturais.

## Limites atuais

- a persistência JSON é adequada para uma instância única, não para cluster horizontal;
- a arena usa geometria procedural e ainda não contém os assets finais de fantasia;
- ainda falta uma interface dedicada para escolher cartas e resolver os duelos no Godot;
- autenticação de conta e progressão permanente do jogador ainda não fazem parte do recorte online.

## Próximo marco

Sprint 07: interface completa de cartas e duelos no Godot, feedback visual/sonoro, persistência em banco transacional e preparação de deploy multiplayer.

---

Desenvolvido por **Tehkné Solutions**.
