# Sprint UI 07 — Release, diagnóstico e observabilidade

## Objetivo

Transformar o fechamento visual do Design 3.0 em uma versão publicável e verificável, com identificação de release, smoke test pós-deploy, diagnóstico do cliente e telemetria técnica sem dados pessoais.

## Release oficial

- versão: `0.12.0`;
- design: `3.0`;
- assinatura: **Tehkné Solutions**;
- endpoint público: `GET /release`;
- health check: `GET /health`;
- commit de build: `HEXA_RELEASE_SHA` no servidor e `VITE_RELEASE_SHA` no cliente.

O Dockerfile injeta a mesma versão no build estático e na runtime Node. Quando o SHA não é fornecido pela plataforma, o valor seguro é `unknown` e continua visível no diagnóstico.

## Telemetria técnica anônima

Endpoint:

```text
POST /experience/events
```

Eventos aceitos:

- `app_boot`;
- `screen_view`;
- `realm_status`;
- `pwa_state`;
- `client_error`;
- `performance`;
- `battle_session`.

Dimensões aceitas:

- tela funcional;
- classe do dispositivo;
- estado do reino;
- release;
- código operacional controlado pela aplicação;
- duração em milissegundos.

Não são aceitos nem persistidos:

- nome ou identificador da conta;
- e-mail;
- senha ou token;
- endereço completo da página;
- mensagens;
- cartas da mão;
- conteúdo da partida;
- posição do tabuleiro;
- IP dentro do payload;
- texto de erro livre.

O servidor sanitiza os campos novamente, limita tamanho, cardinalidade, quantidade por lote e duração. Eventos desconhecidos são rejeitados.

## Preferência do jogador

A opção **Telemetria técnica anônima** fica em Configurações. Ao desativá-la:

- eventos novos deixam de entrar na fila;
- a fila pendente é descartada;
- nenhuma falha de envio afeta o jogo;
- conta e progresso permanecem inalterados.

## Diagnóstico do reino

O painel de Configurações permite:

- consultar release do cliente e do servidor;
- verificar health e conexão;
- confirmar registro e cache da PWA;
- visualizar uso estimado de armazenamento;
- identificar viewport e perfil responsivo;
- copiar um relatório técnico local.

O relatório copiado inclui dados do navegador porque sua entrega é manual e permanece sob controle do jogador. Ele não é enviado automaticamente pela telemetria.

## Agregado operacional

Endpoint administrativo:

```text
GET /admin/experience
Authorization: Bearer <HEXA_ADMIN_TOKEN>
```

O retorno contém somente grupos agregados, contagens e médias/máximos de duração. Os mesmos eventos alimentam métricas Prometheus de baixa cardinalidade.

## Smoke test pós-deploy

Workflow:

```text
.github/workflows/post-deploy-smoke.yml
```

Formas de execução:

1. definir a variável de repositório `HOC_PRODUCTION_URL` para verificações programadas;
2. executar manualmente e preencher `target_url`.

Validações:

- espera resiliente pelo `/health`;
- contrato e assinatura do health;
- versão `0.12.0` e Design `3.0` em `/release`;
- shell HTML da PWA;
- catálogo público da campanha;
- ingestão de um evento sintético identificado como `post-deploy-smoke`.

## Critérios de aceite

- testes unitários e integração do servidor;
- testes da telemetria do cliente;
- TypeScript e build Vite;
- PWA e service worker;
- Docker e smoke test interno;
- campanha e PostgreSQL;
- servidor autoritativo e WebSocket;
- workflow pós-deploy válido;
- nenhuma regressão em progresso, conta ou batalha.

---

**Tehkné Solutions**
