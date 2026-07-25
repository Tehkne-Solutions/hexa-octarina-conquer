# Integração do PACK 99

## Objetivo

O PACK 99 contém a biblioteca final de terreno, tabuleiro, recursos, props,
mapas, heróis, unidades, campeões, VFX, interface e TCG. O arquivo completo
possui centenas de megabytes e não deve ser enviado diretamente ao histórico
do Git.

A integração usa três componentes:

1. `scripts/install_pack99.py` valida e instala o pack;
2. `AssetRuntime` resolve IDs canônicos no Godot;
3. `runtime-assets.ts` disponibiliza o mesmo registro ao cliente web.

## Instalação recomendada

Na raiz do repositório:

```bash
python scripts/install_pack99.py ~/Downloads/HOC_PACK_99_FINAL_RUNTIME.zip \
  --target all \
  --profile core \
  --clean
```

O perfil `core` instala os 597 assets estáticos resolvidos pelo registro global,
incluindo terrenos, estruturas, unidades, retratos, VFX, UI e cartas. Ele não
copia os diretórios completos de frames de animação.

Para desenvolvimento completo de animações:

```bash
python scripts/install_pack99.py ~/Downloads/HOC_PACK_99_FINAL_RUNTIME.zip \
  --target godot \
  --profile full \
  --clean
```

## Validação sem copiar

```bash
python scripts/install_pack99.py ~/Downloads/HOC_PACK_99_FINAL_RUNTIME.zip \
  --target all \
  --profile core \
  --dry-run
```

O instalador recusa packs com:

- `packId` diferente de `HOC_PACK_99_FINAL_RUNTIME`;
- assinatura diferente de `Tehkné Solutions`;
- relatório final com `passed: false`;
- registro global ausente ou inválido.

## Godot

O autoload `AssetRuntime` lê:

```text
res://assets/runtime/registry/assets-runtime.json
```

O `UnitFactory` tenta criar primeiro a versão 2,5D do PACK 99. Caso o runtime
não esteja instalado ou um ID não seja localizado, o código retorna
automaticamente aos meshes 3D procedurais existentes.

O `CombatFX` sobrepõe efeitos PNG do PACK 10 aos efeitos procedurais. Som e
partículas 3D continuam funcionando como camada complementar.

## Web

O módulo `client/web/src/runtime-assets.ts` fornece:

```ts
loadRuntimeAssetRegistry();
getRuntimeAsset(assetId);
runtimeAssetUrl(assetId, field);
preloadRuntimeAssets(assetIds);
```

Exemplo:

```ts
const url = await runtimeAssetUrl("UNIT_RECRUIT_01_IDLE_BASE_NE_01");
```

A próxima etapa visual é substituir progressivamente os desenhos SVG internos
do `Board` por imagens resolvidas pelo runtime, mantendo os SVGs como fallback.

## Versionamento

Os diretórios gerados são ignorados:

```text
client/godot/assets/runtime/*
client/web/public/assets/runtime/*
```

Os READMEs permanecem versionados. Para distribuição, os assets devem entrar
no artefato de build ou em armazenamento/CDN, não no histórico principal do
Git.

Tehkné Solutions
