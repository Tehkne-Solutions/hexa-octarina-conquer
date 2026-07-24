# Wireframes do Jogo Unificado

**Produto:** Hexa Octarina Conquer  
**Versão de UX:** 3.0  
**Assinatura:** Tehkné Solutions

---

## 1. Objetivo

Este documento define a arquitetura visual e comportamental da versão única do jogo.

Os wireframes não representam apenas posicionamento. Eles definem:

- prioridade de informação;
- ações principais;
- comportamento responsivo;
- estados vazios;
- transições;
- drawers e modais;
- relação entre tabuleiro, unidades, cartas e objetivos;
- continuidade entre campanha, partida e progressão.

---

## 2. Mapa de telas

```text
BOOT / ATUALIZAÇÃO
        │
        ▼
HOME
├── CONTINUAR CAMPANHA
├── CAMPANHA
│   ├── MAPA DE CAPÍTULOS
│   ├── DETALHE DA MISSÃO
│   ├── STORYBOARD
│   ├── PARTIDA
│   └── RESULTADO
├── ESCARAMUÇA
│   ├── CONFIGURAÇÃO
│   ├── PARTIDA
│   └── RESULTADO
├── MULTIPLAYER
│   ├── LOBBY
│   ├── SALA
│   ├── PARTIDA
│   └── RESULTADO
├── COLEÇÃO
│   ├── UNIDADES
│   ├── CARTAS
│   ├── CONSTRUÇÕES
│   └── DETALHE / EVOLUÇÃO
├── PERFIL
└── CONFIGURAÇÕES
```

---

## 3. Shell global

## Desktop

```text
┌──────────────────────────────────────────────────────────────────────┐
│ LOGO              Campanha  Jogar  Coleção          Perfil  ⚙       │
│                   ─────────                                          │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│                       CONTEÚDO DA TELA                               │
│                                                                      │
├──────────────────────────────────────────────────────────────────────┤
│ servidor online · versão · Tehkné Solutions                          │
└──────────────────────────────────────────────────────────────────────┘
```

### Regras

- header entre 56 e 64 px;
- logo compacta;
- navegação sem pills neon;
- item ativo com filete dourado ou marca entalhada;
- status de conexão discreto;
- footer desaparece durante partida.

## Mobile

```text
┌──────────────────────────────┐
│ LOGO                 perfil  │
├──────────────────────────────┤
│                              │
│       CONTEÚDO DA TELA       │
│                              │
├──────────────────────────────┤
│ Início Campanha Jogar Cartas │
└──────────────────────────────┘
```

### Regras

- navegação inferior com quatro itens;
- configurações dentro do perfil;
- item ativo com cor e forma, não apenas glow;
- respeitar safe area inferior.

---

# 4. Boot e atualização

```text
┌─────────────────────────────────────────┐
│                                         │
│                EMBLEMA                  │
│         HEXA OCTARINA CONQUER           │
│                                         │
│       Preparando o Reino de Orun        │
│       ███████████████░░░  78%           │
│                                         │
│       Sincronizando campanha...         │
│                                         │
│             Tehkné Solutions            │
└─────────────────────────────────────────┘
```

### Estados

- carregando shell;
- conectando ao servidor;
- restaurando conta;
- restaurando partida;
- atualização disponível;
- offline com conteúdo limitado;
- erro recuperável.

### Atualização PWA

```text
┌─────────────────────────────────────┐
│ Uma nova versão do reino chegou     │
│ Melhorias de interface e batalha.   │
│                                     │
│ [Atualizar agora]   [Depois]        │
└─────────────────────────────────────┘
```

Nunca atualizar durante uma ação crítica sem confirmação.

---

# 5. Home

## Desktop

