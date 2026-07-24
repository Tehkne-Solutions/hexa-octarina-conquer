# Hexa Octarina Conquer — GDD 2.0

## Living Board Strategy RPG + Tactical TCG

**Assinatura:** Tehkné Solutions  
**Status:** revisão estrutural de game design  
**Objetivo:** substituir o Dots tradicional como núcleo por um tabuleiro vivo de estratégia, invocação, economia territorial e combates táticos por cartas.

---

## 1. Diagnóstico do protótipo atual

A sessão gravada mostrou problemas que não serão resolvidos apenas com efeitos visuais:

1. O jogador desenha linhas antes de entender o significado estratégico delas.
2. A regra de ações extras ao fechar células permite várias jogadas seguidas, mas o HUD não explica por que a IA ainda não jogou.
3. O turno não possui uma fase clara de início, ação e encerramento.
4. O tabuleiro é abstrato demais: pontos, linhas e letras não contam uma história.
5. As cartas parecem botões horizontais, e não objetos colecionáveis de um TCG.
6. Cartas de mapa, construção e combate aparecem juntas, sem contexto.
7. O mapa não cria decisões de terreno, rota, posicionamento, recursos ou formação.
8. A campanha ensina comandos, mas não ensina intenção, fantasia ou estratégia.
9. O início é lento e repetitivo porque o jogador precisa construir o tabuleiro antes de encontrar decisões interessantes.
10. O conflito não tem clímax visual: conquistar uma célula deveria parecer uma vitória territorial.

### Decisão

O sistema atual de arestas será preservado como **regra territorial secundária**, não como ação principal de todos os turnos.

---

## 2. Nova fantasia central

O jogador é um **Arquiteto Octarino**, capaz de invocar campeões nos pontos rúnicos de um mundo fragmentado.

Cada ponto do antigo tabuleiro de Go passa a ser um **Nó de Invocação**. Unidades ocupam nós, projetam influência para os nós vizinhos e disputam liberdade territorial. Quando influências hostis se encontram, ocorre um confronto direto.

Células entre quatro nós representam terrenos reivindicáveis. Após dominar a região, o jogador decide qual estrutura construir:

- Fazenda arcana: produz alimento.
- Mina rúnica: produz pedra e cristais.
- Bosque espiritual: produz madeira e essência.
- Biblioteca alquímica: produz conhecimento.
- Quartel: recruta e fortalece unidades.
- Torre de observação: amplia visão e defesa.
- Fortaleza: protege a região e desbloqueia cartas defensivas.
- Portal Octarino: acelera deslocamento e invocação.

A partida deixa de ser “desenhar quadrados” e passa a ser:

> explorar, invocar, posicionar, disputar, combater, construir e evoluir.

---

## 3. Pilares de design

### 3.1 Tabuleiro vivo

O mapa deve parecer um RPG tático de mesa, inspirado visualmente em aventuras top-down de 16 bits, mas com profundidade 2.5D:

- rios animados;
- florestas balançando;
- ruínas, pontes e elevações;
- aldeões e criaturas ambientais;
- clima e iluminação por capítulo;
- unidades respirando, olhando e reagindo;
- construções crescendo visualmente;
- regiões com identidade própria.

### 3.2 Estratégia por turnos legível

Cada turno possui fases explícitas:

1. **Início do turno** — recursos, efeitos e compra.
2. **Comando** — mover, invocar, construir ou usar carta estratégica.
3. **Conflitos** — confrontos pendentes são resolvidos.
4. **Encerramento** — botão claro “Finalizar turno”.
5. **Turno inimigo** — câmera acompanha a IA e mostra suas ações uma a uma.

Não existirão ações extras invisíveis. Quando uma regra conceder ação adicional, o jogo exibirá:

> “Bônus de conquista: +1 ação de comando”.

### 3.3 Unidades como protagonistas

O jogador controla um pequeno grupo de personagens persistentes, e não peças descartáveis anônimas.

Cada unidade possui:

