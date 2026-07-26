# Sprint Runtime 10 — Canal de Release do PACK 99

## Objetivo

Publicar o runtime integral do PACK 99 fora do histórico Git, mas dentro da infraestrutura oficial do projeto, permitindo que GitHub Actions baixe, audite, instale e promova os 1.037 IDs em Web e Godot.

## Evidência local recebida

A execução local de 26 de julho de 2026 confirmou:

- ZIP full reconstruído com 572.184.403 bytes;
- SHA-256 `f72cce299fd28c8bb8520320871d90057884bb0ec19dd449f1c3d07e56a71bbe`;
- 1.037 IDs no Web;
- 1.037 IDs no Godot;
- zero referências pendentes;
- conjuntos e caminhos idênticos;
- bootstrap igual a zero no runtime local promovido;
- aliases provisórios iguais a zero;
- fallback procedural desabilitado no runtime local promovido.

A execução também revelou que o perfil `core` da sincronização atual selecionou 1.037 IDs. Essa inconsistência não invalida o perfil `full`, mas impede declarar o contrato core como concluído até a seleção voltar a exatamente 597 IDs.

## Auditoria integral

O script `scripts/audit_pack99_archive.py` complementa o arquivo histórico `SHA256SUMS.txt`:

1. rejeita caminhos absolutos e travessia de diretórios;
2. valida pack, assinatura e relatório global;
3. exige 1.037 IDs únicos, 46 entidades e 11 packs;
4. resolve todos os campos de runtime publicados pelo registro global;
5. exige zero referências pendentes;
6. calcula SHA-256 de cada arquivo físico do ZIP;
7. registra bytes, hash e caminho de cada entrada;
8. produz relatório JSON auditável.

Isso impede que um arquivo seja promovido apenas porque o registro e o hash externo do ZIP estão corretos.

## Publicação

Depois do merge, executar na raiz do checkout local:

```powershell
.\PUBLICAR-PACK99-RELEASE.cmd
```

O lançador:

- exige o ZIP em `<ASSETS_ROOT>/PACK99-RECOVERED`;
- valida o SHA-256 aprovado;
- exige `promotion-report.json` verde;
- executa a auditoria integral;
- cria ou atualiza a release `pack99-runtime-v1.0.1`;
- publica ZIP, checksum e relatórios;
- dispara `PACK 99 Release Promote`.

## Promoção no GitHub Actions

O workflow `.github/workflows/pack99-release-promote.yml`:

1. baixa o asset por HTTPS da release pública;
2. valida o SHA-256 informado;
3. audita todos os arquivos e referências;
4. instala o perfil full com limpeza atômica;
5. exige 1.037 IDs idênticos em Web e Godot;
6. rejeita bootstrap, aliases e fallback procedural;
7. publica relatórios por 90 dias;
8. publica runtimes Web e Godot como artefatos temporários por 30 dias.

## Regra de limpeza

Os arquivos bootstrap ainda versionados não devem ser removidos antes de o workflow da release concluir com sucesso. A validação local comprova o conteúdo no computador de origem; a validação da release comprova que o mesmo conteúdo é reproduzível fora desse computador.

Após a aprovação do workflow:

1. abrir PR de limpeza do bootstrap versionado;
2. retirar aliases e fallbacks de produção;
3. conectar a build/deploy ao runtime full distribuído;
4. fechar a Issue #45;
5. alterar o PACK 11 para `ready-for-master-production`.

## Assinatura

**Tehkné Solutions**
