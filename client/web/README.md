# Hexa Octarina Conquer — Web Mobile

Cliente PWA mobile-first da **Tehkné Solutions**. Consome o protocolo WebSocket autoritativo existente sem duplicar regras de partida no navegador.

## Executar

```bash
cd client/web
npm install
cp .env.example .env.local
npm run dev
```

Para desenvolvimento local com o servidor na mesma máquina:

```env
VITE_HEXA_WS_URL=ws://localhost:8080/ws
```

## Validar

```bash
npm run check
```

O build de produção será criado em `client/web/dist`.

## Instalação no celular

1. publicar o conteúdo de `dist` em HTTPS;
2. abrir a URL no Chrome, Samsung Internet, Edge, Firefox ou Safari compatível;
3. usar **Instalar aplicativo** ou **Adicionar à tela inicial**;
4. o jogo abrirá em modo standalone e orientação horizontal.

## Arquitetura

- React/TypeScript para interface e estado visual;
- SVG para tabuleiro responsivo e toque preciso;
- WebSocket `/ws` para sessão, lobby, ações e estado privado;
- manifest + service worker para experiência PWA;
- `localStorage` somente para credenciais de sessão do próprio aparelho;
- servidor Node/PostgreSQL permanece autoritativo.

## Estado desta sprint

- login, cadastro e visitante;
- lobby, criação e entrada por código;
- reconexão automática;
- tabuleiro touch-first;
- mão privada de cartas;
- ações macro e duelo;
- shell offline e atualização automática;
- interface landscape adaptada para celulares.

O Godot continua preservado em `client/godot` para pesquisa visual e cenas 3D. O cliente web passa a ser o caminho primário de distribuição e teste rápido.
