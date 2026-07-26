# Sprint Runtime 07 — Hotfix do overlay A01 e instalação atômica

## Contexto

A reconstrução local do PACK 99 gerou os 1.037 IDs, mas a primeira instalação `full` publicou 60 referências não resolvidas. O bootstrap anterior também foi removido antes de existir um runtime integral distribuível.

## Causas identificadas

1. O conteúdo de `HOC_FINAL_A01_GRASS_FLAT_PREMIUM.zip` foi copiado diretamente para a raiz do PACK 01.
2. O registro canônico espera esse conteúdo em `A01_GRASS_ANCESTRAL/`.
3. O instalador não traduzia os `packageRoot` originais, como `packages/HOC_PACK_02_BOARD_SYSTEM_FINAL`, para os diretórios físicos consolidados, como `packages/PACK_02_BOARD_SYSTEM`.
4. O instalador retornava sucesso mesmo quando havia referências pendentes.
5. O destino podia ser apagado por `--clean` antes da validação completa.

## Correções

- overlay A01 instalado em `PACK_01_TERRAIN_CORE/A01_GRASS_ANCESTRAL/`;
- suporte a ZIP com pasta-wrapper ou estrutura já canônica;
- cópia de `README.md`, `autotile-rules.json`, `manifest.terrain.json`, tiles, máscaras e validações;
- normalização automática dos nomes `HOC_PACK_*_FINAL` para `PACK_*`;
- rejeição de IDs duplicados e contagem global diferente de 1.037;
- rejeição imediata de qualquer referência não resolvida;
- instalação em staging e ativação somente depois da validação completa;
- preservação do runtime anterior quando o novo pacote falha;
- restauração temporária do bootstrap validado de 33 IDs na árvore versionada.

## Estado seguro

O bootstrap permanece apenas como proteção operacional enquanto a reconstrução local corrigida não produz:

```json
{
  "expectedAssetIds": 1037,
  "bootstrapAssetIds": 0,
  "bootstrapAliases": 0,
  "proceduralFallbackMode": false,
  "passed": true
}
```

A remoção final dos 33 IDs, 16 payloads, 17 aliases e fallbacks de produção continua condicionada ao gate acima.

## Próxima execução local

Após o merge deste hotfix:

1. atualizar o repositório local;
2. executar novamente o reconstrutor com os onze ZIPs e o overlay A01;
3. executar `core` e `full` para Web e Godot;
4. exigir zero referências pendentes;
5. publicar somente os relatórios e alterações textuais;
6. manter os binários completos fora do Git;
7. abrir a promoção final antes de iniciar a produção binária do PACK 11.

**Tehkné Solutions**
