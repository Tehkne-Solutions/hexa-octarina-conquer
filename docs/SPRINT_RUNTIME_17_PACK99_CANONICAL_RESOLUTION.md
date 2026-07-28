# Sprint Runtime 17 — resolução canônica sem aliases visuais

Esta sprint remove a principal fonte de falsos positivos visuais do PACK 99: um ID ausente ser substituído silenciosamente por outro asset com palavras semelhantes no nome ou caminho.

## Regra do runtime

### Bootstrap e core

Enquanto a Release integral ainda não foi promovida:

- a busca por sufixos continua disponível;
- a busca aproximada continua disponível como compatibilidade;
- componentes legados continuam visíveis;
- sprites procedurais podem ser usados como contingência;
- o DOM anuncia `data-pack99-fallbacks="true"`.

### Full

O runtime só é classificado como `full` quando:

- declara perfil e modo `full`;
- possui exatamente 1.037 IDs canônicos;
- materializa ao menos 1.850 entradas físicas;
- cada entrada possui `canonicalId`;
- cada entrada possui `sourcePath` dentro de `packages/`;
- `fallback` é `null`.

Depois disso:

- missões resolvem somente por ID canônico;
- camadas base, sombra e emissivo pertencem ao mesmo ID;
- busca aproximada deixa de ser usada pela Ponte das Cinzas;
- assets ausentes não recebem substitutos;
- componentes legados do mapa são removidos;
- o DOM anuncia `data-pack99-fallbacks="false"`.

## Personagens

| Personagem | ID canônico |
| --- | --- |
| Kael | `HERO_GUARDIAN_01_IDLE_BASE_SW_01` |
| Lyra | `HERO_RANGER_01_IDLE_BASE_NE_01` |
| Varg | `UNIT_RECRUIT_01_IDLE_BASE_NW_01` |
| Brakk | `CHAMP_BERSERKER_01_IDLE_BASE_NW_01` |

Isso impede as substituições anteriores:

- Lyra usando Guardião;
- Varg usando Guardião;
- Brakk usando Guardião;
- camadas de sombra ou emissivo pertencendo a outro personagem.

## Terreno e landmarks

| Elemento | ID canônico |
| --- | --- |
| Grama | `TILE_GRASS_FLAT_CENTER_A_01` |
| Floresta | `TILE_FOREST_FLAT_CENTER_A_01` |
| Água | `TILE_WATER_FLAT_CENTER_A_01` |
| Ponte | `PROP_STONE_BRIDGE_BUILT_NW_SE_01` |
| Ruínas | `PROP_RUIN_LARGE_01` |
| Moinho/Posto | `TERR_OUTPOST_NEUTRAL_01` |
| Vila/Acampamento | `TERR_CAMP_NEUTRAL_01` |
| Montanha/Rocha | `PROP_ROCK_C_01` |

Floresta e água não podem mais reutilizar a imagem de grama no runtime integral.

## Recursos

| Recurso | ID canônico |
| --- | --- |
| Madeira | `RES_WOOD_ABUNDANT_01` |
| Alimento | `RES_FOOD_ABUNDANT_01` |
| Octarina | `RES_OCTARINE_CRYSTAL_ABUNDANT_01` |
| Mana azul | `RES_MANA_BLUE_ABUNDANT_01` |

A densidade ambiental também recebe IDs próprios para árvores, rochas, ruínas, água, acampamento e cristais menores.

## Estruturas

| Estrutura | ID canônico |
| --- | --- |
| Torre azul | `PROP_TOWER_BLUE_01` |
| Torre vermelha | `PROP_TOWER_RED_01` |
| Forte de Orun | `TERR_FORT_BLUE_01` |
| Portal ativo | `PROP_PORTAL_ACTIVE_01` |
| Cristal octarino | `RES_OCTARINE_CRYSTAL_ABUNDANT_01` |
| Cristal de mana | `RES_MANA_BLUE_ABUNDANT_01` |

## VFX

| Evento | ID canônico |
| --- | --- |
| Movimento | `VFX_MAP_PATH_01` |
| Ataque | `VFX_COMBAT_SLASH_01` |
| Impacto | `VFX_COMBAT_HEAVY_STRIKE_01` |
| Coleta | `VFX_RESOURCE_COLLECT_01` |
| Captura | `VFX_TERRITORY_CONQUEST_01` |
| Construção | `VFX_CONSTRUCTION_01` |
| Vitória | `VFX_COMBAT_VICTORY_01` |
| Derrota | `VFX_COMBAT_DEATH_01` |

## Cartas

As cartas de Kael usam `CARD_ART_HERO_GUARDIAN_01` e as cartas de Lyra usam `CARD_ART_HERO_RANGER_01`.

O registro integral atual não contém artes próprias para:

- `Machado das Cinzas`;
- `Couro Remendado`;
- `Salto Saqueador`.

Essas cartas não reutilizam Berserker, Guerreiro ou outro herói. Em runtime full, recebem um marcador técnico de ausência até a criação do pack especializado de TCG.

## Lacuna confirmada de estrutura

O registro integral também não contém um asset canônico de Fazenda Arcana. O runtime full não usa acampamento, posto avançado ou recurso de alimento como falso substituto da construção.

Essas quatro lacunas passam para a esteira de criação:

1. Fazenda Arcana construída;
2. arte de Machado das Cinzas;
3. arte de Couro Remendado;
4. arte de Salto Saqueador.

## Telemetria do DOM

O cliente publica:

- `data-pack99-runtime`;
- `data-pack99-asset-count`;
- `data-pack99-canonical-count`;
- `data-pack99-fallbacks`;
- `data-pack99-full`.

O gate de produção exige:

- runtime `full`;
- full `true`;
- fallbacks `false`;
- 1.037 IDs canônicos;
- ao menos 1.850 entradas materializadas.

## Critérios de regressão

- índice bootstrap continua funcional;
- declaração full falsa continua rejeitada;
- índice full com fallback continua rejeitado;
- IDs de Kael, Lyra, Varg e Brakk permanecem distintos;
- grama, floresta e água permanecem distintas;
- camada shadow resolve pelo mesmo canonicalId da base;
- ID inexistente retorna `null`, nunca outro asset;
- mapa legado só desaparece depois de full;
- ausência canônica em full nunca chama sprite procedural.

## Próxima etapa

Após integração desta sprint:

1. executar a promoção e o gate de produção;
2. remover fisicamente o índice bootstrap do artefato final;
3. criar os quatro assets ausentes confirmados;
4. iniciar o PACK 11 — Narrative Portraits;
5. estruturar o pack especializado de cartas premium HOC.

**Tehkné Solutions**
