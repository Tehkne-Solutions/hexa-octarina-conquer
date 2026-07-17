# Hexa Octarina Conquer

Este repositório inicia a implementação de um protótipo de jogo híbrido baseado no conceito do GDD em [docs/Hexa Octarina Conquer - GDD - Jogo.md](docs/Hexa%20Octarina%20Conquer%20-%20GDD%20-%20Jogo.md).

## Objetivo do protótipo

- apoiar a lógica de tabuleiro inspirada em Go e Dots and Boxes;
- permitir a criação de províncias e unidades progressivas;
- servir de base para uma futura camada de cartas, combate e UI 3D.

## Estrutura inicial

- `src/hexa_octarina_conquer/`: núcleo do jogo e regras de simulação;
- `tests/`: testes automatizados para garantir evolução controlada;
- `docs/`: documentação de arquitetura, roadmap e decisões de produto.

## Como executar os testes

```bash
python -m unittest discover -s tests -v
```

## Próximos passos

- expandir a regra de captura para unidades conectadas;
- adicionar cartas de ataque, evolução e armadilha;
- preparar a base para UI 3D e combate de células.
