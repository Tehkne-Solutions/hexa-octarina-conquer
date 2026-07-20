# Recursos provisionados pelo Blueprint

## Web Service

- Nome: `hexa-octarina-conquer`
- Runtime: Docker
- Health check: `/health`
- Frontend PWA: `/`
- WebSocket: `/ws`
- Região inicial: Virginia

## PostgreSQL

- Nome: `hexa-octarina-postgres`
- Banco: `hexa_octarina`
- Usuário: `hexa`
- PostgreSQL: 16
- Acesso público bloqueado pelo Blueprint

## Segredos

`HEXA_ADMIN_TOKEN` é gerado pelo Render. O valor não é armazenado no repositório.

**Tehkné Solutions**
