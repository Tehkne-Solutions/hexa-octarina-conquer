# Visual QA — Design 3.0

## Objetivo

Estabelecer uma validação visual reproduzível para o shell unificado de **Hexa Octarina Conquer**, cobrindo a experiência pública antes da publicação.

## Matriz automática

O workflow `.github/workflows/visual-qa.yml` gera o artefato `hexa-octarina-visual-qa` com as seguintes referências:

| Tela | Viewport | Uso |
|---|---:|---|
| Home | 1440×900 | Desktop amplo |
| Home | 1366×768 | Notebook de baixa altura |
| Home | 390×844 | Celular em retrato |
| Campanha | 1366×768 | Mapa e painel lateral no notebook |
| Campanha | 390×844 | Mapa em coluna única |
| Configurações | 390×844 | Preferências e alvos de toque |

As URLs de captura usam `?qa=1&stable=1&screen=...`. A rota de QA apenas seleciona uma tela já existente e oculta avisos transitórios durante a captura. Ela não cria conteúdo paralelo nem altera progressão.

## Critérios de aprovação

### Composição

- nenhum conteúdo pode ultrapassar horizontalmente o viewport;
- a ação primária deve aparecer antes da primeira dobra da home em 1366×768;
- cards não podem sobrepor header, rodapé ou navegação mobile;
- o mapa da campanha deve manter seleção e contexto visíveis sem painel flutuante no celular;
- safe areas precisam ser respeitadas em dispositivos instalados como PWA.

### Legibilidade

- textos funcionais não podem depender de hover;
- descrições podem ser limitadas em telas compactas, mas título, estado e ação devem permanecer completos;
- foco de teclado deve ser visível;
- estados ativo, bloqueado, concluído e offline precisam ter texto ou símbolo além da cor.

### Interação

- alvos de toque devem manter pelo menos 44 px;
- menu mobile deve abrir em grade sem sair do viewport;
- bottom navigation não pode cobrir ações de formulário ou conteúdo final;
- carregamento lazy deve possuir feedback visual estável;
- nenhuma atualização da PWA pode interromper uma batalha sem confirmação.

### Performance percebida

- campanha é pré-carregada após o primeiro repouso da home;
- multiplayer, coleção e perfil são pré-carregados ao primeiro hover, foco ou toque de intenção;
- o cliente autoritativo continua fora do chunk inicial;
- loaders e transições respeitam redução de movimento.

## Perfil de viewport

O runtime classifica o viewport em:

- `mobile`: até 720 px;
- `tablet`: 721–1100 px;
- `notebook`: 1101–1440 px;
- `desktop`: acima de 1440 px;
- `compact`: altura de até 820 px.

As classes são gravadas como atributos no elemento `html`, permitindo correções específicas sem depender somente de media queries sobrepostas.

## Fechamento

A aprovação do workflow **Visual QA Matrix**, junto dos workflows **Web Mobile PWA**, **Single Player Campaign** e **Core Tests**, conclui a etapa de implementação do Design 3.0.

---

**Tehkné Solutions**
