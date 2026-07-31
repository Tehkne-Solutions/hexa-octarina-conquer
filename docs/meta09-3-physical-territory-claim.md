# META 09.3 — Domínio territorial físico

A conquista de uma região agora produz uma sequência material sem alterar o motor estratégico:

1. preenchimento de facção;
2. levantamento do perímetro;
3. pulso de conquista;
4. haste e bandeira da facção;
5. revelação da fundação edificável.

A célula, sua posição e sua hitbox permanecem estáveis. Apenas descendentes e pseudo-elementos decorativos recebem animação.

## Validação

```powershell
npm.cmd --prefix .\client\web run test -- strategic-territory-claim-contract.test.ts
npm.cmd --prefix .\client\web run check
npm.cmd --prefix .\client\web run dev
```

Tehkné Solutions