- classe;
- nível;
- HP;
- ataque;
- defesa;
- velocidade;
- alcance;
- elemento;
- arma;
- armadura;
- habilidade passiva;
- deck pessoal;
- árvore de evolução.

Classes iniciais:

- Guardião Rúnico;
- Arqueira do Éter;
- Alquimista de Campo;
- Conjurador Magitech;
- Batedor Silvestre;
- Engenheiro de Cerco.

### 3.4 Cartas são habilidades da unidade

As cartas não ficam permanentemente abertas como botões de sistema. Cada unidade carrega um deck próprio.

Ao selecionar uma unidade, aparecem as cartas que ela pode usar naquele contexto.

Exemplo:

- arqueira: disparos, armadilhas, mobilidade e precisão;
- guardião: bloqueios, provocações, escudos e contra-ataques;
- alquimista: Molhado, Veneno, Cura e transmutação;
- engenheiro: muralhas, torres, bombas e reparos.

### 3.5 Conflito como evento especial

Quando uma unidade entra na zona de liberdade ou influência de uma unidade inimiga, surge um **Confronto de Fronteira**.

A câmera aproxima o local e abre uma arena lateral inspirada em RPGs táticos por turnos:

- duas unidades ou pequenos grupos frente a frente;
- terreno do conflito preservado;
- cartas na parte inferior;
- energia claramente visível;
- ordem das ações mostrada antes da execução;
- animações curtas e impactantes;
- resultado devolvido ao mapa estratégico.

O confronto decide:

- recuo;
- captura do nó;
- destruição de muralha;
- conquista da célula;
- ferimento da unidade;
- experiência e saque.

---

## 4. Estrutura do tabuleiro

### 4.1 Nós de Invocação

Substituem os pontos abstratos.

Um nó pode estar:

- neutro;
- explorado;
- ocupado;
- energizado;
- bloqueado;
- corrompido.

A unidade ocupa um nó por vez. Algumas unidades podem atacar ou influenciar a distância.

### 4.2 Liberdade inspirada em Go

Cada unidade ou formação possui liberdades: nós adjacentes livres que permitem movimentação, fuga e suporte.

Consequências:

- unidade sem liberdade fica cercada;
- unidade cercada perde energia, defesa ou opção de recuo;
- aliados conectados compartilham suporte;
- inimigo que entra em liberdade contestada inicia conflito;
- controlar rotas e gargalos se torna tão importante quanto causar dano.

### 4.3 Células territoriais

Uma célula é reivindicada quando o jogador controla a maioria de seus quatro nós e vence qualquer conflito pendente.

A muralha não precisa ser desenhada manualmente em todos os lados. Ela é uma consequência visual e estratégica da reivindicação:

- postos surgem nos limites controlados;
- muralhas aparecem onde existe fronteira inimiga;
- estradas aparecem entre células aliadas;
- portões surgem em rotas transitáveis.

O jogador ainda pode usar cartas de engenharia para alterar muralhas e fronteiras.

### 4.4 Terreno

Cada célula possui um terreno:

- planície;
- floresta;
- montanha;
- pântano;
- ruína;
- rio;
- deserto arcano;
- campo magitech.

O terreno altera movimento, defesa, alcance, recursos e cartas disponíveis. Ancient Empires usa tipos de terreno que fornecem bônus defensivos e alteram movimento; essa clareza tática será incorporada ao novo mapa. 

---

## 5. Sistema de turnos

### 5.1 Pontos de Comando

No início do turno, o jogador recebe 3 Pontos de Comando.

Custos sugeridos:

- mover unidade: 1;
- invocar unidade: 2;
- construir: 2;
- usar carta estratégica: 1;
- iniciar ataque: 1;
- reparar: 1;
- finalizar turno: 0.

O jogador pode distribuir os pontos entre unidades diferentes.

### 5.2 Fim de turno explícito

A IA nunca começa “quando o sistema quiser”. O jogador sempre vê:

- ações restantes;
- conflitos pendentes;
- botão Finalizar Turno;
- aviso de ação desperdiçada;
- animação de transição para a IA.

### 5.3 Resolução da IA

