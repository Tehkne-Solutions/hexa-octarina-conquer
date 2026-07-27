# Sprint Assets Progressive 00 — Foundation

## Objetivo

Iniciar a implantação progressiva dos assets do HOC, validando e promovendo cada pack de forma independente antes de atualizar o catálogo cumulativo PACK 99.

## Arquivo recebido

`HOC_PACK_00_FOUNDATION_FINAL.zip`

- tamanho: 2.668.465 bytes;
- SHA-256: `5785a510de068031b00187de5e7811032160e757678f7310e91e0ab45a8ec4d3`;
- entradas: 5;
- integridade ZIP: aprovada;
- caminhos inseguros: zero.

## Resultado da auditoria original

O Style Lock apresenta direção visual consistente e útil, porém o arquivo não podia ser promovido como final:

1. `pack-manifest.json` declarava `final-foundation`;
2. `registry/pack-registry.json` declarava o PACK 00 como `partial`;
3. o próprio registro indicava tarefas pendentes de Art Bible, registro global e escalas;
4. não existiam checksums;
5. não existia licença;
6. não existia changelog;
7. não existiam contratos estruturados de nomenclatura e integração Web × Godot;
8. não existia registro canônico do Style Lock como referência não-runtime.

## Correção produzida

Foi montado o candidato:

`HOC_PACK_00_FOUNDATION_VALIDATED_1.1.0.zip`

- tamanho: 2.673.607 bytes;
- SHA-256: `363286d3a009e3e6a696e917478027a4d5a23564ffbaae9cbe686f4cdd3014bb`;
- entradas: 14;
- checksums internos: 13 aprovados;
- runtime assets: zero;
- reference assets: um;
- referências pendentes: zero;
- caminhos inseguros: zero.

Foram adicionados:

- Art Bible estruturada;
- paleta oficial extraída da prancha;
- escala, câmera, iluminação, materiais e âncoras;
- convenções de IDs e arquivos;
- contrato Web × Godot;
- registro de assets;
- validação de origem;
- relatório final;
- checksums;
- licença;
- changelog.

## Style Lock

- ID: `REF_STYLE_LOCK_01`;
- dimensões: 1536 × 1024;
- SHA-256: `9cb801941cb02c656533fbb8b877b5ada49e3b81a2aec18b3654b953457b1dc6`;
- função: referência visual;
- runtime: não.

## Integração no repositório

Esta sprint adiciona:

- auditor genérico inicial para packs progressivos;
- testes do contrato PACK 00;
- lock versionado do pack;
- documentação do gate;
- workflow de validação textual.

O ZIP e o PNG não são adicionados ao histórico Git. A publicação binária será feita como release individual após o PR ficar verde.

## Efeito no jogo

O PACK 00 não altera a renderização. Sua implementação ocorre por governança técnica: os próximos packs precisam satisfazer o contrato aprovado antes de entrar no Web, Godot ou PACK 99.

## Próxima etapa

1. publicar `HOC_PACK_00_FOUNDATION_VALIDATED_1.1.0.zip` como release individual;
2. atualizar o lock para `promoted`;
3. iniciar a auditoria do `HOC_PACK_01_TERRAIN_CORE_FINAL.zip`;
4. validar o overlay A01 separadamente;
5. substituir progressivamente os terrenos provisórios somente após QA Web × Godot.

**Tehkné Solutions**