```text
┌──────────────────────────────────────────────────────────────────────┐
│ HEADER                                                               │
├──────────────────────────────────────────────────────────────────────┤
│ ┌────────────────────────────────────┐ ┌───────────────────────────┐ │
│ │ A PONTE DAS CINZAS                 │ │ PERFIL                    │ │
│ │ Ilustração panorâmica              │ │ Arquiteto Nv. 4           │ │
│ │                                    │ │ XP ███████░░              │ │
│ │ Continue de onde parou             │ │ 8 conquistas              │ │
│ │ [CONTINUAR CAMPANHA]               │ └───────────────────────────┘ │
│ └────────────────────────────────────┘ ┌───────────────────────────┐ │
│                                        │ RECOMPENSA DIÁRIA         │ │
│ ┌────────────┐ ┌────────────┐          │ Baú rúnico disponível     │ │
│ │ CAMPANHA   │ │ ESCARAMUÇA │          │ [ABRIR]                   │ │
│ │ História   │ │ Contra IA  │          └───────────────────────────┘ │
│ └────────────┘ └────────────┘                                      │
│ ┌────────────┐ ┌────────────┐                                      │
│ │ MULTI      │ │ COLEÇÃO    │                                      │
│ │ Online     │ │ Unidades   │                                      │
│ └────────────┘ └────────────┘                                      │
└──────────────────────────────────────────────────────────────────────┘
```

## Mobile

```text
┌──────────────────────────────┐
│ Hexa Octarina       Nv. 4    │
├──────────────────────────────┤
│ ┌──────────────────────────┐ │
│ │ A PONTE DAS CINZAS       │ │
│ │ imagem                   │ │
│ │ [CONTINUAR]              │ │
│ └──────────────────────────┘ │
│                              │
│ ┌───────────┐ ┌───────────┐ │
│ │ Campanha  │ │ Escaramuça│ │
│ └───────────┘ └───────────┘ │
│ ┌───────────┐ ┌───────────┐ │
│ │ Multi     │ │ Coleção   │ │
│ └───────────┘ └───────────┘ │
│                              │
│ Recompensa disponível        │
├──────────────────────────────┤
│ Início Campanha Jogar Cartas │
└──────────────────────────────┘
```

### Hierarquia

1. continuar jogo;
2. campanha;
3. escaramuça;
4. multiplayer;
5. coleção;
6. perfil e configurações.

O status “online” não deve competir com as ações.

---

# 6. Mapa da campanha

## Desktop

```text
┌──────────────────────────────────────────────────────────────────────┐
│ ← Início         CAMPANHA · AS CRÔNICAS DE ORUN        ★ 14/36       │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│      [Cap. 1]──────[Cap. 2]──────[Cap. 3 bloqueado]                  │
│          │              │                                            │
│      ●───●───●───●      ●───●───●───●                               │
│      1   2   3   4      5   6   7   8                               │
│          ▲                                                           │
│       missão atual                                                   │
│                                                                      │
│ ┌──────────────────────────────┐ ┌─────────────────────────────────┐ │
│ │ CAPÍTULO 1                   │ │ MISSÃO SELECIONADA              │ │
│ │ Fundamentos Rúnicos          │ │ A Ponte das Cinzas              │ │
│ │ texto narrativo breve        │ │ dificuldade · recompensa       │ │
│ └──────────────────────────────┘ │ [ABRIR MISSÃO]                  │ │
│                                  └─────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────┘
```

## Mobile

```text
┌──────────────────────────────┐
│ ← Campanha        ★ 14/36    │
├──────────────────────────────┤
│ CAPÍTULO 1                   │
│ Fundamentos Rúnicos          │
│                              │
│  ●──●──●──●                  │
│  1  2  3  4                  │
│                              │
│ MISSÃO 2                     │
│ O Quadrado Rúnico            │
│ ★★☆                          │
│ recompensa                   │
│ [ABRIR MISSÃO]               │
│                              │
│ Próximo capítulo             │
│  ●──●──●──●                  │
└──────────────────────────────┘
```

### Comportamento

- scroll horizontal apenas na trilha de missões;
- capítulo atual aberto por padrão;
- bloqueios explicam requisito;
- estrelas mostram progresso, não moeda;
- ilustração e narrativa ficam secundárias em mobile.

---

# 7. Briefing da missão

## Desktop

