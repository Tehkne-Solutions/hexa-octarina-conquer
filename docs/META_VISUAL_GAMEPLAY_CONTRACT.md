# HOC — Contrato oficial da meta visual e arquitetural

## Status

Este documento é obrigatório para toda implementação do tabuleiro principal. As referências visuais aprovadas `HOC-PREVIEW-VISUAL-OBJETO-01/02/03` são a meta. Soluções simplificadas que removam grid, pontos, muros, territórios ou densidade estratégica não atendem ao projeto.

## Leitura visual obrigatória

O jogador deve reconhecer imediatamente:

1. onde cada herói, unidade e construção está;
2. quais pontos pertencem a cada facção;
3. quais pontos são adjacentes e alcançáveis;
4. quais muros/arestas conectam os pontos;
5. quais células e territórios foram fechados;
6. onde começa e termina cada bioma/facção;
7. qual é o objetivo atual e qual ação pode ser executada.

## Estrutura do tabuleiro

- projeção isométrica 2,5D;
- grid lógico real, persistente e alinhado ao cenário;
- pontos/pilares visíveis como nós estratégicos;
- muros/arestas visíveis e coloridos por facção;
- células fechadas com preenchimento territorial;
- caminhos de movimento e ataque desenhados sobre o grid;
- construções ancoradas em células/nós válidos;
- terreno, rios, pontes, desníveis e obstáculos respeitando o grid;
- câmera com visão geral, foco de unidade e foco de objetivo.

## Assets

O jogo deve consumir os assets do PACK 99 pelo registry/runtime. Não é aceitável substituir o PACK 99 por:

- gradientes CSS usados como terreno final;
- SVGs genéricos como personagens finais;
- símbolos Unicode como construções finais;
- retângulos simples como pontes finais;
- placeholders ou arte procedural sem equivalência no pack.

Fallbacks só podem existir para diagnóstico e devem ser visualmente marcados em desenvolvimento. Um build de validação visual deve falhar quando um asset obrigatório cair em fallback.

## Hierarquia da interface

A UI deve seguir as referências aprovadas:

- barra superior compacta de recursos, turno e atalhos;
- painel lateral/portrait para heróis e unidades quando necessário;
- minimapa legível;
- objetivo em painel discreto;
- mão de cartas e habilidades na parte inferior;
- botão de fim de turno destacado, sem cobrir o tabuleiro;
- somente uma instância de cada HUD;
- nenhuma UI de debug no modo normal.

## Loop jogável mínimo

1. selecionar uma unidade;
2. visualizar alcance e rota;
3. mover para um nó válido;
4. visualizar adjacência e alvo;
5. atacar ou usar habilidade/carta;
6. criar, remover ou disputar muros/arestas;
7. fechar território;
8. encerrar turno;
9. observar a ação inimiga;
10. voltar ao controle com estado claramente atualizado.

## Arquitetura obrigatória

Separar explicitamente:

- `BoardModel`: nós, arestas, células, ocupação e regras;
- `BoardProjection`: transformação lógica → isométrica;
- `BoardRenderer`: terreno, muros, pontos, unidades e VFX;
- `RuntimeAssetResolver`: registry, aliases e erros de fallback;
- `InteractionController`: seleção, alcance, movimento e ataque;
- `HudLayer`: recursos, cartas, objetivos e turno;
- `DebugLayer`: disponível apenas em modo de desenvolvimento.

Nenhum componente de tela deve misturar todas essas responsabilidades.

## Critérios de bloqueio

Uma PR visual não pode ser aprovada quando qualquer item abaixo ocorrer:

- personagem sem asset do PACK 99;
- grid lógico invisível ou desalinhado;
- pontos estratégicos indistinguíveis;
- muros/arestas ausentes;
- jogador sem saber para onde pode mover;
- jogador sem saber quem pode atacar;
- HUD duplicada;
- sobreposição que bloqueia ações;
- cenário sem correspondência com a meta aprovada;
- teste automatizado verde enquanto a tela usa fallback obrigatório.

## Próxima implementação

A próxima sprint deve reconstruir a fundação do tabuleiro a partir do modelo lógico e do PACK 99, preservando a jogabilidade existente, porém descartando a arena CSS simplificada como direção visual final.
