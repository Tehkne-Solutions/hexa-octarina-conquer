# Sprint Assets Progressive 02 — Board System

## Objetivo

Auditar, corrigir e integrar o PACK 02 sem substituir o bootstrap antes da
promoção externa.

## Fonte auditada

- arquivo: `HOC_PACK_02_BOARD_SYSTEM_FINAL.zip`;
- tamanho: 43.676.247 bytes;
- SHA-256: `1d6a5c78c3b174b069d5f1738ec0f879806bb4328d8a329ef3049852bc9629ee`;
- entradas: 151;
- 55 IDs únicos;
- zero referências ausentes;
- zero caminhos inseguros.

## Problemas estruturais encontrados

- ausência de checksums integrais;
- ausência de licença e changelog;
- ausência de relatório formal de validação;
- ausência de contratos Web × Godot;
- registro global sem `packageRoot`;
- caminhos relativos ambíguos na raiz;
- ausência de provenance por asset;
- ausência de teste de conexão por âncoras.

## Candidato validado

- arquivo: `HOC_PACK_02_BOARD_SYSTEM_VALIDATED_1.1.0.zip`;
- tamanho: 44.534.205 bytes;
- SHA-256: `b4e68398cc7276fc1d2a2fc9348625f7596c6b93e71fe1e1de4277bb4a3063c5`;
- entradas: 162;
- checksums: 161/161;
- 55 assets runtime;
- 55 imagens base;
- 55 sombras;
- 28 emissivos;
- zero pendências.

## Conteúdo

### P01 — Pilares

- neutral;
- blue;
- red;
- energized;
- blocked;
- selected.

### P02 — Arestas

- madeira, pedra e arcana;
- preview, built, damaged e destroyed;
- orientações NE–SW e NW–SE.

### P03 — Evolução Territorial

- selo;
- acampamento;
- posto avançado;
- forte;
- cidadela;
- estados neutral, blue, red, construction e damaged.

## Política de implantação

Os binários permanecem fora do Git e são instalados em:

```text
client/web/public/assets/progressive/PACK_02_BOARD_SYSTEM
client/godot/assets/progressive/PACK_02_BOARD_SYSTEM
```

O pack só substitui a apresentação bootstrap depois da release individual,
comparação Web × Godot e Visual QA.

**Tehkné Solutions**
