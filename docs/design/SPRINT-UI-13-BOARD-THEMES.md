# Sprint UI 13 — Temas regionais de tabuleiro

## Objetivo

Aplicar cenários próprios ao combate e ao replay sem alterar coordenadas, regras, hitboxes, protocolo ou persistência.

## Temas

### Moinho de Orun

- Vale verde e madeira antiga.
- Água, ponte e construções rurais preservadas.
- Runas douradas e atmosfera de reconstrução.
- Tema padrão do prólogo e do Capítulo 1.

### Ruínas Prismáticas

- Piso azul-violeta.
- Cristais, energia ciano e névoa octarina.
- Ruínas e canais realçados.
- Tema padrão do Capítulo 2.

### Fortaleza de Cinzas

- Pedra escura, ferro e brasas.
- Silhueta de muralhas e torres.
- Runas laranja e atmosfera de cerco.
- Tema padrão do Capítulo 3 e das arenas multiplayer sem missão regional.

## Contrato técnico

O módulo `board-theme.ts` concentra:

- IDs válidos;
- metadados;
- mapeamento de missão e capítulo;
- overrides de URL para QA;
- aplicação semântica por `data-board-theme`.

O componente `BoardThemeRuntime` aplica os temas aos dois tabuleiros existentes:

- `GoDotsBoard`, utilizado pela campanha viva;
- `Board`, utilizado pela campanha autoritativa, multiplayer e replay.

Nenhum cálculo de posição é alterado. A implementação usa somente atributos e CSS.

## Contraste competitivo

As cores de propriedade continuam fixas e independentes do cenário:

- jogador: ciano;
- inimigo: coral;
- contestado: dourado.

Províncias, trilhas e pilares mantêm contornos claros sobre os três fundos.

## Acessibilidade e desempenho

- `prefers-reduced-motion` remove animações.
- Efeitos leves removem camadas decorativas.
- Alto contraste reforça linhas, pilares e textos.
- `forced-colors` remove decoração não essencial.
- As camadas regionais não recebem eventos de ponteiro.

## Visual QA

A matriz passa de 24 para 30 capturas, adicionando:

- Moinho de Orun em combate, notebook e celular;
- Ruínas Prismáticas em replay, notebook e celular;
- Fortaleza de Cinzas em combate, notebook e celular.

## Garantias

- sem alteração no motor;
- sem alteração no protocolo;
- sem migração de banco;
- sem novos assets remotos;
- sem mudança nas coordenadas ou hitboxes;
- assinatura pública exclusiva da Tehkné Solutions.

---

**Tehkné Solutions**
