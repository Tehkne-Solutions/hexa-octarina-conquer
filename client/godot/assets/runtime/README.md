# PACK 99 Runtime — Godot

Este diretório recebe os assets gerados localmente pelo instalador:

```bash
python scripts/install_pack99.py /caminho/HOC_PACK_99_FINAL_RUNTIME.zip \
  --target godot \
  --profile core \
  --clean
```

O conteúdo binário gerado é ignorado pelo Git. Apenas este README permanece
versionado. O autoload `AssetRuntime` detecta o registro instalado e habilita
sprites 2,5D, unidades e VFX. Sem o pack, o cliente mantém o fallback 3D
procedural existente.

Use `--profile full` para instalar frames e spritesheets completos.

Tehkné Solutions
