# Sprint UI 14 — HUD limpo e combate narrativo

## Problemas observados

A tela de jogo mantinha três colunas permanentes, painéis internos com rolagem e o CTA de encerramento de turno preso ao final do painel lateral. No combate direto, a mão de cartas e o resultado exigiam rolagem vertical, enquanto a resolução calculava toda a troca imediatamente e apresentava principalmente dados textuais.

## Objetivo

Transformar a tela em uma interface de jogo de viewport único, mantendo somente ações indispensáveis sobre o mapa e convertendo informações secundárias em gavetas flutuantes. O combate deve comunicar cada troca como uma pequena cena de RPG, com fala, antecipação, golpe, reação, dano e resumo.

## HUD de partida

- tabuleiro ocupa todo o viewport;
- `html`, `body`, `#root` e a experiência ativa ficam sem rolagem;
- painel de missão, painel de unidades, crônica e topbar originais ficam ocultos durante a partida;
- rodada, fase e pontos de comando permanecem no topo;
- recursos ficam em uma faixa compacta;
- CTA de encerrar turno fica fixo no canto inferior direito;
- janela do Oráculo permanece fixa no canto inferior esquerdo;
- seletor rápido de unidades permanece acessível;
- objetivos, unidades e crônica são acessados por botões flutuantes;
- o menu de campo permite sair da missão e abrir informações secundárias.

## Diálogos em campo

Mudanças no aviso da missão são convertidas em balões inspirados em RPGs clássicos:

- Kael, Lyra, Brakk e forças inimigas recebem identificação própria;
- mensagens sistêmicas são narradas pelo Oráculo de Campo;
- cada balão pode ser fechado por toque;
- a interface respeita movimento reduzido e efeitos leves.

## Combate direto

A arena passa a funcionar sem rolagem vertical:

- cabeçalho, combatentes, intenção, prévia, cartas e CTA cabem em `100dvh`;
- quatro cartas são exibidas em grade no desktop;
- no celular, a mão usa grade 2×2;
- descrições longas e flavor text ficam ocultos durante a decisão;
- nome, custo, arte e atributos essenciais permanecem visíveis;
- o botão de confirmação permanece fixo na composição.

## Sequência cinematográfica

Depois da confirmação, o resumo textual fica temporariamente oculto e a troca segue esta ordem:

1. fala do personagem do jogador;
2. avanço e golpe do jogador;
3. fala do inimigo;
4. contra-ataque inimigo;
5. narração do resultado da troca;
6. liberação do resumo e do botão para continuar.

A sequência usa movimento dos combatentes, cortes de luz, números de dano, som sintetizado e vibração quando habilitados. A lógica de dano e as regras existentes não são alteradas.

## Garantias técnicas

- nenhuma alteração no motor de combate;
- nenhuma alteração em cartas, dano, HP ou ordem de turno;
- nenhum asset remoto novo;
- nenhuma mudança em protocolo ou persistência;
- fallback funcional com movimento reduzido;
- interface secundária pode rolar apenas dentro das gavetas abertas;
- assinatura pública exclusiva da Tehkné Solutions.

## Critérios de validação

- ausência de scrollbar na partida e na arena de combate;
- CTA de turno sempre visível;
- janela informativa sempre visível;
- objetivos e crônica acessíveis sem ocupar o mapa;
- quatro cartas selecionáveis sem rolagem vertical;
- resumo indisponível antes da conclusão da animação;
- diálogos acionados por eventos de movimento e batalha;
- funcionamento em 1366×768 e 390×844;
- TypeScript, Vitest, PWA e campanha aprovados.

---

**Tehkné Solutions**
