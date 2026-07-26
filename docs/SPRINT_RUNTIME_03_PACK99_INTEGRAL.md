# Sprint Runtime 03 — Aplicação integral do PACK 99

## Objetivo

Substituir o bootstrap reduzido da Sprint Runtime 02 pelo conteúdo completo do
`HOC_PACK_99_FINAL_RUNTIME`, preservando os binários fora do histórico Git e
mantendo uma instalação reproduzível para Web e Godot.

## Fonte canônica

- arquivo: `HOC_PACK_99_FINAL_RUNTIME.zip`;
- SHA-256: `d749943cdb8c8e8afa6bbe21f2c6558e3816371fc44e7cb2dbedb63157185575`;
- packs consolidados: PACK 00 até PACK 10;
- IDs canônicos: 1.037;
- entidades lógicas: 46;
- arquivos finais: 4.525;
- tamanho final descompactado: 578.822.723 bytes;
- assinatura: Tehkné Solutions.

O ZIP completo não é versionado no repositório. Ele deve ser hospedado em uma
origem HTTPS privada ou assinada, cuja URL é configurada no secret
`PACK99_URL` do GitHub Actions.

## Entregas desta etapa

### Sincronizador remoto

`scripts/sync_pack99.py`:

1. recebe um ZIP local, uma URL HTTPS ou o secret `PACK99_URL`;
2. baixa em streaming sem imprimir a URL privada;
3. mantém cache por hash oficial;
4. valida o SHA-256 antes de extrair qualquer arquivo;
5. chama o instalador existente `scripts/install_pack99.py`;
6. suporta destinos `web`, `godot` e `all`;
7. suporta perfis `core` e `full`;
8. rejeita instalações `core` com menos de 597 assets;
9. rejeita instalações `full` com menos de 1.037 assets;
10. rejeita referências não resolvidas;
11. gera `.cache/pack99/sync-report.json`.

### Workflow manual

`.github/workflows/pack99-runtime-sync.yml`:

- nunca executa sem ação explícita;
- usa o secret `PACK99_URL`;
- verifica o hash oficial;
- executa os testes do instalador e do sincronizador;
- instala o perfil escolhido;
- produz artefatos separados para Web e Godot;
- mantém o ZIP em cache por checksum;
- não adiciona os binários ao commit ou à branch.

## Configuração no GitHub

Em **Settings → Secrets and variables → Actions**, criar:

```text
PACK99_URL=https://origem-privada/HOC_PACK_99_FINAL_RUNTIME.zip
```

A URL pode ser assinada e temporária, desde que permaneça válida durante a
execução. O hash não precisa ser secreto e está fixado no workflow.

## Execução local

Com ZIP local:

```bash
python scripts/sync_pack99.py \
  --source ~/Downloads/HOC_PACK_99_FINAL_RUNTIME.zip \
  --target all \
  --profile core \
  --clean
```

Com URL em variável de ambiente:

```bash
export PACK99_URL="https://origem-privada/HOC_PACK_99_FINAL_RUNTIME.zip"
python scripts/sync_pack99.py --target all --profile full --clean
```

Validação sem copiar:

```bash
python scripts/sync_pack99.py \
  --source ~/Downloads/HOC_PACK_99_FINAL_RUNTIME.zip \
  --target all \
  --profile full \
  --dry-run
```

## Critérios para concluir a Sprint Runtime 03

- secret `PACK99_URL` configurado ou ZIP fornecido localmente;
- checksum oficial aprovado;
- perfil `core`: pelo menos 597 assets e zero referências pendentes;
- perfil `full`: 1.037 IDs e zero referências pendentes;
- aliases do bootstrap substituídos por payloads próprios;
- quatro direções dos personagens disponíveis;
- terreno, recursos, props, mapas, VFX, UI e TCG resolvidos pelo runtime;
- build Web/PWA aprovado;
- importação e exportação Godot aprovadas;
- Android 8 e Android 14 aprovados;
- Visual QA realizada sobre assets reais, não sobre fallbacks.

## Bloqueio externo atual

Os manifestos e o checksum oficial foram recuperados e validados, mas o ZIP
binário de aproximadamente 551 MB não foi localizado entre os anexos
acessíveis, Google Drive conectado ou repositório. A camada de sincronização
fica pronta nesta sprint; a instalação real começa assim que o ZIP for
publicado em uma URL HTTPS ou fornecido no ambiente local.

**Tehkné Solutions**
