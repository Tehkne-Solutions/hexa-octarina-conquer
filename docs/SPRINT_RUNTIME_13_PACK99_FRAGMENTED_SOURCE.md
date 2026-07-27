# Sprint Runtime 13 — Fonte fragmentada do PACK 99

## Objetivo

Permitir o armazenamento e a transferência do PACK 99 integral em partes menores, preservando a integridade do ZIP final e impedindo qualquer promoção com partes incompletas, adulteradas ou fora de ordem.

## Fonte reconstruída

- arquivo final: `HOC_PACK_99_FINAL_RUNTIME_RECOVERED_1.0.2.zip`;
- tamanho: `583070593` bytes;
- SHA-256: `5efd54e05cd2a01aa764ad652423d4ceaca0030fb9aca3d233ede3144a3b86e0`;
- partes: 7;
- tamanho máximo por parte: 80 MiB;
- manifesto: `HOC_PACK_99_RELEASE_PARTS_MANIFEST.json`;
- armazenamento atual: Google Drive conectado, pasta `HOC PACK 99 — Runtime Integral 1.0.2`;
- folder ID: `1BV3U_kUMlR0iZ-44YMkL-5V87g29iTw2`.

O Drive é a fonte recuperável atual, mas não substitui um endpoint HTTPS público anônimo para o workflow de promoção. A publicação final deverá usar GitHub Release, CDN ou credencial segura de download no Actions.

## Remontagem no Windows

Coloque na mesma pasta:

- `HOC_PACK_99_RELEASE_PARTS_MANIFEST.json`;
- `HOC_PACK_99_FINAL_RUNTIME_RECOVERED_1.0.2.zip.part001` até `.part007`.

Na raiz do repositório, execute:

```bat
REMONTAR-PACK99-PARTES.cmd "C:\caminho\para\as\partes"
```

O comando produz:

- `HOC_PACK_99_FINAL_RUNTIME_RECOVERED_1.0.2.zip`;
- `HOC_PACK_99_FINAL_RUNTIME_RECOVERED_1.0.2.zip.reassembly-report.json`.

## Remontagem multiplataforma

```bash
python scripts/reassemble_pack99_parts.py \
  --manifest /caminho/HOC_PACK_99_RELEASE_PARTS_MANIFEST.json \
  --parts-dir /caminho \
  --output /caminho/HOC_PACK_99_FINAL_RUNTIME_RECOVERED_1.0.2.zip
```

## Validações obrigatórias

O remontador:

1. valida o schema mínimo do manifesto;
2. rejeita nomes absolutos, subpastas e traversal `../`;
3. exige sequência contínua `1..N`;
4. rejeita nomes ou ordens duplicadas;
5. valida tamanho e SHA-256 de cada parte;
6. grava em arquivo temporário no mesmo volume;
7. valida tamanho e SHA-256 do ZIP final;
8. abre e testa integralmente o ZIP;
9. rejeita entradas inseguras ou duplicadas;
10. exige os registros globais canônicos;
11. substitui o destino somente depois de todas as validações;
12. preserva o runtime anterior em qualquer falha.

## Próxima operação

Após remontar o ZIP:

```bat
RECONSTRUIR-PACK99-LOCAL.cmd
PUBLICAR-PACK99-RELEASE.cmd
```

Depois da publicação HTTPS:

1. executar `PACK 99 Release Promote`;
2. validar 1.037 IDs no Web;
3. validar 1.037 IDs no Godot;
4. exigir zero referências pendentes;
5. remover bootstrap, aliases e fallback procedural;
6. encerrar a Issue #45;
7. retomar o PACK 11 — Narrative Portraits.

**Tehkné Solutions**
