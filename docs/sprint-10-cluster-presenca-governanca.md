# Sprint 10 — Cluster, presença e governança competitiva

## Objetivo

Completar a execução horizontal do servidor autoritativo, adicionar presença distribuída, controlar ausências no matchmaking, administrar temporadas com segurança e preparar a recuperação de contas para um canal externo real.

## Entregas

### Barramento entre réplicas

- tabela `cluster_events` com payload JSONB;
- `LISTEN/NOTIFY` transmitindo somente o ID do evento;
- tópicos para sala, lobby, presença, temporada e penalidade;
- atualização pública em todas as réplicas;
- recarga de estado privado para sockets remotos;
- limpeza periódica dos eventos antigos.

### Presença distribuída

- heartbeat de instâncias;
- heartbeat de jogadores;
- TTL configurável;
- remoção de registros obsoletos;
- proteção contra falso disconnect quando o jogador permanece em outra réplica;
- endpoint `/presence`;
- health check com instâncias e jogadores ativos;
- evento `presence.updated` no cliente.

### Governança competitiva

- penalidades persistentes;
- cooldown por expiração da confirmação do pareamento;
- idempotência por origem da penalidade;
- bloqueio da fila com `MATCHMAKING_COOLDOWN`;
- consulta e limpeza administrativa;
- administração de criação, ativação e encerramento de temporadas;
- API protegida por Bearer token.

### Recuperação de conta

Provedores configuráveis:

- `webhook` para produção;
- `console` para desenvolvimento;
- `none` para desativação explícita.

O webhook recebe conta, código temporário e expiração. O protocolo continua respondendo genericamente para não revelar a existência da conta.

### Godot 0.10.0

- identificação da réplica conectada;
- presença da sala;
- mensagem de cooldown competitivo;
- telemetria com versão e instância;
- APK Android ARM64 0.10.0;
- unidades procedurais compostas;
- variações para recruta e fortaleza;
- banners e brilho elemental.

## Administração

### Listar temporadas

```bash
curl -H "Authorization: Bearer $HEXA_ADMIN_TOKEN" \
  http://localhost:8080/admin/seasons
```

### Criar temporada

```bash
curl -X POST \
  -H "Authorization: Bearer $HEXA_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  http://localhost:8080/admin/seasons \
  -d '{
    "action": "create",
    "id": "season-2026-04",
    "name": "Convergência Octarina",
    "startsAt": 1798761600000,
    "endsAt": 1806537600000
  }'
```

### Ativar temporada

```bash
curl -X POST \
  -H "Authorization: Bearer $HEXA_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  http://localhost:8080/admin/seasons \
  -d '{"action":"activate","seasonId":"season-2026-04"}'
```

### Aplicar penalidade

```bash
curl -X POST \
  -H "Authorization: Bearer $HEXA_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  http://localhost:8080/admin/penalties \
  -d '{
    "accountId": "account-id",
    "kind": "moderation",
    "durationMs": 600000,
    "reason": "conduta antidesportiva"
  }'
```

## Variáveis principais

```text
HEXA_CLUSTER_BUS=postgres
HEXA_PRESENCE_STORE=postgres
HEXA_GOVERNANCE_STORE=postgres
HEXA_PRESENCE_TTL_MS=45000
HEXA_ADMIN_TOKEN=...
HEXA_RECOVERY_PROVIDER=webhook
HEXA_RECOVERY_WEBHOOK_URL=...
HEXA_RECOVERY_WEBHOOK_SECRET=...
```

## Critérios de validação

- uma jogada feita na réplica A chega ao jogador conectado à réplica B;
- estado privado não é enviado a outro jogador;
- payload superior ao limite do `NOTIFY` é entregue por referência persistida;
- duas réplicas aparecem no health check;
- presença expirada deixa de ser considerada online;
- expiração do aceite gera cooldown somente para quem não confirmou;
- cooldown impede nova entrada na fila;
- endpoints administrativos rejeitam requisições sem token;
- recuperação via webhook envia autenticação e payload corretos;
- Godot importa sem erros;
- APK Android é gerado pelo CI;
- regressões Python, Node e conformidade continuam aprovadas.

## Limites conhecidos

- ainda não há penalidade por abandono durante a batalha;
- a administração não possui painel visual;
- o webhook de recuperação precisa ser integrado a e-mail, WhatsApp ou outro canal;
- as unidades são procedurais e não substituem personagens finais produzidos em Blender;
- para escala elevada ou múltiplas regiões, o barramento deverá migrar para um broker dedicado.

## Próximo marco

**Sprint 11 — Operação beta e conteúdo final**

- abandono e reconexão com janela de tolerância;
- espectador e replay;
- painel administrativo web;
- integração real do canal de recuperação;
- personagens GLB e animações;
- cenários e materiais finais;
- AAB de release e preparação para Play Store;
- testes de carga e chaos testing.

---

Desenvolvido por **Tehkné Solutions**.
