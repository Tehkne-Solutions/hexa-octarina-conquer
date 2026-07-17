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

- expandir o conjunto de cartas com efeitos mais distintos e equilibrados;
- preparar uma camada de interface simples para demonstração em terminal ou web;
- documentar e refinar a API do motor para uso em cliente ou servidor.

## Status atual

- Fase 1 concluída: base do motor de regras, províncias, recursos e suporte básico de cartas implementadas.
- Fase 2 concluída: captura de províncias cercadas, evolução de era, recursos de conhecimento e fluxo de turnos adicionados, com testes automatizados garantindo o fluxo.
- Fase 3 concluída: combate de cartas, proteção de províncias, bônus de tempo, fortalecimento por era e helpers de estado/tabuleiro integrados ao motor.
