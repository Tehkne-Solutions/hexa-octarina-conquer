# PACK 00 — Foundation

O PACK 00 não instala sprites, terrenos ou VFX. Ele define o contrato técnico e visual obrigatório para os PACKS 01–10.

## Estado

- versão candidata: `1.1.0`;
- auditoria local: aprovada;
- runtime assets: `0`;
- referências visuais: `1`;
- release individual: pendente;
- integração de gameplay: não aplicável.

## Referência visual

`REF_STYLE_LOCK_01` define:

- fantasia épica tática 2,5D;
- câmera isométrica fixa;
- luz principal superior esquerda;
- sombras suaves;
- escala humana aproximada de 1,8 m;
- célula de referência de 256 × 256 px;
- âncora inferior central;
- paleta, materiais e leitura de silhueta.

A prancha é somente referência. Ela não pode ser utilizada como sprite, textura ou cenário dentro do jogo.

## Gate

Cada pack posterior precisa comprovar:

1. manifesto e assinatura válidos;
2. IDs e arquivos conforme as convenções;
3. zero referências pendentes;
4. integração equivalente no Web e Godot;
5. Visual QA;
6. release e rollback independentes.

O arquivo `pack-lock.json` registra a fonte rejeitada, o pacote corrigido e os hashes aprovados.

**Tehkné Solutions**
