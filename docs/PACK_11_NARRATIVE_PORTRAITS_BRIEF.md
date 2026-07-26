# PACK 11 — Narrative Portraits

## Estado retomado

O pack foi iniciado, mas não concluído. As referências visuais já definidas para Kael, Lyra, Varg e Brakk continuam válidas. Elas ainda não constituem assets de runtime porque faltam transparência, margens padronizadas, exportações individuais e registro canônico.

## Primeira entrega após a promoção do PACK 99

Produzir os quatro retratos mestres individuais:

- `PORTRAIT_KAEL_MASTER_01`
- `PORTRAIT_LYRA_MASTER_01`
- `PORTRAIT_VARG_MASTER_01`
- `PORTRAIT_BRAKK_MASTER_01`

Cada mestre será a fonte das expressões narrativas e não poderá conter texto, moldura, balão ou cenário incorporado.

## Expressões mínimas

Cada personagem terá seis estados:

1. `NEUTRAL`
2. `FOCUSED`
3. `ANGRY`
4. `HURT`
5. `VICTORIOUS`
6. `DEFEATED`

Padrão de ID:

```text
PORTRAIT_<CHARACTER>_<EXPRESSION>_01
```

Exemplo:

```text
PORTRAIT_KAEL_ANGRY_01
```

## Requisitos visuais

- fundo transparente real;
- personagem isolado;
- enquadramento consistente entre todas as expressões;
- cabeça, ombros e parte superior do torso;
- direção visual compatível com balões de fala à esquerda e à direita;
- margens seguras padronizadas;
- silhueta legível em HUD compacto;
- iluminação e materiais coerentes com os sprites 2,5D do runtime;
- sem lettering ou símbolos externos ao personagem;
- sem assinatura dentro da imagem.

## Variantes de exportação

Para cada expressão:

- master de alta resolução;
- runtime Web;
- runtime Godot;
- thumbnail de diálogo;
- ícone compacto de HUD quando aplicável.

## Manifesto inicial

O manifesto deverá registrar:

- ID canônico;
- personagem;
- expressão;
- arquivo master;
- arquivo runtime;
- canvas;
- área segura;
- ponto focal dos olhos;
- orientação;
- versão;
- checksum;
- assinatura `Tehkné Solutions`.

## Ordem da produção

1. recortar e normalizar os quatro retratos mestres;
2. validar transparência e enquadramento;
3. gerar as seis expressões de Kael;
4. gerar as seis expressões de Lyra;
5. gerar as seis expressões de Varg;
6. gerar as seis expressões de Brakk;
7. registrar IDs e checksums;
8. integrar ao sistema narrativo do Web e Godot;
9. validar balões, combate, briefing e pós-partida.

## Gate de início

A produção binária do PACK 11 começa somente após `promotion-report.json` confirmar:

```json
{
  "expectedAssetIds": 1037,
  "bootstrapAssetIds": 0,
  "bootstrapAliases": 0,
  "proceduralFallbackMode": false,
  "passed": true
}
```

**Tehkné Solutions**
