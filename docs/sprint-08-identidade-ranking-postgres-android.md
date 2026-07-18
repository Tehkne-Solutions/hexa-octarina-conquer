# Sprint 08 — Identidade, ranking, PostgreSQL, observabilidade e Android

## Objetivo

Adicionar progressão persistente sem comprometer o servidor autoritativo, preparar a identidade para múltiplas instâncias e disponibilizar um pacote Android reproduzível.

## Identidade

- cadastro por `handle`, nome exibido e senha;
- senha derivada com `scrypt`, salt individual e comparação constante;
- token aleatório de 256 bits;
- apenas o hash SHA-256 do token é persistido;
- sessões com validade de 30 dias;
- contas opcionais: o modo visitante continua disponível;
- uma conta não pode ocupar duas vagas da mesma sala.

## Progressão

- XP por vitória e derrota;
- nível calculado pelo XP;
- rating baseado na expectativa relativa entre os jogadores;
- vitórias e derrotas acumuladas;
- histórico com oponente, motivo e variações;
- registro idempotente por `roomId`;
- encerramento autoritativo inicial por `match.forfeit`.

## Armazenamento

### SQLite

Indicado para desenvolvimento e instância única. Usa WAL, chaves estrangeiras e transações.

### PostgreSQL

O adaptador compartilha o mesmo contrato e cria automaticamente:

- `accounts`;
- `account_sessions`;
- `match_history`;
- índices de ranking e histórico.

O registro da partida bloqueia as contas envolvidas com `FOR UPDATE` antes de aplicar XP e rating.

## Protocolo

Novos comandos:

- `account.register`;
- `account.login`;
- `account.profile`;
- `account.history`;
- `leaderboard.list`;
- `match.forfeit`.

Novos eventos:

- `account.session`;
- `account.profile`;
- `account.history`;
- `leaderboard.data`;
- `match.progression`.

As credenciais da conta nunca entram em patches, lobby ou snapshots públicos.

## Observabilidade

- `/health` com versão, uptime e storages ativos;
- `/metrics` no formato Prometheus;
- contadores de HTTP, WebSocket, erros, contas e partidas;
- duração acumulada de requisições e mensagens;
- logs JSON com contexto e assinatura Tehkné Solutions.

## Godot e Android

- tela de cadastro, login e visitante;
- perfil com nível, XP, rating e resultados;
- ranking e histórico dentro do cliente;
- desistência autoritativa;
- credenciais de conta salvas separadamente da sessão da sala;
- controles touch emulados como mouse;
- orientação landscape;
- preset Android ARM64;
- script de exportação;
- APK debug produzido e publicado pelo CI.

## Testes

- cadastro, login inválido e autenticação;
- progressão idempotente em memória e SQLite;
- restauração de perfil e histórico;
- resultado de partida vinculado às contas;
- fluxo completo por WebSocket;
- PostgreSQL real no GitHub Actions;
- endpoints de health, ranking e métricas;
- estrutura da interface de contas;
- importação headless do projeto;
- exportação do APK Android;
- build do container e validação do Compose.

## Limites

- o estado das salas permanece em SQLite;
- não há recuperação de senha ou e-mail verificado;
- não há matchmaking por rating;
- não há temporada ou reset competitivo;
- personagens e cenários finais ainda não foram produzidos.

## Próximo marco

Sprint 09 — estado distribuído de partidas, matchmaking por rating, temporadas, recuperação de conta, telemetria mobile e assets finais.

---

Desenvolvido por **Tehkné Solutions**.
