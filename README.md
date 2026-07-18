# Hexa Octarina Conquer

Jogo tático híbrido definido no GDD: conquista geométrica por **Dots and Boxes**, conexão e cerco inspirados em **Go**, progressão de eras, economia territorial e Duelo de Célula com cartas.

## Estado atual — Sprint 05

O projeto possui três camadas complementares:

- **motor Python de referência**: especificação executável das regras, balanceamento e regressões;
- **servidor Node.js autoritativo**: salas, WebSocket, revisões, patches, turnos e duelos;
- **cliente Godot 4 mínimo**: conexão, reconexão, desenho do tabuleiro e envio de arestas por clique.

### Implementado

- arestas validadas por limite, ortogonalidade e duplicidade;
- posse da célula atribuída a quem fecha o quarto lado;
- turnos alternados e ação extra ao fechar células;
- cartas macro de expansão, fortificação e convocação de duelo;
- duelo simultâneo com energia, escudo, cura, status e combo `wet + lightning`;
- captura territorial após a resolução do duelo;
- criação e entrada em salas de dois jogadores;
- tokens privados de sessão;
- reconexão incremental por revisão;
- snapshots e patches JSON versionados;
- cliente Godot com persistência local da sessão;
- CI para Python e Node.js.

## Motor Python

```bash
python -m pip install -e .
python -m unittest discover -s tests -v
hexa-octarina
```

## Servidor WebSocket

```bash
cd server
npm install
npm start
```

Endpoints:

```text
HTTP health: http://localhost:8080/health
WebSocket:    ws://localhost:8080/ws
```

Para executar os testes:

```bash
cd server
npm test
```

## Cliente Godot 4

Abra `client/godot/project.godot` no Godot 4.

Por padrão, o cliente conecta em:

```text
ws://127.0.0.1:8080/ws
```

Também é possível iniciar com parâmetros:

```bash
godot --path client/godot -- --name=Arquiteto --room=A1B2C3D4
```

Sem `--room`, o cliente cria uma sala. Com o código, ele entra em uma sala existente.

## Estrutura

- `src/hexa_octarina_conquer/`: motor de referência Python;
- `tests/`: testes do motor de referência;
- `server/src/`: servidor Node.js e regras autoritativas do recorte online;
- `server/test/`: testes de protocolo, salas, reconexão e duelo;
- `client/godot/`: cliente técnico Godot 4;
- `docs/protocol-v1.md`: contrato WebSocket;
- `docs/sprint-04-core-tatico.md`: estabilização do domínio;
- `docs/sprint-05-protocolo-autoritativo.md`: entrega online atual;
- `docs/adr/`: decisões arquiteturais.

## Próximo marco

Sprint 06: paridade automatizada Python ↔ Node, províncias conectadas, persistência de partidas e primeira arena 3D no Godot.

---

Desenvolvido por **Tehkné Solutions**.
