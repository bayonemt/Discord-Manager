// ============================================================
//  Discord Manager FIX v8.8i — Background Tasks & SPA Persistence
//  + Quest + User Profile (Animated Decos & Banners Fix)
// ============================================================
(() => {
  if (document.getElementById('__dm-overlay') && !window.__dmSafelyReloaded) return;
  window.__dmSafelyReloaded = true;

  const host = location.hostname || '';
  const isDiscord = host.includes('discord.com');

  if (!isDiscord) {
    const t = document.createElement('div');
    t.style.cssText =
      'position:fixed;top:16px;left:50%;transform:translateX(-50%);z-index:99999;background:var(--background-base-low);border:1px solid var(--border-subtle);border-radius:8px;padding:14px 18px;font-family:var(--font-primary);color:var(--text-danger);font-size:14px;box-shadow:var(--shadow-high);';
    t.textContent = '❌ Execute isto no Discord Web (discord.com/channels/@me)';
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 5000);
    return;
  }

  let _token = null;
  let dmRunning = false;
  const isApp = typeof DiscordNative !== 'undefined';

  const extractString = (val) => {
    if (typeof val === 'string') return val.trim();
    if (val && typeof val === 'object') {
      for (const key of ['token', 'accessToken', 'authToken', 'jwt', 'value', 'getToken', 'string']) {
        if (typeof val[key] === 'string') return val[key].trim();
        if (typeof val[key] === 'function') {
          try {
            const r = val[key]();
            if (typeof r === 'string') return r.trim();
          } catch {}
        }
      }
    }
    return null;
  };
  const tryWebpack = () => {
    try {
      const req = webpackChunkdiscord_app.push([[Math.random()], {}, (e) => e]);
      const mods = Object.values(req.c);
      for (const mod of mods) {
        try {
          const exp = mod?.exports?.default || mod?.exports;
          if (!exp) continue;
          if (typeof exp.getToken === 'function') {
            const t = exp.getToken();
            const x = extractString(t);
            if (x) return x;
          }
          if (exp.token || exp.accessToken || exp.authToken) {
            const x = extractString(exp);
            if (x) return x;
          }
        } catch {}
      }
    } catch (e) {}
    return null;
  };
  const tryStorage = () => {
    for (const key of ['token', 'Token', 'discord_token', 'auth_token', 'oauth2_token', 'access_token']) {
      try {
        for (const store of [localStorage, sessionStorage]) {
          const raw = store.getItem(key);
          if (raw) {
            let p = raw;
            try {
              p = JSON.parse(raw);
            } catch {}
            const x = extractString(p);
            if (x && x.length > 20) return x;
          }
        }
      } catch {}
    }
    return null;
  };
  const tryCookie = () => {
    try {
      const m = document.cookie.match(/(?:token|auth)=([^;]+)/);
      if (m) {
        const x = extractString(m[1]);
        if (x && x.length > 20) return x;
      }
    } catch {}
    return null;
  };
  const tryGlobals = () => {
    try {
      for (const k of Object.keys(window)) {
        if (k.toLowerCase().includes('token') || k.toLowerCase().includes('auth')) {
          const x = extractString(window[k]);
          if (x && x.length > 20 && x.includes('.')) return x;
        }
      }
    } catch {}
    return null;
  };
  const tryDeepWebpack = () => {
    try {
      const req = webpackChunkdiscord_app.push([[Math.random()], {}, (e) => e]);
      for (const mod of Object.values(req.c)) {
        try {
          const exp = mod?.exports?.default || mod?.exports;
          if (!exp || typeof exp !== 'object') continue;
          for (const key of Object.keys(exp)) {
            const val = exp[key];
            if (typeof val === 'string' && val.length > 50 && val.includes('.') && val.includes('eyJ'))
              return val.trim();
            if (typeof val === 'function') {
              try {
                const r = val();
                if (typeof r === 'string' && r.length > 50 && val.includes('.')) return r.trim();
              } catch {}
            }
          }
        } catch {}
      }
    } catch {}
    return null;
  };

  _token = tryWebpack() || tryStorage() || tryCookie() || tryGlobals() || tryDeepWebpack();
  if (_token)
    _token = String(_token)
      .trim()
      .replace(/^["']+|["']+$/g, '')
      .trim();

  if (!_token || _token.length < 20) {
    const t = document.createElement('div');
    t.style.cssText =
      'position:fixed;top:16px;left:50%;transform:translateX(-50%);z-index:99999;background:var(--background-base-low);border:1px solid var(--border-subtle);border-radius:8px;padding:14px 18px;font-family:var(--font-primary);color:var(--text-danger);font-size:14px;box-shadow:var(--shadow-high);';
    t.innerHTML = '❌ Token não encontrado.<br><small>Certifique-se de estar logado no Discord Web.</small>';
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 5000);
    return;
  }

  let wpRequire,
    FluxDispatcher,
    discordApi,
    RunningGameStore,
    ApplicationStreamingStore,
    ChannelStore,
    GuildChannelStore;
  try {
    wpRequire = webpackChunkdiscord_app.push([[Symbol()], {}, (r) => r]);
    webpackChunkdiscord_app.pop();
    for (const mod of Object.values(wpRequire.c)) {
      try {
        const e = mod?.exports;
        if (!e) continue;
        if (e.A?.__proto__?.getStreamerActiveStreamMetadata) ApplicationStreamingStore = e.A;
        if (e.Ay?.getRunningGames) RunningGameStore = e.Ay;
        if (e.A?.__proto__?.getAllThreadsForParent) ChannelStore = e.A;
        if (e.Ay?.getSFWDefaultChannel) GuildChannelStore = e.Ay;
        if (e.h?.__proto__?.flushWaitQueue) FluxDispatcher = e.h;
        if (e.Bo?.get) discordApi = e.Bo;
      } catch {}
    }
  } catch (e) {}

  const getOS = () => {
    const ua = navigator.userAgent;
    if (ua.includes('Windows')) return 'Windows';
    if (ua.includes('Mac OS')) return 'MacOS';
    return 'Linux';
  };
  const getBrowserVersion = () => {
    const match = navigator.userAgent.match(/Chrome\/(\d+\.\d+\.\d+\.\d+)/);
    return match ? match[1] : '130.0.0.0';
  };
  const buildSuperProps = () =>
    btoa(
      JSON.stringify({
        os: getOS(),
        browser: 'Chrome',
        device: '',
        system_locale: 'pt-BR',
        has_client_mods: false,
        browser_user_agent: navigator.userAgent,
        browser_version: getBrowserVersion(),
        os_version: '',
        referrer: '',
        referring_domain: '',
        referrer_current: '',
        referring_domain_current: '',
        release_channel: 'stable',
        client_build_number: 557958,
        client_event_source: null,
        client_launch_id: crypto.randomUUID(),
        client_app_state: 'focused',
      }),
    );

  const BASE_HEADERS = {
    Authorization: _token,
    'X-Super-Properties': buildSuperProps(),
    'X-Discord-Locale': 'pt-BR',
    'X-Discord-Timezone': 'America/Sao_Paulo',
    'X-Debug-Options': 'bugReporterEnabled',
    Accept: '*/*',
    'Accept-Language': 'pt-BR,pt;q=0.9',
    Origin: 'https://discord.com',
    Referer: 'https://discord.com/channels/@me',
  };
  const QUEST_HEADERS = { ...BASE_HEADERS, Referer: 'https://discord.com/quest-home' };
  const QUEST_POST_HEADERS = { ...QUEST_HEADERS, 'Content-Type': 'application/json' };
  const POST_HEADERS = { ...BASE_HEADERS, 'Content-Type': 'application/json' };
  const GET_HEADERS = BASE_HEADERS;
  const DEL_HEADERS = BASE_HEADERS;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const RELAY_URL = 'http://127.0.0.1:43110';
  const cspFetch = async (url, opts = {}) => {
    try {
      const r = await fetch(`${RELAY_URL}/proxy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, headers: opts.headers || {}, body: opts.body || '' }),
      });
      if (r.ok) {
        const rr = await r.json();
        return { ok: rr.ok, status: rr.status, json: async () => JSON.parse(rr.body), text: async () => rr.body };
      }
    } catch {}
    return fetch(url, opts);
  };
  const progressBar = (current, total) => {
    const pct = total > 0 ? Math.min(100, Math.floor((current / total) * 100)) : 0;
    return `<div class="dm-pbar"><div class="dm-pfill" style="width:${pct}%"></div></div>`;
  };
  const supportedTasks = [
    'WATCH_VIDEO',
    'PLAY_ON_DESKTOP',
    'STREAM_ON_DESKTOP',
    'PLAY_ACTIVITY',
    'WATCH_VIDEO_ON_MOBILE',
    'ACHIEVEMENT_IN_ACTIVITY',
  ];
  const escapeHtml = (unsafe) =>
    unsafe ? unsafe.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') : '';

  const enrollQuest = async (questId) => {
    const r = await fetch(`https://discord.com/api/v9/quests/${questId}/enroll`, {
      method: 'POST',
      headers: QUEST_POST_HEADERS,
      body: JSON.stringify({ location: 1 }),
    });
    if (!r.ok && r.status !== 204) {
      const err = await r.json().catch(() => ({}));
      throw new Error(err.message || `Erro ${r.status}`);
    }
    return true;
  };
  const claimQuest = async (questId) => {
    try {
      await fetch(`https://discord.com/api/v9/quests/${questId}/claim`, {
        method: 'POST',
        headers: QUEST_POST_HEADERS,
        body: JSON.stringify({}),
      });
    } catch {}
  };

  let _sharedGuilds = null;
  let _sharedChannels = null;
  const fetchSharedData = async () => {
    if (_sharedGuilds === null) {
      try {
        const r1 = await fetch('https://discord.com/api/v9/users/@me/guilds', { headers: GET_HEADERS });
        if (r1.ok) _sharedGuilds = await r1.json();
      } catch {}
      _sharedGuilds = _sharedGuilds || [];
    }
    if (_sharedChannels === null) {
      try {
        const r2 = await fetch('https://discord.com/api/v9/users/@me/channels', { headers: GET_HEADERS });
        if (r2.ok) _sharedChannels = await r2.json();
      } catch {}
      _sharedChannels = _sharedChannels || [];
    }
    return { guilds: _sharedGuilds, channels: _sharedChannels };
  };

  const resolveWatchVideo = async (quest, secondsNeeded, initialSecondsDone, stEl, shouldStop) => {
    const speed = 7;
    let secondsDone = initialSecondsDone;
    const questName = quest.name;
    while (!shouldStop() && secondsDone < secondsNeeded) {
      const remaining = Math.min(speed, secondsNeeded - secondsDone);
      await sleep(remaining * 1000);
      if (shouldStop()) break;
      const timestamp = secondsDone + speed;
      const r = await fetch(`https://discord.com/api/v9/quests/${quest.id}/video-progress`, {
        method: 'POST',
        headers: QUEST_POST_HEADERS,
        body: JSON.stringify({ timestamp: Math.min(secondsNeeded, timestamp + Math.random()) }),
      });
      if (r.status === 429) {
        const retry = await r.json().catch(() => ({}));
        stEl.innerHTML = `<span class="dm-spin"></span> ⏳ Rate limited... ${progressBar(secondsDone, secondsNeeded)}`;
        await sleep((retry.retry_after || 5) * 1000);
        continue;
      }
      if (!r.ok) throw new Error(`Erro ${r.status}`);
      const data = await r.json().catch(() => ({}));
      secondsDone = Math.min(secondsNeeded, timestamp);
      stEl.innerHTML = `<span class="dm-spin"></span> 🎬 ${questName}: ${secondsDone}/${secondsNeeded}s ${progressBar(secondsDone, secondsNeeded)}`;
      if (data.completed_at != null) {
        secondsDone = secondsNeeded;
        break;
      }
      if (timestamp >= secondsNeeded) break;
    }
    if (!shouldStop() && secondsDone < secondsNeeded) {
      await fetch(`https://discord.com/api/v9/quests/${quest.id}/video-progress`, {
        method: 'POST',
        headers: QUEST_POST_HEADERS,
        body: JSON.stringify({ timestamp: secondsNeeded }),
      });
    }
    stEl.innerHTML = `✅ 🎬 ${questName}: Concluída! ${progressBar(secondsNeeded, secondsNeeded)}`;
  };
  const resolvePlayOnDesktop = (
    quest,
    secondsNeeded,
    initialSecondsDone,
    applicationId,
    applicationName,
    stEl,
    shouldStop,
  ) => {
    return new Promise((resolve, reject) => {
      if (!isApp) {
        reject(new Error('Requer app desktop'));
        return;
      }
      if (!discordApi || !RunningGameStore || !FluxDispatcher) {
        reject(new Error('Módulos não encontrados'));
        return;
      }
      const fetchAppData = async () => {
        try {
          let appData;
          if (discordApi) {
            const res = await discordApi.get({ url: `/applications/public?application_ids=${applicationId}` });
            appData = res.body[0];
          } else {
            const r = await fetch(`https://discord.com/api/v9/applications/public?application_ids=${applicationId}`, {
              headers: GET_HEADERS,
            });
            if (!r.ok) throw new Error(`${r.status}`);
            appData = (await r.json())[0];
          }
          if (!appData) throw new Error('App não encontrado');
          const exeName =
            appData.executables?.find((x) => x.os === 'win32')?.name?.replace('>', '') ??
            appData.name.replace(/[\/\\:*?"<>|]/g, '');
          const pid = Math.floor(Math.random() * 30000) + 1000;
          const fakeGame = {
            cmdLine: `C:\\Program Files\\${appData.name}\\${exeName}`,
            exeName,
            exePath: `c:/program files/${appData.name.toLowerCase()}/${exeName}`,
            hidden: false,
            isLauncher: false,
            id: applicationId,
            name: appData.name,
            pid,
            pidPath: [pid],
            processName: appData.name,
            start: Date.now(),
          };
          const realGames = RunningGameStore.getRunningGames(),
            realGetRunningGames = RunningGameStore.getRunningGames,
            realGetGameForPID = RunningGameStore.getGameForPID;
          RunningGameStore.getRunningGames = () => [fakeGame];
          RunningGameStore.getGameForPID = (p) => fakeGame;
          FluxDispatcher.dispatch({
            type: 'RUNNING_GAMES_CHANGE',
            removed: realGames,
            added: [fakeGame],
            games: [fakeGame],
          });
          const cleanup = () => {
            RunningGameStore.getRunningGames = realGetRunningGames;
            RunningGameStore.getGameForPID = realGetGameForPID;
            FluxDispatcher.dispatch({ type: 'RUNNING_GAMES_CHANGE', removed: [fakeGame], added: [], games: [] });
            FluxDispatcher.unsubscribe('QUESTS_SEND_HEARTBEAT_SUCCESS', heartbeatHandler);
          };
          const heartbeatHandler = (data) => {
            if (shouldStop()) {
              cleanup();
              reject(new Error('Parado'));
              return;
            }
            let progress;
            try {
              progress =
                (quest.raw?.config?.configVersion ?? 2) === 1
                  ? (data.userStatus?.streamProgressSeconds ?? 0)
                  : Math.floor(data.userStatus?.progress?.PLAY_ON_DESKTOP?.value ?? 0);
            } catch {
              progress = 0;
            }
            stEl.innerHTML = `<span class="dm-spin"></span> 🎮 ${applicationName}: ${progress}/${secondsNeeded}s ${progressBar(progress, secondsNeeded)}`;
            if (progress >= secondsNeeded) {
              cleanup();
              stEl.innerHTML = `✅ 🎮 ${applicationName}: Concluída! ${progressBar(secondsNeeded, secondsNeeded)}`;
              resolve();
            }
          };
          FluxDispatcher.subscribe('QUESTS_SEND_HEARTBEAT_SUCCESS', heartbeatHandler);
          stEl.innerHTML = `<span class="dm-spin"></span> 🎮 Simulando ${applicationName}... ${progressBar(initialSecondsDone, secondsNeeded)}`;
        } catch (e) {
          reject(e);
        }
      };
      fetchAppData();
    });
  };
  const resolveStreamOnDesktop = (
    quest,
    secondsNeeded,
    initialSecondsDone,
    applicationId,
    applicationName,
    stEl,
    shouldStop,
  ) => {
    return new Promise((resolve, reject) => {
      if (!isApp) {
        reject(new Error('Requer app desktop'));
        return;
      }
      if (!ApplicationStreamingStore || !FluxDispatcher) {
        reject(new Error('Módulos não encontrados'));
        return;
      }
      const pid = Math.floor(Math.random() * 30000) + 1000,
        realFunc = ApplicationStreamingStore.getStreamerActiveStreamMetadata;
      ApplicationStreamingStore.getStreamerActiveStreamMetadata = () => ({ id: applicationId, pid, sourceName: null });
      const cleanup = () => {
        ApplicationStreamingStore.getStreamerActiveStreamMetadata = realFunc;
        FluxDispatcher.unsubscribe('QUESTS_SEND_HEARTBEAT_SUCCESS', heartbeatHandler);
      };
      const heartbeatHandler = (data) => {
        if (shouldStop()) {
          cleanup();
          reject(new Error('Parado'));
          return;
        }
        let progress;
        try {
          progress =
            (quest.raw?.config?.configVersion ?? 2) === 1
              ? (data.userStatus?.streamProgressSeconds ?? 0)
              : Math.floor(data.userStatus?.progress?.STREAM_ON_DESKTOP?.value ?? 0);
        } catch {
          progress = 0;
        }
        stEl.innerHTML = `<span class="dm-spin"></span> 📡 ${applicationName}: ${progress}/${secondsNeeded}s ${progressBar(progress, secondsNeeded)}`;
        if (progress >= secondsNeeded) {
          cleanup();
          stEl.innerHTML = `✅ 📡 ${applicationName}: Concluída! ${progressBar(secondsNeeded, secondsNeeded)}`;
          resolve();
        }
      };
      FluxDispatcher.subscribe('QUESTS_SEND_HEARTBEAT_SUCCESS', heartbeatHandler);
      stEl.innerHTML = `<span class="dm-spin"></span> 📡 Simulando stream ${applicationName}... ${progressBar(initialSecondsDone, secondsNeeded)}`;
    });
  };
  const resolvePlayActivity = async (quest, secondsNeeded, initialSecondsDone, stEl, shouldStop) => {
    const questName = quest.name;
    let channelId;
    if (ChannelStore) {
      try {
        const p = ChannelStore.getSortedPrivateChannels();
        if (p.length > 0) channelId = p[0].id;
      } catch {}
    }
    if (!channelId && GuildChannelStore) {
      try {
        const g = Object.values(GuildChannelStore.getAllGuilds()).find((x) => x?.VOCAL?.length > 0);
        if (g) channelId = g.VOCAL[0].channel.id;
      } catch {}
    }
    if (!channelId) {
      try {
        const r = await fetch('https://discord.com/api/v9/users/@me/channels', { headers: GET_HEADERS });
        if (r.ok) {
          const c = await r.json();
          if (c.length > 0) channelId = c[0].id;
        }
      } catch {}
    }
    if (!channelId) {
      try {
        const r = await fetch('https://discord.com/api/v9/users/@me/guilds', { headers: GET_HEADERS });
        if (r.ok) {
          for (const g of await r.json()) {
            const cr = await fetch(`https://discord.com/api/v9/guilds/${g.id}/channels`, { headers: GET_HEADERS });
            if (cr.ok) {
              const v = (await cr.json()).find((c) => c.type === 2);
              if (v) {
                channelId = v.id;
                break;
              }
            }
          }
        }
      } catch {}
    }
    if (!channelId) throw new Error('Nenhum canal de voz encontrado');
    const streamKey = `call:${channelId}:1`;
    let secondsDone = initialSecondsDone;
    stEl.innerHTML = `<span class="dm-spin"></span> 🎯 ${questName}: Iniciando... ${progressBar(secondsDone, secondsNeeded)}`;
    while (!shouldStop() && secondsDone < secondsNeeded) {
      const r = await fetch(`https://discord.com/api/v9/quests/${quest.id}/heartbeat`, {
        method: 'POST',
        headers: QUEST_POST_HEADERS,
        body: JSON.stringify({ stream_key: streamKey, terminal: false }),
      });
      if (r.status === 429) {
        const retry = await r.json().catch(() => ({}));
        stEl.innerHTML = `<span class="dm-spin"></span> ⏳ Rate limited... ${progressBar(secondsDone, secondsNeeded)}`;
        await sleep((retry.retry_after || 5) * 1000);
        continue;
      }
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        throw new Error(err.message || `Erro ${r.status}`);
      }
      const data = await r.json().catch(() => ({}));
      const progress = data.progress?.PLAY_ACTIVITY?.value ?? secondsDone;
      secondsDone = Math.max(secondsDone, progress);
      stEl.innerHTML = `<span class="dm-spin"></span> 🎯 ${questName}: ${secondsDone}/${secondsNeeded}s ${progressBar(secondsDone, secondsNeeded)}`;
      if (secondsDone >= secondsNeeded) break;
      await sleep(20000);
    }
    if (!shouldStop()) {
      await fetch(`https://discord.com/api/v9/quests/${quest.id}/heartbeat`, {
        method: 'POST',
        headers: QUEST_POST_HEADERS,
        body: JSON.stringify({ stream_key: streamKey, terminal: true }),
      });
    }
    stEl.innerHTML = `✅ 🎯 ${questName}: Concluída! ${progressBar(secondsNeeded, secondsNeeded)}`;
  };

  const resolveAchievementInActivity = async (
    quest,
    target,
    initialProgress,
    applicationId,
    applicationName,
    stEl,
    shouldStop,
  ) => {
    const questName = quest.name;
    let progress = initialProgress;
    if (applicationId && !shouldStop() && progress < target) {
      stEl.innerHTML = `<span class="dm-spin"></span> 🏆 ${questName}: tentando heartbeat... ${progressBar(progress, target)}`;
      try {
        let myId;
        try {
          myId = (await (await fetch('https://discord.com/api/v9/users/@me', { headers: GET_HEADERS })).json()).id;
        } catch {}
        let channelId,
          isGuild = false,
          guildId;
        if (ChannelStore) {
          try {
            const p = ChannelStore.getSortedPrivateChannels();
            if (p.length > 0) channelId = p[0].id;
          } catch {}
        }
        if (!channelId && GuildChannelStore) {
          try {
            for (const g of Object.values(GuildChannelStore.getAllGuilds())) {
              const vc = g?.VOCAL?.[0]?.channel;
              if (vc?.id) {
                channelId = vc.id;
                isGuild = true;
                guildId = vc.guild_id ?? g?.id;
                break;
              }
            }
          } catch {}
        }
        if (myId && channelId) {
          const streamKey = isGuild ? `guild:${guildId}:${channelId}:${myId}` : `call:${channelId}:${myId}`;
          let heartbeatFailed = false;
          while (!shouldStop() && progress < target && !heartbeatFailed) {
            const r = await fetch(`https://discord.com/api/v9/quests/${quest.id}/heartbeat`, {
              method: 'POST',
              headers: QUEST_POST_HEADERS,
              body: JSON.stringify({ stream_key: streamKey, application_id: String(applicationId), terminal: false }),
            });
            if (r.status === 429) {
              const retry = await r.json().catch(() => ({}));
              await sleep((retry.retry_after || 5) * 1000);
              continue;
            }
            if (!r.ok) {
              heartbeatFailed = true;
              break;
            }
            const data = await r.json().catch(() => ({}));
            progress =
              data.progress?.[quest.taskName]?.value ?? data.progress?.ACHIEVEMENT_IN_ACTIVITY?.value ?? progress;
            stEl.innerHTML = `<span class="dm-spin"></span> 🏆 ${questName}: ${progress}/${target} ${progressBar(progress, target)}`;
            if (progress >= target) {
              await fetch(`https://discord.com/api/v9/quests/${quest.id}/heartbeat`, {
                method: 'POST',
                headers: QUEST_POST_HEADERS,
                body: JSON.stringify({ stream_key: streamKey, application_id: String(applicationId), terminal: true }),
              }).catch(() => {});
              break;
            }
            await sleep(20000);
          }
        }
      } catch {}
    }
    if (progress >= target) {
      stEl.innerHTML = `✅ 🏆 ${questName}: Concluída! ${progressBar(target, target)}`;
      return;
    }
    if (shouldStop()) return;
    if (!applicationId) throw new Error('Missão sem application_id, não é possível autorizar.');
    stEl.innerHTML = `<span class="dm-spin"></span> 🏆 ${questName}: heartbeat não completou, tentando desbloqueio via app autorizado...`;
    const userOk = confirm(
      `Para completar "${questName}" o script precisa autorizar temporariamente o app "${applicationName}" na sua conta Discord (via OAuth) e revogar a autorização logo em seguida. Continuar?`,
    );
    if (!userOk) throw new Error('Desbloqueio cancelado pelo usuário.');
    let preGrantIds = new Set();
    try {
      const before = await fetch('https://discord.com/api/v9/oauth2/tokens', { headers: GET_HEADERS });
      if (before.ok) {
        const list = await before.json();
        preGrantIds = new Set(list.filter((t) => t.application?.id === applicationId).map((t) => t.id));
      }
    } catch {}
    try {
      const authRes = await fetch(
        `https://discord.com/api/v9/oauth2/authorize?${new URLSearchParams({ response_type: 'code', client_id: applicationId, scope: 'identify applications.commands applications.entitlements' })}`,
        {
          method: 'POST',
          headers: POST_HEADERS,
          body: JSON.stringify({
            permissions: '0',
            authorize: true,
            integration_type: 1,
            location_context: { guild_id: '10000', channel_id: '10000', channel_type: 10000 },
          }),
        },
      );
      if (!authRes.ok) throw new Error(`Autorização falhou (${authRes.status})`);
      const authBody = await authRes.json();
      const location = authBody.location;
      if (!location) throw new Error('Discord não retornou o código de autorização.');
      const authCode = new URL(location).searchParams.get('code');
      if (!authCode) throw new Error('Código de autorização ausente.');
      const ticketRes = await fetch(`https://discord.com/api/v9/applications/${applicationId}/proxy-tickets`, {
        method: 'POST',
        headers: POST_HEADERS,
        body: '{}',
      });
      if (!ticketRes.ok) throw new Error(`Proxy ticket falhou (${ticketRes.status})`);
      const ticketBody = await ticketRes.json();
      const proxyTicket = ticketBody.ticket;
      if (!proxyTicket) throw new Error('Proxy ticket vazio.');
      const referrer = `https://${applicationId}.discordsays.com/?instance_id=example-cl-instance&platform=desktop&discord_proxy_ticket=${encodeURIComponent(proxyTicket)}`;
      stEl.innerHTML = `<span class="dm-spin"></span> 🏆 ${questName}: autorizando app externo...`;
      const dsAuthRes = await cspFetch(`https://${applicationId}.discordsays.com/.proxy/acf/authorize`, {
        headers: {
          'Content-Type': 'application/json',
          'X-Auth-Token': '',
          'X-Discord-Quest-ID': quest.id,
          Referer: referrer,
        },
        body: JSON.stringify({ code: authCode }),
      });
      const dsAuthBody = await dsAuthRes.json().catch(() => ({}));
      const dsToken = dsAuthBody.token;
      if (!dsAuthRes.ok || !dsToken) throw new Error(`App externo recusou o login (${dsAuthRes.status})`);
      stEl.innerHTML = `<span class="dm-spin"></span> 🏆 ${questName}: enviando progresso...`;
      const progRes = await cspFetch(`https://${applicationId}.discordsays.com/.proxy/acf/quest/progress`, {
        headers: {
          'Content-Type': 'application/json',
          'X-Auth-Token': dsToken,
          'X-Discord-Quest-ID': quest.id,
          Referer: referrer,
        },
        body: JSON.stringify({ progress: target }),
      });
      if (!progRes.ok) throw new Error(`App externo recusou o progresso (${progRes.status})`);
      stEl.innerHTML = `✅ 🏆 ${questName}: Concluída via desbloqueio! ${progressBar(target, target)}`;
    } catch (e) {
      if (e instanceof TypeError && /failed to fetch|networkerror/i.test(e.message)) {
        throw new Error(
          'Bloqueado pelo Discord (CSP não permite contato direto com o app externo). Rode o discord_quest_relay.py na sua máquina e tente de novo.',
        );
      }
      throw e;
    } finally {
      try {
        const after = await fetch('https://discord.com/api/v9/oauth2/tokens', { headers: GET_HEADERS });
        if (after.ok) {
          const list = await after.json();
          const ours = list.filter((t) => t.application?.id === applicationId && !preGrantIds.has(t.id));
          for (const g of ours) {
            await fetch(`https://discord.com/api/v9/oauth2/tokens/${g.id}`, {
              method: 'DELETE',
              headers: DEL_HEADERS,
            }).catch(() => {});
          }
        }
      } catch {}
    }
  };

  const resolveSingleQuest = async (quest, stEl, shouldStop) => {
    const raw = quest.raw;
    const taskConfig =
      raw.config?.taskConfig || raw.config?.task_config || raw.config?.taskConfigV2 || raw.config?.task_config_v2;
    if (!taskConfig?.tasks) throw new Error('Config não encontrada');
    const taskName = supportedTasks.find((x) => taskConfig.tasks[x] != null);
    if (!taskName) throw new Error('Tarefa não suportada');
    const secondsNeeded = taskConfig.tasks[taskName].target;
    const secondsDone = raw.user_status?.progress?.[taskName]?.value ?? 0;
    const applicationId = raw.config?.application?.id;
    const applicationName = raw.config?.application?.name || quest.name;
    if (secondsDone >= secondsNeeded) {
      stEl.innerHTML = `✅ ${quest.name}: Já completa! ${progressBar(secondsNeeded, secondsNeeded)}`;
      return;
    }
    if (!quest.isEnrolled) {
      stEl.innerHTML = `<span class="dm-spin"></span> 📋 Inscrevendo...`;
      await enrollQuest(quest.id);
      await sleep(1500);
    }
    stEl.innerHTML = `<span class="dm-spin"></span> 🔧 ${quest.name} (${taskName})... ${progressBar(secondsDone, secondsNeeded)}`;
    if (taskName === 'WATCH_VIDEO' || taskName === 'WATCH_VIDEO_ON_MOBILE')
      await resolveWatchVideo(quest, secondsNeeded, secondsDone, stEl, shouldStop);
    else if (taskName === 'PLAY_ON_DESKTOP')
      await resolvePlayOnDesktop(quest, secondsNeeded, secondsDone, applicationId, applicationName, stEl, shouldStop);
    else if (taskName === 'STREAM_ON_DESKTOP')
      await resolveStreamOnDesktop(quest, secondsNeeded, secondsDone, applicationId, applicationName, stEl, shouldStop);
    else if (taskName === 'PLAY_ACTIVITY')
      await resolvePlayActivity(quest, secondsNeeded, secondsDone, stEl, shouldStop);
    else if (taskName === 'ACHIEVEMENT_IN_ACTIVITY')
      await resolveAchievementInActivity(
        quest,
        secondsNeeded,
        secondsDone,
        applicationId,
        applicationName,
        stEl,
        shouldStop,
      );
    if (!shouldStop()) {
      stEl.innerHTML = `<span class="dm-spin"></span> 🎁 Resgatando...`;
      await claimQuest(quest.id);
      await sleep(1000);
    }
  };

  const cssBtn = document.createElement('style');
  cssBtn.id = '__dm-css-btn';
  cssBtn.textContent = `#__dm-navbtn{align-items:center;border-radius:var(--radius-sm,8px);color:var(--text-muted);cursor:pointer;display:flex;gap:var(--space-sm,12px);padding:var(--space-xs,8px) var(--space-xs,8px) var(--space-xs,8px) 12px;justify-content:flex-start;user-select:none;margin:1px 0;width:100%;box-sizing:border-box;transition:color .2s}#__dm-navbtn:hover{background-color:var(--background-mod-muted);color:var(--text-strong)}#__dm-navbtn.dm-active{background-color:var(--background-mod-muted);color:var(--text-strong)}#__dm-navbtn .dm-navicon{flex-shrink:0;color:inherit;width:20px;height:20px;display:flex;align-items:center;justify-content:center;margin-left:5px}#__dm-navbtn .dm-navname{font-size:16px;font-weight:var(--font-weight-medium,500);line-height:20px;font-family:var(--font-primary);color:inherit;white-space:nowrap;margin-left:0;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis}@keyframes __dmPulse{0%,100%{color:var(--brand-500)}50%{color:var(--text-muted)}}#__dm-navbtn.dm-bg{animation:__dmPulse 1.5s infinite;background-color:var(--background-mod-muted)}#__dm-topbtn{display:flex;align-items:center;justify-content:center;width:24px;height:24px;border-radius:50%;color:var(--interactive-normal,var(--text-muted));cursor:pointer;user-select:none;margin-right:16px;flex-shrink:0;transition:color .15s,background-color .15s}#__dm-topbtn:hover{color:var(--interactive-hover,var(--text-strong));background-color:var(--background-mod-subtle)}#__dm-topbtn svg{width:18px;height:18px}#__dm-topbtn.dm-active{color:var(--brand-500)}#__dm-topbtn.dm-bg{animation:__dmPulse 1.5s infinite}.dm-topbtn-label{display:none;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px;font-family:var(--font-primary);color:var(--text-muted)}.dm-topbtn-label.dm-visible{display:inline-block}`;
  document.head.appendChild(cssBtn);

  const css = document.createElement('style');
  css.id = '__dm-css';
  css.textContent = `@keyframes __dmFI{from{opacity:0}to{opacity:1}}@keyframes __dmSI{from{opacity:0;transform:scale(.98) translateY(4px)}to{opacity:1;transform:none}}@keyframes __dmSpin{to{transform:rotate(360deg)}}#__dm-overlay{position:fixed;inset:0;z-index:10000;background:hsl(0 0% 0%/.7);display:flex;align-items:center;justify-content:center;animation:__dmFI .15s ease}#__dm-modal{width:580px;max-width:95vw;max-height:85vh;background:var(--background-base-lower);border-radius:var(--radius-md,12px);box-shadow:var(--shadow-high);display:flex;flex-direction:column;animation:__dmSI .2s ease;font-family:var(--font-primary);color:var(--text-default);overflow:hidden}.dm-hdr{padding:var(--space-md,16px);background:var(--background-base-low);border-bottom:1px solid var(--border-subtle);display:flex;align-items:center;justify-content:space-between;flex-shrink:0}.dm-hdr h2{margin:0;font-size:16px;font-weight:var(--font-weight-bold,700);line-height:20px;font-family:var(--font-primary);color:var(--text-strong)}.dm-hdr .dm-close{width:32px;height:32px;background:var(--background-mod-subtle);border:none;border-radius:50%;cursor:pointer;padding:0;color:var(--icon-subtle);display:flex;align-items:center;justify-content:center;transition:background .15s,color .15s;flex-shrink:0}.dm-hdr .dm-close:hover{background:var(--background-mod-normal);color:var(--icon-strong)}.dm-body{padding:var(--space-md,16px);overflow-y:auto;flex:1}.dm-body::-webkit-scrollbar{width:4px}.dm-body::-webkit-scrollbar-thumb{background:var(--background-mod-strong);border-radius:4px}.dm-footer{padding:var(--space-md,16px);background:var(--background-base-low);border-top:1px solid var(--border-subtle);display:flex;align-items:center;justify-content:flex-end;gap:8px;flex-shrink:0}.dm-tabs{display:flex;gap:var(--space-xs,8px);margin-bottom:var(--space-md,16px);flex-wrap:wrap}.dm-tab{background:var(--background-mod-subtle);border:none;border-radius:var(--radius-sm,8px);cursor:pointer;font-family:var(--font-primary);font-size:14px;font-weight:var(--font-weight-medium,500);color:var(--text-muted);padding:6px 12px;height:32px;transition:background .1s,color .1s;display:flex;align-items:center}.dm-tab:hover{background:var(--background-mod-normal);color:var(--text-default)}.dm-tab.dm-on{background:var(--background-mod-normal);color:var(--text-strong)}.dm-label{display:block;font-size:12px;font-weight:var(--font-weight-bold,700);letter-spacing:.02em;text-transform:uppercase;color:var(--text-muted);margin-bottom:var(--space-xs,8px);font-family:var(--font-primary)}.dm-input,.dm-select{width:100%;box-sizing:border-box;background:var(--input-background,var(--background-mod-strong));border:1px solid var(--border-subtle);border-radius:var(--radius-sm,8px);padding:10px var(--space-sm,12px);color:var(--text-default);font-size:16px;font-weight:var(--font-weight-medium,500);font-family:var(--font-primary);outline:none;transition:border-color .15s;margin-bottom:var(--space-md,16px)}.dm-input::placeholder{color:var(--input-placeholder-text-default,var(--text-muted))}.dm-input:hover{border-color:var(--input-border-hover,var(--border-strong))}.dm-input:focus,.dm-select:focus{border-color:var(--brand-500)}.dm-hint{font-size:14px;line-height:20px;color:var(--text-muted);margin-top:-12px;margin-bottom:var(--space-md,16px);font-family:var(--font-primary)}.dm-btn{min-height:32px;min-width:60px;border:none;border-radius:var(--radius-sm,8px);cursor:pointer;font-family:var(--font-primary);font-size:14px;font-weight:var(--font-weight-medium,500);line-height:16px;padding:2px 12px;box-sizing:border-box;transition:background-color .2s,color .2s}.dm-btn:disabled{opacity:.5;cursor:not-allowed}.dm-btn.dm-ghost{background:transparent;color:var(--text-link,var(--brand-500));min-width:auto;padding:2px 4px}.dm-btn.dm-ghost:hover:not(:disabled){text-decoration:underline}.dm-btn.dm-danger{background:var(--control-critical-primary-background-default,var(--red-new-50,#da373c));color:var(--white,#fff)}.dm-btn.dm-danger:hover:not(:disabled){background:var(--control-critical-primary-background-hover,var(--red-new-60,#a12828))}.dm-btn.dm-stop{background:var(--background-mod-normal,#4e4f54);color:var(--text-default,#dbdee1)}.dm-btn.dm-stop:hover:not(:disabled){background:var(--background-mod-muted,#727379)}.dm-btn.dm-brand{background:var(--brand-500,#5865f2);color:var(--white,#fff)}.dm-btn.dm-brand:hover:not(:disabled){background:var(--brand-560,#4752c4)}.dm-list{max-height:300px;overflow-y:auto;margin:0 -16px}.dm-list::-webkit-scrollbar{width:4px}.dm-list::-webkit-scrollbar-thumb{background:var(--background-mod-strong);border-radius:4px}.dm-fi{align-items:center;border-radius:0;display:flex;gap:var(--space-sm,12px);padding:var(--space-xs,8px) var(--space-md,16px);cursor:pointer;transition:background-color .1s}.dm-fi:hover{background-color:var(--background-mod-muted);color:var(--text-strong)}.dm-fi.dm-sel{background-color:hsl(var(--red-new-50-hsl,0 64% 55%)/.1)}.dm-av{flex-shrink:0;width:32px;height:32px;border-radius:50%;overflow:hidden;background:var(--background-mod-strong);display:flex;align-items:center;justify-content:center;font-weight:var(--font-weight-bold,700);font-size:13px;color:var(--text-strong)}.dm-av img{width:100%;height:100%;object-fit:cover}.dm-av.dm-sq{border-radius:var(--radius-sm,8px)}.dm-fn{flex:1;min-width:0;font-size:15px;font-weight:var(--font-weight-medium,500);color:var(--text-default);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.dm-fn small{font-size:13px;font-weight:400;color:var(--text-muted);margin-left:2px}.dm-chk{flex-shrink:0;width:20px;height:20px;border-radius:50%;border:2px solid var(--border-subtle);display:flex;align-items:center;justify-content:center;transition:all .15s}.dm-fi.dm-sel .dm-chk{background:var(--red-new-50,#da373c);border-color:transparent}.dm-qi.dm-sel .dm-chk{background:var(--brand-500,#5865f2);border-color:transparent}.dm-search{display:flex;align-items:center;gap:var(--space-xs,8px);background:var(--background-mod-strong);border-radius:var(--radius-sm,8px);padding:0 var(--space-sm,12px);margin-bottom:var(--space-xs,8px);border:1px solid var(--border-subtle);transition:border-color .15s}.dm-search:focus-within{border-color:var(--brand-500)}.dm-search input{flex:1;background:none;border:none;outline:none;font-family:var(--font-primary);font-size:14px;color:var(--text-default);padding:9px 0}.dm-search input::placeholder{color:var(--input-placeholder-text-default,var(--text-muted))}.dm-section{padding:var(--space-md,16px) var(--space-md,16px) var(--space-xs,8px);margin:0 -16px;font-size:11px;font-weight:var(--font-weight-bold,700);letter-spacing:.06em;text-transform:uppercase;color:var(--channels-default,var(--text-muted));font-family:var(--font-primary)}.dm-st{margin-top:var(--space-sm,12px);padding:var(--space-xs,8px) var(--space-sm,12px);background:var(--background-mod-subtle);border-radius:var(--radius-sm,8px);font-size:13px;color:var(--text-muted);max-height:80px;overflow-y:auto;line-height:1.5;font-family:var(--font-primary)}.dm-st.dm-ok{color:var(--text-positive,#23a559)}.dm-st.dm-err{color:var(--text-danger,#f23f43)}.dm-pbar{width:100%;height:8px;background:var(--background-mod-strong,#1e1f22);border-radius:4px;overflow:hidden;margin-top:6px}.dm-pfill{height:100%;background:var(--brand-500,#5865f2);border-radius:4px;transition:width .5s ease}.dm-st.dm-ok .dm-pfill{background:var(--text-positive,#23a559)}.dm-spin{display:inline-block;width:12px;height:12px;border:2px solid currentColor;border-top-color:transparent;border-radius:50%;animation:__dmSpin .6s linear infinite;vertical-align:middle;margin-right:4px}.dm-empty{text-align:center;padding:40px 0;color:var(--text-muted);font-size:14px;font-family:var(--font-primary)}.dm-counter{flex:1;font-size:14px;color:var(--text-muted);font-family:var(--font-primary)}.dm-row-hidden{display:none}.dm-qi{align-items:center;border-radius:0;display:flex;gap:var(--space-sm,12px);padding:var(--space-xs,8px) var(--space-md,16px);cursor:pointer;transition:background-color .1s}.dm-qi:hover{background-color:var(--background-mod-muted)}.dm-qi.dm-sel{background-color:hsl(235 86% 65%/.08)}.dm-qicon{flex-shrink:0;width:40px;height:40px;border-radius:var(--radius-sm,8px);overflow:hidden;background:var(--background-mod-strong);display:flex;align-items:center;justify-content:center;font-size:18px}.dm-qicon img{width:100%;height:100%;object-fit:cover}.dm-qinfo{flex:1;min-width:0}.dm-qname{font-size:14px;font-weight:var(--font-weight-medium,500);color:var(--text-default);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.dm-qsub{font-size:12px;color:var(--text-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.dm-qreward{flex-shrink:0;font-size:13px;font-weight:var(--font-weight-semibold,600);color:var(--brand-500,#5865f2);white-space:nowrap}.dm-qtag{display:inline-block;font-size:10px;font-weight:var(--font-weight-bold,700);padding:1px 4px;border-radius:3px;margin-left:4px;vertical-align:middle}.dm-qtag-desktop{background:var(--background-mod-normal);color:var(--text-muted)}.dm-msg{padding:8px 16px;border-bottom:1px solid var(--border-subtle);cursor:pointer;transition:background .1s}.dm-msg:hover{background:var(--background-mod-muted)}.dm-msg-last{border-bottom:none}.dm-msg-top{display:flex;align-items:center;gap:8px;margin-bottom:4px}.dm-msg-author{font-weight:var(--font-weight-semibold,600);color:var(--text-strong);font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.dm-msg-time{font-size:11px;color:var(--text-muted);white-space:nowrap}.dm-msg-loc{font-size:11px;color:var(--text-link);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-left:auto}.dm-msg-content{font-size:14px;color:var(--text-default);line-height:1.4;word-wrap:break-word;white-space:pre-wrap}.dm-msg-tag{color:var(--text-muted);background:var(--background-mod-normal);padding:1px 4px;border-radius:3px;font-size:11px;margin-left:4px;vertical-align:middle}.dm-paginate{display:flex;justify-content:center;align-items:center;gap:8px;margin-top:12px;padding-bottom:4px;}.dm-paginate span{font-size:13px;color:var(--text-muted);font-family:var(--font-primary)}.dm-profile-card{background:var(--background-base-lower);border-radius:8px;overflow:hidden;border:1px solid var(--border-subtle)}.dm-profile-banner{height:120px;background-size:cover;background-position:center top;background-color:var(--background-mod-strong);flex-shrink:0}.dm-profile-header{position:relative;padding:0 16px 16px;margin-top:-40px;display:flex;flex-direction:column;gap:8px}.dm-profile-avatar-wrapper{position:relative;width:80px;height:80px;flex-shrink:0;margin-bottom:4px;z-index:2;overflow:visible}.dm-profile-avatar{width:100%;height:100%;border-radius:50%;border:6px solid var(--background-base-lower,#1e1f22);overflow:hidden;background:var(--background-mod-strong);position:relative;z-index:1}.dm-profile-avatar img{width:100%;height:100%;object-fit:cover}.dm-profile-deco{position:absolute;top:0.6px;left:-1px;width:96px;height:96px;pointer-events:none;z-index:3}.dm-profile-deco img{width:100%;height:100%;object-fit:contain;display:block}.dm-profile-toprow{display:flex;align-items:flex-end;justify-content:space-between;gap:10px}.dm-profile-badges{display:flex;flex-wrap:wrap;gap:6px;justify-content:flex-end;padding-bottom:6px}.dm-profile-badge{width:24px;height:24px;border-radius:50%;background:var(--background-mod-subtle);overflow:hidden;position:relative;cursor:pointer;box-shadow:0 0 0 3px var(--background-base-lower)}.dm-profile-badge img{width:100%;height:100%;object-fit:cover}.dm-profile-badge:hover::after{content:attr(data-tip);position:absolute;bottom:110%;left:50%;transform:translateX(-50%);background:var(--background-floating);color:var(--text-strong);padding:4px 8px;border-radius:4px;font-size:11px;white-space:nowrap;z-index:10;box-shadow:var(--shadow-high)}.dm-profile-names{display:flex;flex-direction:column;margin-top:10px}.dm-profile-gname{font-size:18px;font-weight:var(--font-weight-bold,700);color:var(--text-strong);display:flex;align-items:center;gap:6px}.dm-profile-tag{font-size:11px;background:var(--background-mod-subtle);padding:1px 4px;border-radius:3px;color:var(--text-muted);vertical-align:middle;font-weight:500}.dm-profile-uname{font-size:13px;color:var(--text-muted);margin-top:2px}.dm-profile-pronouns{font-size:12px;color:var(--text-muted);margin-top:4px;font-style:italic}.dm-profile-bio{font-size:13px;color:var(--text-default);white-space:pre-wrap;line-height:1.5;word-wrap:break-word}.dm-profile-section{margin-top:12px;padding:10px 12px;background:var(--background-mod-subtle);border-radius:8px}.dm-profile-section-title{font-size:10px;font-weight:var(--font-weight-bold,700);text-transform:uppercase;letter-spacing:.05em;color:var(--text-muted);margin-bottom:8px}.dm-conn-list{display:flex;flex-direction:column;gap:4px}.dm-conn-item{background:var(--background-base-lower);padding:6px 10px;border-radius:6px;font-size:13px;display:flex;align-items:center;gap:8px;color:var(--text-default)}.dm-conn-dot{width:8px;height:8px;border-radius:50%;flex-shrink:0}.dm-conn-type{color:var(--text-muted);text-transform:capitalize;flex-shrink:0}.dm-conn-name{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.dm-conn-verified{flex-shrink:0;display:flex;align-items:center;color:var(--text-positive,#23a559);font-size:11px}.dm-profile-infos{display:flex;flex-direction:column;gap:4px;font-size:13px;color:var(--text-muted)}.dm-profile-info-item{display:flex;align-items:center;gap:8px;padding:2px 0}.dm-profile-actions{display:flex;gap:8px;margin-top:12px;flex-wrap:wrap}`;

  const IC_X = `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M18.4 4L12 10.4L5.6 4L4 5.6L10.4 12L4 18.4L5.6 20L12 13.6L18.4 20L20 18.4L13.6 12L20 5.6L18.4 4Z"/></svg>`;
  const IC_CHECK = `<svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="1.5,5.5 4,8 8.5,2"/></svg>`;
  const IC_SEARCH = `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M21.707 20.293l-5.188-5.188A8.4 8.4 0 1 0 15.293 16.5l5.19 5.19a1 1 0 1 0 1.414-1.414ZM4 10.5a6.5 6.5 0 1 1 13 0 6.5 6.5 0 0 1-13 0Z"/></svg>`;
  const IC_GEAR = `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32a.49.49 0 0 0-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54A.484.484 0 0 0 14 2h-4a.484.484 0 0 0-.48.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96a.476.476 0 0 0-.59.22L2.74 8.87a.47.47 0 0 0 .12.61l2.03 1.58c-.05.3-.07.62-.07.94s.02.64.07.94l-2.03 1.58a.47.47 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.03.24.23.41.47.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32a.47.47 0 0 0-.12-.61l-2.01-1.58ZM12 15.6A3.6 3.6 0 1 1 12 8.4a3.6 3.6 0 0 1 0 7.2Z"/></svg>`;

  const overlay = document.createElement('div');
  overlay.id = '__dm-overlay';
  const modal = document.createElement('div');
  modal.id = '__dm-modal';
  overlay.appendChild(modal);
  const dmNavBtns = () =>
    [document.getElementById('__dm-navbtn'), document.getElementById('__dm-topbtn')].filter(Boolean);
  const destroy = () => {
    if (dmRunning) {
      overlay.style.display = 'none';
      dmNavBtns().forEach((btn) => {
        btn.classList.add('dm-bg');
        btn.classList.remove('dm-active');
      });
      return;
    }
    overlay.remove();
    css.remove();
    dmNavBtns().forEach((btn) => btn.classList.remove('dm-active'));
  };
  const toggleManager = () => {
    const existingOverlay = document.getElementById('__dm-overlay');
    if (existingOverlay) {
      if (existingOverlay.style.display === 'none') {
        existingOverlay.style.display = 'flex';
        dmNavBtns().forEach((b) => {
          b.classList.add('dm-active');
          b.classList.remove('dm-bg');
        });
      } else {
        destroy();
      }
      return;
    }
    dmNavBtns().forEach((b) => b.classList.add('dm-active'));
    document.body.appendChild(overlay);
    render();
  };
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) destroy();
  });
  document.addEventListener('keydown', function esc(e) {
    if (e.key === 'Escape' && document.getElementById('__dm-overlay')) {
      destroy();
      document.removeEventListener('keydown', esc);
    }
  });
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.shiftKey && (e.code === 'Digit1' || e.key === '1' || e.key === '!')) {
      e.preventDefault();
      toggleManager();
    }
  });
  const setNavProgress = (text) => {
    const navName = document.querySelector('#__dm-navbtn .dm-navname');
    if (navName) navName.textContent = text || 'Gerenciar';
    const topLabel = document.getElementById('__dm-topbtn-label');
    if (topLabel) {
      topLabel.textContent = text || '';
      topLabel.classList.toggle('dm-visible', !!text);
    }
  };

  const $ = (id) => document.getElementById(id);
  const on = (id, fn) => $(id)?.addEventListener('click', fn);
  const hdr = (t) =>
    `<div class="dm-hdr"><h2>${t}</h2><button class="dm-close" id="__dm-x" aria-label="Fechar">${IC_X}</button></div>`;
  const switchTab = (tab) => {
    const tabs = {
      msgs: ['__dm-t1', '__dm-panel-msgs', '__dm-footer-msgs'],
      frd: ['__dm-t2', '__dm-panel-frd', '__dm-footer-frd'],
      qst: ['__dm-t3', '__dm-panel-qst', '__dm-footer-qst'],
      mut: ['__dm-t4', '__dm-panel-mut', '__dm-footer-mut'],
      lev: ['__dm-t5', '__dm-panel-lev', '__dm-footer-lev'],
      rd: ['__dm-t6', '__dm-panel-rd', '__dm-footer-rd'],
      src: ['__dm-t7', '__dm-panel-src', '__dm-footer-src'],
      usr: ['__dm-t8', '__dm-panel-usr', '__dm-footer-usr'],
      exp: ['__dm-t9', '__dm-panel-exp', '__dm-footer-exp'],
    };
    for (const [name, [btnId, panelId, footerId]] of Object.entries(tabs)) {
      const btn = $(btnId);
      if (btn) btn.classList.toggle('dm-on', tab === name);
      const panel = $(panelId);
      if (panel) panel.style.display = tab === name ? '' : 'none';
      const footer = $(footerId);
      if (footer) footer.style.display = tab === name ? '' : 'none';
    }
  };

  const render = (tab = 'msgs') => {
    document.head.appendChild(css);
    modal.innerHTML = `${hdr('Gerenciar')}<div class="dm-body"><div class="dm-tabs"><button class="dm-tab ${tab === 'msgs' ? 'dm-on' : ''}" id="__dm-t1">🗑️ Mensagens</button><button class="dm-tab ${tab === 'frd' ? 'dm-on' : ''}" id="__dm-t2">👥 Amigos</button><button class="dm-tab ${tab === 'qst' ? 'dm-on' : ''}" id="__dm-t3">🎯 Missões</button><button class="dm-tab ${tab === 'mut' ? 'dm-on' : ''}" id="__dm-t4">🔇 Silenciar</button><button class="dm-tab ${tab === 'lev' ? 'dm-on' : ''}" id="__dm-t5">🚪 Sair</button><button class="dm-tab ${tab === 'rd' ? 'dm-on' : ''}" id="__dm-t6">📖 Lido</button><button class="dm-tab ${tab === 'src' ? 'dm-on' : ''}" id="__dm-t7">🔍 Pesquisar</button><button class="dm-tab ${tab === 'usr' ? 'dm-on' : ''}" id="__dm-t8">👤 Usuário</button><button class="dm-tab ${tab === 'exp' ? 'dm-on' : ''}" id="__dm-t9">📥 Exportação</button></div><div id="__dm-panel-msgs" style="display:${tab === 'msgs' ? '' : 'none'}"></div><div id="__dm-panel-frd" style="display:${tab === 'frd' ? '' : 'none'}"></div><div id="__dm-panel-qst" style="display:${tab === 'qst' ? '' : 'none'}"></div><div id="__dm-panel-mut" style="display:${tab === 'mut' ? '' : 'none'}"></div><div id="__dm-panel-lev" style="display:${tab === 'lev' ? '' : 'none'}"></div><div id="__dm-panel-rd" style="display:${tab === 'rd' ? '' : 'none'}"></div><div id="__dm-panel-src" style="display:${tab === 'src' ? '' : 'none'}"></div><div id="__dm-panel-usr" style="display:${tab === 'usr' ? '' : 'none'}"></div><div id="__dm-panel-exp" style="display:${tab === 'exp' ? '' : 'none'}"></div></div><div class="dm-footer" id="__dm-footer-msgs" style="display:${tab === 'msgs' ? '' : 'none'}"></div><div class="dm-footer" id="__dm-footer-frd" style="display:${tab === 'frd' ? '' : 'none'}"></div><div class="dm-footer" id="__dm-footer-qst" style="display:${tab === 'qst' ? '' : 'none'}"></div><div class="dm-footer" id="__dm-footer-mut" style="display:${tab === 'mut' ? '' : 'none'}"></div><div class="dm-footer" id="__dm-footer-lev" style="display:${tab === 'lev' ? '' : 'none'}"></div><div class="dm-footer" id="__dm-footer-rd" style="display:${tab === 'rd' ? '' : 'none'}"></div><div class="dm-footer" id="__dm-footer-src" style="display:${tab === 'src' ? '' : 'none'}"></div><div class="dm-footer" id="__dm-footer-usr" style="display:${tab === 'usr' ? '' : 'none'}"></div><div class="dm-footer" id="__dm-footer-exp" style="display:${tab === 'exp' ? '' : 'none'}"></div>`;
    on('__dm-x', destroy);
    on('__dm-t1', () => switchTab('msgs'));
    on('__dm-t2', () => switchTab('frd'));
    on('__dm-t3', () => switchTab('qst'));
    on('__dm-t4', () => switchTab('mut'));
    on('__dm-t5', () => switchTab('lev'));
    on('__dm-t6', () => switchTab('rd'));
    on('__dm-t7', () => switchTab('src'));
    on('__dm-t8', () => switchTab('usr'));
    on('__dm-t9', () => switchTab('exp'));
    renderMsgs();
    renderFriends();
    renderQuests();
    renderMute();
    renderLeave();
    renderRead();
    renderSearch();
    renderUser();
    renderExport();
  };

  const renderMsgs = () => {
    const panel = $('__dm-panel-msgs'),
      footer = $('__dm-footer-msgs');
    if (!panel || !footer) return;
    panel.innerHTML = `<label class="dm-label">Modo</label><select class="dm-select" id="__dm-modo"><option value="guild">🏠 Servidor inteiro</option><option value="guild-channel">📢 Canal de servidor</option><option value="dm">💬 DM</option></select><div id="__dm-guild-row"><label class="dm-label">ID do servidor</label><input class="dm-input" id="__dm-gid" placeholder="Ex: 123456789012345678"><p class="dm-hint">Clique com botão direito no servidor → "Copiar ID do servidor".</p></div><div id="__dm-channel-row" class="dm-row-hidden"><label class="dm-label">ID do canal</label><input class="dm-input" id="__dm-cid" placeholder="Ex: 857236589123456001"></div><div id="__dm-dm-hint" class="dm-row-hidden"><p class="dm-hint">Para DM, use o ID do canal da DM.</p></div><label class="dm-label">Filtrar por termos (opcional)</label><input class="dm-input" id="__dm-terms" placeholder="arroz, feijão, linguiça"><p class="dm-hint">Separe por vírgula — vazio deleta todas as suas mensagens.</p><p class="dm-hint">O ritmo de deleção segue o rate limit real do Discord (sem delay fixo).</p>`;
    footer.innerHTML = `<button class="dm-btn dm-danger" id="__dm-run">🗑️ Iniciar</button>`;
    const updateFields = () => {
      const m = $('__dm-modo').value;
      $('__dm-guild-row').classList.toggle('dm-row-hidden', m === 'dm');
      $('__dm-channel-row').classList.toggle('dm-row-hidden', m === 'guild');
      $('__dm-dm-hint').classList.toggle('dm-row-hidden', m !== 'dm');
    };
    $('__dm-modo').addEventListener('change', updateFields);
    updateFields();
    let running = false,
      stoppedEarly = false,
      stEl = null;
    const setSt = (h, c = '') => {
      if (!stEl) {
        stEl = document.createElement('div');
        $('__dm-panel-msgs')?.appendChild(stEl);
      }
      stEl.className = `dm-st ${c}`;
      stEl.innerHTML = h;
    };
    const setRunBtn = (r) => {
      const b = $('__dm-run');
      if (!b) return;
      if (r) {
        b.textContent = '⏹️ Parar';
        b.classList.remove('dm-danger');
        b.classList.add('dm-stop');
        b.disabled = false;
      } else {
        b.textContent = '🗑️ Iniciar';
        b.classList.remove('dm-stop');
        b.classList.add('dm-danger');
        b.disabled = false;
      }
    };
    const doSearch = async (gid, cid, aid, mode, term) => {
      const p = { author_id: aid, limit: 25 };
      if (mode === 'guild-channel' && cid) p.channel_id = cid;
      if (term) p.content = term;
      const url =
        mode === 'dm'
          ? `https://discord.com/api/v10/channels/${cid}/messages/search`
          : `https://discord.com/api/v10/guilds/${gid}/messages/search`;
      while (running) {
        const r = await fetch(`${url}?${new URLSearchParams(p)}`, { headers: GET_HEADERS });
        if (r.status === 429) {
          await sleep((await r.json()).retry_after * 1000 || 5000);
          continue;
        }
        if (!r.ok) throw { status: r.status, msg: `Erro ${r.status}` };
        const d = await r.json();
        return { messages: (d.messages || []).map((g) => g[0]).filter(Boolean), total: d.total_results || 0 };
      }
      return { messages: [], total: 0 };
    };
    on('__dm-run', async () => {
      if (running) {
        stoppedEarly = true;
        running = false;
        dmRunning = false;
        setRunBtn(false);
        setSt('⏹️ Parando...', 'dm-err');
        return;
      }
      const mode = $('__dm-modo').value,
        gid = $('__dm-gid')?.value.trim() || '',
        cid = $('__dm-cid')?.value.trim() || '',
        raw = $('__dm-terms').value,
        terms = raw
          ? raw
              .split(',')
              .map((t) => t.trim())
              .filter(Boolean)
          : [null];
      if ((mode === 'guild' || mode === 'guild-channel') && !gid)
        return setSt('⚠️ Informe o ID do servidor.', 'dm-err');
      if ((mode === 'guild-channel' || mode === 'dm') && !cid) return setSt('⚠️ Informe o ID do canal.', 'dm-err');
      running = true;
      dmRunning = true;
      stoppedEarly = false;
      setRunBtn(true);
      let myId;
      try {
        myId = (await (await fetch('https://discord.com/api/v10/users/@me', { headers: GET_HEADERS })).json()).id;
      } catch {
        running = false;
        dmRunning = false;
        setRunBtn(false);
        setSt('❌ Token inválido.', 'dm-err');
        return;
      }
      let total = 0;
      for (const term of terms) {
        if (!running) break;
        const label = term ? `"${term}"` : 'todas';
        let del = 0,
          failed = new Set();
        while (running) {
          if (!$('__dm-run')) break;
          setSt(`<span class="dm-spin"></span> Buscando [${label}] (${del} deletadas)...`);
          let res;
          try {
            res = await doSearch(gid, cid, myId, mode, term);
          } catch (e) {
            setSt(`❌ ${e.msg}`, 'dm-err');
            break;
          }
          const msgs = res.messages.filter((m) => !failed.has(m.id));
          if (!msgs.length) {
            if (res.total > 0) {
              await sleep(15000);
              continue;
            }
            break;
          }
          for (const msg of msgs) {
            if (!running) break;
            const pv = (msg.content || '[anexo]').slice(0, 50);
            setSt(`<span class="dm-spin"></span> [${del + 1}] ${pv}`);
            setNavProgress(`🗑️ ${pv}`);
            const resp = await fetch(
              `https://discord.com/api/v10/channels/${msg.channel_id || cid}/messages/${msg.id}`,
              { method: 'DELETE', headers: DEL_HEADERS },
            );
            if (!running) break;
            if (resp.status === 204) {
              del++;
              setSt(`🗑️ [${del}] "${pv}"`, 'dm-ok');
              const remaining = resp.headers.get('x-ratelimit-remaining');
              const resetAfter = parseFloat(resp.headers.get('x-ratelimit-reset-after'));
              if (remaining === '0' && resetAfter > 0) await sleep(resetAfter * 1000);
            } else if (resp.status === 429) {
              const retry = await resp.json().catch(() => ({}));
              const waitMs = (retry.retry_after ?? parseFloat(resp.headers.get('retry-after')) ?? 1) * 1000;
              setSt(`<span class="dm-spin"></span> ⏳ Rate limited... aguardando ${(waitMs / 1000).toFixed(1)}s`);
              await sleep(waitMs);
            } else {
              failed.add(msg.id);
            }
          }
          await sleep(1500);
        }
        total += del;
      }
      running = false;
      dmRunning = false;
      setRunBtn(false);
      setNavProgress(null);
      setSt(
        stoppedEarly ? `⏹️ Parado! ${total} deletada(s).` : `✅ Concluído! ${total} deletada(s).`,
        stoppedEarly ? 'dm-err' : 'dm-ok',
      );
      const btns = dmNavBtns();
      btns.forEach((btn) => btn.classList.remove('dm-bg'));
      if (overlay.style.display === 'none') {
        overlay.style.display = 'flex';
        btns.forEach((btn) => btn.classList.add('dm-active'));
      }
    });
  };

  const renderFriends = async () => {
    const panel = $('__dm-panel-frd'),
      footer = $('__dm-footer-frd');
    if (!panel || !footer) return;
    panel.innerHTML = `<div class="dm-empty"><span class="dm-spin"></span> Carregando...</div>`;
    footer.innerHTML = `<span class="dm-counter" id="__dm-cnt">0 selecionado(s)</span><button class="dm-btn dm-ghost" id="__dm-selall" disabled>Selecionar todos</button><button class="dm-btn dm-ghost" id="__dm-cancel">Cancelar</button><button class="dm-btn dm-danger" id="__dm-rm" disabled>Remover</button>`;
    on('__dm-cancel', destroy);
    let friends = [],
      sel = new Set();
    try {
      const r = await fetch('https://discord.com/api/v10/users/@me/relationships', { headers: GET_HEADERS });
      if (!r.ok) throw new Error(r.status);
      friends = (await r.json()).filter((f) => f.type === 1);
    } catch (e) {
      panel.innerHTML = `<div class="dm-empty">❌ Erro: ${e.message}</div>`;
      return;
    }
    if (!friends.length) {
      panel.innerHTML = `<div class="dm-empty">Nenhum amigo.</div>`;
      return;
    }
    panel.innerHTML = `<div class="dm-search">${IC_SEARCH}<input id="__dm-fq" placeholder="Pesquisar"></div><div class="dm-section" id="__dm-fsec">${friends.length} amigo(s)</div><div class="dm-list" id="__dm-flist"></div>`;
    const updateList = () => {
      const q = ($('__dm-fq')?.value || '').toLowerCase();
      const list = friends.filter((f) => (f.user.global_name || f.user.username || '').toLowerCase().includes(q));
      $('__dm-fsec').textContent = `${list.length} amigo(s)`;
      $('__dm-flist').innerHTML = list
        .map((f) => {
          const u = f.user,
            n = u.global_name || u.username,
            tg = u.discriminator && u.discriminator !== '0' ? `#${u.discriminator}` : '',
            av = u.avatar
              ? `<img src="https://cdn.discordapp.com/avatars/${u.id}/${u.avatar}.webp?size=64" alt="">`
              : n[0].toUpperCase(),
            s = sel.has(u.id);
          return `<div class="dm-fi${s ? ' dm-sel' : ''}" data-uid="${u.id}"><div class="dm-av">${av}</div><div class="dm-fn">${n}${tg ? `<small>${tg}</small>` : ''}</div><div class="dm-chk">${s ? IC_CHECK : ''}</div></div>`;
        })
        .join('');
      $('__dm-flist')
        .querySelectorAll('.dm-fi')
        .forEach((el) => {
          el.addEventListener('click', () => {
            const uid = el.dataset.uid;
            sel.has(uid) ? sel.delete(uid) : sel.add(uid);
            $('__dm-cnt').textContent = `${sel.size} selecionado(s)`;
            $('__dm-rm').disabled = sel.size === 0;
            updateList();
          });
        });
    };
    $('__dm-fq').addEventListener('input', updateList);
    updateList();
    on('__dm-selall', () => {
      const q = ($('__dm-fq')?.value || '').toLowerCase();
      const ids = friends
        .filter((f) => (f.user.global_name || f.user.username || '').toLowerCase().includes(q))
        .map((f) => f.user.id);
      const all = ids.length > 0 && ids.every((id) => sel.has(id));
      all ? ids.forEach((id) => sel.delete(id)) : ids.forEach((id) => sel.add(id));
      $('__dm-cnt').textContent = `${sel.size} selecionado(s)`;
      $('__dm-rm').disabled = sel.size === 0;
      updateList();
    });
    on('__dm-rm', async () => {
      if (!sel.size) return;
      $('__dm-rm').disabled = true;
      let done = 0,
        fail = 0;
      const st = document.createElement('div');
      st.className = 'dm-st';
      panel.appendChild(st);
      for (const uid of sel) {
        const f = friends.find((x) => x.user.id === uid);
        const name = f ? f.user.global_name || f.user.username : uid;
        st.innerHTML = `<span class="dm-spin"></span> Removendo ${name}... (${done + 1}/${sel.size})`;
        setNavProgress(`👥 ${name} (${done + 1}/${sel.size})`);
        try {
          const r = await fetch(`https://discord.com/api/v10/users/@me/relationships/${uid}`, {
            method: 'DELETE',
            headers: DEL_HEADERS,
          });
          r.ok || r.status === 204 ? done++ : fail++;
        } catch {
          fail++;
        }
        await sleep(600);
      }
      friends = friends.filter((f) => !sel.has(f.user.id));
      sel.clear();
      $('__dm-cnt').textContent = '0 selecionado(s)';
      setNavProgress(null);
      st.className = 'dm-st dm-ok';
      st.innerHTML = `✅ ${done} removido(s)${fail ? ` · ⚠️ ${fail} falha(s)` : ''}`;
      updateList();
    });
  };

  const renderQuests = async () => {
    const panel = $('__dm-panel-qst'),
      footer = $('__dm-footer-qst');
    if (!panel || !footer) return;
    panel.innerHTML = `<div class="dm-empty"><span class="dm-spin"></span> Carregando missões...</div>`;
    footer.innerHTML = `<span class="dm-counter" id="__dm-qcnt">0 selecionada(s)</span><button class="dm-btn dm-ghost" id="__dm-qselall" disabled>Selecionar todos</button><button class="dm-btn dm-brand" id="__dm-qrun" disabled>⚡ Resolver</button>`;
    let allQuests = [],
      sel = new Set();
    let questRunning = false,
      questStopped = false;
    try {
      const r = await fetch('https://discord.com/api/v9/quests/@me', { headers: QUEST_HEADERS });
      if (!r.ok) throw new Error(`${r.status}`);
      const data = await r.json();
      const rawQuests = data.quests || [];
      const now = new Date();
      allQuests = rawQuests.map((q) => {
        const name = q.config?.messages?.quest_name || q.config?.messages?.game_title || 'Missão';
        const game = q.config?.messages?.game_title || '';
        const reward = q.config?.rewards_config?.rewards?.[0]?.messages?.name || 'Recompensa';
        const tilePath = q.config?.assets?.game_tile_dark || q.config?.assets?.game_tile_light || '';
        const tileUrl = tilePath ? `https://cdn.discordapp.com/${tilePath}?format=webp&width=80&height=80` : '';
        const expiresAt = q.config?.expires_at ? new Date(q.config.expires_at) : null;
        const isExpired = expiresAt ? expiresAt <= now : false;
        const isClaimed = !!q.user_status?.claimed_at;
        const isCompleted = !!q.user_status?.completed_at;
        const isEnrolled = !!q.user_status?.enrolled_at;
        let status = '⏳ Não iniciada';
        if (isClaimed) status = '🏆 Resgatada';
        else if (isCompleted) status = '✅ Completa';
        else if (isEnrolled) status = '🔄 Em progresso';
        const taskConfig =
          q.config?.taskConfig || q.config?.task_config || q.config?.taskConfigV2 || q.config?.task_config_v2;
        const taskName = taskConfig?.tasks ? supportedTasks.find((x) => taskConfig.tasks[x] != null) : null;
        const needsDesktop = taskName === 'PLAY_ON_DESKTOP' || taskName === 'STREAM_ON_DESKTOP';
        const taskLabel = taskName ? taskName.replace(/_/g, ' ').toLowerCase() : 'desconhecida';
        return {
          id: q.id,
          name,
          game,
          reward,
          tileUrl,
          expiresAt,
          isExpired,
          isClaimed,
          isCompleted,
          isEnrolled,
          status,
          taskName,
          needsDesktop,
          taskLabel,
          raw: q,
        };
      });
    } catch (e) {
      panel.innerHTML = `<div class="dm-empty">❌ Erro: ${e.message}</div>`;
      return;
    }
    const quests = allQuests.filter((q) => !q.isClaimed && !q.isExpired && q.taskName);
    if (!quests.length) {
      panel.innerHTML = `<div class="dm-empty">🎉 Nenhuma missão ativa!</div>`;
      return;
    }
    panel.innerHTML = `<div class="dm-search">${IC_SEARCH}<input id="__dm-qq" placeholder="Pesquisar missão"></div><div class="dm-section" id="__dm-qsec">${quests.length} missão(ões)</div><div class="dm-list" id="__dm-qlist"></div>`;
    const updateList = () => {
      const q = ($('__dm-qq')?.value || '').toLowerCase();
      const list = quests.filter((qst) => qst.name.toLowerCase().includes(q));
      $('__dm-qsec').textContent = `${list.length} missão(ões)`;
      $('__dm-qlist').innerHTML = list
        .map((qst) => {
          const s = sel.has(qst.id);
          const desktopTag =
            qst.needsDesktop && !isApp ? `<span class="dm-qtag dm-qtag-desktop">🖥️ Desktop</span>` : '';
          return `<div class="dm-qi${s ? ' dm-sel' : ''}" data-qid="${qst.id}"><div class="dm-chk">${s ? IC_CHECK : ''}</div>${qst.tileUrl ? `<div class="dm-qicon"><img src="${qst.tileUrl}" alt=""></div>` : '<div class="dm-qicon">🎮</div>'}<div class="dm-qinfo"><div class="dm-qname">${qst.name}${desktopTag}</div><div class="dm-qsub">${qst.game} · ${qst.status} · ${qst.taskLabel}</div></div><div class="dm-qreward">${qst.reward}</div></div>`;
        })
        .join('');
      const btn = $('__dm-qselall');
      if (btn) {
        const ids = list.map((qst) => qst.id);
        btn.textContent = ids.length > 0 && ids.every((id) => sel.has(id)) ? 'Desselecionar' : 'Selecionar todos';
      }
      $('__dm-qlist')
        .querySelectorAll('.dm-qi')
        .forEach((el) => {
          el.addEventListener('click', () => {
            const qid = el.dataset.qid;
            sel.has(qid) ? sel.delete(qid) : sel.add(qid);
            $('__dm-qcnt').textContent = `${sel.size} selecionada(s)`;
            $('__dm-qrun').disabled = sel.size === 0;
            updateList();
          });
        });
    };
    $('__dm-qq').addEventListener('input', updateList);
    updateList();
    on('__dm-qselall', () => {
      const q = ($('__dm-qq')?.value || '').toLowerCase();
      const visible = quests.filter((qst) => qst.name.toLowerCase().includes(q));
      const ids = visible.map((qst) => qst.id);
      const all = ids.length > 0 && ids.every((id) => sel.has(id));
      all ? ids.forEach((id) => sel.delete(id)) : ids.forEach((id) => sel.add(id));
      $('__dm-qcnt').textContent = `${sel.size} selecionada(s)`;
      $('__dm-qrun').disabled = sel.size === 0;
      updateList();
    });
    on('__dm-qrun', async () => {
      if (questRunning) {
        questStopped = true;
        questRunning = false;
        dmRunning = false;
        const b = $('__dm-qrun');
        if (b) {
          b.textContent = '⚡ Resolver';
          b.classList.remove('dm-stop');
          b.classList.add('dm-brand');
          b.disabled = false;
        }
        return;
      }
      if (!sel.size) return;
      const needsDesktopSelected = [...sel].some((id) => {
        const q = quests.find((qst) => qst.id === id);
        return q && q.needsDesktop && !isApp;
      });
      if (needsDesktopSelected) {
        const st = document.createElement('div');
        st.className = 'dm-st dm-err';
        st.innerHTML = '⚠️ Missões de jogo/stream requerem o app desktop.';
        panel.appendChild(st);
        return;
      }
      questRunning = true;
      questStopped = false;
      dmRunning = true;
      const b = $('__dm-qrun');
      if (b) {
        b.textContent = '⏹️ Parar';
        b.classList.remove('dm-brand');
        b.classList.add('dm-stop');
        b.disabled = false;
      }
      const stEl = document.createElement('div');
      stEl.className = 'dm-st';
      panel.appendChild(stEl);
      const shouldStop = () => questStopped;
      const selectedQuests = quests.filter((q) => sel.has(q.id));
      let completedCount = 0,
        failedCount = 0;
      for (const quest of selectedQuests) {
        if (shouldStop()) break;
        try {
          await resolveSingleQuest(quest, stEl, shouldStop);
          completedCount++;
        } catch (e) {
          failedCount++;
          stEl.className = 'dm-st dm-err';
          stEl.innerHTML = `❌ ${quest.name}: ${e.message}`;
          await sleep(2000);
        }
      }
      questRunning = false;
      dmRunning = false;
      const b2 = $('__dm-qrun');
      if (b2) {
        b2.textContent = '⚡ Resolver';
        b2.classList.remove('dm-stop');
        b2.classList.add('dm-brand');
        b2.disabled = false;
      }
      if (!shouldStop()) {
        stEl.className = 'dm-st dm-ok';
        stEl.innerHTML = `✅ ${completedCount} resolvida(s)${failedCount ? ` · ⚠️ ${failedCount} falha(s)` : ''}`;
      } else {
        stEl.className = 'dm-st dm-err';
        stEl.innerHTML = `⏹️ Parado! ${completedCount} resolvida(s)`;
      }
      const navBtns = dmNavBtns();
      navBtns.forEach((navBtn) => navBtn.classList.remove('dm-bg'));
      if (overlay.style.display === 'none') {
        overlay.style.display = 'flex';
        navBtns.forEach((navBtn) => navBtn.classList.add('dm-active'));
      }
    });
  };

  const renderMute = async () => {
    const panel = $('__dm-panel-mut'),
      footer = $('__dm-footer-mut');
    if (!panel || !footer) return;
    panel.innerHTML = `<div class="dm-empty"><span class="dm-spin"></span> Carregando...</div>`;
    footer.innerHTML = `<span class="dm-counter" id="__dm-mcnt">0 selecionado(s)</span><button class="dm-btn dm-ghost" id="__dm-mselall" disabled>Selecionar todos</button><button class="dm-btn dm-brand" id="__dm-mrun" disabled>🔇 Silenciar</button>`;
    let guilds = [],
      channels = [],
      sel = new Set();
    let currentType = 'guilds';
    const data = await fetchSharedData();
    guilds = [...data.guilds];
    channels = [...data.channels];
    const getAvatar = (item, type) => {
      if (type === 'guilds') {
        if (item.icon)
          return `<img src="https://cdn.discordapp.com/icons/${item.id}/${item.icon}.webp?size=64" alt="">`;
        return (item.name || '?')[0].toUpperCase();
      }
      if (item.type === 3 && item.icon)
        return `<img src="https://cdn.discordapp.com/channel-icons/${item.id}/${item.icon}.webp?size=64" alt="">`;
      if (item.recipients?.[0]?.avatar)
        return `<img src="https://cdn.discordapp.com/avatars/${item.recipients[0].id}/${item.recipients[0].avatar}.webp?size=64" alt="">`;
      return (item.name || item.recipients?.map((r) => r.global_name || r.username).join(', ') || '?')[0].toUpperCase();
    };
    const getName = (item, type) => {
      if (type === 'guilds') return item.name || 'Servidor';
      return item.name || item.recipients?.map((r) => r.global_name || r.username).join(', ') || 'DM';
    };
    const getTypeLabel = (item) => {
      if (item.type === 1) return '💬 DM';
      if (item.type === 3) return '👥 Grupo';
      return '📢 Canal';
    };
    if (!guilds.length && !channels.length) {
      panel.innerHTML = `<div class="dm-empty">❌ Nada encontrado.</div>`;
      return;
    }
    panel.innerHTML = `<label class="dm-label">Tipo</label><select class="dm-select" id="__dm-mtype"><option value="guilds">🌍 Servidores (${guilds.length})</option><option value="channels">💬 Canais, DMs e Grupos (${channels.length})</option></select><div class="dm-search">${IC_SEARCH}<input id="__dm-mq" placeholder="Pesquisar"></div><div class="dm-section" id="__dm-msec">${guilds.length} encontrado(s)</div><div class="dm-list" id="__dm-mlist"></div>`;
    const updateList = () => {
      const q = ($('__dm-mq')?.value || '').toLowerCase();
      const list =
        currentType === 'guilds'
          ? guilds.filter((g) => (g.name || '').toLowerCase().includes(q))
          : channels.filter((c) => getName(c, 'channels').toLowerCase().includes(q));
      $('__dm-msec').textContent = `${list.length} encontrado(s)`;
      $('__dm-mlist').innerHTML = list
        .map((item) => {
          const id = item.id,
            name = currentType === 'guilds' ? item.name : getName(item, 'channels'),
            av = getAvatar(item, currentType),
            sub = currentType === 'channels' ? `<small>${getTypeLabel(item)}</small>` : '',
            s = sel.has(id),
            isG = currentType === 'guilds';
          return `<div class="dm-fi${s ? ' dm-sel' : ''}" data-mid="${id}"><div class="dm-av ${isG ? 'dm-sq' : ''}">${av}</div><div class="dm-fn">${name} ${sub}</div><div class="dm-chk">${s ? IC_CHECK : ''}</div></div>`;
        })
        .join('');
      $('__dm-mlist')
        .querySelectorAll('.dm-fi')
        .forEach((el) => {
          el.addEventListener('click', () => {
            const mid = el.dataset.mid;
            sel.has(mid) ? sel.delete(mid) : sel.add(mid);
            $('__dm-mcnt').textContent = `${sel.size} selecionado(s)`;
            $('__dm-mrun').disabled = sel.size === 0;
            $('__dm-mselall').disabled = false;
            updateList();
          });
        });
      const btn = $('__dm-mselall');
      if (btn) {
        const ids = list.map((i) => i.id);
        btn.textContent = ids.length > 0 && ids.every((id) => sel.has(id)) ? 'Desselecionar' : 'Selecionar todos';
      }
    };
    $('__dm-mtype').addEventListener('change', (e) => {
      currentType = e.target.value;
      sel.clear();
      $('__dm-mcnt').textContent = '0 selecionado(s)';
      $('__dm-mrun').disabled = true;
      $('__dm-mselall').disabled = true;
      updateList();
    });
    $('__dm-mq').addEventListener('input', updateList);
    updateList();
    on('__dm-mselall', () => {
      const q = ($('__dm-mq')?.value || '').toLowerCase();
      const list =
        currentType === 'guilds'
          ? guilds.filter((g) => (g.name || '').toLowerCase().includes(q))
          : channels.filter((c) => getName(c, 'channels').toLowerCase().includes(q));
      const ids = list.map((i) => i.id);
      const all = ids.length > 0 && ids.every((id) => sel.has(id));
      all ? ids.forEach((id) => sel.delete(id)) : ids.forEach((id) => sel.add(id));
      $('__dm-mcnt').textContent = `${sel.size} selecionado(s)`;
      $('__dm-mrun').disabled = sel.size === 0;
      updateList();
    });
    on('__dm-mrun', async () => {
      if (!sel.size) return;
      $('__dm-mrun').disabled = true;
      let done = 0,
        fail = 0;
      const st = document.createElement('div');
      st.className = 'dm-st';
      panel.appendChild(st);
      const muteConfig = { selected_time_window: -1, end_time: null };
      if (currentType === 'guilds') {
        st.innerHTML = `<span class="dm-spin"></span> Silenciando ${sel.size} servidor(es)...`;
        try {
          const guildOverrides = {};
          for (const gid of sel) {
            guildOverrides[gid] = { muted: true, mute_config: muteConfig };
          }
          const r = await fetch('https://discord.com/api/v9/users/@me/guilds/settings', {
            method: 'PATCH',
            headers: POST_HEADERS,
            body: JSON.stringify({ guilds: guildOverrides }),
          });
          r.ok ? (done = sel.size) : (fail = sel.size);
        } catch {
          fail = sel.size;
        }
      } else {
        st.innerHTML = `<span class="dm-spin"></span> Silenciando ${sel.size} canal(is)...`;
        try {
          const channelOverrides = {};
          for (const cid of sel) {
            channelOverrides[cid] = { muted: true, mute_config: muteConfig };
          }
          const r = await fetch('https://discord.com/api/v9/users/@me/guilds/@me/settings', {
            method: 'PATCH',
            headers: POST_HEADERS,
            body: JSON.stringify({ channel_overrides: channelOverrides }),
          });
          r.ok ? (done = sel.size) : (fail = sel.size);
        } catch {
          fail = sel.size;
        }
      }
      sel.clear();
      $('__dm-mcnt').textContent = '0 selecionado(s)';
      st.className = 'dm-st' + (done > 0 ? ' dm-ok' : 'dm-err');
      st.innerHTML = `✅ ${done} silenciado(s)${fail ? ` · ⚠️ ${fail} falha(s)` : ''}`;
      updateList();
    });
  };

  const renderLeave = async () => {
    const panel = $('__dm-panel-lev'),
      footer = $('__dm-footer-lev');
    if (!panel || !footer) return;
    panel.innerHTML = `<div class="dm-empty"><span class="dm-spin"></span> Carregando...</div>`;
    footer.innerHTML = `<span class="dm-counter" id="__dm-lcnt">0 selecionado(s)</span><button class="dm-btn dm-ghost" id="__dm-lselall" disabled>Selecionar todos</button><button class="dm-btn dm-danger" id="__dm-lrun" disabled>🚪 Sair</button>`;
    let guilds = [],
      channels = [],
      sel = new Set();
    let currentType = 'guilds';
    const data = await fetchSharedData();
    guilds = [...data.guilds];
    channels = [...data.channels];
    const getAvatar = (item, type) => {
      if (type === 'guilds') {
        if (item.icon)
          return `<img src="https://cdn.discordapp.com/icons/${item.id}/${item.icon}.webp?size=64" alt="">`;
        return (item.name || '?')[0].toUpperCase();
      }
      if (item.type === 3 && item.icon)
        return `<img src="https://cdn.discordapp.com/channel-icons/${item.id}/${item.icon}.webp?size=64" alt="">`;
      if (item.recipients?.[0]?.avatar)
        return `<img src="https://cdn.discordapp.com/avatars/${item.recipients[0].id}/${item.recipients[0].avatar}.webp?size=64" alt="">`;
      return (item.name || item.recipients?.map((r) => r.global_name || r.username).join(', ') || '?')[0].toUpperCase();
    };
    const getName = (item, type) => {
      if (type === 'guilds') return item.name || 'Servidor';
      return item.name || item.recipients?.map((r) => r.global_name || r.username).join(', ') || 'DM';
    };
    const getTypeLabel = (item) => {
      if (item.type === 1) return '💬 DM';
      if (item.type === 3) return '👥 Grupo';
      return '📢 Canal';
    };
    if (!guilds.length && !channels.length) {
      panel.innerHTML = `<div class="dm-empty">❌ Nada encontrado.</div>`;
      return;
    }
    panel.innerHTML = `<label class="dm-label">Tipo</label><select class="dm-select" id="__dm-ltype"><option value="guilds">🌍 Servidores (${guilds.length})</option><option value="channels">💬 Fechar DMs e Grupos (${channels.length})</option></select><div id="__dm-lhint" class="dm-hint">Sai dos servidores selecionados. Você não pode sair de servidores que é dono.</div><div class="dm-search">${IC_SEARCH}<input id="__dm-lq" placeholder="Pesquisar"></div><div class="dm-section" id="__dm-lsec">${guilds.length} encontrado(s)</div><div class="dm-list" id="__dm-llist"></div>`;
    const updateList = () => {
      const q = ($('__dm-lq')?.value || '').toLowerCase();
      const list =
        currentType === 'guilds'
          ? guilds.filter((g) => (g.name || '').toLowerCase().includes(q))
          : channels.filter((c) => getName(c, 'channels').toLowerCase().includes(q));
      $('__dm-lsec').textContent = `${list.length} encontrado(s)`;
      $('__dm-llist').innerHTML = list
        .map((item) => {
          const id = item.id,
            name = currentType === 'guilds' ? item.name : getName(item, 'channels'),
            av = getAvatar(item, currentType),
            sub = currentType === 'channels' ? `<small>${getTypeLabel(item)}</small>` : '',
            s = sel.has(id),
            isG = currentType === 'guilds';
          return `<div class="dm-fi${s ? ' dm-sel' : ''}" data-lid="${id}"><div class="dm-av ${isG ? 'dm-sq' : ''}">${av}</div><div class="dm-fn">${name} ${sub}</div><div class="dm-chk">${s ? IC_CHECK : ''}</div></div>`;
        })
        .join('');
      $('__dm-llist')
        .querySelectorAll('.dm-fi')
        .forEach((el) => {
          el.addEventListener('click', () => {
            const lid = el.dataset.lid;
            sel.has(lid) ? sel.delete(lid) : sel.add(lid);
            $('__dm-lcnt').textContent = `${sel.size} selecionado(s)`;
            $('__dm-lrun').disabled = sel.size === 0;
            $('__dm-lselall').disabled = false;
            updateList();
          });
        });
      const btn = $('__dm-lselall');
      if (btn) {
        const ids = list.map((i) => i.id);
        btn.textContent = ids.length > 0 && ids.every((id) => sel.has(id)) ? 'Desselecionar' : 'Selecionar todos';
      }
    };
    $('__dm-ltype').addEventListener('change', (e) => {
      currentType = e.target.value;
      sel.clear();
      $('__dm-lcnt').textContent = '0 selecionado(s)';
      $('__dm-lrun').disabled = true;
      $('__dm-lselall').disabled = true;
      $('__dm-lhint').textContent =
        currentType === 'guilds'
          ? 'Sai dos servidores selecionados. Você não pode sair de servidores que é dono.'
          : 'Fecha conversas de DM e grupos. Isso não remove amigos, apenas fecha a aba.';
      updateList();
    });
    $('__dm-lq').addEventListener('input', updateList);
    updateList();
    on('__dm-lselall', () => {
      const q = ($('__dm-lq')?.value || '').toLowerCase();
      const list =
        currentType === 'guilds'
          ? guilds.filter((g) => (g.name || '').toLowerCase().includes(q))
          : channels.filter((c) => getName(c, 'channels').toLowerCase().includes(q));
      const ids = list.map((i) => i.id);
      const all = ids.length > 0 && ids.every((id) => sel.has(id));
      all ? ids.forEach((id) => sel.delete(id)) : ids.forEach((id) => sel.add(id));
      $('__dm-lcnt').textContent = `${sel.size} selecionado(s)`;
      $('__dm-lrun').disabled = sel.size === 0;
      updateList();
    });
    on('__dm-lrun', async () => {
      if (!sel.size) return;
      $('__dm-lrun').disabled = true;
      let done = 0,
        fail = 0;
      const st = document.createElement('div');
      st.className = 'dm-st';
      panel.appendChild(st);
      for (const id of sel) {
        const action = currentType === 'guilds' ? 'Saindo do servidor' : 'Fechando conversa';
        st.innerHTML = `<span class="dm-spin"></span> ${action}... (${done + 1}/${sel.size})`;
        try {
          const url =
            currentType === 'guilds'
              ? `https://discord.com/api/v9/users/@me/guilds/${id}`
              : `https://discord.com/api/v9/channels/${id}`;
          const r = await fetch(url, { method: 'DELETE', headers: DEL_HEADERS });
          r.ok || r.status === 204 ? done++ : fail++;
        } catch {
          fail++;
        }
        await sleep(800);
      }
      if (currentType === 'guilds') guilds = guilds.filter((g) => !sel.has(g.id));
      else channels = channels.filter((c) => !sel.has(c.id));
      sel.clear();
      $('__dm-lcnt').textContent = '0 selecionado(s)';
      st.className = 'dm-st' + (fail > 0 && done === 0 ? ' dm-err' : 'dm-ok');
      const actionDone = currentType === 'guilds' ? 'Saiu de' : 'Fechou';
      st.innerHTML = `✅ ${actionDone} ${done}${fail ? ` · ⚠️ ${fail} falha(s)${currentType === 'guilds' ? ' (dono?)' : ''}` : ''}`;
      updateList();
    });
  };

  const renderRead = async () => {
    const panel = $('__dm-panel-rd'),
      footer = $('__dm-footer-rd');
    if (!panel || !footer) return;
    panel.innerHTML = `<div class="dm-empty"><span class="dm-spin"></span> Carregando...</div>`;
    footer.innerHTML = `<span class="dm-counter" id="__dm-rcnt">0 selecionado(s)</span><button class="dm-btn dm-ghost" id="__dm-rselall" disabled>Selecionar todos</button><button class="dm-btn dm-brand" id="__dm-rrun" disabled>📖 Marcar como lido</button>`;
    let guilds = [],
      channels = [],
      sel = new Set();
    let currentType = 'guilds';
    const data = await fetchSharedData();
    guilds = [...data.guilds];
    channels = [...data.channels];
    const getAvatar = (item, type) => {
      if (type === 'guilds') {
        if (item.icon)
          return `<img src="https://cdn.discordapp.com/icons/${item.id}/${item.icon}.webp?size=64" alt="">`;
        return (item.name || '?')[0].toUpperCase();
      }
      if (item.type === 3 && item.icon)
        return `<img src="https://cdn.discordapp.com/channel-icons/${item.id}/${item.icon}.webp?size=64" alt="">`;
      if (item.recipients?.[0]?.avatar)
        return `<img src="https://cdn.discordapp.com/avatars/${item.recipients[0].id}/${item.recipients[0].avatar}.webp?size=64" alt="">`;
      return (item.name || item.recipients?.map((r) => r.global_name || r.username).join(', ') || '?')[0].toUpperCase();
    };
    const getName = (item, type) => {
      if (type === 'guilds') return item.name || 'Servidor';
      return item.name || item.recipients?.map((r) => r.global_name || r.username).join(', ') || 'DM';
    };
    const getTypeLabel = (item) => {
      if (item.type === 1) return '💬 DM';
      if (item.type === 3) return '👥 Grupo';
      return '📢 Canal';
    };
    if (!guilds.length && !channels.length) {
      panel.innerHTML = `<div class="dm-empty">❌ Nada encontrado.</div>`;
      return;
    }
    panel.innerHTML = `<label class="dm-label">Tipo</label><select class="dm-select" id="__dm-rtype"><option value="guilds">🌍 Servidores (${guilds.length})</option><option value="channels">💬 DMs e Grupos (${channels.length})</option></select><p class="dm-hint">O delay é calculado automaticamente pelo Discord para evitar bloqueios.</p><div class="dm-search">${IC_SEARCH}<input id="__dm-rq" placeholder="Pesquisar"></div><div class="dm-section" id="__dm-rsec">${guilds.length} encontrado(s)</div><div class="dm-list" id="__dm-rlist"></div>`;
    const updateList = () => {
      const q = ($('__dm-rq')?.value || '').toLowerCase();
      const list =
        currentType === 'guilds'
          ? guilds.filter((g) => (g.name || '').toLowerCase().includes(q))
          : channels.filter((c) => getName(c, 'channels').toLowerCase().includes(q));
      $('__dm-rsec').textContent = `${list.length} encontrado(s)`;
      $('__dm-rlist').innerHTML = list
        .map((item) => {
          const id = item.id,
            name = currentType === 'guilds' ? item.name : getName(item, 'channels'),
            av = getAvatar(item, currentType),
            sub = currentType === 'channels' ? `<small>${getTypeLabel(item)}</small>` : '',
            s = sel.has(id),
            isG = currentType === 'guilds';
          return `<div class="dm-fi${s ? ' dm-sel' : ''}" data-rid="${id}"><div class="dm-av ${isG ? 'dm-sq' : ''}">${av}</div><div class="dm-fn">${name} ${sub}</div><div class="dm-chk">${s ? IC_CHECK : ''}</div></div>`;
        })
        .join('');
      $('__dm-rlist')
        .querySelectorAll('.dm-fi')
        .forEach((el) => {
          el.addEventListener('click', () => {
            const rid = el.dataset.rid;
            sel.has(rid) ? sel.delete(rid) : sel.add(rid);
            $('__dm-rcnt').textContent = `${sel.size} selecionado(s)`;
            $('__dm-rrun').disabled = sel.size === 0;
            $('__dm-rselall').disabled = false;
            updateList();
          });
        });
      const btn = $('__dm-rselall');
      if (btn) {
        const ids = list.map((i) => i.id);
        btn.textContent = ids.length > 0 && ids.every((id) => sel.has(id)) ? 'Desselecionar' : 'Selecionar todos';
      }
    };
    $('__dm-rtype').addEventListener('change', (e) => {
      currentType = e.target.value;
      sel.clear();
      $('__dm-rcnt').textContent = '0 selecionado(s)';
      $('__dm-rrun').disabled = true;
      $('__dm-rselall').disabled = true;
      updateList();
    });
    $('__dm-rq').addEventListener('input', updateList);
    updateList();
    on('__dm-rselall', () => {
      const q = ($('__dm-rq')?.value || '').toLowerCase();
      const list =
        currentType === 'guilds'
          ? guilds.filter((g) => (g.name || '').toLowerCase().includes(q))
          : channels.filter((c) => getName(c, 'channels').toLowerCase().includes(q));
      const ids = list.map((i) => i.id);
      const all = ids.length > 0 && ids.every((id) => sel.has(id));
      all ? ids.forEach((id) => sel.delete(id)) : ids.forEach((id) => sel.add(id));
      $('__dm-rcnt').textContent = `${sel.size} selecionado(s)`;
      $('__dm-rrun').disabled = sel.size === 0;
      updateList();
    });
    on('__dm-rrun', async () => {
      if (!sel.size) return;
      $('__dm-rrun').disabled = true;
      let guildDone = 0,
        guildFail = 0;
      const readStates = [];
      const st = document.createElement('div');
      st.className = 'dm-st';
      panel.appendChild(st);
      if (currentType === 'guilds') {
        const guildArr = [...sel];
        for (let i = 0; i < guildArr.length; i++) {
          const gid = guildArr[i];
          const gName = guilds.find((g) => g.id === gid)?.name || gid;
          st.innerHTML = `<span class="dm-spin"></span> Buscando canais de ${gName} (${i + 1}/${guildArr.length})...`;
          try {
            const r = await fetch(`https://discord.com/api/v9/guilds/${gid}/channels`, { headers: GET_HEADERS });
            if (r.status === 429) {
              const retry = await r.json().catch(() => ({}));
              const waitSec = retry.retry_after || 5;
              st.innerHTML = `<span class="dm-spin"></span> ⏳ Rate limit! Aguardando ${Math.ceil(waitSec)}s...`;
              await sleep(waitSec * 1000);
              i--;
              continue;
            }
            if (!r.ok) {
              guildFail++;
              continue;
            }
            const guildChannels = await r.json();
            for (const ch of guildChannels) {
              if ([0, 5, 15].includes(ch.type) && ch.last_message_id) {
                readStates.push({ channel_id: ch.id, message_id: ch.last_message_id, read_state_type: 0 });
              }
            }
            guildDone++;
          } catch {
            guildFail++;
          }
          await sleep(600);
        }
      } else {
        const chArr = [...sel];
        for (let i = 0; i < chArr.length; i++) {
          const cid = chArr[i];
          const ch = channels.find((c) => c.id === cid);
          st.innerHTML = `<span class="dm-spin"></span> Processando (${i + 1}/${chArr.length})...`;
          if (ch && ch.last_message_id) {
            readStates.push({ channel_id: cid, message_id: ch.last_message_id, read_state_type: 0 });
          } else if (ch) {
            try {
              const r = await fetch(`https://discord.com/api/v9/channels/${cid}/messages?limit=1`, {
                headers: GET_HEADERS,
              });
              if (r.status === 429) {
                const retry = await r.json().catch(() => ({}));
                const waitSec = retry.retry_after || 5;
                st.innerHTML = `<span class="dm-spin"></span> ⏳ Rate limit! Aguardando ${Math.ceil(waitSec)}s...`;
                await sleep(waitSec * 1000);
                i--;
                continue;
              }
              if (r.ok) {
                const msgs = await r.json();
                if (msgs.length > 0) {
                  readStates.push({ channel_id: cid, message_id: msgs[0].id, read_state_type: 0 });
                }
              }
            } catch {}
            await sleep(600);
          }
        }
      }
      const chunkSize = 100;
      const chunks = [];
      for (let i = 0; i < readStates.length; i += chunkSize) {
        chunks.push(readStates.slice(i, i + chunkSize));
      }
      let ackDone = 0,
        ackFail = 0;
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        st.innerHTML = `<span class="dm-spin"></span> Marcando como lido (${Math.min((i + 1) * chunkSize, readStates.length)}/${readStates.length} canais)...`;
        try {
          const r = await fetch('https://discord.com/api/v9/read-states/ack-bulk', {
            method: 'POST',
            headers: POST_HEADERS,
            body: JSON.stringify({ read_states: chunk }),
          });
          if (r.status === 429) {
            const retry = await r.json().catch(() => ({}));
            const waitSec = retry.retry_after || 5;
            st.innerHTML = `<span class="dm-spin"></span> ⏳ Rate limit no ack! Aguardando ${Math.ceil(waitSec)}s...`;
            await sleep(waitSec * 1000);
            i--;
            continue;
          }
          if (r.ok || r.status === 204) {
            ackDone += chunk.length;
          } else {
            ackFail += chunk.length;
          }
        } catch {
          ackFail += chunk.length;
        }
        await sleep(600);
      }
      sel.clear();
      $('__dm-rcnt').textContent = '0 selecionado(s)';
      st.className = 'dm-st' + (ackDone > 0 ? ' dm-ok' : 'dm-err');
      st.innerHTML = `✅ ${ackDone} canal(is) marcado(s) como lido(s)${ackFail ? ` · ⚠️ ${ackFail} falha(s)` : ''}`;
      updateList();
    });
  };

  const renderSearch = async () => {
    const panel = $('__dm-panel-src'),
      footer = $('__dm-footer-src');
    if (!panel || !footer) return;

    panel.innerHTML = `
      <label class="dm-label">Pesquisar em</label>
      <select class="dm-select" id="__dm-sscope">
        <option value="both">🌍 Servidores e DMs</option>
        <option value="guilds">🌍 Apenas Servidores</option>
        <option value="dms">💬 Apenas DMs e Grupos</option>
      </select>
      <label class="dm-label">Termo de busca</label>
      <input class="dm-input" id="__dm-squery" placeholder="Ex: hello world">
      <p class="dm-hint">O script varre vários locais até juntar <strong>100 mensagens</strong> para mostrar na página. Se não houver 100 no total, mostra as que encontrar.</p>
      <div id="__dm-sstatus" class="dm-st" style="display:none;"></div>
      <div id="__dm-sresults"></div>`;

    footer.innerHTML = `<span class="dm-counter" id="__dm-scnt">0 resultado(s)</span><button class="dm-btn dm-brand" id="__dm-srun">🔍 Iniciar Busca</button>`;

    let searchState = {
      scope: 'both',
      query: '',
      phase: 'guilds',
      currentIndex: 0,
      currentOffset: 0,
      totalInCurrent: 0,
      hasMore: true,
      isFetching: false,
      currentPage: 1,
      pageMessages: [],
    };

    const TARGET_PER_PAGE = 100;
    const API_FETCH_LIMIT = 25;
    let pagesHistory = [];

    const formatContent = (msg) => {
      let text = msg.content || '';
      if (msg.attachments.length > 0) text += (text ? ' ' : '') + "<span class='dm-msg-tag'>[anexo]</span>";
      if (msg.embeds.length > 0) text += (text ? ' ' : '') + "<span class='dm-msg-tag'>[embed]</span>";
      return text || "<span class='dm-msg-tag'>[vazio]</span>";
    };

    const updateStatus = (text) => {
      const st = $('__dm-sstatus');
      if (st) {
        st.style.display = text ? '' : 'none';
        st.innerHTML = text;
      }
    };

    const renderPage = () => {
      const resultsDiv = $('__dm-sresults');
      const counter = $('__dm-scnt');
      if (!resultsDiv || !counter) return;

      if (!searchState.pageMessages.length) {
        resultsDiv.innerHTML = `<div class="dm-empty">Nenhuma mensagem encontrada.</div>`;
        counter.textContent = '0 resultado(s)';
        return;
      }

      counter.textContent = `${searchState.pageMessages.length} resultado(s) nesta página`;

      let html = '';
      searchState.pageMessages.forEach((msg, index) => {
        const author = msg.author?.global_name || msg.author?.username || 'Desconhecido';
        const time = new Date(msg.timestamp).toLocaleString('pt-BR');
        const jumpLink = `https://discord.com/channels/${msg.guild_id || '@me'}/${msg.channel_id}/${msg.id}`;
        const location = msg.__guildName ? `🌍 ${escapeHtml(msg.__guildName)}` : '💬 DM';

        html += `<div class="dm-msg ${index === searchState.pageMessages.length - 1 ? 'dm-msg-last' : ''}" onclick="window.location.href='${jumpLink}'">
          <div class="dm-msg-top">
            <span class="dm-msg-author">${escapeHtml(author)}</span>
            <span class="dm-msg-time">${time}</span>
            <span class="dm-msg-loc">${location}</span>
          </div>
          <div class="dm-msg-content">${formatContent(msg)}</div>
        </div>`;
      });

      html += `<div class="dm-paginate">`;
      if (searchState.currentPage > 1) html += `<button class="dm-btn dm-brand" id="__dm-sprev">⬅️ Anterior</button>`;
      html += `<span>Página ${searchState.currentPage}</span>`;

      if (searchState.pageMessages.length >= TARGET_PER_PAGE || searchState.hasMore) {
        html += `<button class="dm-btn dm-brand" id="__dm-snext">Próxima ➡️</button>`;
      }
      html += `</div>`;

      resultsDiv.innerHTML = html;

      const prevBtn = $('__dm-sprev');
      if (prevBtn)
        prevBtn.addEventListener('click', () => {
          searchState.currentPage--;
          renderHistoryPage();
        });

      const nextBtn = $('__dm-snext');
      if (nextBtn)
        nextBtn.addEventListener('click', async () => {
          searchState.currentPage++;
          await fetchPage();
        });
    };

    const renderHistoryPage = () => {
      searchState.pageMessages = pagesHistory[searchState.currentPage - 1] || [];
      renderPage();
    };

    const fetchPage = async () => {
      if (searchState.isFetching) return;

      if (pagesHistory.length >= searchState.currentPage) {
        renderHistoryPage();
        return;
      }

      searchState.isFetching = true;
      searchState.pageMessages = [];
      const runBtn = $('__dm-srun');
      if (runBtn) runBtn.disabled = true;

      const data = await fetchSharedData();

      while (searchState.pageMessages.length < TARGET_PER_PAGE) {
        if (!searchState.hasMore) break;

        let currentTargets = searchState.phase === 'guilds' ? data.guilds : data.channels;

        if (searchState.currentIndex >= currentTargets.length) {
          if (searchState.phase === 'guilds' && searchState.scope === 'both') {
            searchState.phase = 'dms';
            searchState.currentIndex = 0;
            searchState.currentOffset = 0;
            continue;
          } else {
            searchState.hasMore = false;
            break;
          }
        }

        let target = currentTargets[searchState.currentIndex];
        let targetName =
          searchState.phase === 'guilds'
            ? target.name
            : target.name || target.recipients?.map((r) => r.global_name || r.username).join(', ') || 'DM';

        updateStatus(
          `<span class="dm-spin"></span> Buscando em: ${escapeHtml(targetName)} (${searchState.pageMessages.length}/${TARGET_PER_PAGE} coletados)...`,
        );

        let url =
          searchState.phase === 'guilds'
            ? `https://discord.com/api/v9/guilds/${target.id}/messages/search`
            : `https://discord.com/api/v9/channels/${target.id}/messages/search`;

        try {
          const p = { limit: API_FETCH_LIMIT, offset: searchState.currentOffset };
          if (searchState.query) p.content = searchState.query;

          const r = await fetch(`${url}?${new URLSearchParams(p)}`, { headers: GET_HEADERS });

          if (r.status === 429) {
            const retry = await r.json().catch(() => ({}));
            const waitSec = retry.retry_after || 5;
            updateStatus(`<span class="dm-spin"></span> ⏳ Rate limit! Aguardando ${Math.ceil(waitSec)}s...`);
            await sleep(waitSec * 1000);
            continue;
          }

          if (r.status === 202) {
            const retry = await r.json().catch(() => ({}));
            const waitSec = retry.retry_after || 1;
            updateStatus(
              `<span class="dm-spin"></span> ⏳ Indexando ${escapeHtml(targetName)}... Aguardando ${waitSec + 1}s...`,
            );
            await sleep((waitSec + 1) * 1000);
            continue;
          }

          if (r.ok) {
            const d = await r.json();
            searchState.totalInCurrent = d.total_results || 0;
            const msgs = (d.messages || []).map((m) => m[0]).filter(Boolean);

            msgs.forEach((m) => {
              m.__guildName = searchState.phase === 'guilds' ? target.name : null;
              searchState.pageMessages.push(m);
            });

            searchState.currentOffset += msgs.length;

            if (msgs.length === 0 || searchState.currentOffset >= searchState.totalInCurrent) {
              searchState.currentIndex++;
              searchState.currentOffset = 0;
              await sleep(600);
            }

            if (searchState.pageMessages.length >= TARGET_PER_PAGE) {
              break;
            }
          } else {
            searchState.currentIndex++;
            searchState.currentOffset = 0;
            await sleep(600);
          }
        } catch {
          searchState.currentIndex++;
          searchState.currentOffset = 0;
          await sleep(600);
        }
      }

      searchState.pageMessages.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      pagesHistory.push([...searchState.pageMessages]);

      searchState.isFetching = false;
      if (runBtn) runBtn.disabled = false;
      updateStatus('');
      renderPage();
    };

    on('__dm-srun', async () => {
      searchState = {
        scope: $('__dm-sscope').value,
        query: $('__dm-squery').value.trim(),
        phase: $('__dm-sscope').value === 'dms' ? 'dms' : 'guilds',
        currentIndex: 0,
        currentOffset: 0,
        totalInCurrent: 0,
        hasMore: true,
        isFetching: false,
        currentPage: 1,
        pageMessages: [],
      };
      pagesHistory = [];

      await fetchPage();
    });
  };

  // ==========================================
  // ABA USUÁRIO - COM ANIMAÇÕES CORRIGIDAS
  // ==========================================
  const renderUser = () => {
    const panel = $('__dm-panel-usr'),
      footer = $('__dm-footer-usr');
    if (!panel || !footer) return;

    panel.innerHTML = `
      <label class="dm-label">ID do Usuário</label>
      <input class="dm-input" id="__dm-uid" placeholder="Ex: 629067248522231838">
      <div id="__dm-uresult"></div>`;

    footer.innerHTML = `<button class="dm-btn dm-brand" id="__dm-urun">🔍 Buscar Perfil</button>`;

    const getCreationDate = (id) => {
      try {
        const timestamp = Number(BigInt(id) >> 22n) + 1420070400000;
        return new Date(timestamp).toLocaleString('pt-BR', { dateStyle: 'long', timeStyle: 'short' });
      } catch {
        return 'Desconhecido';
      }
    };

    const intToHex = (int) => (int ? '#' + int.toString(16).padStart(6, '0') : null);

    const CONN_COLORS = {
      spotify: '#1db954',
      steam: '#66c0f4',
      github: '#f0f6fc',
      twitter: '#1da1f2',
      x: '#f0f6fc',
      youtube: '#ff0000',
      twitch: '#9146ff',
      reddit: '#ff4500',
      tiktok: '#ff0050',
      battlenet: '#00aeff',
      epicgames: '#f0f6fc',
      xbox: '#107c10',
      playstation: '#0070d1',
      paypal: '#00457c',
      instagram: '#e1306c',
      facebook: '#1877f2',
      crunchyroll: '#f47521',
    };

    const renderProfile = (data) => {
      const user = data.user || data;
      const profile = data.user_profile || user;
      const badges = data.badges || [];
      const guildBadges = data.guild_badges || [];
      const connAccounts = data.connected_accounts || [];
      const mutualFriendsCount = data.mutual_friends_count || 0;
      const mutualGuilds = data.mutual_guilds || [];

      // ── Avatar ──────────────────────────────────────────────────
      const isAvatarGif = user.avatar?.startsWith('a_');
      const avatarUrl = user.avatar
        ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.${isAvatarGif ? 'gif' : 'webp'}?size=256`
        : `https://cdn.discordapp.com/embed/avatars/${
            user.discriminator !== '0' ? parseInt(user.discriminator) % 5 : (parseInt(user.id) >> 22) % 6
          }.png`;

      // ── Decoração — passthrough=true força APNG/GIF animado ─────
      const decoAsset = user.avatar_decoration_data?.asset;
      const decoUrl = decoAsset
        ? `https://cdn.discordapp.com/avatar-decoration-presets/${decoAsset}.png?passthrough=true&size=240`
        : '';

      // ── Banner ──────────────────────────────────────────────────
      const isBannerGif = user.banner?.startsWith('a_');
      const bannerUrl = user.banner
        ? `https://cdn.discordapp.com/banners/${user.id}/${user.banner}.${isBannerGif ? 'gif' : 'webp'}?size=600`
        : '';

      const accentColor = intToHex(profile.accent_color || user.accent_color) || '#5865f2';
      const bannerColor = user.banner_color || accentColor;
      const clan = user.primary_guild || user.clan;

      let nitroStatus = 'Sem Nitro';
      if (data.premium_type === 1) nitroStatus = 'Nitro Classic';
      if (data.premium_type === 2) nitroStatus = 'Nitro';
      if (data.premium_type === 3) nitroStatus = 'Nitro Basic';

      const allBadges = [...guildBadges, ...badges];

      // ── Banner: usa <img> para GIF animado, <div> para estático ─
      const bannerHtml = bannerUrl
        ? isBannerGif
          ? `<div class="dm-profile-banner" style="background-color:${bannerColor}">
               <img src="${bannerUrl}" style="width:100%;height:100%;object-fit:cover;object-position:center top;display:block;" alt="">
             </div>`
          : `<div class="dm-profile-banner" style="background-image:url('${bannerUrl}');background-color:${bannerColor};"></div>`
        : `<div class="dm-profile-banner" style="background-color:${bannerColor};"></div>`;

      $('__dm-uresult').innerHTML = `
        <div class="dm-profile-card">
          ${bannerHtml}
          <div class="dm-profile-header">

            <!-- Avatar + Decoração + Badges -->
            <div class="dm-profile-toprow">
              <div class="dm-profile-avatar-wrapper">
                ${decoUrl ? `<div class="dm-profile-deco"><img src="${decoUrl}" alt=""></div>` : ''}
                <div class="dm-profile-avatar">
                  <img src="${avatarUrl}" alt="">
                </div>
              </div>
              ${
                allBadges.length > 0
                  ? `
              <div class="dm-profile-badges">
                ${allBadges
                  .map(
                    (b) => `
                  <div class="dm-profile-badge" data-tip="${escapeHtml(b.description || b.id)}">
                    <img src="https://cdn.discordapp.com/badge-icons/${b.icon}.png" alt="">
                  </div>`,
                  )
                  .join('')}
              </div>`
                  : ''
              }
            </div>

            <!-- Nome, pronomes -->
            <div class="dm-profile-names">
              <div class="dm-profile-gname">
                ${escapeHtml(user.global_name || user.username)}
                ${clan?.tag ? `<span class="dm-profile-tag">${escapeHtml(clan.tag)}</span>` : ''}
              </div>
              <div class="dm-profile-uname">
                ${escapeHtml(user.username)}${user.discriminator && user.discriminator !== '0' ? `#${user.discriminator}` : ''}
              </div>
              ${profile.pronouns ? `<div class="dm-profile-pronouns">${escapeHtml(profile.pronouns)}</div>` : ''}
            </div>

            <!-- Ações -->
            <div class="dm-profile-actions">
              ${bannerUrl ? `<button class="dm-btn dm-ghost" id="__dm-dl-banner">📥 Banner</button>` : ''}
              <button class="dm-btn dm-ghost" id="__dm-dl-avatar">📥 Avatar</button>
              ${profile.bio ? `<button class="dm-btn dm-ghost" id="__dm-copy-bio">📋 Copiar Bio</button>` : ''}
            </div>

            <!-- Bio -->
            ${
              profile.bio
                ? `
              <div class="dm-profile-section">
                <div class="dm-profile-section-title">Sobre mim</div>
                <div class="dm-profile-bio">${escapeHtml(profile.bio)}</div>
              </div>`
                : ''
            }

            <!-- Infos gerais -->
            <div class="dm-profile-section">
              <div class="dm-profile-section-title">Informações</div>
              <div class="dm-profile-infos">
                <div class="dm-profile-info-item">📅 Conta criada em: ${getCreationDate(user.id)}</div>
                <div class="dm-profile-info-item" style="color:${accentColor}">✨ ${nitroStatus}</div>
                ${mutualFriendsCount > 0 ? `<div class="dm-profile-info-item">👥 Amigos em comum: ${mutualFriendsCount}</div>` : ''}
                ${mutualGuilds.length > 0 ? `<div class="dm-profile-info-item">🌍 Servidores em comum: ${mutualGuilds.length}</div>` : ''}
              </div>
            </div>

            <!-- Conexões -->
            ${
              connAccounts.length > 0
                ? `
              <div class="dm-profile-section">
                <div class="dm-profile-section-title">Conexões</div>
                <div class="dm-conn-list">
                  ${connAccounts
                    .map(
                      (c) => `
                    <div class="dm-conn-item">
                      <span class="dm-conn-dot" style="background:${CONN_COLORS[c.type] || 'var(--brand-500)'}"></span>
                      <span class="dm-conn-type">${escapeHtml(c.type)}</span>
                      <span class="dm-conn-name">${escapeHtml(c.name)}</span>
                      ${c.verified ? `<span class="dm-conn-verified" title="Verificado">✔</span>` : ''}
                    </div>`,
                    )
                    .join('')}
                </div>
              </div>`
                : ''
            }
          </div>
        </div>`;

      // Botões de ação
      const dlBanner = $('__dm-dl-banner');
      if (dlBanner) dlBanner.addEventListener('click', () => window.open(bannerUrl, '_blank'));

      const dlAvatar = $('__dm-dl-avatar');
      if (dlAvatar) dlAvatar.addEventListener('click', () => window.open(avatarUrl, '_blank'));

      const copyBio = $('__dm-copy-bio');
      if (copyBio)
        copyBio.addEventListener('click', () => {
          navigator.clipboard.writeText(profile.bio).then(() => {
            copyBio.textContent = '✅ Copiado!';
            setTimeout(() => {
              copyBio.textContent = '📋 Copiar Bio';
            }, 2000);
          });
        });
    };

    on('__dm-urun', async () => {
      const uid = $('__dm-uid')?.value.trim();
      if (!uid || !/^\d{17,20}$/.test(uid)) {
        $('__dm-uresult').innerHTML = `<div class="dm-st dm-err">⚠️ ID inválido. Deve conter 17-20 dígitos.</div>`;
        return;
      }

      $('__dm-uresult').innerHTML = `<div class="dm-empty"><span class="dm-spin"></span> Buscando perfil...</div>`;
      const runBtn = $('__dm-urun');
      if (runBtn) runBtn.disabled = true;

      try {
        const r = await fetch(
          `https://discord.com/api/v9/users/${uid}/profile?type=modal&with_mutual_guilds=true&with_mutual_friends=false&with_mutual_friends_count=true`,
          { headers: GET_HEADERS },
        );

        if (r.status === 429) {
          const retry = await r.json().catch(() => ({}));
          const waitSec = retry.retry_after || 5;
          $('__dm-uresult').innerHTML = `<div class="dm-st dm-err">⏳ Rate limit! Aguarde ${waitSec}s.</div>`;
          await sleep(waitSec * 1000);
          if (runBtn) runBtn.disabled = false;
          return;
        }

        if (!r.ok) {
          const errData = await r.json().catch(() => ({}));
          throw new Error(errData.message || `Erro ${r.status}`);
        }

        const data = await r.json();
        renderProfile(data);
      } catch (e) {
        $('__dm-uresult').innerHTML = `<div class="dm-st dm-err">❌ Erro: ${escapeHtml(e.message)}</div>`;
      } finally {
        if (runBtn) runBtn.disabled = false;
      }
    });
  };

  const renderExport = async () => {
    const panel = $('__dm-panel-exp'),
      footer = $('__dm-footer-exp');
    if (!panel || !footer) return;

    panel.innerHTML = `<div class="dm-empty"><span class="dm-spin"></span> Carregando DMs e grupos...</div>`;
    footer.innerHTML = `<span class="dm-counter" id="__dm-ecnt">0 selecionado(s)</span><button class="dm-btn dm-ghost" id="__dm-eselall" disabled>Selecionar todos</button><button class="dm-btn dm-brand" id="__dm-erun" disabled>📥 Exportar</button>`;

    let channels = [],
      sel = new Set();
    try {
      const data = await fetchSharedData();
      channels = (data.channels || []).filter((c) => c.type === 1 || c.type === 3);
    } catch (e) {
      panel.innerHTML = `<div class="dm-empty">❌ Erro: ${escapeHtml(e.message)}</div>`;
      return;
    }

    if (!channels.length) {
      panel.innerHTML = `<div class="dm-empty">Nenhuma DM ou grupo encontrada.</div>`;
      return;
    }

    const getAvatar = (item) => {
      if (item.type === 3 && item.icon)
        return `<img src="https://cdn.discordapp.com/channel-icons/${item.id}/${item.icon}.webp?size=64" alt="">`;
      if (item.recipients?.[0]?.avatar)
        return `<img src="https://cdn.discordapp.com/avatars/${item.recipients[0].id}/${item.recipients[0].avatar}.webp?size=64" alt="">`;
      return (item.name || item.recipients?.map((r) => r.global_name || r.username).join(', ') || '?')[0].toUpperCase();
    };
    const getName = (item) => item.name || item.recipients?.map((r) => r.global_name || r.username).join(', ') || 'DM';
    const getTypeLabel = (item) => (item.type === 1 ? '💬 DM' : '👥 Grupo');

    panel.innerHTML = `
      <div class="dm-search">${IC_SEARCH}<input id="__dm-eq" placeholder="Pesquisar"></div>
      <label class="dm-label">Formato</label>
      <select class="dm-select" id="__dm-eformat" style="margin-bottom:10px">
        <option value="json">📄 JSON (estruturado)</option>
        <option value="txt">📝 TXT (legível)</option>
      </select>
      <label class="dm-label">Mensagens por canal</label>
      <select class="dm-select" id="__dm-elimit" style="margin-bottom:10px">
        <option value="100">100</option>
        <option value="500">500</option>
        <option value="1000" selected>1.000</option>
        <option value="5000">5.000</option>
        <option value="0">Todas disponíveis</option>
      </select>
      <p class="dm-hint">Selecione os DMs/grupos. O download começa automaticamente ao finalizar.</p>
      <div class="dm-section" id="__dm-esec">${channels.length} canal(is)</div>
      <div class="dm-list" id="__dm-elist"></div>
      <div id="__dm-estatus" class="dm-st" style="display:none;margin-top:12px"></div>`;

    const updateList = () => {
      const q = ($('__dm-eq')?.value || '').toLowerCase();
      const list = channels.filter((c) => getName(c).toLowerCase().includes(q));
      $('__dm-esec').textContent = `${list.length} canal(is)`;
      $('__dm-elist').innerHTML = list
        .map((c) => {
          const name = getName(c);
          const s = sel.has(c.id);
          return `<div class="dm-fi${s ? ' dm-sel' : ''}" data-cid="${c.id}"><div class="dm-av">${getAvatar(c)}</div><div class="dm-fn">${escapeHtml(name)}<small>${getTypeLabel(c)}</small></div><div class="dm-chk">${s ? IC_CHECK : ''}</div></div>`;
        })
        .join('');
      $('__dm-elist')
        .querySelectorAll('.dm-fi')
        .forEach((el) => {
          el.addEventListener('click', () => {
            const cid = el.dataset.cid;
            if (sel.has(cid)) sel.delete(cid);
            else sel.add(cid);
            updateList();
            updateCounter();
          });
        });
    };

    const updateCounter = () => {
      const cnt = $('__dm-ecnt');
      const run = $('__dm-erun');
      const selall = $('__dm-eselall');
      if (cnt) cnt.textContent = `${sel.size} selecionado(s)`;
      if (run) run.disabled = sel.size === 0;
      if (selall) selall.disabled = channels.length === 0;
    };

    $('__dm-eq')?.addEventListener('input', updateList);
    on('__dm-eselall', () => {
      const q = ($('__dm-eq')?.value || '').toLowerCase();
      const visible = channels.filter((c) => getName(c).toLowerCase().includes(q)).map((c) => c.id);
      const allSelected = visible.every((id) => sel.has(id));
      visible.forEach((id) => (allSelected ? sel.delete(id) : sel.add(id)));
      updateList();
      updateCounter();
    });

    let running = false;
    on('__dm-erun', async () => {
      if (running) return;
      running = true;
      const runBtn = $('__dm-erun');
      if (runBtn) {
        runBtn.disabled = true;
        runBtn.textContent = '⏳ Exportando...';
      }
      const status = $('__dm-estatus');
      const setStatus = (html) => {
        if (status) {
          status.style.display = '';
          status.innerHTML = html;
        }
      };

      const format = $('__dm-eformat')?.value || 'json';
      const limit = parseInt($('__dm-elimit')?.value || '1000', 10);
      const selectedChannels = channels.filter((c) => sel.has(c.id));
      const result = [];

      try {
        for (let i = 0; i < selectedChannels.length; i++) {
          const ch = selectedChannels[i];
          const chName = getName(ch);
          setStatus(
            `<span class="dm-spin"></span> Exportando ${escapeHtml(chName)} (${i + 1}/${selectedChannels.length})...`,
          );
          const messages = await fetchChannelMessages(ch.id, limit, (done, total) => {
            setStatus(
              `<span class="dm-spin"></span> Exportando ${escapeHtml(chName)} (${i + 1}/${selectedChannels.length}) — ${done} mensagens ${progressBar(done, total || done)}`,
            );
          });
          result.push({
            channel: { id: ch.id, name: chName, type: ch.type },
            stats: computeChannelStats(messages),
            messages,
          });
        }

        const blob =
          format === 'json'
            ? new Blob([JSON.stringify({ ...computeGlobalStats(result), channels: result }, null, 2)], {
                type: 'application/json',
              })
            : new Blob([messagesToTxt(result)], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `discord_export_${new Date().toISOString().slice(0, 10)}.${format}`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        setStatus(`✅ Exportação concluída! ${result.reduce((a, b) => a + b.messages.length, 0)} mensagens baixadas.`);
      } catch (e) {
        setStatus(`❌ Erro: ${escapeHtml(e.message)}`);
      } finally {
        running = false;
        if (runBtn) {
          runBtn.disabled = sel.size === 0;
          runBtn.textContent = '📥 Exportar';
        }
      }
    });

    updateList();
    updateCounter();
  };

  const computeChannelStats = (messages) => {
    const perAuthor = {};
    const authorNames = {};
    let attachments = 0,
      embeds = 0,
      chars = 0;
    let first = null,
      last = null;
    for (const m of messages) {
      const aid = m.author?.id || 'unknown';
      const aname = m.author?.global_name || m.author?.username || 'Desconhecido';
      perAuthor[aid] = (perAuthor[aid] || 0) + 1;
      authorNames[aid] = aname;
      attachments += (m.attachments || []).length;
      embeds += (m.embeds || []).length;
      chars += (m.content || '').length;
      const t = new Date(m.timestamp).getTime();
      if (first === null || t < first) first = t;
      if (last === null || t > last) last = t;
    }
    const sortedAuthors = Object.entries(perAuthor)
      .sort((a, b) => b[1] - a[1])
      .map(([id, count]) => ({ id, name: authorNames[id] || 'Desconhecido', count }));
    return {
      total_messages: messages.length,
      unique_authors: Object.keys(perAuthor).length,
      messages_per_author: sortedAuthors,
      author_names: authorNames,
      first_message_at: first ? new Date(first).toISOString() : null,
      last_message_at: last ? new Date(last).toISOString() : null,
      total_attachments: attachments,
      total_embeds: embeds,
      total_characters: chars,
    };
  };

  const computeGlobalStats = (channels) => {
    let total = 0,
      attachments = 0,
      embeds = 0,
      chars = 0;
    const authorTotals = {};
    const authorNames = {};
    for (const ch of channels) {
      total += ch.messages.length;
      attachments += ch.stats.total_attachments;
      embeds += ch.stats.total_embeds;
      chars += ch.stats.total_characters;
      for (const a of ch.stats.messages_per_author) {
        authorTotals[a.id] = (authorTotals[a.id] || 0) + a.count;
        authorNames[a.id] = a.name;
      }
    }
    const sorted = Object.entries(authorTotals)
      .sort((a, b) => b[1] - a[1])
      .map(([id, count]) => ({ id, name: authorNames[id] || 'Desconhecido', count }));
    return {
      exported_at: new Date().toISOString(),
      total_channels: channels.length,
      total_messages: total,
      total_attachments: attachments,
      total_embeds: embeds,
      total_characters: chars,
      messages_per_author_global: sorted,
    };
  };

  const fetchChannelMessages = async (channelId, limit, onProgress) => {
    const messages = [];
    let before = null;
    let done = 0;
    const perPage = 100;
    const target = limit > 0 ? limit : Infinity;

    while (done < target) {
      const params = new URLSearchParams({
        limit: String(Math.min(perPage, target === Infinity ? perPage : target - done)),
      });
      if (before) params.set('before', before);
      const r = await fetch(`https://discord.com/api/v9/channels/${channelId}/messages?${params}`, {
        headers: GET_HEADERS,
      });

      if (r.status === 429) {
        const retry = await r.json().catch(() => ({}));
        await sleep((retry.retry_after || 5) * 1000);
        continue;
      }
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        throw new Error(err.message || `Erro ${r.status}`);
      }
      const batch = await r.json();
      if (!batch.length) break;
      messages.push(...batch);
      done += batch.length;
      before = batch[batch.length - 1].id;
      if (onProgress) onProgress(done, target === Infinity ? done + perPage : target);
      if (batch.length < perPage) break;
      await sleep(800);
    }

    return messages.map((m) => ({
      id: m.id,
      content: m.content,
      author: {
        id: m.author?.id,
        username: m.author?.username,
        global_name: m.author?.global_name,
        avatar: m.author?.avatar,
      },
      timestamp: m.timestamp,
      edited_timestamp: m.edited_timestamp,
      attachments: (m.attachments || []).map((a) => ({
        id: a.id,
        filename: a.filename,
        url: a.url,
        size: a.size,
        content_type: a.content_type,
      })),
      embeds: m.embeds || [],
      mentions: (m.mentions || []).map((u) => u.id),
      mention_roles: m.mention_roles || [],
      pinned: m.pinned,
      type: m.type,
    }));
  };

  const messagesToTxt = (result) => {
    let txt = '';
    for (const ch of result) {
      txt += `================================================================================\n`;
      txt += `CANAL: ${ch.channel.name} (${ch.channel.type === 1 ? 'DM' : 'Grupo'}) — ID: ${ch.channel.id}\n`;
      txt += `MENSAGENS: ${ch.messages.length}\n`;
      txt += `AUTORES ÚNICOS: ${ch.stats.unique_authors}\n`;
      txt += `PRIMEIRA MSG: ${ch.stats.first_message_at ? new Date(ch.stats.first_message_at).toLocaleString('pt-BR') : '-'}\n`;
      txt += `ÚLTIMA MSG: ${ch.stats.last_message_at ? new Date(ch.stats.last_message_at).toLocaleString('pt-BR') : '-'}\n`;
      txt += `ANEXOS: ${ch.stats.total_attachments} | EMBEDS: ${ch.stats.total_embeds} | CARACTERES: ${ch.stats.total_characters}\n`;
      txt += `POR AUTOR:\n`;
      for (const a of ch.stats.messages_per_author) {
        txt += `  - ${a.name} (${a.id}): ${a.count}\n`;
      }
      txt += `================================================================================\n\n`;
      for (const m of ch.messages) {
        const author = m.author.global_name || m.author.username || 'Desconhecido';
        const time = new Date(m.timestamp).toLocaleString('pt-BR');
        txt += `[${time}] ${author}: ${m.content || '[vazio]'}\n`;
        if (m.attachments.length) {
          txt += `  [anexos: ${m.attachments.map((a) => a.url).join(', ')}]\n`;
        }
        if (m.embeds.length) {
          txt += `  [embed: ${m.embeds.length}]\n`;
        }
        txt += `\n`;
      }
      txt += `\n`;
    }
    return txt;
  };

  const injectBtn = () => {
    if (document.getElementById('__dm-navbtn')) return;
    const anchor =
      document.querySelector('[data-list-item-id$="___friends"]') || document.querySelector('a[href="/channels/@me"]');
    if (!anchor) return;
    const item = anchor.closest('li') || anchor.closest('[class*="container"]') || anchor.parentElement;
    if (!item) return;
    const btn = document.createElement('div');
    btn.id = '__dm-navbtn';
    btn.setAttribute('role', 'button');
    btn.setAttribute('tabindex', '0');
    btn.innerHTML = `<div class="dm-navicon">${IC_GEAR}</div><div class="dm-navname">Gerenciar</div>`;
    btn.addEventListener('click', toggleManager);
    btn.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        btn.click();
      }
    });
    item.insertAdjacentElement('afterend', btn);
  };

  const injectTopbarBtn = () => {
    if (document.getElementById('__dm-topbtn')) return;
    const helpLink = document.querySelector('a[href="https://support.discord.com"]');
    const trailing = helpLink?.parentElement || document.querySelector('[class*="trailing_"]');
    if (!trailing) return;
    const wrap = document.createElement('div');
    wrap.id = '__dm-topwrap';
    wrap.style.cssText = 'display:flex;align-items:center;gap:6px;';
    const btn = document.createElement('div');
    btn.id = '__dm-topbtn';
    btn.setAttribute('role', 'button');
    btn.setAttribute('tabindex', '0');
    btn.setAttribute('aria-label', 'Gerenciar');
    btn.innerHTML = IC_GEAR;
    btn.addEventListener('click', toggleManager);
    btn.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        btn.click();
      }
    });
    const label = document.createElement('span');
    label.id = '__dm-topbtn-label';
    label.className = 'dm-topbtn-label';
    wrap.appendChild(btn);
    wrap.appendChild(label);
    trailing.insertBefore(wrap, trailing.firstChild);
  };

  injectBtn();
  injectTopbarBtn();
  setInterval(() => {
    injectBtn();
    injectTopbarBtn();
  }, 2000);
})();
