# Hotfix — Reversão da promoção prematura do PACK 99

## Motivo

O PR #49 foi integrado antes da publicação da release `pack99-runtime-v1.0.1` e antes da validação externa dos 1.037 IDs. Em seguida, o commit `d4e468fbb7abfc190efebbb4e27b257db1c85318` removeu os 34 arquivos bootstrap versionados, mas os arquivos integrais em `packages/` continuaram ignorados pelo Git.

Isso deixou a árvore principal sem o runtime bootstrap e com builds Docker dependentes de uma release ainda ausente.

## Ação

Este hotfix restaura integralmente a árvore do commit seguro:

`9d8f31feaceba03d00fecd601e8e68f0d8061975`

A restauração:

- recupera os 16 payloads Web;
- recupera os 16 payloads Godot;
- recupera os dois registros bootstrap;
- remove a dependência obrigatória da release nos builds normais;
- devolve os fallbacks provisórios enquanto a promoção externa não estiver comprovada;
- mantém o canal de publicação e auditoria do PACK 99 existente até a Sprint Runtime 10.

## Regra para nova promoção

O PR final de limpeza somente poderá ser integrado após:

1. publicação HTTPS do ZIP integral;
2. SHA-256 validado;
3. auditoria externa completa;
4. Web com 1.037 IDs e zero pendências;
5. Godot com 1.037 IDs e zero pendências;
6. bootstrap e aliases iguais a zero no runtime promovido;
7. builds Docker, PWA e APKs aprovados usando o asset publicado.

A compatibilidade adicional para layouts de runtime já instalados será reaplicada em PR separado, depois da estabilização da `main`.

**Tehkné Solutions**
