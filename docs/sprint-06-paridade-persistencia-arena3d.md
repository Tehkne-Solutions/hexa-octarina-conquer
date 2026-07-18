# Sprint 06 — Paridade, persistência, cerco e arena 3D

## Objetivo

Evoluir o recorte online da Sprint 05 para uma base recuperável, verificável e visualmente próxima da direção final do produto, sem perder a autoridade do servidor ou a compatibilidade com o motor Python.

## Entregas

### Províncias conectadas

- células aliadas ortogonalmente adjacentes formam uma única província;
- fusões preservam a unidade mais forte, nível, HP e proteção;
- cada célula continua identificável e aponta para a província atual;
- IDs antigos `cell:x,y` continuam aceitos como alvo de cartas;
- uma aresta que fecha duas células concede dois bônus de ação.

### Cerco e combate

- o servidor detecta províncias sem liberdades;
- um cerco por um único oponente abre automaticamente um Duelo de Célula;
- criação de duelo de cerco é idempotente;
- quantidade de território adjacente fornece suporte ao atacante;
- tamanho e unidade da província fortalecem o defensor;
- uma captura pode unir a província conquistada a território aliado adjacente.

### Persistência

- armazenamento em memória para testes;
- armazenamento JSON em disco para execução local e instância única;
- escrita atômica por arquivo temporário e renomeação;
- quarentena de snapshots inválidos;
- restauração de salas, jogadores, tokens, tabuleiro, duelos, revisões e histórico;
- jogadores restaurados começam desconectados;
- reconexão autenticada publica presença aos demais participantes;
- migração de snapshots antigos que possuíam somente células.

### Lobby

- comando WebSocket `lobby.list`;
- eventos `lobby.rooms` e `lobby.updated`;
- endpoint HTTP `GET /rooms`;
- filtro opcional por status;
- respostas públicas sem tokens, mãos de cartas ou credenciais.

### Paridade Python ↔ Node

- cenários canônicos versionados em `conformance/scenarios.json`;
- execução dos mesmos comandos nos dois motores;
- normalização e comparação de células, proprietários, províncias e unidades;
- validação integrada ao CI.

### Godot 4

- transporte de sessão separado da apresentação;
- matchmaking automático em sala aguardando jogador;
- criação automática quando não há sala disponível;
- primeira arena 3D procedural;
- plataformas por célula, pilares rúnicos, muralhas e unidades de província;
- câmera isométrica, luzes e HUD;
- seleção de pilares por raycast para jogar uma aresta;
- cena 2D anterior mantida como fallback de diagnóstico.

## Critérios de validação

- duas células aliadas conectadas aparecem como uma província;
- a evolução territorial não é perdida em uma fusão;
- uma aresta que fecha duas células mantém o turno com dois bônus;
- o mesmo cerco não cria duelos duplicados;
- uma sala volta após reinício com a mesma revisão e estado;
- presença online não é restaurada falsamente;
- lobby e snapshots públicos não expõem `sessionToken`;
- snapshots da Sprint 05 migram sem perda do proprietário e da unidade;
- os cenários de conformidade produzem o mesmo resultado em Python e Node;
- o projeto Godot abre tendo `arena_3d.tscn` como cena inicial.

## Limites conhecidos

- persistência em arquivo não oferece coordenação entre múltiplas instâncias;
- o cerco usa células territoriais já conquistadas e ainda não modela linhas de suprimento avançadas;
- a arena 3D utiliza meshes primitivas, não os assets finais de fantasia;
- cartas e duelos ainda não possuem uma interface completa no cliente Godot;
- contas, inventário permanente e progressão de campanha continuam fora do recorte.

## Próximo sprint

**Sprint 07 — Interface de cartas, combate 3D e infraestrutura multiplayer**

- mão de cartas interativa no Godot;
- seleção e confirmação simultânea em duelos;
- câmera e transição cinematográfica para a arena de combate;
- animações, partículas e áudio de conquista, cerco e evolução;
- banco transacional para salas, contas e progressão;
- expiração de salas e limpeza de armazenamento;
- observabilidade, rate limiting e preparação de deploy.

---

Desenvolvido por **Tehkné Solutions**.