A IA executa cada ação separadamente:

1. câmera destaca a unidade;
2. caminho aparece;
3. unidade se move;
4. recurso ou construção é atualizado;
5. conflito é anunciado;
6. animação termina;
7. próxima ação começa.

Velocidade ajustável: normal, rápida ou instantânea.

---

## 6. Sistema TCG

### 6.1 Anatomia da carta

Cada carta deve parecer um artefato mágico colecionável, com leitura clara em tela pequena.

Campos:

- nome;
- ilustração;
- classe da unidade;
- elemento;
- raridade;
- custo de energia;
- ataque;
- defesa ou escudo;
- alcance;
- velocidade;
- alvo;
- texto de efeito;
- palavras-chave;
- símbolo cabalístico;
- lore curto;
- evolução ou nível exigido.

### 6.2 Identidade visual

- moldura dourada ou metálica;
- círculos cabalísticos e runas discretas;
- arte ocupando aproximadamente metade da carta;
- custo no canto superior;
- ataque e defesa em selos inferiores;
- cor por elemento;
- raridade marcada por gemas;
- verso animado Octarino.

### 6.3 Tipos de carta

- Ataque;
- Defesa;
- Técnica;
- Movimento;
- Reação;
- Invocação;
- Construção;
- Equipamento;
- Ultimate.

### 6.4 Combate sequencial

O combate usa turnos curtos e sequenciais. Axie Infinity adotou turnos sequenciais e sistemas explícitos de energia/cartas para acelerar o ritmo e reduzir passividade; o novo sistema seguirá essa leitura clara, sem copiar suas regras literalmente.

Fluxo:

1. jogador escolhe até 3 cartas;
2. custo total é validado;
3. ordem prevista é mostrada;
4. inimigo escolhe ou IA responde;
5. ações são executadas uma a uma;
6. reações podem interromper;
7. conflito termina em até 3 rodadas na maioria dos casos.

---

## 7. Economia territorial

Cada território gera um recurso básico. A construção define como esse recurso será explorado.

Exemplo:

- floresta + serraria: madeira;
- montanha + mina: pedra e cristal;
- planície + fazenda: alimento;
- ruína + biblioteca: conhecimento;
- campo magitech + reator: energia.

Recursos servem para:

- invocar unidades;
- construir;
- aprimorar equipamentos;
- evoluir cartas;
- reparar estruturas;
- desbloquear tecnologias.

O sistema deve produzir decisões semelhantes a jogos de estratégia territorial, mas em escala curta e mobile.

---

## 8. Progressão RPG

Micro RPG enfatiza desbloqueio e melhoria de heróis e armas; essa sensação de coleção e crescimento será aplicada às unidades persistentes da campanha.

### 8.1 Personagens

- nível 1 a 30;
- atributos por nível;
- três caminhos de especialização;
- habilidade Ultimate;
- afinidade elemental;
- vínculos narrativos.

### 8.2 Armas

Cada arma possui:

- nível;
- qualidade;
- ataque base;
- alcance;
- modificadores;
- habilidade associada;
- aparência evolutiva.

### 8.3 Evolução visual

A evolução precisa aparecer no mapa e no combate:

- roupa e silhueta mudam;
- arma cresce ou ganha efeitos;
- novas animações são desbloqueadas;
- aura e ícone indicam especialização.

---

## 9. Campanha viva

A campanha deixa de ser uma lista de objetivos e passa a ser uma jornada visual.

Cada missão possui:

1. storyboard de abertura;
2. diálogo curto no mapa;
3. objetivo visual;
4. evento de gameplay;
5. confronto principal;
6. consequência territorial;
7. recompensa;
8. gancho narrativo.

O tutorial deve ensinar uma decisão por vez:

- missão 1: mover e ocupar um nó;
- missão 2: invocar uma unidade;
- missão 3: iniciar e vencer um confronto;
- missão 4: reivindicar uma célula;
- missão 5: construir uma fonte de recursos;
- missão 6: usar terreno e suporte;
- missão 7: evoluir uma arma;
- missão 8: combinar cartas elementais.