```text
┌──────────────────────────────────────────────────────────────────────┐
│ ← Campanha                                                           │
├───────────────────────────────────┬──────────────────────────────────┤
│                                   │ MISSÃO 01                        │
│      ILUSTRAÇÃO / STORYBOARD      │ A PONTE DAS CINZAS              │
│                                   │                                  │
│                                   │ O moinho alimenta a vila...      │
│                                   │                                  │
│                                   │ OBJETIVO                         │
│                                   │ Libertar Lyra                    │
│                                   │                                  │
│                                   │ EXTRAS                           │
│                                   │ □ não perder Kael                │
│                                   │ □ terminar em 8 rodadas          │
│                                   │                                  │
│                                   │ RECOMPENSAS                      │
│                                   │ Arco Prismático · 120 XP         │
│                                   │                                  │
│                                   │ [INICIAR MISSÃO]                 │
└───────────────────────────────────┴──────────────────────────────────┘
```

## Mobile

```text
┌──────────────────────────────┐
│ ← Missão 01                  │
├──────────────────────────────┤
│ imagem 16:9                  │
│                              │
│ A PONTE DAS CINZAS           │
│ narrativa curta              │
│                              │
│ Objetivo principal           │
│ Extras                       │
│ Recompensas                  │
│                              │
│ [INICIAR MISSÃO]             │
└──────────────────────────────┘
```

### Regras

- botão iniciar sempre visível ao final;
- objetivo principal em uma frase;
- no máximo três extras;
- recomendações de unidade só aparecem quando relevantes;
- primeira missão oferece “tutorial ligado”.

---

# 8. Storyboard da campanha

```text
┌──────────────────────────────────────────────────────────────────────┐
│ PULAR INTRO                                                          │
│                                                                      │
│                  CENA ILUSTRADA / DIORAMA                            │
│                                                                      │
│ ┌──────────────────────────────────────────────────────────────────┐ │
│ │ KAEL                                                             │ │
│ │ “O moinho ainda está de pé. Isso significa que há esperança.”   │ │
│ └──────────────────────────────────────────────────────────────────┘ │
│                                             [CONTINUAR]              │
│                  ● ● ○ ○                                             │
└──────────────────────────────────────────────────────────────────────┘
```

### Mobile

- imagem ocupa 55–65% da tela;
- caixa de diálogo inferior;
- toque na tela avança;
- texto nunca sobreposto ao rosto do personagem;
- opção de repetir cena no menu da missão.

---

# 9. Partida — desktop

```text
┌────────────────────────────────────────────────────────────────────────────┐
│ A Ponte das Cinzas | Rodada 3 | SEU TURNO | PC ✦✦○ | 🪵2 ◈1 🌾0 | ☰    │
├──────────────┬──────────────────────────────────────────────┬──────────────┤
│ OBJETIVO     │                                              │ UNIDADES     │
│              │                                              │              │
│ Atravesse    │                MAPA CONTÍNUO                 │ [Kael]       │
│ a ponte      │                                              │ HP 18/20     │
│              │      pontos Go + linhas Dots + células       │ ATQ 4 DEF 5  │
│ 1 Libertar ✓ │                                              │              │
│ 2 Ponte   ▶  │       personagens sobre os nós               │ [Lyra]       │
│ 3 Combate 🔒 │                                              │ bloqueada    │
│              │                                              │              │
│ EVENTO       │                                              │ CONTEXTO     │
│ Kael moveu   │                                              │ ação atual   │
├──────────────┴──────────────────────────────────────────────┴──────────────┤
│ MÃO: [carta] [carta] [carta] [carta]          [ENCERRAR TURNO]           │
└────────────────────────────────────────────────────────────────────────────┘
```

### Regras de composição

- mapa recebe 55–65% da largura útil;
- painel esquerdo entre 190 e 240 px;
- painel direito entre 210 e 270 px;
- mão ocupa 170–230 px de altura;
- evento mostra apenas o mais recente;
- histórico completo abre drawer;
- menu nunca cobre o tabuleiro sem backdrop.

---

# 10. Partida — notebook 1366×768

