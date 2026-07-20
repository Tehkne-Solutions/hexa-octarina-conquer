# Sprint 14 — Campanha Single Player

## Objetivo

Adicionar um modo solo completo ao Hexa Octarina Conquer sem duplicar as regras do jogo no navegador. A campanha utiliza o mesmo motor autoritativo, o mesmo tabuleiro, as mesmas cartas e os mesmos duelos do multiplayer.

## Estrutura

### Capítulo 1 — Fundamentos Rúnicos

1. A Primeira Linha
2. O Quadrado Rúnico
3. Cerco Inicial
4. Guardião do Limiar

### Capítulo 2 — A Convergência Alquímica

5. Maré e Trovão
6. Fortalezas Vivas
7. Rede de Províncias
8. Mestre Alquimista

### Capítulo 3 — Ascensão Magitech

9. Pressão Mecânica
10. Trono Fragmentado
11. Última Convergência
12. Octarina Absoluta

Cada missão possui um objetivo obrigatório e dois objetivos opcionais. A conclusão concede entre uma e três estrelas.

## Objetivos disponíveis

- conquistar células;
- abrir vantagem territorial;
- formar uma província conectada de determinado tamanho;
- fortificar províncias;
- vencer Duelos de Célula;
- capturar províncias;
- utilizar sequências de cartas em duelo;
- concluir dentro do limite de rodadas;
- preservar determinada quantidade de HP.

## IA autoritativa

O adversário é criado como um jogador real controlado pelo servidor. A interface não simula ou inventa ações da IA.

### Iniciante

- prioriza fechamentos imediatos;
- evita algumas jogadas perigosas;
- comete erros controlados periodicamente;
- utiliza cartas de forma conservadora.

### Tático

- considera conexão territorial;
- pressiona células próximas ao inimigo;
- fortifica unidades enfraquecidas;
- convoca duelos contra províncias vulneráveis.

### Mestre

- considera risco, conexão e pressão inimiga;
- utiliza expansão para preparar fechamentos;
- executa sequências combinadas;
- usa Molhado seguido de Raio quando possui energia suficiente.

## Baralho de campanha

A campanha fornece uma reserva maior que a mão multiplayer para garantir que missões de longa duração sejam concluíveis. Ela inclui múltiplas cópias de:

- Expansão Rúnica;
- Fortaleza Octarina;
- Convocar Duelo;
- Golpe Rúnico;
- Égide de Pedra;
- Maré Rúnica;
- Raio Encadeado;
- Cura Alquímica.

O limite de uma carta macro por turno continua valendo.

## Progressão

### Conta autenticada

O progresso é salvo no PostgreSQL:

- estrelas por missão;
- tentativas;
- melhor quantidade de rodadas;
- melhor HP final;
- totais de células, duelos e fortificações;
- conquistas;
- salas já registradas para evitar duplicidade.

### Visitante

O progresso é salvo no `localStorage` do navegador. Ele permanece no mesmo navegador e dispositivo, mas não é sincronizado entre aparelhos.

## Conquistas

1. Primeiro Selo
2. Constelação Rúnica
3. Céu Alquímico
4. Cartógrafo
5. Duelista Octarino
6. Arquiteto de Fortalezas
7. Vitória Imaculada
8. Runa Completa
9. Convergência Completa
10. Lenda da Octarina

## API

### Catálogo

```http
GET /campaign/catalog
```

### Progresso autenticado

```http
GET /campaign/progress
Authorization: Bearer ACCESS_TOKEN
X-Account-ID: ACCOUNT_ID
```

### Iniciar missão

```http
POST /campaign/start
Content-Type: application/json
```

### Registrar conclusão

```http
POST /campaign/complete
Content-Type: application/json
```

O servidor verifica a sala, a conta e o resultado autoritativo antes de registrar a conclusão.

## Persistência distribuída

A tabela `campaign_progress` utiliza JSONB e gravação transacional. A criação do esquema é protegida por advisory lock, permitindo que múltiplas réplicas iniciem simultaneamente contra um banco vazio.

## PWA

O lobby passa a oferecer duas entradas:

- Campanha solo;
- Sala multiplayer.

A tela da campanha contém capítulos, missões, estrelas, bloqueios, briefing, adversário, objetivos e conquistas. Durante a partida, os objetivos são atualizados em tempo real. Ao terminar, é exibida uma tela de vitória ou derrota com estatísticas e acesso à próxima missão.

## Implantação

O `render.yaml` define `HEXA_CAMPAIGN_STORE=postgres`. Após o merge, o Blueprint existente deve sincronizar automaticamente. Se o auto deploy estiver desativado, use **Manual Deploy → Deploy latest commit** no serviço `hexa-octarina-conquer`.

## Validação

- regras e IA em memória;
- ciclo HTTP autenticado;
- progresso idempotente;
- PostgreSQL transacional;
- inicialização concorrente do esquema;
- progresso visitante;
- TypeScript e Vite;
- imagem Docker com PWA e API;
- smoke test de `/campaign/catalog` dentro do container final.

---

Desenvolvido por **Tehkné Solutions**.
