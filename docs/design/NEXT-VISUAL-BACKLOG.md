# Backlog visual após o Design 3.0

## Estado

O Design 3.0 fechou a unificação do produto, campanha, coleção, perfil, multiplayer, responsividade, PWA, acessibilidade, Visual QA e observabilidade da experiência.

A próxima evolução não deve reabrir o shell. Ela deve substituir abstrações visuais e ampliar modos dentro da arquitetura consolidada.

## P0 — Experiência jogável

### 1. Assets finais de personagens e construções

- substituir símbolos provisórios por personagens ilustrados ou GLB;
- manter silhueta e leitura por facção;
- criar estados neutro, selecionado, ferido e derrotado;
- validar peso, atlas, lazy loading e fallback.

### 2. Feedback de combate

- impacto visual e sonoro por tipo de carta;
- leitura de dano, bloqueio e vantagem;
- vibração opcional em dispositivos compatíveis;
- redução automática conforme preferências de movimento e efeitos.

### 3. Pós-partida cinematográfico

- resumo da batalha;
- progressão e recompensas;
- destaques táticos;
- ação clara para repetir, avançar ou retornar ao mapa.

## P1 — Conteúdo e retenção

### 4. Espectador e replay no shell web

- lista pública de partidas;
- timeline por revisão;
- controles de pausa, velocidade e salto;
- nenhuma exposição de mãos ou tokens privados.

### 5. Evolução da coleção

- comparação de cartas;
- decks e loadouts;
- evolução visual por domínio;
- origem e missão de cada recompensa.

### 6. Onboarding de conta

- entrada como visitante sem bloqueio;
- sincronização explicada no momento correto;
- recuperação de acesso dentro do shell unificado;
- migração segura do progresso local.

## P2 — Acabamento premium

### 7. Arte narrativa dos capítulos

- key art por região;
- ilustrações de briefing;
- transições leves entre capítulos;
- fallback em CSS para offline e aparelhos modestos.

### 8. Temas de tabuleiro

- moinho de Orun;
- ruínas prismáticas;
- fortaleza de cinzas;
- variações que não prejudiquem contraste ou coordenadas.

### 9. Áudio e ambientação

- trilha adaptativa;
- ambientes por capítulo;
- controles separados para música, efeitos e interface;
- política de autoplay compatível com PWA.

## Regras de execução

- não criar um segundo cliente público;
- preservar campanha e multiplayer no mesmo battle shell;
- exigir screenshots da Visual QA Matrix em todo ajuste de UI;
- medir performance e erros pelas ferramentas da Sprint UI 07;
- manter a assinatura exclusiva da Tehkné Solutions;
- não enviar telemetria pessoal ou conteúdo de partidas.

---

**Tehkné Solutions**
