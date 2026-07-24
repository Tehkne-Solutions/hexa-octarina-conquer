# Sprint de Unificação do Jogo, Overhaul de UI/UX e Responsividade

**Produto:** Hexa Octarina Conquer  
**Status:** Planejamento aprovado para implementação  
**Assinatura:** Tehkné Solutions

---

## 1. Decisão de produto

O jogo passará a ter **uma única versão pública e oficial**.

A experiência atualmente exposta por `?mode=living-board` deixa de ser um protótipo paralelo e passa a ser o núcleo padrão do produto. O cliente legado continua temporariamente no repositório apenas como referência técnica e fallback de desenvolvimento, sem botão público, sem rota promocional e sem participação na navegação normal.

### Resultado esperado

Ao abrir a URL principal, o usuário deve encontrar:

1. identidade visual única;
2. menu principal único;
3. campanha, escaramuça e multiplayer no mesmo shell;
4. tabuleiro híbrido Go + Dots como base de todas as partidas;
5. combate TCG, unidades, recursos, construções e progressão no mesmo fluxo;
6. nenhuma menção a GDD, protótipo, modo de teste ou versão alternativa.

---

## 2. Problemas que a sprint resolve

### Produto fragmentado

O `main.tsx` decide entre `App` e `GoDotsLivingBoardDemo` por query string e ainda exibe um launcher público. Isso cria duas experiências concorrentes, dois estilos visuais e dois caminhos de manutenção.

### Direção visual inadequada

A interface atual depende de:

- roxo e azul escuro como base;
- glow aplicado a quase todos os estados;
- muitos gradientes;
- painéis com estética de dashboard SaaS;
- glassmorphism;
- excesso de cards arredondados;
- baixa materialidade de fantasia.

### Responsividade insuficiente

A composição foi criada para telas grandes, mas não funciona bem em notebooks de 1366×768. Painéis laterais disputam espaço com o tabuleiro, cartas ocupam área excessiva, modais ultrapassam a altura disponível e o mobile depende demais de rolagem.

### Hierarquia e onboarding frágeis

- muitas mensagens competem pela atenção;
- o objetivo atual não domina a tela;
- turno, ações, seleção e consequência nem sempre são óbvios;
- IA, movimento e combate mudam de contexto sem transições consistentes;
- cartas apresentam conteúdo, mas ainda não operam como uma mão TCG clara.

---

## 3. Objetivo da sprint

Entregar a fundação de uma versão única, responsiva e visualmente coerente com um jogo de fantasia tática e TCG.

### Objetivos mensuráveis

- remover o launcher público do GDD;
- iniciar o produto diretamente no novo shell;
- suportar 1366×768 sem elementos críticos cortados;
- suportar mobile entre 360×740 e 430×932 sem zoom manual;
- reduzir glow e gradientes decorativos em pelo menos 70%;
- consolidar tokens de cor, espaçamento, borda, sombra e tipografia;
- tornar o tabuleiro a maior área útil durante uma partida;
- manter campanha, conta, WebSocket e multiplayer existentes;
- garantir uma sequência tutorial compreensível sem conhecimento prévio.

---

## 4. Fora do escopo desta sprint

- produção de ilustrações finais em alta resolução;
- animação frame a frame dos personagens;
- migração completa do vertical slice para o servidor autoritativo;
- expansão de capítulos da campanha;
- balanceamento definitivo das cartas;
- novos modos competitivos;
- loja, monetização ou passe de temporada;
- dublagem e trilha sonora final.

Esses itens podem ser preparados visualmente, mas não bloqueiam a entrega.

---

## 5. Princípios de design

### Uma ação principal por contexto

Cada tela deve ter uma ação dominante. A interface não deve apresentar campanha, multiplayer, coleção, configurações e conteúdo técnico ao mesmo tempo.

### O tabuleiro é o protagonista

Durante a partida, o mapa deve ocupar a maior área possível. Painéis secundários tornam-se compactos, recolhíveis ou contextuais.

### Fantasia material, não dashboard

A interface deve parecer construída com:

- pedra;
- bronze;
- madeira;
- couro;
- pergaminho;
- tecido;
- runas.

O jogo não deve parecer uma ferramenta de IA, painel administrativo ou aplicativo corporativo.

### Glow é consequência, não decoração

