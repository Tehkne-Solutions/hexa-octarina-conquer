# Sprint UI 10 — Decks, loadouts e evolução da coleção

## Objetivo

Transformar a coleção do Hexa Octarina Conquer em um sistema de preparação de batalha. O deck salvo deixa de ser apenas uma visualização e passa a determinar as cartas privadas disponíveis na campanha viva, nas missões autoritativas e nas salas multiplayer.

## Regras do loadout

Cada loadout possui:

- exatamente 5 cartas de combate;
- até 2 cópias da mesma carta;
- custo total máximo de 9 de energia;
- pelo menos 2 cartas de Kael/Guardião;
- pelo menos 2 cartas de Lyra/Arqueira;
- somente cartas desbloqueadas na progressão atual.

As táticas de tabuleiro permanecem fixas e são adicionadas automaticamente:

- Expansão Rúnica;
- Fortaleza Octarina;
- Convocar Duelo.

A mão autoritativa é formada por 3 táticas fixas e 5 cartas do loadout ativo.

## Experiência de coleção

O editor oferece:

- criação de até 6 decks;
- renomeação, exclusão e ativação;
- cinco slots visíveis;
- custo e equilíbrio por herói em tempo real;
- mensagens de validação acionáveis;
- evolução de domínio de Kael e Lyra;
- origem, missão e requisito de cada carta;
- comparação de até duas cartas;
- diferenças de custo, ataque, defesa e velocidade;
- indicação das cartas bloqueadas e do requisito de desbloqueio.

## Pontos de seleção

O loadout ativo pode ser consultado e editado em:

- coleção;
- painel da campanha;
- briefing antes da missão;
- lobby multiplayer.

## Integração da campanha viva

O deck ativo é dividido pelas funções dos heróis:

- cartas de Guardião alimentam o deck de Kael;
- cartas de Arqueira alimentam o deck de Lyra.

O motor existente continua responsável por recomendações, seleção de energia e resolução das rodadas.

## Integração autoritativa

O cliente envia somente os cinco IDs públicos do loadout ao criar ou entrar em uma sala e ao iniciar uma campanha.

O servidor repete toda a validação antes de inserir o jogador na sala. Uma composição inválida não altera a sala nem a persistência.

O bot da campanha continua utilizando a mão canônica anterior, preservando sua estratégia e compatibilidade.

## Compatibilidade

Clientes antigos que não enviam `loadout` continuam recebendo a mão inicial legada. Salas persistidas anteriormente não precisam de migração de schema.

## Privacidade

O loadout completo permanece dentro do estado privado do jogador. O snapshot público expõe somente o tamanho da mão, preservando as garantias do espectador e do multiplayer.

## QA visual

A matriz passa a incluir:

- editor de loadout em 1366×768;
- editor de loadout em 390×844.

Critérios:

- cinco slots legíveis;
- ações principais disponíveis no primeiro fluxo de rolagem;
- nenhuma sobreposição com o aplicativo subjacente;
- ausência de overflow horizontal;
- biblioteca, validação e comparação navegáveis por toque;
- rodapé de salvar acessível no celular.

---

**Tehkné Solutions**
