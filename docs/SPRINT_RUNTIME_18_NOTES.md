# Runtime 18 — notas de entrega

O fluxo local antigo apontava para a edição 1.0.1 e não publicava os archives exigidos pelo Docker atual. A Runtime 18 corrige o operador Windows para a edição 1.0.2 e conecta a publicação diretamente ao gate público.

Arquivos centrais:

- `PUBLICAR-PACK99-RELEASE.cmd`;
- `scripts/publish_pack99_release.ps1`;
- `runtime/packs/PACK_99_RECOVERED/publisher-contract.json`;
- `scripts/validate_publish_pack99_release_contract.py`;
- `tests/test_publish_pack99_release_contract.py`.

**Tehkné Solutions**