Brilho deve indicar apenas:

- seleção;
- magia ativa;
- raridade;
- alvo prioritário;
- conquista;
- perigo.

Não deve ser aplicado permanentemente a todos os painéis.

### Clareza antes de ornamentação

- texto principal sempre legível;
- ícones acompanhados de rótulo na primeira exposição;
- contraste mínimo AA para texto funcional;
- animações nunca escondem estado persistente;
- feedback de ação em até 150 ms;
- transições de contexto entre 220 e 450 ms.

---

## 6. Arquitetura pública unificada

### Entrada atual a remover

```tsx
const livingBoardActive = pageUrl.searchParams.get("mode") === "living-board";

{livingBoardActive ? (
  <GoDotsLivingBoardDemo />
) : (
  <>
    <App />
    <button>Testar GDD 2.1</button>
  </>
)}
```

### Entrada alvo

```tsx
<GameApp />
```

`GameApp` controla as telas internas por estado ou roteamento leve:

```text
boot
home
campaign-map
mission-briefing
battle
collection
profile
settings
multiplayer-lobby
post-match
```

### Legado

O cliente antigo fica acessível apenas quando:

```text
VITE_ENABLE_LEGACY_CLIENT=true
```

E somente por uma rota não divulgada:

```text
/dev/legacy
```

Em produção, a flag deve ser `false`.

---

## 7. Estrutura de componentes proposta

```text
client/web/src/
├── app/
│   ├── GameApp.tsx
│   ├── GameRouter.tsx
│   ├── game-state.ts
│   └── screens.ts
├── design-system/
│   ├── tokens.css
│   ├── typography.css
│   ├── surfaces.css
│   ├── buttons.css
│   ├── icons.tsx
│   └── components/
├── shell/
│   ├── GameShell.tsx
│   ├── TopBar.tsx
│   ├── BottomNavigation.tsx
│   ├── SideDrawer.tsx
│   └── ConnectionStatus.tsx
├── home/
│   ├── HomeScreen.tsx
│   └── ModeCard.tsx
├── campaign/
│   ├── CampaignMapScreen.tsx
│   ├── MissionBriefingScreen.tsx
│   └── StoryFrame.tsx
├── battle/
│   ├── BattleScreen.tsx
│   ├── GoDotsBoard.tsx
│   ├── TurnHud.tsx
│   ├── ObjectiveHud.tsx
│   ├── UnitRoster.tsx
│   ├── ResourceHud.tsx
│   ├── CombatDrawer.tsx
│   ├── TcgHand.tsx
│   └── BuildTerritoryModal.tsx
├── cards/
│   ├── TcgCard.tsx
│   ├── CardDetailModal.tsx
│   └── CardFan.tsx
├── collection/
│   ├── CollectionScreen.tsx
│   └── UnitDetailScreen.tsx
└── responsive/
    ├── useViewportMode.ts
    └── viewport-types.ts
```

Não é obrigatório mover todos os arquivos no primeiro commit. Essa estrutura é o destino de consolidação.

---

## 8. Design system

### Paleta principal

```css
:root {
  --color-ink-950: #11120f;
  --color-ink-900: #191b17;
  --color-slate-800: #2c332f;
  --color-slate-700: #3c4740;

  --color-parchment-100: #f3e8ca;
  --color-parchment-200: #dfcfaa;
  --color-parchment-300: #c5ad7d;

  --color-bronze-300: #c6974f;
  --color-bronze-500: #8d642f;
  --color-bronze-700: #583b1f;

  --color-moss-300: #88a765;
  --color-moss-500: #526b3f;
  --color-moss-700: #31432d;

  --color-rune-blue: #5ca7bf;
  --color-rune-gold: #e3b85c;
  --color-enemy-rust: #a84e3d;
  --color-danger: #c64d43;
  --color-success: #6f9d5e;
}
```

### Regras de cor

- fundo geral: grafite e ardósia, nunca roxo saturado;
- painéis: pedra, couro ou pergaminho escurecido;
- ação principal: bronze/dourado;
- jogador: azul rúnico moderado;
- inimigo: ferrugem/vermelho escuro;
- seleção: borda clara + sombra curta;
- magia: glow localizado com raio máximo de 12–18 px.

### Gradientes

