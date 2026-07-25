# PACK 99 Runtime — Web

Este diretório recebe o runtime estático usado pelo cliente web:

```bash
python scripts/install_pack99.py /caminho/HOC_PACK_99_FINAL_RUNTIME.zip \
  --target web \
  --profile core \
  --clean
```

O módulo `src/runtime-assets.ts` carrega
`/assets/runtime/registry/assets-runtime.json` e resolve os arquivos pelos IDs
canônicos. O conteúdo gerado é ignorado pelo Git para evitar commits e deploys
com centenas de megabytes.

Antes de publicar, selecione conscientemente o perfil e confirme o limite do
provedor de hospedagem. Para o PWA, `core` é o perfil recomendado.

Tehkné Solutions
