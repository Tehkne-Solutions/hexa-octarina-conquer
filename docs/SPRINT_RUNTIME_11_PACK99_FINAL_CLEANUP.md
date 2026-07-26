# Sprint Runtime 11 — Limpeza final do PACK 99

## Estado

Esta sprint está preparada em branch isolada e **não pode ser integrada** antes de a release `pack99-runtime-v1.0.1` ser publicada e o workflow `PACK 99 Release Promote` concluir com sucesso.

## Evidência já aprovada localmente

- Web: 1.037 IDs;
- Godot: 1.037 IDs;
- referências pendentes: zero;
- conjuntos e caminhos Web/Godot: idênticos;
- bootstrap no runtime promovido: zero;
- aliases provisórios: zero;
- fallback procedural: desabilitado;
- SHA-256 do ZIP: `f72cce299fd28c8bb8520320871d90057884bb0ec19dd449f1c3d07e56a71bbe`;
- assinatura: Tehkné Solutions.

## Mudanças desta sprint

### Produção Web

- o Docker baixa o ZIP oficial da release por HTTPS;
- o SHA-256 é validado antes da extração;
- `install_pack99.py` instala o perfil `full` antes do build Vite;
- o build de produção recebe exatamente 1.037 IDs;
- o registro `core`, bootstrap ou incompleto é rejeitado no navegador;
- falhas apresentam diagnóstico explícito;
- SVGs procedurais deixam de aparecer como personagens substitutos;
- filtros usados para transformar um payload bootstrap em outro personagem são removidos.

### PWA

Os arquivos de `assets/runtime/packages/` não entram no precache inicial. Eles são carregados sob demanda e armazenados em cache próprio, evitando uma instalação inicial de centenas de megabytes.

O registro runtime, o shell e os manifests continuam disponíveis para validação offline.

### Godot

Meshes procedurais de unidade só podem ser usados no editor com:

```text
HOC_ALLOW_PROCEDURAL_FALLBACK=1
```

Builds normais não criam cápsulas, esferas ou fortalezas falsas quando o PACK 99 está ausente. A falha é registrada de forma explícita.

### PACK 11

O manifesto de `PACK 11 — Narrative Portraits` passa para:

```text
ready-for-master-production
```

A integração continua condicionada ao relatório externo de promoção.

## Bootstrap a remover antes do merge

Para cada cliente, serão removidos:

- 5 payloads de tabuleiro;
- 7 payloads de sprites;
- 4 payloads de VFX;
- 1 registro bootstrap.

Total:

- 16 payloads físicos Web;
- 16 payloads físicos Godot;
- 2 registros de 33 IDs;
- 17 reutilizações por alias deixam de existir junto dos registros bootstrap.

## Gate obrigatório

O PR só poderá sair do modo draft quando o workflow externo produzir:

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

Além disso:

1. o asset da release deve ter o SHA-256 aprovado;
2. a auditoria integral deve verificar cada arquivo do ZIP;
3. o Docker deve concluir com o runtime full;
4. Web e Godot devem usar o mesmo conjunto de IDs;
5. os testes de produção não podem depender dos payloads bootstrap versionados.

## Ordem de integração

1. publicar a release;
2. concluir `PACK 99 Release Promote`;
3. anexar os relatórios ao PR;
4. remover os 34 arquivos bootstrap versionados;
5. executar PWA, Docker, Visual QA e Godot;
6. integrar o PR;
7. fechar a Issue #45;
8. iniciar `PORTRAIT_KAEL_MASTER_01`.

**Tehkné Solutions**