Permitidos apenas para:

- simulação de metal;
- profundidade do terreno;
- iluminação de carta rara;
- céu e cenário;
- estados cinematográficos.

Não permitidos como preenchimento padrão de todo card ou painel.

### Raios

```text
Botões pequenos: 6 px
Painéis: 8–12 px
Modais: 12 px
Cartas TCG: 8 px
Pills/status: 999 px somente quando semanticamente necessário
```

### Sombras

```text
Pequena: 0 2px 4px rgba(0,0,0,.35)
Média: 0 6px 14px rgba(0,0,0,.38)
Elevada: 0 14px 30px rgba(0,0,0,.45)
```

Evitar sombras difusas maiores que 40 px em componentes comuns.

### Tipografia

- títulos narrativos: serifada de fantasia legível;
- interface: sans serif compacta e funcional;
- números/recursos: tabular numerals;
- textos de carta: tamanho mínimo de 12 px em notebook e 11 px no mobile;
- corpo normal nunca abaixo de 13 px no mobile.

---

## 9. Breakpoints oficiais

### `mobile-compact`

```text
360×740 até 389×844
```

### `mobile`

```text
390×844 até 479×960
```

### `tablet`

```text
768×1024 até 1023×1366
```

### `notebook`

```text
1024×640 até 1439×899
```

O alvo mínimo obrigatório é:

```text
1366×768
```

### `desktop`

```text
1440×900 ou maior
```

### Estratégia

Não usar apenas largura. Considerar também altura:

```css
@media (max-height: 800px) { ... }
@media (max-height: 700px) { ... }
```

O jogo deve compactar header, cartas e painéis quando a altura for limitada.

---

## 10. Layout-alvo por viewport

### Desktop

```text
┌─────────────────────────────────────────────────────────────┐
│ Top bar: missão | turno | recursos | conexão | menu         │
├──────────────┬──────────────────────────────┬───────────────┤
│ Objetivo     │                              │ Unidades       │
│ e eventos    │          TABULEIRO           │ e contexto     │
│              │                              │               │
├──────────────┴──────────────────────────────┴───────────────┤
│ Mão TCG / ações contextuais / Encerrar turno                │
└─────────────────────────────────────────────────────────────┘
```

### Notebook 1366×768

```text
┌─────────────────────────────────────────────────────────────┐
│ Header compacto                                              │
├──────────┬─────────────────────────────────────┬─────────────┤
│ Objetivo │              TABULEIRO              │ Unidades    │
│ compacto │                                     │ compacto    │
├──────────┴─────────────────────────────────────┴─────────────┤
│ Cartas reduzidas em leque + ações                            │
└─────────────────────────────────────────────────────────────┘
```

Regras:

- header máximo de 52 px;
- painel lateral entre 190 e 230 px;
- cartas visíveis com 150–176 px de altura;
- tabuleiro recebe pelo menos 54% da largura útil;
- logs ficam em drawer, não em painel fixo.

### Mobile

```text
┌───────────────────────────┐
│ Turno | PC | menu         │
├───────────────────────────┤
│ Objetivo atual recolhível │
├───────────────────────────┤
│                           │
│        TABULEIRO          │
│                           │
├───────────────────────────┤
│ Unidade selecionada       │
├───────────────────────────┤
│ Cartas em carrossel/leque │
├───────────────────────────┤
│ Encerrar turno | ação     │
└───────────────────────────┘
```

Regras:

- tabuleiro deve usar entre 45 e 58% da altura;
- mão TCG é horizontal, com snap;
- detalhes abrem em bottom sheet;
- objetivos e log usam drawers;
- botão de turno permanece fixo;
- nenhuma interação crítica depende de hover.

---

## 11. Backlog priorizado

## P0 — Bloqueadores de unificação

### UNI-001 — Remover bifurcação pública

**Descrição:** remover query string como seletor da versão oficial e retirar o botão “Testar GDD 2.1”.

**Arquivos principais:**

- `client/web/src/main.tsx`
- `client/web/src/App.tsx`
- `client/web/src/living-board-launcher.css`

**Critérios de aceite:**

- URL principal abre a versão unificada;
- não existe launcher GDD em produção;
- `?mode=living-board` redireciona para a URL limpa ou funciona como alias temporário;
- cliente legado só aparece com flag de desenvolvimento.

