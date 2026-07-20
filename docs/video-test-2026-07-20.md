# Análise do teste em vídeo — 20/07/2026

O vídeo de 36 segundos confirmou falhas de usabilidade na primeira missão da campanha:

- o jogador seleciona vários pilares, mas não sabe que precisa escolher dois pontos ortogonalmente adjacentes;
- quando o segundo ponto não é válido, a seleção apenas muda de lugar sem explicar o motivo;
- não existe indicação dos segmentos disponíveis;
- não existe prévia da linha que será criada;
- as cartas aparecem antes de o jogador compreender a ação básica;
- cartas exclusivas de duelo parecem utilizáveis fora do combate;
- o painel de objetivos informa o resultado esperado, mas não ensina a ação necessária;
- o feedback de envio e confirmação da jogada não é suficientemente visível.

## Critérios do hotfix

1. Permitir jogar tocando diretamente no segmento entre dois pilares.
2. Ao selecionar um pilar, destacar todos os vizinhos válidos e desenhar prévias das linhas possíveis.
3. Não trocar silenciosamente a seleção quando o segundo pilar for inválido.
4. Mostrar uma instrução contextual sobre a próxima ação.
5. Mostrar feedback imediato de envio e confirmação da jogada.
6. Na primeira missão, orientar a primeira linha de forma visual.
7. Separar cartas macro das cartas usadas somente no duelo.
8. Não apresentar uma carta como utilizável quando falta mana ou alvo.
9. Manter as regras autoritativas e o multiplayer inalterados.

**Tehkné Solutions**
