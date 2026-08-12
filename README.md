# Discord Manager

Userscript único (cole no console do navegador) que adiciona um painel de gerenciamento em massa à sua própria conta do Discord: deletar mensagens, remover amigos, resolver Quests automaticamente, silenciar/sair de servidores em lote, marcar tudo como lido, buscar/exportar mensagens e visualizar perfis — tudo via um botão injetado na UI do próprio Discord.

> Feito e mantido como projeto pessoal/educacional. Ver [Avisos e riscos](#-avisos-e-riscos) antes de usar.

## ⚠️ Avisos e riscos

**Isto é um self-bot.** Ele usa o token de autenticação da sua própria conta para automatizar ações que normalmente só o cliente oficial do Discord faz (deletar mensagens em lote, simular progresso de jogo, etc.). Isso **viola os [Termos de Serviço do Discord](https://discord.com/terms)**, especificamente a cláusula que proíbe automatizar/self-botar contas de usuário (diferente de bots registrados via API oficial com token de aplicação).

Consequências possíveis de usar este script:
- **Banimento da conta**, permanente ou temporário, a critério do Discord.
- A funcionalidade de missões (`ACHIEVEMENT_IN_ACTIVITY`) **falsifica progresso perante backends de patrocinadores reais** (ex: estúdios de jogo, distribuidoras de filme) para resgatar recompensas (Orbs) sem de fato jogar/interagir com a Activity. Isso não é só um "ToS violation" contra o Discord — é uma fraude contra quem está pagando pela campanha promocional.
- O script extrai e usa o **token bruto da sua conta** localmente, no seu navegador. Ele não envia esse token para nenhum servidor terceiro além da própria API do Discord (e, no caso do bypass de missão, do backend legítimo `discordsays.com` do próprio app da missão) — mas cole scripts de fontes desconhecidas no console **por sua conta e risco**: esse é o vetor clássico de golpes de roubo de conta ("cole isso pra ganhar Nitro grátis").

**Use apenas na sua própria conta, entendendo os riscos. Sem garantias — o autor não se responsabiliza por contas banidas ou penalizadas.**

## O que ele faz

Um botão "Gerenciar" é injetado na barra lateral (perto de "Amigos") e outro ícone de engrenagem na barra do topo do app. Abra com um clique ou com o atalho **`Ctrl+Shift+1`**. O painel tem 9 abas:

| Aba | O que faz |
|---|---|
| 🗑️ **Mensagens** | Deleta em massa suas mensagens de um servidor, canal ou DM, com filtro opcional por termo. Usa a Search API do Discord para localizar e a API de mensagens para deletar. |
| 👥 **Amigos** | Lista todos os seus amigos com busca, seleção múltipla e remoção em lote. |
| 🎯 **Missões** | Resolve automaticamente as Discord Quests ativas (ver [detalhes técnicos](#resolução-de-quests) abaixo). |
| 🔇 **Silenciar** | Silencia servidores/canais selecionados em lote. |
| 🚪 **Sair** | Sai de servidores selecionados em lote. |
| 📖 **Lido** | Marca servidores/DMs selecionados como lidos. |
| 🔍 **Pesquisar** | Busca mensagens (suas ou de qualquer termo) em servidores e DMs, com paginação. |
| 👤 **Usuário** | Consulta o perfil público de um usuário pelo ID (bio, badges, banner, conexões, decoração de avatar, servidores/amigos em comum). |
| 📥 **Exportação** | Exporta o histórico de uma DM/grupo para um arquivo `.txt`. |

## Como usar

1. Abra o [Discord Web](https://discord.com/channels/@me) (ou o cliente desktop — ver limitação abaixo).
2. Abra o DevTools (`F12` ou `Ctrl+Shift+I`) → aba **Console**.
3. Cole o conteúdo de [`discord.js`](./discord.js) inteiro e aperte Enter.
4. Clique no botão "Gerenciar" (barra lateral ou topo) ou use `Ctrl+Shift+1`.

Colar o script de novo (sem recarregar a página) substitui a instância anterior automaticamente.

## Detalhes técnicos

### Extração de token

O script tenta, em ordem, várias estratégias até achar um token válido (`_token = tryWebpack() || tryStorage() || tryCookie() || tryGlobals() || tryDeepWebpack()`):

1. **`tryWebpack`** — injeta um chunk falso no `webpackChunkdiscord_app` para obter acesso aos módulos internos já carregados e procura um módulo com `getToken()` ou propriedade `token`.
2. **`tryStorage`** — varre chaves comuns (`token`, `discord_token`, etc.) em `localStorage`/`sessionStorage`.
3. **`tryCookie`** — regex em `document.cookie`.
4. **`tryGlobals`** — varre `window` por chaves com "token"/"auth" no nome.
5. **`tryDeepWebpack`** — varredura mais profunda de todos os módulos webpack carregados, procurando strings com formato de JWT (contém `.` e `eyJ`).

Isso é necessário porque o Discord não expõe o token de forma estável entre versões do cliente — cada estratégia cobre uma forma diferente de como o token pode estar acessível no momento.

### Headers

Todas as requisições usam os mesmos headers que o cliente oficial envia (`X-Super-Properties` codificado em base64 com dados do "navegador" simulado, `X-Discord-Locale`, `X-Discord-Timezone`, etc.), pra minimizar o quão destoante o tráfego é do de um cliente real.

### Deleção de mensagens sem delay fixo

Em vez de um `sleep` arbitrário entre deleções, o script:
- Lê os headers `X-RateLimit-Remaining` / `X-RateLimit-Reset-After` de cada resposta e só pausa quando o bucket realmente zera, pelo tempo exato que o Discord pediu.
- Em um `429`, lê o `retry_after` real do corpo da resposta (em vez de um valor chutado) e espera exatamente isso.

### Resolução de Quests

Cada tipo de tarefa de Quest (`taskConfig.tasks`) tem um resolver dedicado:

| Tipo de tarefa | Estratégia |
|---|---|
| `WATCH_VIDEO` / `WATCH_VIDEO_ON_MOBILE` | Envia progresso incremental para `/quests/{id}/video-progress` simulando reprodução em tempo real. |
| `PLAY_ON_DESKTOP` | Substitui temporariamente `RunningGameStore.getRunningGames`/`getGameForPID` por um processo falso e dispara o evento Flux `RUNNING_GAMES_CHANGE`, fazendo o cliente acreditar que um jogo está rodando. Requer o app desktop (`DiscordNative`). |
| `STREAM_ON_DESKTOP` | Mesma ideia, mas sobrescreve `ApplicationStreamingStore.getStreamerActiveStreamMetadata`. Requer app desktop. |
| `PLAY_ACTIVITY` | Envia heartbeats para `/quests/{id}/heartbeat` com um `stream_key` de uma call de voz (DM ou canal de servidor). |
| `ACHIEVEMENT_IN_ACTIVITY` | Ver seção abaixo — é o caso mais complexo. |

#### `ACHIEVEMENT_IN_ACTIVITY` — Activities embutidas (ex: mini-games promocionais)

Esse tipo de missão (usado por quests patrocinadas, ex: promoções de jogos/filmes) não é resolvido por heartbeat simples na maioria dos casos atuais — o endpoint de heartbeat costuma responder `403`. O resolver tenta em duas etapas:

1. **Heartbeat spoof** (`resolveAchievementInActivity`): tenta o mesmo mecanismo do `PLAY_ACTIVITY`. Funciona para uma minoria de quests mais antigas.
2. **Bypass via OAuth2** (se a etapa 1 falhar): replica o fluxo real que o cliente do Discord faz ao abrir uma Activity:
   - `POST /oauth2/authorize` no app da quest (com consentimento do usuário via `confirm()` do navegador).
   - `POST /applications/{appId}/proxy-tickets` para obter um ticket de proxy.
   - `POST https://{appId}.discordsays.com/.proxy/acf/authorize` — login no backend do próprio app da Activity, usando o ticket.
   - `POST https://{appId}.discordsays.com/.proxy/acf/quest/progress` — envia o progresso completo direto pro backend do app, que confia na origem autenticada.
   - **Sempre revoga a autorização OAuth criada** (`DELETE /oauth2/tokens/{id}`) no final, mesmo se algo falhar no meio — nunca deixa uma app terceira autorizada na conta.

**Por que precisa do relay local:** o navegador bloqueia por CSP (`Content-Security-Policy: connect-src`) qualquer `fetch` direto para `*.discordsays.com` a partir da página do Discord — tanto no Web quanto no client desktop. O CSP do Discord, porém, libera explicitamente `http://127.0.0.1:*`. Por isso existe o [`discord_quest_relay.py`](./discord_quest_relay.py): um servidor HTTP local, sem dependências externas, que escuta em `127.0.0.1:43110`, só repassa requisições para hosts terminados em `.discordsays.com`, e existe unicamente para dar esse "salto" que o CSP não deixa o JS da página dar sozinho.

Pra usar essa funcionalidade: rode `python3 discord_quest_relay.py` num terminal à parte antes de resolver esse tipo de missão. O script principal detecta sozinho (`cspFetch`) se o relay está disponível; se não estiver, cai de volta pra uma tentativa de `fetch` direto (que falhará por CSP, com uma mensagem de erro explicando o que fazer).

### Injeção de UI / persistência em SPA

O Discord Web é uma SPA que re-renderiza a UI constantemente, então o botão "Gerenciar" (`injectBtn`) e o ícone da barra do topo (`injectTopbarBtn`) são reinjetados a cada 2 segundos via `setInterval`, checando se ainda existem no DOM antes de recriar. O progresso de tarefas rodando em segundo plano (deleção de mensagens, remoção de amigos) aparece tanto no texto do botão da sidebar quanto num rótulo ao lado do ícone do topo.

## Estrutura do repositório

```
discord.js                # o script principal — cole isso no console
discord_quest_relay.py    # relay local opcional, só necessário para missões ACHIEVEMENT_IN_ACTIVITY
```

## Limitações conhecidas

- `PLAY_ON_DESKTOP`/`STREAM_ON_DESKTOP` só funcionam no cliente desktop (`DiscordNative`), não no navegador.
- `ACHIEVEMENT_IN_ACTIVITY` depende do relay local rodando; sem ele, o bypass falha com uma mensagem clara indicando o motivo (CSP).
- Como qualquer engenharia reversa de API não documentada, o Discord pode mudar comportamento/formato das respostas a qualquer momento e quebrar partes do script sem aviso.

## Licença

Sem licença definida — uso pessoal/educacional. Se for publicar, considere deixar isso explícito no repositório.

