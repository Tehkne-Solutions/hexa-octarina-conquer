# PACK 11 — Narrative Portraits

## Objetivo

Preparar a próxima camada visual do Hexa Octarina Conquer sem bloquear a publicação do PACK 99. O PACK 11 cobre retratos narrativos reutilizáveis em diálogos, eventos, missões, telas de campeão e resultados de batalha.

## Dependência de entrada

A integração final no runtime permanece condicionada à promoção do PACK 99 v1.0.2 em produção, acompanhada pela Issue #63. O trabalho deste pack pode avançar em especificação, produção e validação isolada antes dessa promoção.

## Escopo inicial

### Heróis e campeões

- 8 retratos principais de heróis;
- 8 variações emocionais neutras;
- 8 variações de tensão ou combate;
- 8 variações de vitória;
- 8 variações de derrota ou exaustão.

### Personagens narrativos

- 6 líderes de facção;
- 6 conselheiros ou especialistas;
- 6 antagonistas ou rivais;
- 6 comerciantes, artesãos ou operadores de cidade.

### Estados obrigatórios

Cada personagem aprovado deve ter, quando aplicável:

- `neutral`;
- `speaking`;
- `alert`;
- `combat`;
- `victory`;
- `defeat`.

## Padrão visual

- fantasia medieval 2,5D consistente com o jogo;
- leitura forte em 256 × 256 px;
- versão mestre em 1024 × 1024 px;
- fundo transparente;
- iluminação direcional consistente;
- enquadramento de busto ou meio-corpo;
- margem segura para balões, molduras e recortes responsivos;
- sem textos, logos ou molduras incorporadas na imagem.

## Estrutura de arquivos

```text
PACK_11_NARRATIVE_PORTRAITS/
├── manifest.json
├── atlas/
├── heroes/
├── champions/
├── factions/
├── npcs/
├── previews/
└── validation/
```

## Convenção de nomes

```text
hoc_p11_portrait_<grupo>_<personagem>_<estado>_<variante>.png
```

Exemplos:

```text
hoc_p11_portrait_hero_elyra_neutral_a.png
hoc_p11_portrait_champion_vorak_combat_a.png
hoc_p11_portrait_npc_blacksmith_speaking_a.png
```

## Contrato mínimo do manifest

Cada entrada precisa declarar:

- `id`;
- `packId`;
- `characterId`;
- `group`;
- `state`;
- `variant`;
- `sourcePath`;
- `runtimePath`;
- `width`;
- `height`;
- `sha256`;
- `transparentBackground`;
- `approved`.

## Etapas de produção

1. consolidar roster canônico;
2. produzir folhas de direção visual por grupo;
3. gerar retratos mestres individuais;
4. revisar identidade, anatomia, recorte e transparência;
5. gerar estados emocionais mantendo identidade facial;
6. exportar tamanhos de runtime;
7. montar atlas opcional para Web e Godot;
8. gerar manifest e hashes;
9. validar carregamento isolado;
10. integrar ao runtime após a promoção do PACK 99.

## Critérios de aceite

- nenhum arquivo com borda, texto ou fundo opaco acidental;
- identidade do personagem consistente entre estados;
- dimensões e nomes válidos;
- transparência real nos quatro cantos;
- manifest sem IDs duplicados;
- hash SHA-256 presente para todos os arquivos finais;
- preview de todos os estados;
- carregamento validado em Web e Godot;
- ausência de fallback para retratos aprovados.

## Primeiro lote recomendado

O lote inicial deve conter 4 personagens completos, cada um com 6 estados, totalizando 24 retratos finais. Esse lote serve como gate de qualidade antes da produção integral.

## Sequência após aprovação do lote inicial

1. concluir heróis;
2. concluir campeões;
3. concluir líderes de facção;
4. concluir NPCs funcionais;
5. gerar atlas e manifest final;
6. integrar ao jogo;
7. validar diálogos, eventos, missões e resultados de batalha.

**Tehkné Solutions**