```text
┌──────────────────────────────────────────────────────────────────────┐
│ Missão | R3 | SEU TURNO | PC ✦✦○ | recursos | ☰                    │
├──────────┬───────────────────────────────────────────┬───────────────┤
│ Objetivo │                                           │ Kael / Lyra   │
│ atual    │                TABULEIRO                  │               │
│ + 3 itens│                                           │ painel curto  │
├──────────┴───────────────────────────────────────────┴───────────────┤
│ ◀ [carta] [carta] [carta] [carta] ▶   [ENCERRAR TURNO]             │
└──────────────────────────────────────────────────────────────────────┘
```

### Ajustes obrigatórios

- esconder descrições longas das cartas;
- cartas entre 116 e 132 px de largura;
- painel direito sem biografia;
- objetivo secundário recolhido;
- mapa sem rolagem da página;
- modal de combate usa 92% da altura, com conteúdo interno rolável;
- header máximo de 50–54 px.

---

# 11. Partida — mobile

```text
┌──────────────────────────────┐
│ R3 · SEU TURNO · PC ✦✦○  ☰  │
├──────────────────────────────┤
│ OBJETIVO: Atravesse a ponte  │
├──────────────────────────────┤
│                              │
│       TABULEIRO GO+DOTS      │
│                              │
│                              │
├──────────────────────────────┤
│ Kael · HP 18/20 · Nv. 2      │
│ [trocar unidade]             │
├──────────────────────────────┤
│ ◀ cartas horizontais ▶       │
│ [carta] [carta] [carta]      │
├──────────────────────────────┤
│ [AÇÕES]      [ENCERRAR]      │
└──────────────────────────────┘
```

### Gestos

- toque em unidade seleciona;
- toque em nó válido move;
- toque longo abre detalhe;
- pinça pode ampliar mapa, quando necessário;
- arraste horizontal navega cartas;
- swipe up na unidade abre ficha;
- swipe up no objetivo abre lista completa.

### Regras

- não usar hover;
- botão encerrar turno fixo;
- cartas com snap e seleção tátil;
- tabuleiro nunca menor que 320 px de largura;
- drawers respeitam safe area;
- texto do objetivo limitado a duas linhas.

---

# 12. Tutorial contextual

## Spotlight

```text
┌────────────────────────────────────────────────────┐
│ tela escurecida                                    │
│                                                    │
│              ┌─────────────┐                       │
│              │ NÓ DOURADO  │ ← área iluminada     │
│              └─────────────┘                       │
│                                                    │
│ ┌────────────────────────────────────────────────┐ │
│ │ PASSO 1 · MOVIMENTO                           │ │
│ │ Kael está selecionado. Toque no nó dourado.  │ │
│ │                                  [ENTENDI]    │ │
│ └────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────┘
```

### Sequência inicial recomendada

1. selecionar Kael automaticamente;
2. mover para um nó;
3. explicar linha criada;
4. mostrar PC consumido;
5. destacar Encerrar turno;
6. mostrar ação da IA;
7. devolver controle;
8. liberar Lyra;
9. apresentar combate;
10. explicar conquista territorial.

Uma etapa só avança quando a ação esperada acontece.

---

# 13. Transição do turno da IA

```text
┌──────────────────────────────────────────┐
│              TURNO INIMIGO              │
│                                          │
│  1/2 Varg selecionou uma rota            │
│  2/2 Varg avançou em direção à ponte     │
│                                          │
│  [animação no mapa em segundo plano]     │
└──────────────────────────────────────────┘
```

### Regras

- não usar modal opaco cobrindo completamente o mapa;
- acompanhar a ação com câmera/foco;
- uma ação por vez;
- intervalo curto entre ações;
- resumo de uma linha antes de devolver controle;
- opção de velocidade 1×, 1.5× e 2× nas configurações.

---

# 14. Combate TCG — desktop

```text
┌──────────────────────────────────────────────────────────────────────┐
│ CONFRONTO DE FRONTEIRA · RODADA 1                              ✕    │
├───────────────────────────────┬──────────────────────────────────────┤
│ KAEL                          │ VARG                                 │
│ HP ███████░ 18/20             │ HP █████░░ 12/16                    │
│ ATQ 4 · DEF 5 · VEL 2         │ INTENÇÃO: Golpe brutal              │
│                               │ ATQ 5 · DEF 1 · VEL 1               │
├───────────────────────────────┴──────────────────────────────────────┤
│ PREVISÃO: você causa 6 · recebe 2 · age primeiro                    │
├──────────────────────────────────────────────────────────────────────┤
│     [CARTA 1]  [CARTA 2]  [CARTA 3]  [CARTA 4]                     │
│        1          2                                                   │
│                                                                      │
│ Energia usada: 3/3                         [CONFIRMAR COMBINAÇÃO]    │
└──────────────────────────────────────────────────────────────────────┘
```