### UNI-002 — Criar GameApp e shell único

**Descrição:** extrair autenticação, conexão, menu e modos para um shell comum.

**Critérios de aceite:**

- campanha e multiplayer não recriam header e navegação;
- estado da conta sobrevive à troca de telas;
- conexão WebSocket permanece ativa;
- retorno ao menu não reinicia a aplicação inteira.

### UNI-003 — Definir estado de navegação

**Descrição:** centralizar as telas válidas e transições.

**Critérios de aceite:**

- back do navegador funciona de forma previsível;
- atualizar a página preserva a tela segura possível;
- partida ativa pede confirmação antes de sair;
- telas técnicas não ficam acessíveis por acidente.

### UX-001 — Design tokens

**Descrição:** criar tokens globais e eliminar cores duplicadas espalhadas nos CSS.

**Critérios de aceite:**

- nenhuma nova tela usa hexadecimal direto fora dos tokens;
- roxo não é cor de fundo principal;
- glow decorativo permanente é removido;
- todos os estados possuem contraste suficiente.

### RWD-001 — Notebook 1366×768

**Descrição:** adaptar battle shell para altura limitada.

**Critérios de aceite:**

- header, tabuleiro, cartas e botão de turno aparecem sem scroll vertical da página;
- painel lateral pode rolar internamente;
- modal TCG cabe na viewport;
- texto funcional permanece legível.

### RWD-002 — Mobile PWA

**Critérios de aceite:**

- 360×740 sem overflow horizontal;
- safe areas aplicadas;
- orientação retrato funcional;
- landscape melhora o tabuleiro, mas não é obrigatória;
- toque mínimo de 44×44 px.

---

## P1 — Experiência principal

### UI-001 — Home unificada

- campanha como CTA principal;
- continuar missão quando houver progresso;
- escaramuça e multiplayer secundários;
- coleção, perfil e configurações como navegação persistente;
- status de conexão discreto.

### UI-002 — HUD de batalha

- objetivo atual dominante;
- Pontos de Comando claros;
- fase atual;
- unidade selecionada;
- recursos;
- botão de encerrar turno;
- eventos recentes limitados a três.

### UI-003 — Tabuleiro responsivo

- escala baseada na área disponível;
- zoom e pan apenas quando necessário;
- nós com hit area ampliada invisível;
- linhas, células e sprites sem depender de tamanho fixo;
- labels de cenário recolhíveis em mobile.

### UI-004 — Cartas TCG reais

- orientação vertical;
- arte ocupando 45–52% da carta;
- nome, custo, raridade e elemento fixos;
- ATQ/DEF/VEL em posição constante;
- descrição resumida na mão;
- descrição completa em modal;
- seleção com ordem de execução.

### UX-002 — Tutorial contextual

- uma regra por vez;
- spotlight no alvo;
- confirmação visual e sonora;
- IA bloqueada até a instrução terminar;
- opção “mostrar novamente”;
- opção “pular tutorial” para jogadores recorrentes.

### UX-003 — Turno e IA

- início de turno com banner curto;
- PC recebidos e gastos animados;
- botão de encerrar turno sempre visível;
- IA executa ação por ação;
- câmera/foco acompanha apenas a ação relevante;
- resumo final da IA antes de devolver controle.

---

## P2 — Polimento

### ART-001 — Materiais e superfícies

- pedra, couro, bronze, pergaminho;
- texturas leves e otimizadas;
- sem ruído que prejudique leitura;
- fallback sem textura.

### ART-002 — Sprites básicos consistentes

- escala única;
- sombra de contato;
- silhueta reconhecível;
- estados idle, selected, damaged e defeated;
- paleta por facção.

### A11Y-001 — Acessibilidade

- navegação por teclado no desktop;
- aria-label em ações;
- `prefers-reduced-motion`;
- modo de alto contraste futuro preparado;
- cor nunca é o único indicador.

### PERF-001 — Performance

- JS inicial abaixo de 400 KB comprimido, quando possível;
- imagens lazy-loaded;
- evitar filtros SVG caros em dezenas de elementos;
- 50–60 FPS durante movimento em dispositivos médios;
- service worker sem manter versões incompatíveis indefinidamente.

---

## 12. Plano de execução — 10 dias úteis

