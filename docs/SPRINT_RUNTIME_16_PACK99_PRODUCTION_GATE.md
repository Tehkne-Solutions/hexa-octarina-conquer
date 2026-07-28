# Sprint Runtime 16 — gate de promoção em produção do PACK 99

Esta sprint fecha o intervalo entre “runtime validado no pipeline” e “runtime comprovadamente servido pelo jogo público”.

## Resultado da recuperação e promoção

A fonte integral preservada no Google Drive foi baixada, remontada e auditada novamente durante esta etapa.

### Fonte recuperada

- artefato: `HOC_PACK_99_FINAL_RUNTIME_RECOVERED_1.0.2.zip`;
- tamanho: `583070593` bytes;
- SHA-256: `5efd54e05cd2a01aa764ad652423d4ceaca0030fb9aca3d233ede3144a3b86e0`;
- partes: `7/7` aprovadas;
- entradas no ZIP: `4531`;
- corrupção detectada: nenhuma.

### Registro integral

- IDs canônicos: `1037`;
- referências físicas de payload: `1850`;
- referências ausentes: `0`;
- Web e Godot: conjuntos idênticos;
- bootstrap no runtime promovido: `0`;
- aliases temporários no runtime promovido: `0`;
- fallback procedural no runtime promovido: `false`.

### Archives materializados

#### Web

- nome: `hoc-pack99-web-full.zip`;
- tamanho: `583473279` bytes;
- arquivos: `4527`;
- SHA-256: `4b6c3c78ebad78b7f49e8919620fb48476bdf7a40354c9a8041e9dbb4eccd910`.

#### Godot

- nome: `hoc-pack99-godot-full.zip`;
- tamanho: `583473281` bytes;
- arquivos: `4527`;
- SHA-256: `d5d4df6be9c5e711d98969d0dfd59fb2167889ccda5d0023e0d36724c8e7e9b9`.

Os archives foram produzidos de maneira determinística, acompanhados por checksum e relatório JSON assinado.

## Por que o bootstrap ainda não é removido nesta alteração

A promoção local e os archives estão aprovados, mas a remoção definitiva do bootstrap exige uma evidência adicional: o jogo público precisa servir a Release integral e os payloads físicos.

A sprint não considera suficiente:

- apenas existir um ZIP;
- apenas o índice declarar `runtimeMode: full`;
- apenas o DOM declarar `data-pack99-full=true`;
- apenas o build Docker terminar.

A promoção final exige todas essas evidências combinadas.

## Marcador versionado

Arquivo:

`runtime/packs/PACK_99_RECOVERED/production-release.json`

Estados permitidos:

### `awaiting-release`

- Release ainda não confirmada;
- `required: false`;
- Docker pode usar o bootstrap como contingência.

### `release-published`

- Release e relatórios assinados confirmados;
- SHA-256 dos archives registrado;
- `required: false` durante o primeiro redeploy;
- Docker tenta instalar o runtime integral.

### `promoted`

- produção validada;
- manifests públicos aprovados;
- amostra de payloads físicos aprovada;
- DOM confirmado em full;
- `required: true`;
- qualquer build sem a Release integral passa a falhar.

## Validador público

`scripts/validate_pack99_production.py` verifica:

1. `/health` saudável;
2. `/assets/runtime/runtime-install.json`;
3. `/assets/runtime/pack99/runtime-index.json`;
4. `profile: full`;
5. exatamente `1037` IDs canônicos;
6. ao menos `1850` entradas materializadas;
7. `fallback: null`;
8. caminhos limitados a `packages/`;
9. amostra determinística de payloads físicos;
10. rejeição de HTML da SPA no lugar de imagens;
11. tamanho remoto quando o servidor retorna `Content-Range`;
12. relatório JSON assinado.

O validador suporta repetição para acompanhar o redeploy do Render sem aceitar um estado intermediário.

## Gate do navegador

O workflow abre o jogo com Chromium headless e exige no elemento `<html>`:

- `data-pack99-runtime="full"`;
- `data-pack99-full="true"`;
- `data-pack99-asset-count` maior ou igual a `1850`.

Esses atributos são alimentados pelo índice carregado em runtime, e não por constantes do build.

## Automação pós-Release

Workflow:

`.github/workflows/pack99-production-gate.yml`

Fluxo:

1. recebe o sucesso de `PACK 99 Runtime Sync`;
2. localiza a Release `pack99-runtime-v1.0.2`;
3. baixa somente os relatórios assinados;
4. valida Web, Godot e relatório de promoção;
5. registra `release-published` na `main`;
6. o commit aciona o redeploy pela integração Git;
7. aciona também `RENDER_DEPLOY_HOOK_URL` quando configurado;
8. aguarda o runtime integral aparecer no endpoint público;
9. valida manifests e payloads físicos;
10. valida os marcadores do DOM;
11. registra `promoted` e `required: true` na `main`;
12. publica as evidências como artifact por 90 dias.

O workflow também roda em pull requests apenas no modo de testes. Nenhuma Release, alteração da `main` ou chamada de produção ocorre em PR.

## Docker protegido pelo marcador

O Docker agora:

- lê o marcador versionado;
- baixa archive e checksum da Release;
- confirma o SHA-256 promovido quando disponível;
- exige `1037` IDs e ao menos `1850` entradas materializadas;
- rejeita qualquer índice que ainda anuncie fallback;
- mantém contingência somente antes de `promoted`;
- falha obrigatoriamente depois que `required` se torna `true`.

## Limite operacional atual

O ambiente conectado conseguiu ler e baixar todas as partes privadas do Google Drive, remontar o ZIP e gerar os archives finais. Entretanto, os conectores disponíveis nesta sessão não expõem um canal autenticado para enviar arquivos binários locais grandes a uma GitHub Release ou ao Google Drive.

Por isso, esta sprint não declara falsamente a Release como publicada. Assim que o workflow `PACK 99 Runtime Sync` for executado com acesso à origem, a publicação e o gate de produção serão concluídos automaticamente.

## Próxima operação

1. executar `PACK 99 Runtime Sync` com `operation=promote`;
2. publicar `pack99-runtime-v1.0.2`;
3. acompanhar `PACK 99 Production Gate`;
4. exigir o marcador `promoted`;
5. remover o bootstrap e os fallbacks do código-fonte;
6. retomar o PACK 11 — Narrative Portraits.

**Tehkné Solutions**
