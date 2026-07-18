# Hexa Octarina Conquer

Motor de referência do jogo tático híbrido definido no GDD: conquista geométrica por **Dots and Boxes**, conexão e cerco inspirados em **Go**, progressão de eras, economia territorial e duelos de cartas em células.

## Estado atual — v0.2.0

Esta sprint estabiliza o núcleo antes da integração com Godot 4 e backend autoritativo:

- arestas validadas por limite, ortogonalidade e duplicidade;
- posse da célula atribuída a quem fecha o quarto lado;
- províncias persistentes, sem perder HP, nível ou proteção quando o tabuleiro muda;
- turnos corrigidos, com ações por era e turno extra ao fechar células;
- recursos de madeira, pedra, comida e conhecimento;
- cercos agora abrem um **Duelo de Célula**, em vez de capturar silenciosamente;
- combate TCG com energia, escudo, cura, status, elementos e combo `wet + electric`;
- eventos e snapshot serializável para futura API/WebSocket;
- assinatura técnica: **Tehkné Solutions**.

## Executar

```bash
python -m unittest discover -s tests -v
PYTHONPATH=src python -m hexa_octarina_conquer.cli
```

Após instalação editável, o comando também fica disponível:

```bash
pip install -e .
hexa-octarina
```

## Estrutura

- `src/hexa_octarina_conquer/game_state.py`: estado autoritativo, Dots, províncias, turnos, eras e gatilhos de cerco;
- `src/hexa_octarina_conquer/combat.py`: resolução determinística dos duelos TCG;
- `src/hexa_octarina_conquer/catalog.py`: deck inicial de demonstração;
- `src/hexa_octarina_conquer/cli.py`: cliente local mínimo;
- `tests/`: regressões do motor e do combate;
- `docs/adr/`: decisões arquiteturais;
- `docs/sprint-04-core-tatico.md`: escopo e critérios desta entrega.

## Próximo marco

Implementar a camada de transporte autoritativa em Node.js/WebSocket e um cliente Godot 4 que consuma snapshots e eventos deste motor como especificação executável.

---

Desenvolvido por **Tehkné Solutions**.
