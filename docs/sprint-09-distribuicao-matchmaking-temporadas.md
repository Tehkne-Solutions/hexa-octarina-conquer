# Sprint 09 — Distribuição, matchmaking, temporadas e recuperação

## Objetivo

Remover a afinidade obrigatória de instância das partidas e entregar a primeira camada competitiva completa do Hexa Octarina Conquer.

## Estado distribuído das partidas

Foi criado um armazenamento PostgreSQL para:

- snapshots completos das salas;
- revisão autoritativa;
- status e data de atualização;
- journal de eventos por revisão;
- índices de consulta por status e atividade.

O `DistributedRoomManager` recarrega o estado persistido antes de criar jogador, reconectar ou aplicar um comando. A gravação usa bloqueio transacional e compara a revisão observada com a revisão atual.

Quando duas instâncias tentam gravar a mesma sala, apenas a primeira vence. A segunda recebe `ROOM_WRITE_CONFLICT`, evitando sobrescrita silenciosa.

## Matchmaking

A fila competitiva considera:

- temporada ativa;
- região;
- tamanho do tabuleiro;
- rating global do jogador;
- tempo de espera.

A faixa de busca começa em ±100 pontos e aumenta 50 pontos a cada 15 segundos até ±500.

Ao formar uma partida, o servidor:

1. remove os dois tickets da fila;
2. cria uma atribuição persistente;
3. reserva um `roomId` único;
4. define anfitrião e convidado;
5. exige aceite autenticado;
6. permite ao anfitrião criar a sala e ao convidado entrar nela por qualquer réplica Node.

## Temporadas

A temporada ativa é criada sob advisory lock PostgreSQL, garantindo somente uma temporada ativa mesmo com múltiplas instâncias inicializando simultaneamente.

O ranking sazonal mantém separadamente:

- rating inicial neutro de 1000;
- vitórias;
- derrotas;
- partidas de colocação;
- posição na temporada.

O perfil global continua mantendo XP, nível, rating e histórico de longo prazo.

## Recuperação de conta

Foi implementado um desafio temporário:

- código criptograficamente aleatório;
- persistência somente do hash;
- expiração em 15 minutos;
- máximo de cinco tentativas;
- uso único;
- invalidação de todas as sessões anteriores após a redefinição.

A resposta da solicitação não revela se o usuário existe. Em desenvolvimento o código pode ser exposto para QA; em produção deve ser entregue por um canal externo.

## Telemetria

O comando `telemetry.track` registra:

- conta opcional;
- sessão do cliente;
- nome do evento;
- payload limitado a 8 KiB;
- horário do servidor.

O cliente envia eventos de conexão, entrada na fila e confirmação da sala.

## Cliente Godot 0.9.0

A interface passou a oferecer:

- fila ranqueada para contas autenticadas;
- estado da busca e faixa de rating em tempo real;
- aceite automático do pareamento;
- repetição do aceite quando o anfitrião ainda está criando a sala;
- ranking global e ranking sazonal;
- identificação da temporada ativa;
- solicitação e confirmação de recuperação;
- telemetria mobile;
- reconexão automática após conflito de revisão.

Visitantes preservam o fluxo de lobby público sem progressão persistente.

## Produção

O Compose passou a usar PostgreSQL para:

- salas e journal;
- identidade e progressão;
- temporadas e rankings;
- fila e atribuições;
- recuperação;
- telemetria.

O health check confirma que os três adaptadores estão em `postgres`.

## Testes

Foram adicionados testes para:

- rejeição de escritor obsoleto;
- persistência e restauração distribuída;
- pareamento por rating;
- anfitrião e convidado recebendo a mesma sala;
- ranking sazonal;
- recuperação de uso único;
- invalidação de sessão antiga;
- telemetria;
- fluxo competitivo completo via WebSocket;
- boot totalmente distribuído;
- importação Godot e geração do APK Android.

Os testes PostgreSQL são executados sequencialmente porque compartilham o mesmo banco efêmero e fazem limpeza integral das tabelas.

## Limites conhecidos

- broadcasts WebSocket ainda são locais ao processo Node;
- réplicas diferentes precisam de Redis, NATS ou Pub/Sub para eventos em tempo real entre sockets;
- não existe penalidade por abandonar a fila ou não aceitar a partida;
- a entrega real do código de recuperação depende de provedor externo;
- não existe painel administrativo de temporadas ou moderação;
- os assets visuais finais continuam pendentes.

## Próximo marco

Sprint 10:

- barramento de eventos entre réplicas;
- presença e sockets distribuídos;
- penalidades competitivas;
- administração de temporadas;
- canal de recuperação real;
- personagens, cenários e efeitos finais.

---

Desenvolvido por **Tehkné Solutions**.
