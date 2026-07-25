# Sprint UI 12 — Arte narrativa dos capítulos

## Objetivo

Dar identidade visual própria às regiões da campanha sem reabrir o shell, sem adicionar dependências externas e sem prejudicar PWA, offline, acessibilidade ou aparelhos modestos.

## Regiões

### Prólogo Vivo — Vale de Orun

- ponte rúnica;
- cinzas suspensas;
- lua dourada;
- água fria e silhuetas de Kael e Lyra;
- cor principal dourado queimado.

### Capítulo 1 — Planícies Rúnicas

- monólitos de basalto;
- linhas de energia turquesa;
- leitura de território e fundação;
- cor principal turquesa mineral.

### Capítulo 2 — Delta Prismático

- torres alquímicas;
- cristais e canais violeta;
- sensação de convergência e transformação;
- cor principal violeta prismático.

### Capítulo 3 — Fortaleza Magitech

- muralhas rubras;
- engrenagens solares;
- núcleo octarino instável;
- sensação de pressão mecânica;
- cor principal vermelho magitech.

## Implementação

- quatro SVGs locais em `public/assets/chapters`;
- componente reutilizável `CampaignNarrativeArt`;
- temas e tokens em `campaign-narrative.ts`;
- key art nos cards dos capítulos;
- arte ampliada no painel da missão selecionada;
- briefing ilustrado com selo variável por missão;
- região e atmosfera exibidas no mapa e briefing;
- transição leve quando a região selecionada muda;
- nenhum arquivo remoto ou biblioteca adicional.

## Fallback e performance

A camada CSS permanece atrás de cada SVG. Se o arquivo falhar, a paisagem abstrata continua exibindo:

- orbe regional;
- montanhas;
- rota luminosa;
- cor e contraste do capítulo.

As artes usam:

- SVG vetorial;
- lazy loading nos cards do mapa;
- carregamento prioritário apenas no briefing e missão selecionada;
- redução automática de animações;
- remoção de grão e filtros em efeitos leves;
- contraste reforçado no modo de alto contraste.

## Visual QA

A matriz passa de 18 para 24 capturas e inclui:

- mapa rúnico em notebook;
- briefing rúnico em celular;
- briefing alquímico em notebook;
- mapa alquímico em celular;
- briefing magitech em notebook;
- briefing magitech em celular.

O catálogo usado nessas capturas é isolado e existe somente quando `qa=1`; ele não altera campanha, progresso, desbloqueios ou servidor.

## Critérios de aceite

- cada região deve ser reconhecível sem depender do texto;
- briefings devem manter objetivo e CTA no fluxo de rolagem;
- não pode existir overflow horizontal em 390×844;
- notebook 1366×768 deve mostrar arte e conteúdo útil no primeiro viewport;
- falha de asset deve produzir fallback CSS legível;
- `prefers-reduced-motion`, efeitos leves e alto contraste devem continuar respeitados;
- assets devem ser incluídos no build e cache da PWA;
- assinatura pública permanece exclusivamente Tehkné Solutions.

---

**Tehkné Solutions**
