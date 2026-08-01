# META 09-R.6 — Primeira GitHub Release

Corrige o probe de existência da GitHub Release no Windows PowerShell 5.1.

Quando `gh release view` retorna `release not found`, isso é uma condição esperada na primeira publicação. Com `$ErrorActionPreference = "Stop"`, o stderr do processo nativo interrompia o script antes do bloco que cria a release.

A correção executa somente o probe com `ErrorActionPreference = Continue`, lê `$LASTEXITCODE` e restaura o comportamento `Stop` imediatamente depois.

Nenhuma validação de runtime, hash, upload ou deploy é relaxada.

Tehkné Solutions
