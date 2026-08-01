# META 10.18 — Diagnóstico pós-política simétrica

## Evidência

O baseline de 5.000 partidas executado após a META 10.17 manteve **100% de vitórias Blue**, inclusive quando a iniciativa foi invertida para Red-first.

- Blue-first: 1000/1000 vitórias Blue, média de 5 rodadas.
- Red-first: 1000/1000 vitórias Blue, média de 4 rodadas.
- Baseline 5k: Blue 100%, Red 0%, unresolved 0%.
- Território médio final: Blue 2, Red 0.
- Estruturas Red: a ação `STRUCTURE` permaneceu em 0 ocorrências.

## Conclusão

A iniciativa não explica o viés. A equalização da política do harness também não alterou o vencedor. O próximo eixo a investigar é o **setup espacial inicial**: posições das unidades, estradas iniciais e acesso relativo às células/rotas de fechamento.

O mapa 3×3 inicia Blue com Kael no nó central (`s-1-1`) e Lyra no canto inferior esquerdo, enquanto Red inicia Varg no canto superior direito e Brakk no canto inferior direito. As duas facções possuem duas estradas iniciais, porém a centralidade e as rotas acessíveis não são geometricamente equivalentes.

## Próxima validação

Executar um A/B de espelhamento de setup mantendo regras, HP, dano, orçamento e scorer constantes. Se o lado que herdar a geometria Blue também herdar a dominância, o viés estará isolado no setup espacial e poderá ser corrigido sem buff artificial de facção.

## Observação de CI

O baseline de 5.000 partidas passou funcionalmente e imprimiu o relatório completo, mas excedeu o timeout histórico de 15 s após o scorer simétrico tornar a simulação mais custosa. O timeout do teste deve ser ajustado sem reduzir a amostra.

Tehkné Solutions
