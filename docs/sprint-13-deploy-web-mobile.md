# Sprint 13 — Deploy Web Mobile em domínio único

Assinatura: **Tehkné Solutions**

## Objetivo

Publicar o cliente PWA e o servidor autoritativo em um único serviço HTTPS, eliminando configuração manual de origem cruzada e de `VITE_HEXA_WS_URL`.

## Entregas

- build multi-stage do cliente React dentro do Docker;
- PWA copiada para `/app/web` na imagem final;
- servidor Node entrega arquivos estáticos e mantém APIs e WebSockets;
- cache imutável para assets versionados;
- service worker sem cache HTTP para atualização segura;
- fallback de SPA para rotas do cliente;
- APIs administrativas, métricas, health e replay preservadas;
- teste automatizado de shell, assets, service worker e passthrough de API;
- Blueprint Render com Web Service Docker e PostgreSQL;
- segredo administrativo gerado automaticamente;
- documentação de deploy e instalação no celular.

## Resultado esperado

O mesmo endereço oferece:

```text
https://<servico>.onrender.com/
wss://<servico>.onrender.com/ws
https://<servico>.onrender.com/health
```

O cliente detecta o host atual e conecta automaticamente ao `/ws`, sem variável externa no build.

## Critérios de aceite

- testes Node e Web verdes;
- imagem Docker compila frontend e backend;
- `/` retorna a PWA;
- `/health` continua retornando JSON;
- `/ws` continua aceitando upgrade WebSocket;
- `render.yaml` provisiona serviço e banco;
- health check confirma todos os armazenamentos PostgreSQL.