### Carta na mão

```text
┌──────────────────────┐
│ 2          ÉPICA     │
│ BARREIRA DE ORUN     │
├──────────────────────┤
│                      │
│     ARTE PRINCIPAL   │
│  círculo cabalístico │
│                      │
├──────────────────────┤
│ GUARDIÃO · PEDRA     │
│ Bloqueia 4 de dano.  │
│ Se agir primeiro...  │
├──────────────────────┤
│ ⚔ 1   ◆ 5   ➤ 2     │
└──────────────────────┘
```

### Estados

- normal;
- recomendada;
- selecionada;
- sem energia;
- bloqueada;
- combo;
- rara/épica/lendária;
- ampliada.

---

# 15. Combate TCG — mobile

```text
┌──────────────────────────────┐
│ CONFRONTO · RODADA 1     ✕   │
├──────────────────────────────┤
│ Kael 18/20   ×   Varg 12/16 │
│ Intenção: ataque pesado      │
│ Previsão: causa 6 / recebe 2 │
├──────────────────────────────┤
│                              │
│     CARTA CENTRAL GRANDE     │
│                              │
│ ◀ carta   carta   carta ▶    │
├──────────────────────────────┤
│ Energia 3/3                  │
│ Ordem: 1 Barreira · 2 Golpe  │
│ [CONFIRMAR]                  │
└──────────────────────────────┘
```

### Comportamento

- uma carta principal central;
- cartas laterais parcialmente visíveis;
- toque amplia;
- botão selecionar dentro do detalhe ou na própria carta;
- ordem mostrada em faixa curta;
- previsão atualiza imediatamente.

---

# 16. Resultado da rodada TCG

```text
┌───────────────────────────────────────────┐
│ RODADA RESOLVIDA                          │
├───────────────────────────────────────────┤
│ Barreira de Orun ativada                  │
│ Kael bloqueou 4                           │
│ Golpe Rúnico causou 6                     │
│ Varg causou 2                             │
│                                           │
│ Kael 16/20          Varg 6/16             │
│                                           │
│ [PRÓXIMA RODADA]                          │
└───────────────────────────────────────────┘
```

Nada deve avançar automaticamente antes de o jogador compreender o resultado, exceto quando a opção “combate rápido” estiver ativa.

---

# 17. Construção territorial

```text
┌────────────────────────────────────────────────────┐
│ TERRITÓRIO REIVINDICADO                            │
│ Moinho do Norte                                    │
├────────────────────────┬───────────────────────────┤
│ FAZENDA ARCANA         │ TORRE RÚNICA              │
│ produção: +2 alimento  │ defesa: +3                │
│ bônus de campanha      │ cartas de fortificação    │
│                        │                           │
│ [CONSTRUIR]            │ [CONSTRUIR]               │
└────────────────────────┴───────────────────────────┘
```

### Mobile

Cards empilhados verticalmente, com comparação resumida no topo.

### Regras

- custo claramente visível;
- recurso insuficiente explica como obter;
- construção aparece na célula antes de fechar o modal;
- primeira missão pode marcar a construção como fornecida pela campanha.

---

# 18. Pós-partida

## Vitória

```text
┌──────────────────────────────────────────────────────┐
│                 MISSÃO CONCLUÍDA                     │
│                 ★ ★ ☆                                │
│                                                      │
│ OBJETIVO PRINCIPAL ✓                                 │
│ Não perder Kael   ✓                                  │
│ Até 8 rodadas     ✕                                  │
│                                                      │
│ RECOMPENSAS                                          │
│ 120 XP · Arco Prismático · 80 ouro                   │
│                                                      │
│ [PRÓXIMA MISSÃO]   [REPETIR]   [MENU]                │
└──────────────────────────────────────────────────────┘
```

