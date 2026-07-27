# PACK 99 — importação local canônica

## Objetivo

Mapear integralmente o conteúdo recuperado do PACK 99, preservar uma única
fonte canônica no monorepo e gerar os runtimes Web e Godot sem manter duas
cópias versionadas dos mesmos binários.

## Origem esperada

```text
W:\TEHKNE-SOLUTIONS\PROJETOS\JOGO-HOC\ASSETS\PACK99-RECOVERED\
├── HOC_PACK_99_FINAL_RUNTIME_RECOVERED_1.0.1\
├── HOC_PACK_99_FINAL_RUNTIME_RECOVERED_1.0.1.zip.sha256
└── HOC_PACK_99_FINAL_RUNTIME_RECOVERED_1.0.1.zip.report.json
```

Repositório:

```text
W:\TEHKNE-SOLUTIONS\PROJETOS\JOGO-HOC\hexa-octarina-conquer
```

## Arquitetura

A importação cria uma única fonte versionada:

```text
assets/pack99/source/
```

Os contratos e catálogos ficam em:

```text
runtime/packs/PACK_99_RECOVERED/
```

Os runtimes gerados localmente ficam em:

```text
client/web/public/assets/runtime/pack99/
client/godot/assets/runtime/pack99/
```

Esses dois diretórios são derivados e ficam no `.gitignore`. O objetivo é não
versionar os mesmos 500+ MB duas vezes. Por padrão, a materialização usa
hardlinks NTFS quando possível e recua automaticamente para cópia.

## Operação recomendada

### 1. Auditar sem alterar assets

```bat
MAPEAR-PACK99.cmd audit
```

Arquivos gerados em `.cache\pack99-map\`:

- `PACK99_MAPPING_REPORT.md`;
- `asset-catalog.json`;
- `asset-review.csv`;
- `duplicates.json`;
- `unclassified.json`;
- `summary.json`.

A auditoria calcula SHA-256 de cada arquivo, detecta conteúdo duplicado,
classifica categorias, tenta identificar PACK 00–10 pela estrutura e marca
arquivos que precisam de Git LFS.

### 2. Conferir os pontos de revisão

Antes da importação, revisar principalmente:

```text
.cache\pack99-map\unclassified.json
.cache\pack99-map\duplicates.json
.cache\pack99-map\asset-review.csv
```

Arquivos não classificados não são descartados. Eles entram no catálogo e
permanecem visíveis para correção posterior.

### 3. Preparar Git LFS

```bat
cd /d W:\TEHKNE-SOLUTIONS\PROJETOS\JOGO-HOC\hexa-octarina-conquer
git lfs install
git lfs version
```

O importador atualiza `.gitattributes` de forma idempotente para rastrear os
formatos binários do PACK 99.

### 4. Importar a fonte canônica

```bat
MAPEAR-PACK99.cmd import
```

Essa etapa:

- preserva a hierarquia relativa original;
- copia todos os arquivos, inclusive documentos e manifests;
- gera IDs estáveis;
- registra SHA-256, tamanho, tipo, categoria e PACK sugerido;
- gera `runtime-contract.json`;
- não escreve nos diretórios de runtime Web/Godot.

### 5. Materializar os runtimes locais

```bat
MAPEAR-PACK99.cmd materialize
```

Ou, para recriar tudo:

```bat
MAPEAR-PACK99.cmd materialize --clean-generated
```

A materialização usa apenas os arquivos marcados como candidatos de runtime e
gera `runtime-index.json`, pronto para loaders Web e Godot.

### 6. Executar tudo após a primeira auditoria

```bat
MAPEAR-PACK99.cmd all
```

## Validação antes do commit

```bat
git status --short
git lfs ls-files
git diff -- .gitattributes .gitignore
```

Adicionar somente a fonte canônica, contratos e ferramentas:

```bat
git add .gitattributes .gitignore
git add MAPEAR-PACK99.cmd scripts/map_pack99_recovered.py
git add assets/pack99/source
git add runtime/packs/PACK_99_RECOVERED
```

Não adicionar:

```text
.cache/pack99-map/
client/web/public/assets/runtime/pack99/
client/godot/assets/runtime/pack99/
```

## Resultado para a próxima sprint

Depois da importação, o código não precisará procurar arquivos por nome ou
pasta. Web e Godot deverão consumir `runtime-index.json` e resolver cada asset
por ID estável, categoria, estado e destino.

O importador não substitui o bootstrap atual e não ativa automaticamente nenhum
asset no jogo. Ele prepara o PACK 99 para implementação progressiva e rollback
seguro.

**Tehkné Solutions**
