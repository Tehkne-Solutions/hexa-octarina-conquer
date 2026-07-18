# ADR 0005 — Barramento de cluster com PostgreSQL

- **Status:** Aceito
- **Data:** 2026-07-18
- **Assinatura:** Tehkné Solutions

## Contexto

A Sprint 09 removeu a afinidade de instância do estado autoritativo das partidas, mas cada processo Node ainda mantinha seus próprios sockets e broadcasts. Uma jogada persistida por uma réplica não era automaticamente enviada aos jogadores conectados a outra réplica.

Também era necessário distribuir presença, lobby, atualização de temporadas e penalidades sem adicionar um novo serviço obrigatório antes da primeira operação multiplayer controlada.

## Decisão

Usar o PostgreSQL em duas camadas complementares:

1. `cluster_events` persiste o envelope completo do evento em JSONB;
2. `LISTEN/NOTIFY` transmite somente o ID desse registro.

A réplica que recebe a notificação busca o payload por ID e executa a atualização nos sockets locais.

Os tópicos iniciais são:

- `room.update`;
- `lobby.invalidate`;
- `presence.invalidate`;
- `season.invalidate`;
- `penalty.updated`.

## Razões

- evita o limite prático de payload do `NOTIFY`;
- permite reter eventos para diagnóstico;
- não adiciona Redis, NATS ou outro serviço ao primeiro deploy distribuído;
- reutiliza a infraestrutura PostgreSQL já obrigatória para salas e competição;
- mantém os sockets privados locais a cada processo;
- permite substituir o transporte posteriormente sem alterar o protocolo do jogo.

## Presença

A presença é persistida em:

- `cluster_instances`;
- `player_presence`.

Cada instância e jogador conectado envia heartbeat. Registros que ultrapassam o TTL são ignorados e removidos pela manutenção periódica.

A presença distribuída é a fonte para decidir se o fechamento de um socket realmente desconectou o jogador ou se ele ainda está conectado em outra réplica.

## Consequências positivas

- jogadores conectados a réplicas diferentes recebem os mesmos patches;
- mãos privadas são recarregadas do estado autoritativo após uma invalidação;
- lobby, temporada e presença convergem entre processos;
- o health check informa réplicas e jogadores ativos;
- o servidor pode ser escalado horizontalmente sem sticky sessions para o estado da partida.

## Limites

- o PostgreSQL passa a acumular funções de banco, fila leve e presença;
- eventos extremos podem exigir Redis Streams, NATS JetStream ou outro broker dedicado;
- `LISTEN/NOTIFY` não oferece replay por consumidor, por isso o payload continua persistido;
- a limpeza de eventos antigos precisa permanecer ativa;
- o canal de WebSocket ainda depende do balanceador aceitar conexões longas.

## Critério para migração futura

Migrar para um broker dedicado quando ocorrer ao menos uma destas condições:

- volume sustentado superior à capacidade acordada do PostgreSQL;
- necessidade de replay por grupo de consumidores;
- processamento assíncrono fora do servidor de jogo;
- múltiplas regiões com latência incompatível com um PostgreSQL central;
- exigência de entrega com semântica superior ao modelo de invalidação atual.