## Derrota

```text
┌──────────────────────────────────────────────────────┐
│ A PONTE PERMANECE CERCADA                            │
│                                                      │
│ Causa principal: Kael foi cercado                    │
│ Dica: preserve ao menos duas liberdades              │
│                                                      │
│ [TENTAR NOVAMENTE]   [AJUSTAR DECK]   [MENU]         │
└──────────────────────────────────────────────────────┘
```

### Regras

- sempre explicar o resultado;
- recompensas animadas de forma curta;
- próximo passo dominante;
- não esconder progresso salvo;
- derrota oferece dica contextual baseada na partida.

---

# 19. Coleção

## Desktop

```text
┌──────────────────────────────────────────────────────────────────────┐
│ COLEÇÃO                   Unidades | Cartas | Construções             │
├──────────────────────┬───────────────────────────────────────────────┤
│ FILTROS              │ [Kael] [Lyra] [Varg] [Alquimista]            │
│ classe               │ [....] [....] [....] [....]                  │
│ elemento             │                                               │
│ raridade             │                                               │
│ desbloqueado         │                                               │
└──────────────────────┴───────────────────────────────────────────────┘
```

## Mobile

- filtros em bottom sheet;
- duas colunas;
- busca recolhível;
- tabs fixas no topo;
- toque abre detalhe.

---

# 20. Detalhe e evolução da unidade

```text
┌──────────────────────────────────────────────────────────────────────┐
│ ← Coleção                     KAEL · GUARDIÃO RÚNICO                 │
├──────────────────────────────────┬───────────────────────────────────┤
│                                  │ Nível 4                           │
│       PERSONAGEM / SPRITE        │ HP 24 · ATQ 6 · DEF 8 · VEL 2   │
│                                  │                                   │
│                                  │ ARMA: Lâmina de Orun              │
│                                  │ ARMADURA: Guarda de Bronze        │
│                                  │                                   │
│                                  │ [MELHORAR]                        │
├──────────────────────────────────┴───────────────────────────────────┤
│ DECK DA UNIDADE                                                      │
│ [carta] [carta] [carta] [carta]                                     │
└──────────────────────────────────────────────────────────────────────┘
```

### Evolução

- mostrar antes/depois;
- custo explícito;
- mudanças de sprite quando aplicável;
- arma, armadura e cartas em seções separadas;
- não usar árvore complexa no primeiro release.

---

# 21. Multiplayer

## Lobby

```text
┌──────────────────────────────────────────────────────────────┐
│ MULTIPLAYER                                                  │
├────────────────────────────┬─────────────────────────────────┤
│ PARTIDA RANQUEADA          │ SALAS PERSONALIZADAS            │
│ Rating 1024                │ Código da sala [______]         │
│ Região automática          │ [ENTRAR]                        │
│                            │                                 │
│ [BUSCAR RIVAL]             │ [CRIAR SALA]                    │
└────────────────────────────┴─────────────────────────────────┘
```

### Fila

```text
Buscando rival
Rating alvo: 900–1150
Tempo: 00:18
[Cancelar]
```

### Sala incompleta

- informar claramente que falta rival;
- permitir voltar ao menu;
- permitir iniciar campanha solo;
- tabuleiro bloqueado;
- não exibir “seu turno”.

---

# 22. Perfil

```text
┌──────────────────────────────────────────────────┐
│ PERFIL                                           │
│ Arquiteto · Nv. 4                               │
│ XP █████████░ 780/900                           │
│                                                  │
│ Campanha  8/12 missões                          │
│ Ranking   Prata II                              │
│ Vitórias  12                                    │
│ Conquistas 8/30                                 │
│                                                  │
│ [HISTÓRICO] [CONQUISTAS] [CONTA]                │
└──────────────────────────────────────────────────┘
```

---

# 23. Configurações

Seções:

```text
Jogo
- velocidade da IA
- confirmar encerramento do turno
- tutorial contextual
- combate rápido

Vídeo
- qualidade
- efeitos
- animações reduzidas

Áudio
- música
- efeitos
- voz

Acessibilidade
- tamanho do texto
- contraste
- vibração
- reduzir movimento

Conta
- sessão
- recuperação
- sair
```

