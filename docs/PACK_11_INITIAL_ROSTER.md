# PACK 11 — Roster inicial de produção

## Objetivo

Definir o primeiro lote de quatro personagens do PACK 11 sem introduzir nomes canônicos não confirmados. Até que o roster narrativo oficial seja ligado aos dados do jogo, os quatro personagens usam identificadores de produção estáveis e substituíveis.

## Regra de canonização

- os IDs abaixo são IDs de produção;
- nomes exibidos não devem ser gravados dentro das imagens;
- a troca posterior para IDs narrativos canônicos deve ocorrer somente no manifest;
- os arquivos visuais não podem depender de texto embutido;
- nenhuma integração no runtime público acontece antes da promoção do PACK 99.

## Lote 01

### `hero_vanguard_01`

**Função:** protagonista de linha de frente.

**Silhueta:** armadura média, capa curta, ombreiras assimétricas e arma principal parcialmente visível.

**Leitura emocional:** disciplina, presença e resistência.

**Paleta-base:** aço escuro, dourado envelhecido e acento octarina.

**Estados:** `neutral`, `speaking`, `alert`, `combat`, `victory`, `defeat`.

### `hero_arcanist_01`

**Função:** protagonista de controle arcano.

**Silhueta:** vestes estruturadas, foco mágico próximo ao rosto e detalhes geométricos.

**Leitura emocional:** inteligência, concentração e poder contido.

**Paleta-base:** violeta profundo, azul noturno e luz octarina.

**Estados:** `neutral`, `speaking`, `alert`, `combat`, `victory`, `defeat`.

### `champion_raider_01`

**Função:** campeão agressivo e rival recorrente.

**Silhueta:** armadura pesada fragmentada, cicatrizes visíveis e arma brutal fora do centro.

**Leitura emocional:** ameaça, impulso e orgulho.

**Paleta-base:** ferro queimado, vermelho escuro e âmbar.

**Estados:** `neutral`, `speaking`, `alert`, `combat`, `victory`, `defeat`.

### `faction_oracle_01`

**Função:** líder ou conselheiro de facção.

**Silhueta:** traje cerimonial, halo ou ornamento arcano e mãos parcialmente visíveis.

**Leitura emocional:** autoridade, mistério e controle.

**Paleta-base:** marfim, ouro pálido e octarina luminosa.

**Estados:** `neutral`, `speaking`, `alert`, `combat`, `victory`, `defeat`.

## Regras visuais comuns

- imagem mestre em 1024 × 1024 px;
- exportação de runtime em 256 × 256 px;
- PNG com transparência real;
- enquadramento em busto ou meio-corpo;
- rosto totalmente legível em 256 px;
- iluminação principal vinda do mesmo lado em todos os personagens;
- nenhum texto, logo, moldura ou fundo opaco;
- identidade facial consistente entre os seis estados;
- armas, adornos e efeitos não podem cortar olhos, boca ou contorno principal do rosto.

## Matriz de produção

| Personagem | neutral | speaking | alert | combat | victory | defeat |
| --- | --- | --- | --- | --- | --- | --- |
| hero_vanguard_01 | pendente | pendente | pendente | pendente | pendente | pendente |
| hero_arcanist_01 | pendente | pendente | pendente | pendente | pendente | pendente |
| champion_raider_01 | pendente | pendente | pendente | pendente | pendente | pendente |
| faction_oracle_01 | pendente | pendente | pendente | pendente | pendente | pendente |

## Gate de aprovação

O lote só avança para integração quando os 24 retratos estiverem presentes, aprovados, com hash SHA-256, transparência validada e identidade consistente por personagem.

**Tehkné Solutions**
