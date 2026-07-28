# Sprint Runtime 18 — publicação integral em um comando

A infraestrutura das Runtimes 12–17 já valida, resolve e consome o PACK 99 integral, mas o comando local de publicação ainda apontava para a edição recuperada 1.0.1 e publicava somente o ZIP-fonte. Isso não correspondia ao contrato atual do Docker e do gate de produção.

## Correção

`PUBLICAR-PACK99-RELEASE.cmd` agora executa o pipeline oficial da edição 1.0.2:

1. localiza `HOC_PACK_99_FINAL_RUNTIME_RECOVERED_1.0.2.zip`;
2. exige exatamente `583070593` bytes;
3. exige SHA-256 `5efd54e05cd2a01aa764ad652423d4ceaca0030fb9aca3d233ede3144a3b86e0`;
4. instala o perfil `core` em Web e Godot;
5. instala o perfil `full` em Web e Godot;
6. gera os índices premium;
7. valida 1.037 IDs canônicos, zero bootstrap, zero aliases e zero fallback procedural;
8. empacota archives determinísticos separados para Web e Godot;
9. valida ao menos 1.850 entradas materializadas em cada cliente;
10. cria ou atualiza a Release `pack99-runtime-v1.0.2`;
11. publica archives, checksums e relatórios;
12. dispara `PACK 99 Production Gate`;
13. o gate registra a Release na `main`, aciona o Render, valida os payloads públicos e promove o marcador somente após o DOM anunciar runtime full.

## Archives publicados

- `hoc-pack99-web-full.zip`;
- `hoc-pack99-web-full.zip.sha256`;
- `hoc-pack99-web-full.zip.report.json`;
- `hoc-pack99-godot-full.zip`;
- `hoc-pack99-godot-full.zip.sha256`;
- `hoc-pack99-godot-full.zip.report.json`;
- `promotion-report.json`;
- `source-reassembly-report.json`.

## Uso

Na raiz do checkout Windows:

```bat
PUBLICAR-PACK99-RELEASE.cmd
```

Quando o ZIP estiver em outro local:

```bat
PUBLICAR-PACK99-RELEASE.cmd -SourceArchive "W:\CAMINHO\HOC_PACK_99_FINAL_RUNTIME_RECOVERED_1.0.2.zip"
```

Pré-requisitos:

- Python 3;
- GitHub CLI;
- `gh auth status` aprovado;
- remote `origin` apontando para `Tehkne-Solutions/hexa-octarina-conquer`;
- acesso de escrita à Release e ao workflow do repositório.

## Falha segura

Qualquer divergência de hash, tamanho, contagem, caminho, paridade Web/Godot ou relatório interrompe a publicação. O comando não altera o marcador de produção diretamente. Apenas o workflow `PACK 99 Production Gate` pode promover o estado depois de validar o deploy público.

## Critério de conclusão

A integração só está concluída quando `runtime/packs/PACK_99_RECOVERED/production-release.json` declarar:

- `status: promoted`;
- `required: true`;
- `promotionReportPassed: true`;
- hashes dos archives Web e Godot preenchidos;
- datas de promoção e validação pública preenchidas.

E o DOM do jogo público declarar:

- `data-pack99-runtime="full"`;
- `data-pack99-full="true"`;
- `data-pack99-fallbacks="false"`;
- `data-pack99-canonical-count="1037"`;
- `data-pack99-asset-count` igual ou superior a `1850`.

## Próxima etapa

Depois da promoção pública:

1. remover fisicamente o índice bootstrap do artefato final;
2. criar Fazenda Arcana construída;
3. criar Machado das Cinzas, Couro Remendado e Salto Saqueador;
4. iniciar o PACK 11 — Narrative Portraits;
5. estruturar o PACK 15/16 de identidade simbólica e cartas premium HOC.

**Tehkné Solutions**
