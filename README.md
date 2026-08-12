# Discord Manager

A single userscript (paste into the browser console) that adds a bulk management panel to your own Discord account: delete messages, remove friends, automatically resolve Quests, mute/leave servers in bulk, mark everything as read, search/export messages, and view profiles — all through a button injected into Discord's own UI.

> Built and maintained as a personal/educational project. See [Warnings and risks](#️-warnings-and-risks) before using.

## ⚠️ Warnings and risks

**This is a self-bot.** It uses your own account's authentication token to automate actions that normally only the official Discord client performs (bulk-deleting messages, spoofing game activity, etc.). This **violates [Discord's Terms of Service](https://discord.com/terms)**, specifically the clause prohibiting automating/self-botting user accounts (as opposed to registered bots via the official API with an application token).

Possible consequences of using this script:

- **Account ban**, permanent or temporary, at Discord's discretion.
- The quest functionality (`ACHIEVEMENT_IN_ACTIVITY`) **spoofs progress against real sponsor backends** (e.g. game studios, film distributors) to redeem rewards (Orbs) without actually playing/interacting with the Activity. This is not just a "ToS violation" against Discord — it is fraud against whoever is paying for the promotional campaign.
- The script extracts and uses your **raw account token** locally, in your browser. It does not send that token to any third-party server other than Discord's own API (and, in the case of the quest bypass, the legitimate `discordsays.com` backend of the quest's own app) — but pasting scripts from unknown sources into the console **is at your own risk**: this is the classic attack vector for account theft scams ("paste this to get free Nitro").

**Use only on your own account, with a clear understanding of the risks. No warranties — the author is not responsible for banned or penalized accounts.**

## What it does

A "Manage" button is injected into the sidebar (near "Friends") and a gear icon into the app's top bar. Open it with a click or the **`Ctrl+Shift+1`** shortcut. The panel has 9 tabs:

| Tab | What it does |
|---|---|
| 🗑️ **Messages** | Bulk-deletes your messages from a server, channel, or DM, with an optional keyword filter. Uses Discord's Search API to find them and the Messages API to delete. |
| 👥 **Friends** | Lists all your friends with search, multi-select, and bulk removal. |
| 🎯 **Quests** | Automatically resolves active Discord Quests (see [technical details](#quest-resolution) below). |
| 🔇 **Mute** | Mutes selected servers/channels in bulk. |
| 🚪 **Leave** | Leaves selected servers in bulk. |
| 📖 **Read** | Marks selected servers/DMs as read. |
| 🔍 **Search** | Searches messages (yours or any term) across servers and DMs, with pagination. |
| 👤 **User** | Looks up a user's public profile by ID (bio, badges, banner, connections, avatar decoration, mutual servers/friends). |
| 📥 **Export** | Exports a DM/group chat history to a `.txt` file. |

## How to use

1. Open [Discord Web](https://discord.com/channels/@me) (or the desktop client — see limitation below).
2. Open DevTools (`F12` or `Ctrl+Shift+I`) → **Console** tab.
3. Paste the entire contents of [`discord.js`](./discord.js) and press Enter.
4. Click the "Manage" button (sidebar or top bar) or use `Ctrl+Shift+1`.

Pasting the script again (without reloading the page) automatically replaces the previous instance.

## Technical details

### Token extraction

The script tries several strategies in order until it finds a valid token (`_token = tryWebpack() || tryStorage() || tryCookie() || tryGlobals() || tryDeepWebpack()`):

1. **`tryWebpack`** — injects a fake chunk into `webpackChunkdiscord_app` to access the already-loaded internal modules and looks for a module with `getToken()` or a `token` property.
2. **`tryStorage`** — scans common keys (`token`, `discord_token`, etc.) in `localStorage`/`sessionStorage`.
3. **`tryCookie`** — regex against `document.cookie`.
4. **`tryGlobals`** — scans `window` for keys containing "token"/"auth".
5. **`tryDeepWebpack`** — deeper scan of all loaded webpack modules, looking for strings in JWT format (containing `.` and `eyJ`).

This is necessary because Discord does not expose the token in a stable way across client versions — each strategy covers a different way the token may be accessible at any given moment.

### Headers

All requests use the same headers that the official client sends (`X-Super-Properties` base64-encoded with simulated "browser" data, `X-Discord-Locale`, `X-Discord-Timezone`, etc.), to minimize how distinguishable the traffic is from a real client.

### Message deletion without fixed delay

Instead of an arbitrary `sleep` between deletions, the script:
- Reads the `X-RateLimit-Remaining` / `X-RateLimit-Reset-After` headers from each response and only pauses when the bucket actually empties, for exactly the amount of time Discord requested.
- On a `429`, reads the real `retry_after` from the response body (instead of a guessed value) and waits exactly that long.

### Quest resolution

Each quest task type (`taskConfig.tasks`) has a dedicated resolver:

| Task type | Strategy |
|---|---|
| `WATCH_VIDEO` / `WATCH_VIDEO_ON_MOBILE` | Sends incremental progress to `/quests/{id}/video-progress` simulating real-time playback. |
| `PLAY_ON_DESKTOP` | Temporarily replaces `RunningGameStore.getRunningGames`/`getGameForPID` with a fake process and fires the `RUNNING_GAMES_CHANGE` Flux event, making the client believe a game is running. Requires the desktop app (`DiscordNative`). |
| `STREAM_ON_DESKTOP` | Same idea, but overrides `ApplicationStreamingStore.getStreamerActiveStreamMetadata`. Requires the desktop app. |
| `PLAY_ACTIVITY` | Sends heartbeats to `/quests/{id}/heartbeat` with a `stream_key` from a voice call (DM or server channel). |
| `ACHIEVEMENT_IN_ACTIVITY` | See section below — this is the most complex case. |

#### `ACHIEVEMENT_IN_ACTIVITY` — Embedded Activities (e.g. promotional mini-games)

This quest type (used by sponsored quests, e.g. game/film promotions) is not resolved by a simple heartbeat in most current cases — the heartbeat endpoint typically returns `403`. The resolver attempts two steps:

1. **Heartbeat spoof** (`resolveAchievementInActivity`): tries the same mechanism as `PLAY_ACTIVITY`. Works for a minority of older quests.
2. **OAuth2 bypass** (if step 1 fails): replicates the real flow the Discord client performs when opening an Activity:
   - `POST /oauth2/authorize` on the quest's app (with user consent via the browser's `confirm()`).
   - `POST /applications/{appId}/proxy-tickets` to obtain a proxy ticket.
   - `POST https://{appId}.discordsays.com/.proxy/acf/authorize` — logs into the Activity app's own backend using the ticket.
   - `POST https://{appId}.discordsays.com/.proxy/acf/quest/progress` — sends full progress directly to the app's backend, which trusts the authenticated origin.
   - **Always revokes the created OAuth authorization** (`DELETE /oauth2/tokens/{id}`) at the end, even if something fails midway — never leaves a third-party app authorized on the account.

**Why the local relay is needed:** the browser's CSP (`Content-Security-Policy: connect-src`) blocks any direct `fetch` to `*.discordsays.com` from the Discord page — both on the web client and the desktop app. However, Discord's own CSP explicitly allows `http://127.0.0.1:*`. That is why [`discord_quest_relay.py`](./discord_quest_relay.py) exists: a local HTTP server with no external dependencies, listening on `127.0.0.1:43110`, that only forwards requests to hosts ending in `.discordsays.com`, and exists solely to provide the "hop" that the page's JS cannot make directly due to CSP.

To use this feature: run `python3 discord_quest_relay.py` in a separate terminal before resolving this type of quest. The main script auto-detects (`cspFetch`) whether the relay is available; if not, it falls back to a direct `fetch` attempt (which will fail due to CSP, with an error message explaining what to do).

### UI injection / SPA persistence

Discord Web is a SPA that constantly re-renders the UI, so the "Manage" button (`injectBtn`) and the top-bar icon (`injectTopbarBtn`) are re-injected every 2 seconds via `setInterval`, checking whether they still exist in the DOM before recreating them. Progress from background tasks (message deletion, friend removal) appears both in the sidebar button text and in a label next to the top-bar icon.

## Repository structure

```
discord.js                # the main script — paste this into the console
discord_quest_relay.py    # optional local relay, only needed for ACHIEVEMENT_IN_ACTIVITY quests
```

## Known limitations

- `PLAY_ON_DESKTOP`/`STREAM_ON_DESKTOP` only work in the desktop client (`DiscordNative`), not in the browser.
- `ACHIEVEMENT_IN_ACTIVITY` depends on the local relay running; without it, the bypass fails with a clear message indicating the reason (CSP).
- Like any reverse-engineering of an undocumented API, Discord may change behavior/response formats at any time and break parts of the script without warning.

## License

[MIT](./LICENSE) — no warranties, use at your own risk (see [Warnings and risks](#️-warnings-and-risks)).
