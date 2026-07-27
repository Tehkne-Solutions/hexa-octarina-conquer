# Grupo Final A01 — Planície Ancestral

Tileset final flat premium 2,5D para o Hexa Octarina Conquer.

## Conteúdo

- 16 PNGs RGBA individuais em `tiles/`
- 16 máscaras técnicas em `masks/`
- textura-fonte normalizada e seamless
- manifesto de assets
- regras de autotile
- constantes TypeScript
- preview sem textos
- teste de conexão 3×3

## Arquitetura

Os três `CENTER` são tiles-base completos.

Os demais arquivos são overlays de transição e devem ser renderizados sobre o
tile-base do terreno vizinho. Isso evita penhascos, espessura e sobreposição.

## Runtime recomendado

- Asset master: 1024×512 px
- Exibição padrão: 512×256 px
- Footprint: 1×1
- Âncora: centro da célula
- Sobreposição: 0 px
- Sombra por tile: não
- Penhasco por tile: não

## Assinatura

Tehkné Solutions
