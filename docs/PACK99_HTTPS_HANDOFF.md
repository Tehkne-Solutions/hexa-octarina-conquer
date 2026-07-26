# PACK 99 — Handoff para armazenamento HTTPS

## Binário obrigatório

| Campo | Valor |
|---|---|
| Arquivo | `HOC_PACK_99_FINAL_RUNTIME_RECOVERED_1.0.1.zip` |
| Tamanho | `569.804.164` bytes |
| SHA-256 | `e0a00bc450c0c80b4d9433f476b8377353433b0eb90318c9589b331923296c6d` |
| Conteúdo | 11 packs, 1.037 IDs canônicos, 46 entidades |
| Assinatura | Tehkné Solutions |

## Requisitos do endpoint

- HTTPS obrigatório;
- download binário direto;
- sem página HTML intermediária;
- suporte a arquivo de aproximadamente 570 MB;
- URL estável durante sincronização e deploy;
- nenhuma transformação ou recompressão do objeto;
- conteúdo retornado deve produzir exatamente o SHA-256 acima.

## Secret do GitHub

```text
PACK99_URL=<URL HTTPS DIRETA>
```

## Verificação de aceite

O endpoint é considerado aceito somente quando:

1. o workflow baixa o arquivo;
2. o SHA-256 confere;
3. a instalação `core` conclui com 597 assets e zero pendências;
4. a instalação `full` conclui com 1.037 assets e zero pendências;
5. Web e Godot apresentam os mesmos 1.037 IDs;
6. `promotion-report.json` retorna `passed: true`.

## Estado atual

O ZIP recuperado não foi localizado nos artefatos atuais do GitHub Actions, no Google Drive conectado, no armazenamento local da sessão ou em um projeto Vercel associado ao HOC. A publicação depende da recuperação física desse arquivo ou da repetição da montagem a partir dos onze ZIPs finais.

**Tehkné Solutions**
