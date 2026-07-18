# ADR 0001 — Motor de referência e stack de produção

## Decisão

O núcleo Python permanece como **especificação executável e suíte de regressão** das regras. Ele não será tratado como cliente final mobile.

A stack de produção seguirá o GDD:

- cliente 3D mobile: **Godot 4**;
- transporte e partidas online: **Node.js + WebSocket**;
- servidor autoritativo: valida ações, mantém snapshots e resolve duelos;
- motor Python: valida comportamento, balanceamento e compatibilidade das regras durante a migração.

## Motivo

Migrar para o visual antes de estabilizar o domínio propagaria falhas de estado para rede, animação e persistência. O motor de referência reduz esse risco e oferece casos de teste reproduzíveis para as implementações Node/GDScript.

## Consequências

- toda regra nova deve nascer com teste no motor de referência;
- o protocolo futuro deve expor comandos e eventos, não objetos gráficos;
- Godot será uma camada de apresentação e input, sem autoridade sobre a partida;
- a assinatura de produto e documentação permanece **Tehkné Solutions**.