### Dia 1 — Fundação

- criar `GameApp`;
- remover launcher público;
- definir telas e navegação;
- preservar login e conexão.

### Dia 2 — Design tokens

- cores;
- tipografia;
- espaçamento;
- superfícies;
- sombras;
- botões.

### Dia 3 — Home e shell

- home unificada;
- top bar;
- navegação;
- conexão;
- instalação PWA.

### Dia 4 — Battle shell desktop/notebook

- tabuleiro dominante;
- painéis compactos;
- HUD de turno;
- recursos;
- objetivo.

### Dia 5 — Cartas TCG

- card component;
- mão em leque;
- detalhe;
- seleção e ordem;
- intenção inimiga.

### Dia 6 — Responsividade mobile

- bottom sheets;
- carrossel de cartas;
- drawers;
- safe areas;
- touch targets.

### Dia 7 — Tutorial e IA

- spotlight;
- sequência guiada;
- fases da IA;
- feedback de ações.

### Dia 8 — Campanha e pós-partida

- mapa;
- briefing;
- vitória/derrota;
- recompensas;
- progressão.

### Dia 9 — QA visual e funcional

- matriz de viewports;
- navegadores;
- reconexão;
- cache PWA;
- campanha e multiplayer.

### Dia 10 — Correções e deploy

- correção P0/P1;
- screenshots comparativos;
- smoke test Render;
- merge;
- manual de validação.

---

## 13. Matriz de testes

| Ambiente | Viewport | Obrigatório |
|---|---:|---|
| Chrome Windows | 1366×768 | Sim |
| Edge Windows | 1366×768 | Sim |
| Chrome Windows | 1920×1080 | Sim |
| Chrome Android | 360×800 | Sim |
| Chrome Android | 412×915 | Sim |
| Samsung Internet | 360×800 | Recomendado |
| Safari iOS | 390×844 | Recomendado |
| PWA instalada | Android | Sim |
| Aba anônima | Desktop/mobile | Sim |

### Cenários funcionais

1. primeiro acesso como visitante;
2. login e retorno ao menu;
3. iniciar campanha;
4. mover unidade;
5. encerrar turno;
6. observar IA;
7. iniciar combate TCG;
8. escolher cartas;
9. ocupar território;
10. construir;
11. terminar missão;
12. reconectar após atualização;
13. iniciar multiplayer;
14. sair de sala incompleta;
15. atualizar service worker.

---

## 14. Definition of Done

A sprint só pode ser considerada concluída quando:

- existe uma única experiência pública;
- não há botão GDD/protótipo;
- URL principal abre o novo shell;
- notebook 1366×768 é jogável;
- mobile 360×740 é jogável;
- campanha e multiplayer continuam operacionais;
- cartas parecem TCG, não botões de dashboard;
- roxo/glow deixam de dominar a interface;
- tabuleiro ocupa a maior parte da partida;
- tutorial informa claramente o que fazer;
- testes PWA, Docker e servidor passam;
- Render publica a versão sem intervenção manual especial;
- documentação e screenshots são atualizados.

---

## 15. Riscos e mitigação

### Risco: reescrever demais ao mesmo tempo

**Mitigação:** manter protocolo, backend e dados; trocar primeiro shell, componentes e CSS.

### Risco: quebrar campanha legada

**Mitigação:** adaptar `CampaignScreen` gradualmente ao novo shell, preservando contratos.

### Risco: responsividade tratada só no final

**Mitigação:** cada componente deve ser validado em notebook e mobile no mesmo PR.

### Risco: excesso de ornamentação

**Mitigação:** toda textura e moldura deve passar pelo teste “melhora hierarquia ou apenas decora?”.

### Risco: cache PWA mostrar versões diferentes

**Mitigação:** versão explícita do shell, aviso de atualização e estratégia de ativação controlada.

---

## 16. Ordem de implementação recomendada

```text
Unificação de entrada
→ Game shell
→ Design tokens
→ Battle shell responsivo
→ Cartas TCG
→ Tutorial
→ Campanha e home
→ QA
→ Deploy
```

Nenhuma nova missão ou sistema deve entrar antes de UNI-001, UNI-002, UX-001, RWD-001 e RWD-002 estarem concluídos.

---

**Tehkné Solutions**
