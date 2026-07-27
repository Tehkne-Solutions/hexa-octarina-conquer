# Relatório de Auditoria — PACK 01 Terrain Core

## Parecer

O PACK 01 original possui conteúdo completo e consistente, mas não estava pronto para promoção direta por causa de documentação incompleta e de um contrato incorreto de montagem dos tiles. O candidato 1.1.0 corrige esses pontos e está aprovado para publicação individual e QA progressivo.

## Arquivo original

| Campo | Resultado |
|---|---|
| Arquivo | `HOC_PACK_01_TERRAIN_CORE_FINAL.zip` |
| Bytes | 75.839.049 |
| SHA-256 | `95f537534fbd9d9169d54789dcbda9659b568cf606046dd360d68a78f5153c61` |
| Entradas | 247 |
| IDs | 103 únicos |
| Referências ausentes | 0 |
| Caminhos inseguros | 0 |
| Assinatura | Tehkné Solutions |

## Overlay A01

| Campo | Resultado |
|---|---|
| Arquivo | `HOC_FINAL_A01_GRASS_FLAT_PREMIUM.zip` |
| Bytes | 12.010.917 |
| SHA-256 | `39a950605cfd2102e7956792ca49573beb14e8e5bf6cb657ece1856c28f8ebc2` |
| Arquivos comparados | 39 |
| Arquivos idênticos | 23 |
| Arquivos alterados | 16 |
| Tiles alterados | 10 |
| Máscaras alteradas | 0 |
| IDs alterados | não |
| Geometria alterada | não |
| Decisão | aplicar |

## Defeito corrigido

Os arquivos de tile tinham 8 px de bleed transparente. Os manifests indicavam overlap zero, produzindo linhas escuras nos testes de conexão. O candidato declara e testa:

```text
master canvas: 1024 × 512
runtime display: 512 × 256
runtime grid step: 252 × 124
edge bleed: 8 px
```

## Candidato 1.1.0

| Campo | Resultado |
|---|---|
| Arquivo | `HOC_PACK_01_TERRAIN_CORE_VALIDATED_1.1.0.zip` |
| Bytes | 73.072.823 |
| SHA-256 | `5cd1fc0844e2d17eefd1e010a62090526d60e74a2090047027a3e511949d0dad` |
| Entradas | 257 |
| Checksums aprovados | 256/256 |
| IDs | 103/103 únicos |
| Tiles | 103 RGBA, 1024 × 512 |
| Máscaras | 96 RGBA, 1024 × 1024 |
| Famílias | 6 |
| Módulos de suporte | 7 |
| Referências ausentes | 0 |
| Caminhos inseguros | 0 |
| Status | `runtime_ready` |

## Distribuição dos IDs

- 16 Grass Ancestral;
- 16 Runic Stone;
- 16 Forest;
- 16 Corrupted;
- 16 Shallow Water;
- 16 Lava;
- 7 caminhos de suporte.

## Resultado

```text
Integridade do ZIP:                 APROVADA
Manifests:                          APROVADOS APÓS CORREÇÃO
Registros e provenance:             APROVADOS
Checksums:                          APROVADOS
IDs únicos:                         APROVADOS
Overlay A01:                        APROVADO
Web staging:                        IMPLEMENTADO
Godot staging:                      IMPLEMENTADO
Release individual:                 PENDENTE
QA com binários da release:         PENDENTE
Promoção remota:                    PENDENTE
```

**Tehkné Solutions**
