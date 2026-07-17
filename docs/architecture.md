# Arquitetura do protótipo

## Visão geral

O projeto começa com um núcleo de regras independente de interface. A intenção é separar:

- modelo de estado do tabuleiro;
- regras de conquista e evolução;
- camada de cartas e efeitos;
- camada de apresentação futura (UI/3D).

## Módulos previstos

- `game_state.py`: mantém o estado do jogo, turnos, tabuleiro e províncias.
- `rules.py`: implementa a lógica de fechamento de células, evolução de unidades e captura.
- `cards.py`: modela cartas de ataque, evolução, conquista e armadilha.
- `models.py`: tipos auxiliares como `Player`, `Province`, `Unit` e `Card`.

## Princípios

- regras puras e determinísticas;
- testes automatizados para cada regra central;
- documentação por fase e evolução do produto.
