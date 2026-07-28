# PACK 11 — Direção visual do lote inicial

## Objetivo

Fechar um padrão reproduzível para os 24 retratos do primeiro lote do PACK 11, preservando identidade entre estados e garantindo leitura em interfaces Web e Godot.

## Padrão global

- fantasia medieval 2,5D estilizada, acabamento premium;
- busto ou meio-corpo, câmera frontal em leve três-quartos;
- silhueta legível em 256 × 256 px;
- mestre em 1024 × 1024 px, PNG RGBA;
- fundo totalmente transparente;
- luz principal superior esquerda e recorte frio discreto à direita;
- contraste concentrado no rosto, olhos e mãos;
- sem texto, moldura, logo, cenário completo ou elementos cortados;
- consistência facial, de traje, materiais e proporções entre os seis estados.

## Personagens

### hero_vanguard_01

Função: herói defensor e referência de liderança.

- silhueta: ombreiras robustas, escudo parcialmente visível, postura estável;
- materiais: aço escovado, couro escuro e tecido azul profundo;
- leitura: confiável, resiliente, disciplinado;
- acento: brilho dourado discreto em emblema central.

### hero_arcanist_01

Função: herói conjurador, inteligência e controle arcano.

- silhueta: manto assimétrico, gola alta, mão canalizando energia;
- materiais: tecido violeta, metal escuro e cristais octarinos;
- leitura: concentrado, observador, poderoso sem exagero;
- acento: energia magenta-ciano contida ao redor da mão.

### champion_raider_01

Função: campeão agressivo, mobilidade e pressão ofensiva.

- silhueta: armadura leve irregular, lâmina curta ou machado parcial;
- materiais: couro avermelhado, ferro gasto e tecido queimado;
- leitura: impetuoso, competitivo, perigoso;
- acento: marcas quentes em laranja e vermelho profundo.

### faction_oracle_01

Função: líder espiritual e ponte narrativa entre facções.

- silhueta: véu, ornamentos suspensos e gesto ritual;
- materiais: tecido claro, bronze envelhecido e gemas translúcidas;
- leitura: sereno, enigmático, autoritativo;
- acento: luminescência octarina verde-azulada.

## Estados obrigatórios

- `neutral`: repouso atento, boca fechada, energia mínima;
- `speaking`: boca em fala natural e gesto leve;
- `alert`: olhos ampliados, tensão corporal e foco lateral;
- `combat`: postura ativa, energia ou arma em evidência sem cobrir o rosto;
- `victory`: alívio, confiança e elevação sutil da postura;
- `defeat`: exaustão e dano leve, sem gore ou deformação.

## Regras de consistência

1. O rosto-base deve permanecer reconhecível nos seis estados.
2. Cabelo, olhos, acessórios, traje e paleta não podem mudar entre variações.
3. A câmera, escala e enquadramento devem permanecer equivalentes.
4. A expressão deve ser a principal diferença entre os estados.
5. Efeitos visuais não podem ultrapassar excessivamente a margem segura.
6. Nenhum retrato pode depender de um fundo para ser compreendido.

## Gate de qualidade

Um personagem só avança quando seus seis estados forem aprovados como conjunto. O lote completo só passa quando os quatro conjuntos estiverem consistentes, transparentes e legíveis em 256 px.