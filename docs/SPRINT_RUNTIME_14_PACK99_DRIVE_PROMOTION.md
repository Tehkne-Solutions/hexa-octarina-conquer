# Sprint Runtime 14 — promoção integral do PACK 99 pelo Drive

A fonte recuperada do PACK 99 está preservada em sete partes privadas no Google Drive. Esta sprint conecta essa fonte ao workflow `PACK 99 Runtime Sync` sem colocar os 583 MB no histórico Git.

## Fonte canônica

- versão: `1.0.2`;
- artefato final: `HOC_PACK_99_FINAL_RUNTIME_RECOVERED_1.0.2.zip`;
- tamanho: `583070593` bytes;
- SHA-256: `5efd54e05cd2a01aa764ad652423d4ceaca0030fb9aca3d233ede3144a3b86e0`;
- partes: 7;
- contrato versionado: `runtime/packs/PACK_99_RECOVERED/drive-source.json`;
- pasta Drive: `HOC PACK 99 — Runtime Integral 1.0.2`.

## Configuração única

1. Criar ou selecionar uma conta de serviço Google com acesso somente de leitura ao Drive.
2. Compartilhar a pasta do PACK 99 com o `client_email` dessa conta como leitor.
3. Criar no repositório o secret `PACK99_DRIVE_SERVICE_ACCOUNT_JSON` com o JSON completo da conta de serviço.
4. Não registrar a credencial em arquivos, logs, comentários ou artefatos.

A autenticação é executada pela action oficial `google-github-actions/auth`. O downloader recebe somente um access token temporário e não manipula a chave privada.

## Execução

No GitHub Actions, executar `PACK 99 Runtime Sync` com:

- `operation`: `promote`;
- `target`: `all`;
- `source_provider`: `drive-parts`;
- `force_download`: `false` na primeira tentativa; usar `true` somente para invalidar cache;
- `publish_artifacts`: `true`.

## Sequência protegida

1. validar os testes do instalador, sincronizador, remontador, downloader e gate de promoção;
2. autenticar no Drive com token temporário;
3. baixar as sete partes;
4. validar tamanho e SHA-256 de cada parte;
5. remontar o ZIP de forma atômica;
6. validar tamanho, SHA-256 e entradas canônicas do ZIP final;
7. instalar o perfil `core` em Web e Godot;
8. instalar o perfil `full` em Web e Godot;
9. executar o gate de promoção;
10. publicar relatórios e runtimes como artefatos temporários.

## Critérios obrigatórios

- download: 7/7 partes aprovadas;
- ZIP final: SHA-256 exato da versão `1.0.2`;
- `core`: pelo menos 597 assets e zero referências pendentes;
- `full`: pelo menos 1.037 IDs e zero referências pendentes;
- Web e Godot: conjuntos de IDs idênticos;
- `promotion-report.json`: `passed: true`;
- nenhum segredo presente nos artefatos.

## Depois da promoção

Somente após esses critérios:

1. substituir o bootstrap de 33 IDs;
2. remover os 17 aliases temporários;
3. remover fallbacks visuais onde houver payload canônico;
4. validar o deploy Web/PWA e os APKs;
5. retomar o PACK 11 — Narrative Portraits.

**Tehkné Solutions**
