# Sprint Runtime 08 — Executor local do PACK 99

## Objetivo

Executar a reconstrução e a promoção integral do PACK 99 no computador que contém os ZIPs originais, sem depender do Copilot, sem publicar aproximadamente 570 MB no Git e sem remover o bootstrap diante de uma instalação incompleta.

## Comando único

Na raiz atualizada do repositório, execute:

```powershell
.\RECONSTRUIR-PACK99-LOCAL.cmd
```

O lançador utiliza por padrão:

```text
<ASSETS_ROOT> = W:\TEHKNE-SOLUTIONS\PROJETOS\JOGO-HOC\ASSETS
```

Outro diretório de metadados pode ser informado quando necessário:

```powershell
.\RECONSTRUIR-PACK99-LOCAL.cmd --metadata-dir "<CAMINHO_DO_PACK99_METADATA>"
```

## Descoberta dos metadados

O executor procura os manifestos globais nesta ordem:

1. diretório informado por `--metadata-dir`;
2. diretórios conhecidos dentro de `<ASSETS_ROOT>`;
3. diretórios próximos contendo `pack-manifest.json`;
4. ZIP reconstruído anterior em `PACK99-RECOVERED`.

Ao utilizar um ZIP anterior, somente os metadados globais são extraídos. O diretório `packages/` antigo não é reutilizado; os onze packs e o A01 são reconstruídos novamente a partir das fontes individuais.

## Operação

O executor:

1. valida o repositório;
2. valida os ZIPs 00–10 e o A01;
3. calcula o SHA-256 de cada origem;
4. compila os scripts Python;
5. executa os testes de runtime;
6. recupera ou descobre os metadados globais;
7. reconstrói o ZIP final com o overlay A01 corrigido;
8. calcula o novo SHA-256;
9. sincroniza `core` no Web e Godot;
10. exige zero referências pendentes;
11. sincroniza `full` no Web e Godot;
12. exige exatamente 1.037 assets e zero pendências;
13. executa o gate de promoção;
14. confirma ausência de bootstrap, aliases e fallback procedural;
15. grava relatórios externos;
16. imprime um bloco curto para ser colado no chat.

## Segurança

- os ZIPs originais nunca são modificados;
- o ZIP final permanece fora do Git;
- o runtime integral permanece ignorado pelo Git;
- a instalação é atômica pelo instalador corrigido;
- uma referência não resolvida interrompe o processo;
- o runtime anterior é preservado quando a instalação falha antes da ativação;
- o perfil `full` aceita somente 1.037 IDs únicos;
- Web e Godot precisam apresentar o mesmo conjunto e os mesmos caminhos.

## Saídas locais

```text
<ASSETS_ROOT>\PACK99-RECOVERED\HOC_PACK_99_FINAL_RUNTIME_RECOVERED_1.0.1.zip
<ASSETS_ROOT>\PACK99-REPORTS\PACK99_LOCAL_PROMOTION.log
<ASSETS_ROOT>\PACK99-REPORTS\sync-core-report.json
<ASSETS_ROOT>\PACK99-REPORTS\sync-full-report.json
<ASSETS_ROOT>\PACK99-REPORTS\promotion-report.json
<ASSETS_ROOT>\PACK99-REPORTS\PACK99_LOCAL_PROMOTION_RESULT.json
<ASSETS_ROOT>\PACK99-REPORTS\PACK99_LOCAL_PROMOTION_RESULT.md
```

## Resultado esperado

```text
PACK99_LOCAL_PROMOTION=PASSED
CORE_WEB=597 ou mais;UNRESOLVED=0
CORE_GODOT=597 ou mais;UNRESOLVED=0
FULL_WEB=1037;UNRESOLVED=0
FULL_GODOT=1037;UNRESOLVED=0
```

O relatório de promoção deve conter:

```json
{
  "expectedAssetIds": 1037,
  "bootstrapAssetIds": 0,
  "bootstrapAliases": 0,
  "proceduralFallbackMode": false,
  "passed": true,
  "signature": "Tehkné Solutions"
}
```

## Falha

Quando uma etapa falha, o executor:

- retorna código diferente de zero;
- interrompe as etapas dependentes;
- preserva os arquivos de diagnóstico;
- informa o log local;
- não declara a promoção aprovada.

**Tehkné Solutions**
