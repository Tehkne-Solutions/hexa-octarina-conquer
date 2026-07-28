# Checklist operacional — publicação final do PACK 99

Antes de executar:

- checkout atualizado da `main`;
- Python 3 disponível;
- GitHub CLI disponível;
- `gh auth status` aprovado;
- ZIP `HOC_PACK_99_FINAL_RUNTIME_RECOVERED_1.0.2.zip` disponível;
- pelo menos 2 GB livres para runtimes e archives temporários.

Executar:

```bat
PUBLICAR-PACK99-RELEASE.cmd -SourceArchive "W:\CAMINHO\HOC_PACK_99_FINAL_RUNTIME_RECOVERED_1.0.2.zip"
```

Confirmar no bloco final:

- `PACK99_RELEASE_PUBLISHED=YES`;
- `TAG=pack99-runtime-v1.0.2`;
- `CANONICAL_IDS=1037`;
- `MATERIALIZED_ENTRIES` igual ou superior a `1850`;
- `PRODUCTION_GATE_DISPATCHED=True`.

Depois acompanhar no GitHub Actions:

1. `PACK 99 Production Gate`;
2. marcador `release-published` registrado;
3. novo deploy do Render;
4. validação HTTP e DOM aprovada;
5. marcador final `promoted` e `required: true`.

Não remover manualmente o bootstrap antes de o gate público concluir.

**Tehkné Solutions**