Nenhuma missão começa com oito cartas, vários objetivos e um tabuleiro vazio.

---

## 10. Loop principal

### Durante a missão

1. observar mapa e objetivo;
2. mover ou invocar unidade;
3. capturar nó estratégico;
4. coletar recurso;
5. entrar em conflito;
6. vencer combate por cartas;
7. reivindicar célula;
8. construir;
9. preparar próximo turno;
10. derrotar comandante ou cumprir objetivo.

### Entre missões

1. receber XP e recursos;
2. aprimorar herói;
3. melhorar arma;
4. ajustar deck;
5. desbloquear carta;
6. assistir storyboard;
7. escolher próxima rota da campanha.

---

## 11. Modos de jogo

### Campanha

- narrativa;
- heróis persistentes;
- mapas feitos à mão;
- chefes;
- decisões e rotas.

### Escaramuça solo

- mapas aleatórios;
- IA configurável;
- condições customizadas.

### Multiplayer

- partidas rápidas;
- draft reduzido;
- matchmaking;
- temporadas.

### Desafio diário

- mapa e deck predefinidos;
- objetivo especial;
- ranking por eficiência.

---

## 12. O que será removido ou rebaixado

- Dots tradicional como abertura obrigatória;
- letras ou símbolos como unidades;
- mão inteira sempre aberta;
- turnos automáticos sem confirmação;
- ações extras sem explicação;
- campanha baseada apenas em checklists;
- células vazias sem terreno;
- cartas macro e cartas de duelo misturadas;
- combate resolvido sem cena dedicada.

---

## 13. Vertical slice recomendado

A nova implementação deve provar o jogo com uma única missão completa:

### Missão: A Ponte das Cinzas

- mapa 7×7 de nós;
- rio dividindo o mapa;
- uma ponte central;
- jogador controla Guardião e Arqueira;
- inimigo controla dois Saqueadores;
- objetivo: capturar o moinho além da ponte;
- conflito obrigatório na ponte;
- combate por cartas em tela lateral;
- vitória permite construir uma Fazenda Arcana;
- recurso recebido melhora a arma da Arqueira;
- storyboard final revela o antagonista.

### Critérios

- jogador entende seu primeiro objetivo sem texto longo;
- primeiro conflito ocorre em menos de 90 segundos;
- turno do jogador e da IA são inequivocamente separados;
- cartas parecem itens colecionáveis;
- unidade e construção são reconhecíveis sem legenda;
- missão dura entre 8 e 12 minutos;
- escolha de terreno altera a estratégia;
- vitória produz progresso visível.

---

## 14. Roadmap de reestruturação

### Sprint A — protótipo do tabuleiro vivo

- mapa com terreno;
- nós de invocação;
- movimento por unidade;
- influência e liberdade;
- fim de turno explícito;
- IA visualizada passo a passo.

### Sprint B — conflito e cartas

- arena lateral;
- cartas verticais completas;
- ataque, defesa e energia;
- decks por unidade;
- transição mapa ↔ combate.

### Sprint C — território e economia

- reivindicação de célula;
- construções;
- recursos;
- evolução visual.

### Sprint D — campanha viva

- storyboard;
- diálogos;
- missão A Ponte das Cinzas;
- recompensa e melhoria de arma.

### Sprint E — polimento mobile

- câmera;
- toque;
- acessibilidade;
- áudio;
- onboarding;
- telemetria de abandono e confusão.

---

## 15. Princípio de inovação

O diferencial não será somar jogos conhecidos, mas conectar suas melhores decisões em um ciclo coerente:

- liberdade e cerco de Go;
- clareza tática e terreno de estratégia por turnos;
- emoção e coleção de TCG;
- conquista espacial e construções econômicas;
- progressão de heróis e armas;
- campanha narrativa em um tabuleiro vivo.

O jogador não desenha linhas para completar quadrados. Ele comanda personagens vivos, disputa liberdade, vence confrontos, transforma território e constrói um reino.

---

**Tehkné Solutions**
