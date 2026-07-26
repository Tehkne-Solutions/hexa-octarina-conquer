# Sprint Runtime 05 — Promoção integral do PACK 99

## Objetivo

Promover o `HOC_PACK_99_FINAL_RUNTIME` recuperado do bootstrap provisório para o runtime integral, executando obrigatoriamente:

1. sincronização `core` em Web e Godot;
2. sincronização `full` em Web e Godot;
3. comparação dos 1.037 IDs canônicos;
4. rejeição de aliases e payloads diretos do bootstrap;
5. emissão de relatório de promoção.

## Fonte recuperada

- Arquivo: `HOC_PACK_99_FINAL_RUNTIME_RECOVERED_1.0.1.zip`
- Tamanho: `569.804.164` bytes
- SHA-256: `e0a00bc450c0c80b4d9433f476b8377353433b0eb90318c9589b331923296c6d`
- Packs: `11`
- IDs canônicos: `1.037`
- Entidades: `46`
- Referências pendentes: `0`

O arquivo deve permanecer fora do histórico Git e ser publicado em armazenamento de objetos ou CDN por uma URL HTTPS estável.

## Configuração

Crie ou atualize o secret do repositório:

```text
PACK99_URL=https://<armazenamento>/HOC_PACK_99_FINAL_RUNTIME_RECOVERED_1.0.1.zip
```

A resposta HTTPS deve permitir download integral sem página intermediária e preservar o conteúdo binário. O workflow valida o SHA-256 antes de extrair qualquer arquivo.

## Operação automática

Execute o workflow **PACK 99 Runtime Sync** com:

```text
operation = promote
target = all
force_download = true
publish_artifacts = true
```

A operação `promote` executa em uma única máquina:

```text
core → full → validate_pack99_promotion.py
```

O cache é identificado pelo SHA-256 recuperado. O ZIP é baixado apenas uma vez.

## Gate de promoção

O script `scripts/validate_pack99_promotion.py` exige:

- perfil `full` nos dois clientes;
- exatamente 1.037 assets no Web;
- exatamente 1.037 assets no Godot;
- IDs únicos e conjuntos idênticos;
- caminhos runtime idênticos entre os clientes;
- zero referências não resolvidas;
- assinatura `Tehkné Solutions`;
- todos os caminhos físicos sob `packages/`;
- ausência dos diretórios diretos `board/`, `sprites/` e `vfx/` usados pelo bootstrap;
- ausência do objeto `deployment` com alias/fallback;
- ausência de versões marcadas como `runtime02` ou `bootstrap`.

## Remoção do bootstrap

A instalação `full --clean` remove fisicamente:

- o registro provisório com 33 IDs;
- os 16 payloads diretos;
- as 17 reutilizações por alias;
- os diretórios diretos do bootstrap.

A remoção dos fallbacks visuais no código-fonte deve ocorrer somente após o relatório de promoção apresentar `passed: true`. Até esse momento, removê-los quebraria o jogo em ambientes onde o ZIP integral ainda não foi instalado.

## Evidências geradas

O workflow publica:

- `sync-core-report.json`;
- `sync-full-report.json`;
- `promotion-report.json`;
- runtime Web completo;
- runtime Godot completo.

## Próxima etapa

Com o runtime integral promovido e validado, iniciar o `PACK 11 — Narrative Portraits`, preservando IDs, canvas, âncoras, nomenclatura e assinatura institucional.

**Tehkné Solutions**