No mobile, usar lista com subpáginas, não modal gigante.

---

# 24. Drawer de eventos

```text
┌──────────────────────────────┐
│ HISTÓRICO DA RODADA      ✕   │
├──────────────────────────────┤
│ 14:21 Kael moveu             │
│ 14:22 linha rúnica criada    │
│ 14:23 Varg avançou           │
│ 14:24 confronto iniciado     │
│ 14:25 Kael causou 6          │
└──────────────────────────────┘
```

Eventos técnicos como `room.patch` ou nomes internos nunca aparecem ao jogador.

---

# 25. Estados de conexão

### Online

Ícone discreto, sem mensagem persistente.

### Reconectando

```text
Reconectando à partida…  tentativa 2
```

- banner curto;
- ações bloqueadas;
- estado do mapa preservado;
- botão “tentar novamente” após limite.

### Offline

```text
Sem conexão. Campanha local disponível parcialmente.
```

Somente quando realmente suportado.

---

# 26. Sistema de cards e painéis

## Painel de pedra

Uso:

- HUD;
- objetivo;
- unidade;
- recursos.

Características:

- fundo quase plano;
- borda interna sutil;
- ruído leve;
- sombra curta;
- raio 8–10 px.

## Pergaminho

Uso:

- narrativa;
- briefing;
- detalhes de missão;
- textos longos.

## Bronze/couro

Uso:

- botões principais;
- tabs;
- moldura TCG;
- recompensas.

## Vidro/neon

Não usar como sistema principal. Pode aparecer apenas em magia Octarina rara e por tempo curto.

---

# 27. Regras de microinteração

| Ação | Feedback |
|---|---|
| Selecionar unidade | contorno + som curto + painel atualizado |
| Nó válido | borda, símbolo e hit area ampliada |
| Mover | trilha cresce + PC diminui |
| Linha criada | som material/rúnico |
| Célula fechada | preenchimento territorial + construção habilitada |
| Carta selecionada | sobe 8–12 px + número de ordem |
| Energia insuficiente | carta balança levemente + custo destacado |
| Encerrar turno | confirmação opcional + banner da IA |
| Dano | número localizado + barra atualiza |
| Vitória | pausa curta + selo + recompensas |

Nenhuma animação deve impedir clique por mais de 600 ms, salvo cenas narrativas.

---

# 28. Critérios de aceite visual

## Identidade

- não parece dashboard;
- não parece produto de IA;
- roxo não domina;
- fantasia é reconhecível em screenshot estático;
- cartas são reconhecíveis como TCG;
- tabuleiro é reconhecível como Go + Dots sobre mapa vivo.

## Notebook

- 1366×768 sem corte de ação principal;
- tabuleiro, objetivo, unidade e cartas visíveis;
- modal TCG cabe;
- botão de turno acessível.

## Mobile

- 360 px sem overflow horizontal;
- tabuleiro legível;
- cartas navegáveis;
- toque mínimo adequado;
- drawers fecham facilmente;
- safe areas respeitadas.

## Fluxo

- usuário novo identifica Campanha;
- inicia uma missão sem botão técnico;
- entende a primeira ação;
- entende quando a IA joga;
- entende como escolher cartas;
- entende por que conquistou uma célula;
- entende qual é o próximo passo.

---

# 29. Ordem de implementação dos wireframes

```text
1. Game shell + Home
2. Battle desktop/notebook
3. Battle mobile
4. TCG desktop/mobile
5. Tutorial
6. Campaign map + briefing
7. Post-match
8. Collection + unit detail
9. Multiplayer lobby
10. Profile + settings
```

---

# 30. Tela que define o sucesso da sprint

A tela mais importante é a partida em 1366×768.

Ela deve mostrar simultaneamente:

- objetivo atual;
- Pontos de Comando;
- tabuleiro Go + Dots;
- unidade selecionada;
- mão de cartas;
- botão de encerrar turno.

Se essa tela estiver clara, temática e responsiva, o restante do sistema pode ser construído sobre a mesma fundação.

---

**Tehkné Solutions**
