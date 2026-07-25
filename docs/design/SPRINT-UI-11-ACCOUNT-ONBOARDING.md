# Sprint UI 11 — Onboarding de conta e migração segura

## Objetivo

Permitir que qualquer jogador entre como visitante sem bloqueio, crie ou recupere a conta dentro do shell unificado e leve o progresso local para a conta com backup, prévia e resolução explícita de conflitos.

## Princípios

- visitante primeiro: nenhuma tela de autenticação bloqueia home, campanha local ou lobby;
- sincronização contextual: o convite aparece após progresso real ou por ação do jogador;
- nenhuma sobrescrita silenciosa;
- toda migração cria backup local antes da escrita;
- o servidor valida, normaliza e resolve novamente o progresso recebido;
- a conta nunca recebe tokens, cartas privadas ou conteúdo de partida no payload de migração;
- assinatura exclusiva da Tehkné Solutions.

## Fluxos

### Visitante

1. entra diretamente no shell;
2. joga e salva progresso no dispositivo;
3. recebe convite discreto para proteger a jornada;
4. pode ignorar e continuar jogando.

### Criar conta

1. informa usuário, nome de batalha e senha;
2. conta é criada pelo protocolo autoritativo;
3. progresso local é comparado ao registro remoto vazio;
4. backup local é criado;
5. união segura é aplicada após confirmação;
6. catálogo e perfil são recarregados.

### Entrar

1. autentica a conta existente;
2. cliente solicita prévia da sincronização;
3. se os dados forem iguais, conclui sem escrita;
4. se apenas um lado estiver à frente, recomenda a união;
5. se houver divergência, apresenta três decisões:
   - unir progresso;
   - manter a conta;
   - usar este dispositivo.

### Recuperar acesso

1. solicita código pelo usuário;
2. servidor responde sem revelar se a conta existe;
3. código e nova senha são confirmados no mesmo painel;
4. demais sessões são revogadas pelo servidor;
5. a nova sessão entra no fluxo normal de sincronização.

## Dados migrados

- estado e percentual do prólogo vivo;
- objetivos concluídos;
- tentativas e melhor rodada;
- construção escolhida;
- recompensas locais;
- datas de início, última partida e conclusão.

Não são migrados:

- tokens de sessão;
- mãos ou cartas submetidas;
- conteúdo de partidas;
- mensagens livres;
- dados técnicos de telemetria.

## Resolução

A união segura usa operações monotônicas:

- maior avanço de estado, objetivos e percentual;
- menor melhor rodada válida;
- união de recompensas permitidas;
- maior data de atividade;
- construção do registro mais avançado;
- tentativas preservadas pelo maior valor, evitando duplicação.

O endpoint `POST /campaign/sync-guest` aceita as estratégias:

- `preview`: compara sem gravar;
- `merge`: união segura recomendada;
- `remote`: mantém o registro da conta e restaura no dispositivo;
- `local`: substitui somente o prólogo remoto pelo backup deste dispositivo.

## Persistência e idempotência

- memória e PostgreSQL implementam o mesmo contrato;
- o prólogo é armazenado dentro do progresso de campanha da conta;
- demais missões e conquistas não são alteradas;
- a recompensa de 300 XP por conclusão migrada é idempotente por conta;
- até dez backups locais são retidos no navegador.

## QA

- visitante não encontra modal bloqueante;
- criação, login e recuperação funcionam dentro do shell;
- backup é criado antes da migração;
- conflito nunca é resolvido automaticamente por sobrescrita;
- refresh mantém a sessão;
- logout mantém o progresso local;
- Visual QA em 1366×768 e 390×844;
- testes de normalização, comparação, merge, memória e PostgreSQL;
- testes web de oferta contextual e backup.

---

**Tehkné Solutions**