# Deploy Web Mobile no Render

Assinatura: **Tehkné Solutions**

## Arquitetura simplificada

A imagem Docker compila e entrega o cliente PWA e executa o servidor autoritativo no mesmo domínio:

- `https://<servico>.onrender.com/` — cliente Web Mobile;
- `wss://<servico>.onrender.com/ws` — jogadores;
- `wss://<servico>.onrender.com/spectator?roomId=...` — espectadores;
- `https://<servico>.onrender.com/health` — saúde do servidor;
- PostgreSQL privado provisionado pelo mesmo Blueprint.

Como frontend e WebSocket compartilham a origem, não é necessário configurar `VITE_HEXA_WS_URL` no Render. O cliente deriva automaticamente `wss://<host>/ws` quando a página usa HTTPS.

## Primeiro deploy

1. Acesse o dashboard do Render e conecte sua conta GitHub.
2. Autorize o repositório `Tehkne-Solutions/hexa-octarina-conquer`.
3. Escolha **New > Blueprint**.
4. Selecione o repositório.
5. O Render detectará o arquivo `render.yaml` na raiz.
6. Confirme a criação de:
   - `hexa-octarina-conquer` como Web Service Docker;
   - `hexa-octarina-postgres` como PostgreSQL.
7. Inicie o deploy e acompanhe os logs até o health check ficar verde.

O Blueprint configura automaticamente todos os armazenamentos como PostgreSQL e gera um token administrativo aleatório.

## Teste pelo celular

1. Abra a URL `https://hexa-octarina-conquer.onrender.com` ou o endereço exibido no dashboard.
2. Entre como visitante.
3. Crie uma sala.
4. Em outro navegador, aba anônima ou aparelho, abra a mesma URL e entre pelo código.
5. No Chrome Android, abra o menu e escolha **Instalar aplicativo** ou **Adicionar à tela inicial**.

## Verificações rápidas

- `/health` deve retornar `ok: true`;
- `roomStore`, `identityStore`, `competitionStore`, `clusterBus`, `presenceStore`, `governanceStore` e `resilienceStore` devem mostrar `postgres`;
- a página inicial deve carregar o cliente Web Mobile;
- ao criar uma sala, o segundo navegador deve enxergá-la no lobby;
- uma atualização de página deve restaurar a sessão.

## Plano gratuito

O Blueprint usa planos gratuitos para o primeiro teste. O serviço pode entrar em suspensão quando fica sem tráfego, portanto a primeira abertura após inatividade pode demorar. Para testes contínuos e partidas sem cold start, altere o plano do Web Service para `starter` ou superior.

## Domínio próprio

Depois de validar o endereço `onrender.com`, adicione um domínio como:

```text
jogar.hexaoctarina.com.br
```

O certificado HTTPS é emitido pelo Render. Como o WebSocket usa o mesmo domínio, o cliente continuará funcionando sem recompilação.

## Atualizações

Depois de conectar o Blueprint à branch `main`, cada merge aprovado pode disparar um novo deploy. O service worker atualiza o shell da PWA; não é necessário reinstalar o aplicativo no celular.
