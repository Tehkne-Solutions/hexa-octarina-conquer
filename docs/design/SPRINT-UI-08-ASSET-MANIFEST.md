# Sprint UI 08 — Manifesto de assets finais

## Objetivo

Substituir abstrações provisórias do vertical slice por assets vetoriais reutilizáveis, mantendo leitura em notebook e celular, funcionamento offline e baixo custo de carregamento.

## Personagens

| ID | Personagem | Função | Facção | Estados |
|---|---|---|---|---|
| `HOC-CHR-KAEL-001` | Kael | Guardião Rúnico | Orun | neutro, selecionado, ferido, derrotado |
| `HOC-CHR-LYRA-001` | Lyra | Arqueira Prismática | Orun | selada, neutra, selecionada, ferida, derrotada |
| `HOC-CHR-RAIDER-001` | Saqueador | Invasor | Cinzas | neutro, ferido, derrotado |
| `HOC-CHR-BRAKK-001` | Brakk | Capitão do Moinho | Cinzas | elite, neutro, ferido, derrotado |

### Implementação

- componente: `FantasyUnitSprite.tsx`;
- formato: SVG inline;
- sem requisição de imagem externa;
- silhueta e paleta diferenciadas por função e facção;
- estado calculado a partir de HP, atividade, derrota e seleção;
- redução de animação e efeitos respeitada pelo shell.

## Construções

| ID | Construção | Tipo | Estados |
|---|---|---|---|
| `HOC-BLD-MILL-001` | Moinho do Norte | marco territorial | neutro |
| `HOC-BLD-FARM-001` | Fazenda Arcana | produção e recuperação | prévia, construída, danificada |
| `HOC-BLD-TOWER-001` | Torre Rúnica | defesa e controle | prévia, construída, danificada |

### Implementação

- componente: `FantasyBuildingSprite.tsx`;
- formato: SVG inline;
- aplicado no tabuleiro, seletor de construção e pós-partida;
- fallback estrutural preservado por texto e `aria-label`;
- animações desativadas em movimento reduzido e efeitos leves.

## Feedback de combate

| ID | Evento | Saída visual | Saída opcional |
|---|---|---|---|
| `HOC-FX-HIT-LIGHT-001` | dano 0–2 | flash e números leves | som sintético e vibração curta |
| `HOC-FX-HIT-MEDIUM-001` | dano 3–5 | cortes cruzados médios | som sintético e vibração média |
| `HOC-FX-HIT-HEAVY-001` | dano 6+ | impacto ampliado | som sintético e vibração forte |

- som e vibração possuem controles dentro da arena;
- preferências são locais;
- feedback nunca bloqueia a resolução da rodada;
- movimento reduzido desativa os efeitos de impacto.

## Pós-partida

| ID | Tela | Conteúdo |
|---|---|---|
| `HOC-OUTCOME-VICTORY-001` | vitória | rodadas, territórios, destaques, arma, construção, avançar ou repetir |
| `HOC-OUTCOME-DEFEAT-001` | derrota | rodadas, leitura tática, retorno ao mapa ou nova tentativa |

A camada cinematográfica utiliza os mesmos resultados e botões do motor existente. Nenhuma regra de campanha foi duplicada.

## Critérios de validação

- sem overflow horizontal em 390×844;
- tabuleiro utilizável em 1366×768;
- assets legíveis em tamanho compacto;
- ausência de requisições externas de imagem;
- testes de classificação de estado e intensidade;
- Visual QA Matrix obrigatória;
- telemetria apenas operacional e anônima.

---

**Tehkné Solutions**
