# Sprint Assets Progressive 01 — Terrain Core

## Objetivo

Auditar, corrigir e integrar progressivamente o PACK 01 sem substituir o bootstrap atual antes da publicação e validação externa do ZIP individual.

## Fontes auditadas

### PACK 01 original

- arquivo: `HOC_PACK_01_TERRAIN_CORE_FINAL.zip`;
- tamanho: 75.839.049 bytes;
- SHA-256: `95f537534fbd9d9169d54789dcbda9659b568cf606046dd360d68a78f5153c61`;
- sete subpacks;
- 103 IDs únicos;
- zero referências ausentes;
- seis famílias de terreno com 16 assets cada;
- sete módulos de caminhos.

### Overlay A01

- arquivo: `HOC_FINAL_A01_GRASS_FLAT_PREMIUM.zip`;
- tamanho: 12.010.917 bytes;
- SHA-256: `39a950605cfd2102e7956792ca49573beb14e8e5bf6cb657ece1856c28f8ebc2`;
- 10 tiles alterados;
- zero máscaras alteradas;
- IDs e geometria preservados;
- regras TypeScript atualizadas.

## Problema encontrado

Os tiles de todas as famílias possuíam 8 px de bleed transparente, mas os manifests declaravam overlap zero. Quando os testes eram montados sem sobreposição, linhas escuras apareciam entre as células.

O contrato corrigido passou a exigir:

- master: 1024 × 512 px;
- exibição runtime: 512 × 256 px;
- grid runtime: 252 × 124 px;
- bleed/overlap: 8 px no master;
- transparência RGBA;
- ordem de bits N, E, S, W.

## Candidato validado

- arquivo: `HOC_PACK_01_TERRAIN_CORE_VALIDATED_1.1.0.zip`;
- tamanho: 73.072.823 bytes;
- SHA-256: `5cd1fc0844e2d17eefd1e010a62090526d60e74a2090047027a3e511949d0dad`;
- 257 entradas;
- 256 checksums aprovados;
- 103 IDs únicos;
- 103 tiles validados;
- 96 máscaras validadas;
- zero referências pendentes;
- zero caminhos inseguros;
- overlay A01 aplicado.

## Famílias

| Subpack | Terrain ID | Assets |
|---|---|---:|
| A01 Grass Ancestral | `TERRAIN_GRASS_ANCESTRAL` | 16 |
| A02 Runic Stone | `TERRAIN_RUNIC_STONE` | 16 |
| A03 Forest | `TERRAIN_FOREST` | 16 |
| A04 Corrupted | `TERRAIN_CORRUPTED` | 16 |
| A05 Shallow Water | `TERRAIN_SHALLOW_WATER` | 16 |
| A06 Lava | `TERRAIN_LAVA` | 16 |
| A07 Support Modules | caminhos | 7 |

## Implementação progressiva

O pack é instalado em namespaces isolados:

```text
client/web/public/assets/progressive/PACK_01_TERRAIN_CORE
client/godot/assets/progressive/PACK_01_TERRAIN_CORE
```

O instalador:

- audita o ZIP antes da extração;
- rejeita caminhos inseguros;
- exige 103 IDs e zero pendências;
- prepara Web e Godot em staging;
- ativa os destinos atomicamente;
- não toca em `assets/runtime`;
- preserva o bootstrap em qualquer falha.

## Web

- loader do registro `terrain-runtime.json`;
- validação de identidade, assinatura, versão, contagem e grid;
- camada isométrica de 7 × 7 células;
- bioma selecionado por tema e tipo de célula;
- fallback silencioso para o cenário atual quando o pack não está instalado;
- sem precache obrigatório dos binários nesta etapa.

## Godot

- novo autoload `ProgressiveTerrainRuntime`;
- resolução dos 103 IDs;
- cache de texturas;
- terreno progressivo preferido nas células;
- fallback para o terreno do bootstrap enquanto a release não está promovida;
- pilares, arestas, unidades e VFX permanecem inalterados.

## Gate de promoção

O PACK 01 somente muda para `promoted` após:

1. release individual HTTPS;
2. SHA-256 aprovado;
3. auditoria externa verde;
4. instalação Web com 103 IDs e zero pendências;
5. instalação Godot com 103 IDs e zero pendências;
6. comparação Web × Godot idêntica;
7. build PWA, Docker e APKs usando a release;
8. Visual QA dos seis biomas;
9. confirmação de que o bootstrap continua funcional durante rollback.

## Próximo pack

Após a promoção do PACK 01, iniciar `PACK 02 — Board System` para pilares, arestas, células e estados de interação.

**Tehkné Solutions**
