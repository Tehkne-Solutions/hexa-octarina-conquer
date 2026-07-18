# Extensão de identidade e progressão — Protocolo v1

Assinatura: **Tehkné Solutions**

## Cadastro

```json
{
  "protocolVersion": "1.0",
  "type": "account.register",
  "requestId": "register-1",
  "payload": {
    "handle": "arquiteto",
    "displayName": "Arquiteto",
    "password": "senha-com-8-ou-mais"
  }
}
```

Resposta: `account.session`, com perfil público, `accessToken` e expiração. O token deve ser tratado como segredo e nunca enviado em lobby, patch ou snapshot.

## Login

Tipo: `account.login`.

Payload:

- `handle`;
- `password`.

## Perfil e histórico

`account.profile` e `account.history` exigem:

- `accountId`;
- `accessToken`;
- `limit`, opcional no histórico.

## Ranking

`leaderboard.list` é público e aceita `limit` entre 1 e 100. A resposta `leaderboard.data` contém apenas dados públicos de progressão.

## Vincular conta à sala

`room.create` e `room.join` aceitam duas formas:

### Conta autenticada

```json
{
  "accountId": "account-...",
  "accessToken": "segredo"
}
```

O servidor autentica a conta e utiliza seu nome exibido.

### Visitante

```json
{
  "playerName": "Visitante"
}
```

## Encerrar partida

`match.forfeit` usa as mesmas credenciais e revisão das demais ações da sala. O servidor:

1. marca a sala como `finished`;
2. publica `match.finished`;
3. registra a progressão uma única vez;
4. publica `match.progression` quando as duas vagas possuem contas.

## Erros estáveis

- `INVALID_HANDLE`;
- `INVALID_DISPLAY_NAME`;
- `INVALID_PASSWORD`;
- `ACCOUNT_EXISTS`;
- `ACCOUNT_NOT_FOUND`;
- `INVALID_LOGIN`;
- `INVALID_ACCOUNT_SESSION`;
- `ACCOUNT_ALREADY_IN_ROOM`;
- `MATCH_NOT_ACTIVE`;
- `MATCH_FINISHED`.
