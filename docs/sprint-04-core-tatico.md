# Sprint 04 — Núcleo tático persistente e Duelo de Célula

## Objetivo

Transformar o protótipo em uma especificação confiável para a futura implementação Godot 4 + Node.js, preservando a essência de tabuleiro e preparando o combate direto definido no GDD.

## Problemas corrigidos

1. `end_turn()` iniciava o turno do jogador anterior antes de trocar o índice.
2. arestas diagonais, fora do mapa e duplicadas não eram bloqueadas.
3. `_resolve_provinces()` recriava todas as províncias e apagava evolução, HP, armadilhas e bônus.
4. captura por cerco era revertida pela reconstrução baseada apenas nas arestas.
5. cartas eram consumidas antes da validação completa do alvo.
6. conhecimento não era gerado naturalmente pelo mapa.

## Entregas

- estado persistente de células e províncias;
- ação extra ao fechar célula;
- limites de ações escalados por era;
- detecção de cerco com abertura de duelo;
- combate com energia, iniciativa, elementos, status, escudo e cura;
- combo lógico `wet -> electric`;
- log de eventos e snapshot pronto para serialização;
- deck inicial e CLI atualizados;
- 19 testes automatizados.

## Critérios de validação

- uma jogada inválida não altera mana, mão ou tabuleiro;
- uma província evoluída mantém estado após novas arestas;
- o próximo jogador recebe regeneração e compra corretamente;
- um cerco não troca posse sem resolução de combate;
- o resultado do duelo atualiza o mapa e a província;
- `python -m unittest discover -s tests -v` termina sem falhas.

## Próximo sprint

**Sprint 05 — Protocolo autoritativo Node/WebSocket**

- esquema versionado de comandos e eventos;
- criação de sala e reconexão;
- validação server-side de `play_edge`, `play_card` e `resolve_duel_round`;
- snapshots incrementais;
- adaptador de compatibilidade com o motor de referência;
- cliente Godot mínimo para visualizar pontos, arestas, células e eventos.
