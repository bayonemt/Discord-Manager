#!/usr/bin/env node
'use strict';

const tls = require('tls');
const dgram = require('dgram');
const crypto = require('crypto');
const https = require('https');
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { spawn } = require('child_process');

const ROOT = __dirname;
const STATE_FILE = path.join(ROOT, 'session.json');
const VIDEO_FILE = path.join(ROOT, 'assets', 'video.mp4');

const GATEWAY_HOST = 'gateway.discord.gg';
const ME_URL = 'https://discord.com/api/v9/users/@me?with_analytics_token=true';
const USERS_URL = 'https://discord.com/api/v9/users';

const CLIENT_VERSION = '1.0.9253';
const CLIENT_BUILD_NUMBER = 594031;
const NATIVE_BUILD_NUMBER = 88414;
const OS_VERSION = '10.0.26200';
const USER_AGENT =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
    '(KHTML, like Gecko) discord/1.0.9253 Chrome/148.0.7778.280 ' +
    'Electron/42.7.1 Safari/537.36';

const AUTH_MAX_AGE = 12 * 3600;
const OPUS_SILENCE = Buffer.from([0xf8, 0xff, 0xfe]);

const STREAM_TIERS = [
    [1, 'Acabou de chegar', 1],
    [2, 'Ainda se conhecendo', 5],
    [3, 'Na Galera', 20],
    [4, 'Na Vitrine', 75],
    [5, 'Lança-tendências', 150],
    [6, 'Nos Holofotes', 300],
    [7, 'Estrela', 500],
    [8, 'Sensação', 1000],
    [9, 'Personalidade', 2000],
    [10, 'Fenômeno', 5000],
];

const PERM_ADMIN = 1n << 3n;
const PERM_STREAM = 1n << 9n;
const PERM_VIEW = 1n << 10n;
const PERM_CONNECT = 1n << 20n;

function uuid() { return crypto.randomUUID(); }
function stamp() { return new Date().toTimeString().slice(0, 8); }

const C = {
    RED: '\x1b[91m', ORANGE: '\x1b[38;5;208m', GREEN: '\x1b[92m',
    YELLOW: '\x1b[93m', CYAN: '\x1b[96m', WHITE: '\x1b[97m',
    GREY: '\x1b[90m', MAGENTA: '\x1b[95m', R: '\x1b[0m',
};

function log(glyph, target, detail, color) {
    console.log(`  ${C.GREY}${stamp()}${C.R} ${glyph} ${C.WHITE}${target}${C.R} ${C.GREY}·${C.R} ${color}${detail}${C.R}`);
}
function ok(t, d) { log(`${C.GREEN}✓${C.R}`, t, d, C.GREEN); }
function warn(t, d) { log(`${C.YELLOW}!${C.R}`, t, d, C.YELLOW); }
function err(t, d) { log(`${C.RED}✗${C.R}`, t, d, C.RED); }
function info(t, d) {
    if (d !== undefined) log(`${C.CYAN}ℹ${C.R}`, t, d, C.WHITE);
    else console.log(`  ${C.GREY}${stamp()}${C.R} ${C.GREY}·${C.R} ${C.WHITE}${t}${C.R}`);
}
function live(t, d) { log(`${C.MAGENTA}●${C.R}`, t, d, C.MAGENTA); }
function rule(ch) {
    const w = process.stdout.columns || 80;
    console.log(`${C.CYAN}${(ch || '─').repeat(w)}${C.R}`);
}
function banner() {
    process.stdout.write('\x1b[2J\x1b[3J\x1b[H');
    const w = process.stdout.columns || 80;
    const border = '═'.repeat(Math.max(10, w - 2));
    const title = 'DISCORD STREAM MAXIMIZER';
    const sub = 'Gateway + Voice + Video — Node.js Engine';
    const padT = ' '.repeat(Math.max(0, Math.floor((w - title.length - 2) / 2)));
    const padS = ' '.repeat(Math.max(0, Math.floor((w - sub.length - 2) / 2)));
    console.log();
    console.log(`${C.CYAN}╔${border}╗${C.R}`);
    console.log(`${C.CYAN}║${C.R}${padT}${C.WHITE}${title}${C.R}${' '.repeat(Math.max(0, w - 2 - padT.length - title.length))}${C.CYAN}║${C.R}`);
    console.log(`${C.CYAN}║${C.R}${padS}${C.GREY}${sub}${C.R}${' '.repeat(Math.max(0, w - 2 - padS.length - sub.length))}${C.CYAN}║${C.R}`);
    console.log(`${C.CYAN}╚${border}╝${C.R}`);
    console.log();
}

function localProps() {
    return {
        os: 'Windows', browser: 'Discord Client', release_channel: 'stable',
        client_version: CLIENT_VERSION, os_version: OS_VERSION,
        os_arch: 'x64', app_arch: 'x64', system_locale: 'en-US',
        has_client_mods: false, browser_user_agent: USER_AGENT,
        browser_version: '42.7.1', os_sdk_version: '26200',
        client_build_number: CLIENT_BUILD_NUMBER,
        native_build_number: NATIVE_BUILD_NUMBER,
        client_event_source: null, client_app_state: 'focused',
    };
}

function buildSuperProps() {
    const props = localProps();
    props.client_launch_id = uuid();
    props.launch_signature = uuid();
    props.client_heartbeat_session_id = uuid();
    return Buffer.from(JSON.stringify(props)).toString('base64');
}

function userIdFromToken(token) {
    try {
        const first = token.split('.')[0];
        return Buffer.from(first, 'base64').toString('utf-8');
    } catch { return ''; }
}

function formatTimer(sec) {
    const s = Math.max(0, Math.floor(sec));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const ss = s % 60;
    return `${String(h).padStart(2, '0')}h:${String(m).padStart(2, '0')}m:${String(ss).padStart(2, '0')}s`;
}

// ── State ──

class State {
    constructor() {
        this.token = '';
        this.cookie = '';
        this.fingerprint = '';
        this.analytics_token = '';
        this.fetched_at = 0;
        this.total_stream_hours_claimed = 0;
        this.total_stream_sessions = 0;
        this.last_guild_id = '';
        this.last_channel_id = '';
        this.viewer_token = '';
    }
    static load() {
        const s = new State();
        if (fs.existsSync(STATE_FILE)) {
            try {
                const raw = JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
                for (const k of Object.keys(s)) {
                    if (k in raw) s[k] = raw[k];
                }
            } catch {}
        }
        return s;
    }
    save() {
        let existing = {};
        if (fs.existsSync(STATE_FILE)) {
            try { existing = JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8')); } catch {}
        }
        for (const k of Object.keys(this)) existing[k] = this[k];
        fs.writeFileSync(STATE_FILE, JSON.stringify(existing, null, 2));
    }
    get isStale() { return !this.analytics_token || (Date.now() / 1000 - this.fetched_at) > AUTH_MAX_AGE; }
}

// ── HTTP helpers ──

function httpGet(url, headers) {
    return new Promise((resolve, reject) => {
        const req = https.get(url, { headers }, res => {
            let body = '';
            res.on('data', c => body += c);
            res.on('end', () => {
                try { resolve({ status: res.statusCode, data: JSON.parse(body) }); }
                catch { resolve({ status: res.statusCode, data: { message: body } }); }
            });
        });
        req.on('error', e => resolve({ status: 0, data: { message: e.message } }));
        req.setTimeout(10000, () => { req.destroy(); resolve({ status: 0, data: { message: 'timeout' } }); });
    });
}

function discordGet(url, token, superProps) {
    const headers = { authorization: token, 'user-agent': USER_AGENT };
    if (superProps) headers['x-super-properties'] = superProps;
    return httpGet(url, headers);
}

async function ensureAnalyticsToken(state) {
    if (!state.isStale) return;
    const sp = buildSuperProps();
    const { status, data } = await discordGet(ME_URL, state.token, sp);
    if (status === 401) throw new Error('Token rejeitado (HTTP 401)');
    if (!data.analytics_token) throw new Error('Sem analytics_token na resposta');
    state.analytics_token = data.analytics_token;
    state.fetched_at = Math.floor(Date.now() / 1000);
    state.save();
}

// ── Readline helper ──

function ask(prompt) {
    return new Promise(resolve => {
        const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
        rl.question(prompt, ans => { rl.close(); resolve(ans.trim()); });
    });
}

// ── MiniWebSocket (raw TLS + RFC 6455) ──

class MiniWebSocket {
    constructor(host, port, wsPath) {
        this.host = host;
        this.port = port || 443;
        this.path = wsPath || '/';
        this.sock = null;
        this.closed = true;
        this._buf = Buffer.alloc(0);
        this._queue = [];
        this._waiting = null;
    }

    connect() {
        return new Promise((resolve, reject) => {
            this.sock = tls.connect({ host: this.host, port: this.port, servername: this.host }, () => {
                const key = crypto.randomBytes(16).toString('base64');
                const hostHdr = this.port === 443 ? this.host : `${this.host}:${this.port}`;
                const req =
                    `GET ${this.path} HTTP/1.1\r\n` +
                    `Host: ${hostHdr}\r\n` +
                    `Upgrade: websocket\r\nConnection: Upgrade\r\n` +
                    `Sec-WebSocket-Key: ${key}\r\nSec-WebSocket-Version: 13\r\n` +
                    `User-Agent: ${USER_AGENT}\r\n\r\n`;
                this.sock.write(req);
            });
            this.sock.on('error', e => {
                this.closed = true;
                if (this._waiting) { this._waiting(null); this._waiting = null; }
                reject(e);
            });

            let headerBuf = Buffer.alloc(0);
            let upgraded = false;

            const onData = (chunk) => {
                if (!upgraded) {
                    headerBuf = Buffer.concat([headerBuf, chunk]);
                    const idx = headerBuf.indexOf('\r\n\r\n');
                    if (idx === -1) return;
                    const headerStr = headerBuf.slice(0, idx).toString();
                    if (!headerStr.includes('101')) {
                        this.close();
                        return reject(new Error(`Handshake rejected: ${headerStr.split('\r\n')[0]}`));
                    }
                    upgraded = true;
                    this.closed = false;
                    const leftover = headerBuf.slice(idx + 4);
                    if (leftover.length) this._buf = Buffer.concat([this._buf, leftover]);
                    this._drain();
                    resolve();
                } else {
                    this._buf = Buffer.concat([this._buf, chunk]);
                    this._drain();
                }
            };
            this.sock.on('data', onData);
            this.sock.on('close', () => {
                this.closed = true;
                if (this._waiting) { this._waiting(null); this._waiting = null; }
            });
            this.sock.setTimeout(0);
        });
    }

    _drain() {
        while (this._buf.length >= 2) {
            const b0 = this._buf[0];
            const b1 = this._buf[1];
            const opcode = b0 & 0x0F;
            const masked = !!(b1 & 0x80);
            let payloadLen = b1 & 0x7F;
            let offset = 2;

            if (payloadLen === 126) {
                if (this._buf.length < 4) return;
                payloadLen = this._buf.readUInt16BE(2);
                offset = 4;
            } else if (payloadLen === 127) {
                if (this._buf.length < 10) return;
                payloadLen = Number(this._buf.readBigUInt64BE(2));
                offset = 10;
            }

            if (masked) offset += 4;
            if (this._buf.length < offset + payloadLen) return;

            let payload = this._buf.slice(offset, offset + payloadLen);
            if (masked) {
                const maskKey = this._buf.slice(offset - 4, offset);
                for (let i = 0; i < payload.length; i++) payload[i] ^= maskKey[i % 4];
            }
            this._buf = this._buf.slice(offset + payloadLen);

            if (opcode === 0x8) {
                let code = 0, reason = '';
                if (payload.length >= 2) {
                    code = payload.readUInt16BE(0);
                    reason = payload.slice(2).toString('utf-8');
                }
                this._enqueue({ op: 'close', code, reason });
                this.close();
                return;
            }
            if (opcode === 0x9) {
                this._sendPong(payload);
                this._enqueue({ op: 'ping' });
                continue;
            }
            if (opcode === 0x2) {
                this._enqueue({ op: 'binary', data: payload });
                continue;
            }
            if (opcode === 0x1) {
                try {
                    const parsed = JSON.parse(payload.toString('utf-8'));
                    this._enqueue(parsed);
                } catch {
                    this._enqueue({ op: 'text', raw: payload.toString('utf-8') });
                }
                continue;
            }
        }
    }

    _enqueue(msg) {
        if (this._waiting) {
            const cb = this._waiting;
            this._waiting = null;
            cb(msg);
        } else {
            this._queue.push(msg);
        }
    }

    recv(timeoutMs) {
        if (this._queue.length) return Promise.resolve(this._queue.shift());
        if (this.closed) return Promise.resolve(null);
        const ms = timeoutMs || 5000;
        return new Promise(resolve => {
            let timer = setTimeout(() => {
                this._waiting = null;
                resolve(null);
            }, ms);
            this._waiting = (msg) => {
                clearTimeout(timer);
                resolve(msg);
            };
        });
    }

    send(data) {
        if (this.closed || !this.sock) throw new Error('socket closed');
        const payload = Buffer.from(data, 'utf-8');
        this._sendFrame(0x81, payload);
    }

    sendBinary(data) {
        if (this.closed || !this.sock) throw new Error('socket closed');
        this._sendFrame(0x82, data);
    }

    _sendFrame(opByte, payload) {
        const maskKey = crypto.randomBytes(4);
        const len = payload.length;
        let header;
        if (len <= 125) {
            header = Buffer.alloc(2);
            header[0] = opByte;
            header[1] = 0x80 | len;
        } else if (len <= 65535) {
            header = Buffer.alloc(4);
            header[0] = opByte;
            header[1] = 0x80 | 126;
            header.writeUInt16BE(len, 2);
        } else {
            header = Buffer.alloc(10);
            header[0] = opByte;
            header[1] = 0x80 | 127;
            header.writeBigUInt64BE(BigInt(len), 2);
        }
        const masked = Buffer.from(payload);
        for (let i = 0; i < masked.length; i++) masked[i] ^= maskKey[i % 4];
        try {
            this.sock.write(Buffer.concat([header, maskKey, masked]));
        } catch {
            this.close();
        }
    }

    _sendPong(payload) {
        if (this.closed || !this.sock) return;
        try {
            const maskKey = crypto.randomBytes(4);
            const len = payload.length;
            const header = Buffer.alloc(2);
            header[0] = 0x8A;
            header[1] = 0x80 | len;
            const masked = Buffer.from(payload);
            for (let i = 0; i < masked.length; i++) masked[i] ^= maskKey[i % 4];
            this.sock.write(Buffer.concat([header, maskKey, masked]));
        } catch {}
    }

    close() {
        this.closed = true;
        if (this.sock) {
            try { this.sock.destroy(); } catch {}
            this.sock = null;
        }
        this._queue = [];
        if (this._waiting) { this._waiting(null); this._waiting = null; }
    }
}

// ── AES-256-GCM RTP encryption ──

function encryptRtp(secretKey, rtpHeader, plaintext, nonceCounter) {
    const nonce = Buffer.alloc(12);
    nonce.writeUInt32BE(nonceCounter, 0);
    const cipher = crypto.createCipheriv('aes-256-gcm', secretKey.slice(0, 32), nonce);
    cipher.setAAD(rtpHeader);
    const enc = Buffer.concat([cipher.update(plaintext), cipher.final(), cipher.getAuthTag()]);
    const suffix = Buffer.alloc(4);
    suffix.writeUInt32BE(nonceCounter, 0);
    return Buffer.concat([rtpHeader, enc, suffix]);
}

function buildRtcpSr(secretKey, ssrc, rtpTs, pktCount, byteCount, nonceCounter) {
    const nowWall = Date.now() / 1000;
    const ntpNow = nowWall + 2208988800;
    const ntpMsw = Math.floor(ntpNow) >>> 0;
    const ntpLsw = Math.floor((ntpNow - Math.floor(ntpNow)) * 0x100000000) >>> 0;
    const header = Buffer.alloc(8);
    header[0] = 0x80; header[1] = 200;
    header.writeUInt16BE(6, 2);
    header.writeUInt32BE(ssrc >>> 0, 4);
    const payload = Buffer.alloc(20);
    payload.writeUInt32BE(ntpMsw, 0);
    payload.writeUInt32BE(ntpLsw, 4);
    payload.writeUInt32BE(rtpTs >>> 0, 8);
    payload.writeUInt32BE(pktCount >>> 0, 12);
    payload.writeUInt32BE(byteCount >>> 0, 16);

    const nonce = Buffer.alloc(12);
    nonce.writeUInt32BE(nonceCounter, 0);
    const cipher = crypto.createCipheriv('aes-256-gcm', secretKey.slice(0, 32), nonce);
    cipher.setAAD(header);
    const enc = Buffer.concat([cipher.update(payload), cipher.final(), cipher.getAuthTag()]);
    const suffix = Buffer.alloc(4);
    suffix.writeUInt32BE(nonceCounter, 0);
    return Buffer.concat([header, enc, suffix]);
}

// ── Media Stream Pump ──

class MediaStreamPump {
    constructor(voiceConn, videoPath) {
        this.conn = voiceConn;
        this.videoPath = videoPath;
        this.running = false;
        this.vProc = null;
        this.aProc = null;
    }

    start() {
        if (!fs.existsSync(this.videoPath)) { warn('stream', 'video não encontrado, usando silêncio'); return false; }
        if (!this.conn.secretKey || !this.conn.udpSock) { warn('stream', 'sem chave ou UDP, usando silêncio'); return false; }
        this.running = true;

        const vCmd = [
            'ffmpeg', '-hide_banner', '-loglevel', 'error',
            '-stream_loop', '-1', '-i', this.videoPath,
            '-r', '30', '-vf', 'scale=848:480',
            '-c:v', 'libx264', '-preset', 'ultrafast', '-tune', 'zerolatency',
            '-threads', '1', '-b:v', '1200k', '-maxrate', '1200k', '-bufsize', '2400k',
            '-g', '30', '-keyint_min', '30', '-sc_threshold', '0',
            '-bf', '0', '-b_strategy', '0', '-flags', '+low_delay',
            '-force_key_frames', 'expr:gte(t,n_forced*1)',
            '-profile:v', 'baseline', '-level', '3.1',
            '-x264opts', 'b-pyramid=0:bframes=0:ref=1:no-scenecut=1:keyint=30:min-keyint=30',
            '-pix_fmt', 'yuv420p',
            '-bsf:v', 'h264_mp4toannexb,dump_extra=freq=keyframe,h264_metadata=aud=insert',
            '-an', '-f', 'h264', 'pipe:1',
        ];
        const aCmd = [
            'ffmpeg', '-hide_banner', '-loglevel', 'error',
            '-stream_loop', '-1', '-i', this.videoPath,
            '-vn', '-c:a', 'libopus', '-ar', '48000', '-ac', '2', '-b:a', '64k',
            '-frame_duration', '20', '-f', 'opus', 'pipe:1',
        ];

        try {
            this.vProc = spawn(vCmd[0], vCmd.slice(1), { stdio: ['ignore', 'pipe', 'ignore'] });
            this.aProc = spawn(aCmd[0], aCmd.slice(1), { stdio: ['ignore', 'pipe', 'ignore'] });
        } catch (e) {
            err('stream', `ffmpeg falhou: ${e.message}`);
            this.stop();
            return false;
        }

        this._pumpVideo();
        this._pumpAudio();
        ok('stream', `transmitindo vídeo e áudio de ${path.basename(this.videoPath)} (loop)`);
        return true;
    }

    _pumpVideo() {
        const conn = this.conn;
        const secretKey = conn.secretKey;
        let vSeq = (Math.random() * 0x7FFF) >>> 0;
        let vTs = (Math.random() * 0x7FFFFFFF) >>> 0;
        const videoSsrc = conn.videoSsrc || (conn.ssrc + 1);
        let buf = Buffer.alloc(0);
        let curFrame = [];
        let nextTime = Date.now();
        const frameInterval = 1000 / 30;
        let vPkts = 0, vBytes = 0, lastSr = Date.now();

        const sendFrame = (nalus) => {
            if (!nalus.length || !this.running) return;
            for (let nIdx = 0; nIdx < nalus.length; nIdx++) {
                const data = nalus[nIdx];
                const isLastNalu = nIdx === nalus.length - 1;

                if (data.length <= 1100) {
                    const marker = isLastNalu ? 0x80 : 0x00;
                    const rtpHdr = Buffer.alloc(12);
                    rtpHdr[0] = 0x90;
                    rtpHdr[1] = marker | 101;
                    rtpHdr.writeUInt16BE(vSeq & 0xFFFF, 2);
                    rtpHdr.writeUInt32BE(vTs >>> 0, 4);
                    rtpHdr.writeUInt32BE(videoSsrc >>> 0, 8);
                    const pktHeader = Buffer.concat([rtpHdr, Buffer.from([0xbe, 0xde, 0x00, 0x01])]);
                    const plaintext = Buffer.concat([Buffer.from([0x51, 0x00, 0x00, 0x00]), data]);
                    conn.nonceCounter++;
                    const packet = encryptRtp(secretKey, pktHeader, plaintext, conn.nonceCounter);
                    try { conn.udpSock.send(packet, conn.voicePort, conn.voiceIp); vPkts++; vBytes += packet.length; } catch {}
                    vSeq = (vSeq + 1) & 0xFFFF;
                } else {
                    const hdr = data[0];
                    const ntype = hdr & 0x1F;
                    const fnri = hdr & 0xE0;
                    const fuInd = fnri | 28;
                    const body = data.slice(1);
                    const csize = 1100;
                    const totalChunks = Math.ceil(body.length / csize);
                    for (let idx = 0; idx < totalChunks; idx++) {
                        const chunk = body.slice(idx * csize, (idx + 1) * csize);
                        let fuHdr;
                        if (idx === 0) fuHdr = 0x80 | ntype;
                        else if (idx === totalChunks - 1) fuHdr = 0x40 | ntype;
                        else fuHdr = ntype;
                        const fuPayload = Buffer.concat([Buffer.from([fuInd, fuHdr]), chunk]);
                        const isLastPacket = isLastNalu && idx === totalChunks - 1;
                        const marker = isLastPacket ? 0x80 : 0x00;
                        const rtpHdr = Buffer.alloc(12);
                        rtpHdr[0] = 0x90;
                        rtpHdr[1] = marker | 101;
                        rtpHdr.writeUInt16BE(vSeq & 0xFFFF, 2);
                        rtpHdr.writeUInt32BE(vTs >>> 0, 4);
                        rtpHdr.writeUInt32BE(videoSsrc >>> 0, 8);
                        const pktHeader = Buffer.concat([rtpHdr, Buffer.from([0xbe, 0xde, 0x00, 0x01])]);
                        const plaintext = Buffer.concat([Buffer.from([0x51, 0x00, 0x00, 0x00]), fuPayload]);
                        conn.nonceCounter++;
                        const packet = encryptRtp(secretKey, pktHeader, plaintext, conn.nonceCounter);
                        try { conn.udpSock.send(packet, conn.voicePort, conn.voiceIp); vPkts++; vBytes += packet.length; } catch {}
                        vSeq = (vSeq + 1) & 0xFFFF;
                    }
                }
            }
            vTs = (vTs + 3000) >>> 0;

            const now = Date.now();
            if (now - lastSr >= 1000) {
                conn.nonceCounter++;
                const sr = buildRtcpSr(secretKey, videoSsrc, vTs, vPkts, vBytes, conn.nonceCounter);
                try { conn.udpSock.send(sr, conn.voicePort, conn.voiceIp); } catch {}
                lastSr = now;
            }
        };

        const stdout = this.vProc.stdout;
        stdout.on('data', (chunk) => {
            if (!this.running) return;
            buf = Buffer.concat([buf, chunk]);

            while (true) {
                let p4 = buf.indexOf(Buffer.from([0, 0, 0, 1]), 4);
                let p3 = -1;
                for (let i = 3; i <= buf.length - 3; i++) {
                    if (buf[i] === 0 && buf[i + 1] === 0 && buf[i + 2] === 1 && (i < 1 || buf[i - 1] !== 0)) {
                        p3 = i; break;
                    }
                }
                const positions = [p4, p3].filter(p => p !== -1);
                if (!positions.length) break;
                const nextPos = Math.min(...positions);
                const nalu = buf.slice(0, nextPos);
                buf = buf.slice(nextPos);
                const scLen = nalu[0] === 0 && nalu[1] === 0 && nalu[2] === 0 && nalu[3] === 1 ? 4 : 3;
                const data = nalu.slice(scLen);
                if (!data.length) continue;
                const ntype = data[0] & 0x1F;
                if (ntype === 9) {
                    if (curFrame.length) {
                        const now = Date.now();
                        const delay = nextTime - now;
                        if (delay > 0) {
                            const frameCopy = curFrame.slice();
                            setTimeout(() => sendFrame(frameCopy), delay);
                        } else {
                            sendFrame(curFrame);
                            if (delay < -100) nextTime = now;
                        }
                        nextTime += frameInterval;
                        curFrame = [];
                    }
                } else {
                    curFrame.push(data);
                }
            }
        });
        stdout.on('end', () => {
            if (curFrame.length) sendFrame(curFrame);
        });
    }

    _pumpAudio() {
        const conn = this.conn;
        const secretKey = conn.secretKey;
        let aSeq = (Math.random() * 0x7FFF) >>> 0;
        let aTs = (Math.random() * 0x7FFFFFFF) >>> 0;
        let buf = Buffer.alloc(0);
        let nextTime = Date.now();
        let aPkts = 0, aBytes = 0, lastSr = Date.now();

        const sendOpusPacket = (p) => {
            if (!this.running) return;
            const rtpHdr = Buffer.alloc(12);
            rtpHdr[0] = 0x80;
            rtpHdr[1] = 120;
            rtpHdr.writeUInt16BE(aSeq & 0xFFFF, 2);
            rtpHdr.writeUInt32BE(aTs >>> 0, 4);
            rtpHdr.writeUInt32BE(conn.ssrc >>> 0, 8);
            conn.nonceCounter++;
            const packet = encryptRtp(secretKey, rtpHdr, p, conn.nonceCounter);
            try { conn.udpSock.send(packet, conn.voicePort, conn.voiceIp); aPkts++; aBytes += packet.length; } catch {}
            aSeq = (aSeq + 1) & 0xFFFF;
            aTs = (aTs + 960) >>> 0;

            const now = Date.now();
            if (now - lastSr >= 1000) {
                conn.nonceCounter++;
                const sr = buildRtcpSr(secretKey, conn.ssrc, aTs, aPkts, aBytes, conn.nonceCounter);
                try { conn.udpSock.send(sr, conn.voicePort, conn.voiceIp); } catch {}
                lastSr = now;
            }

            const delay = nextTime - Date.now();
            if (delay > 0) {} else if (delay < -100) nextTime = Date.now();
            nextTime += 20;
        };

        const stdout = this.aProc.stdout;
        stdout.on('data', (chunk) => {
            if (!this.running) return;
            buf = Buffer.concat([buf, chunk]);

            while (buf.length >= 27) {
                if (buf[0] !== 0x4F || buf[1] !== 0x67 || buf[2] !== 0x67 || buf[3] !== 0x53) {
                    const idx = buf.indexOf(Buffer.from('OggS'));
                    if (idx === -1) { buf = Buffer.alloc(0); break; }
                    buf = buf.slice(idx);
                    if (buf.length < 27) break;
                }
                const nSegs = buf[26];
                if (buf.length < 27 + nSegs) break;
                const segTable = buf.slice(27, 27 + nSegs);
                let bodyLen = 0;
                for (let i = 0; i < nSegs; i++) bodyLen += segTable[i];
                if (buf.length < 27 + nSegs + bodyLen) break;
                const body = buf.slice(27 + nSegs, 27 + nSegs + bodyLen);
                buf = buf.slice(27 + nSegs + bodyLen);

                let offset = 0;
                let curPkt = Buffer.alloc(0);
                for (let i = 0; i < nSegs; i++) {
                    const s = segTable[i];
                    curPkt = Buffer.concat([curPkt, body.slice(offset, offset + s)]);
                    offset += s;
                    if (s < 255) {
                        if (curPkt.toString('utf-8', 0, 8).startsWith('OpusHead') ||
                            curPkt.toString('utf-8', 0, 8).startsWith('OpusTags')) {
                            curPkt = Buffer.alloc(0);
                            continue;
                        }
                        sendOpusPacket(curPkt);
                        curPkt = Buffer.alloc(0);
                    }
                }
            }
        });
    }

    stop() {
        this.running = false;
        if (this.vProc) { try { this.vProc.kill(); } catch {} this.vProc = null; }
        if (this.aProc) { try { this.aProc.kill(); } catch {} this.aProc = null; }
    }
}

// ── VoiceConnection ──

class VoiceConnection {
    constructor(opts) {
        let cleaned = opts.endpoint.replace('wss://', '').replace('https://', '').replace(/\/$/, '');
        if (cleaned.includes(':')) {
            const parts = cleaned.split(':');
            this.host = parts[0];
            this.port = parseInt(parts[1]) || 443;
        } else {
            this.host = cleaned;
            this.port = 443;
        }
        this.serverId = opts.serverId;
        this.userId = opts.userId;
        this.sessionId = opts.sessionId;
        this.token = opts.token;
        this.label = opts.label || 'voice';
        this.isStream = !!opts.isStream;
        this.streamKey = opts.streamKey || '';
        this.channelId = opts.channelId || '';

        this.ws = null;
        this.udpSock = null;
        this.ssrc = 0;
        this.videoSsrc = 0;
        this.rtxSsrc = 0;
        this.voiceIp = '';
        this.voicePort = 0;
        this.externalIp = '';
        this.externalPort = 0;
        this.secretKey = null;
        this.encryptionMode = '';
        this.heartbeatInterval = 13.75;
        this.running = false;
        this.nonceCounter = 0;
        this._hbTimer = null;
        this._silenceTimer = null;
        this._mediaPump = null;
    }

    async connect() {
        try {
            this.ws = new MiniWebSocket(this.host, this.port, '/?v=7');
            await this.ws.connect();
        } catch (e) {
            err(this.label, `ws falhou: ${e.message}`);
            return false;
        }

        const hello = await this._recvOp(8, 10000);
        if (!hello) { err(this.label, 'sem Hello do voice server'); return false; }
        this.heartbeatInterval = ((hello.d || {}).heartbeat_interval || 13750) / 1000;

        const identifyD = {
            server_id: this.serverId,
            user_id: this.userId,
            session_id: this.sessionId,
            token: this.token,
            max_dave_protocol_version: 1,
        };
        if (this.isStream) {
            if (this.streamKey) identifyD.stream_key = this.streamKey;
            identifyD.video = true;
            identifyD.streams = [{ type: 'screen', rid: '100', quality: 100 }];
        }
        this.ws.send(JSON.stringify({ op: 0, d: identifyD }));

        const ready = await this._recvOp(2, 10000);
        if (!ready) { err(this.label, 'sem Ready do voice server'); return false; }
        const d = ready.d || {};
        this.ssrc = d.ssrc || 0;
        const streams = d.streams || [];
        if (streams.length) {
            this.videoSsrc = streams[0].ssrc || (this.ssrc + 1);
            this.rtxSsrc = streams[0].rtx_ssrc || (this.videoSsrc + 1);
        } else {
            this.videoSsrc = this.ssrc + 1;
            this.rtxSsrc = this.ssrc + 2;
        }
        this.voiceIp = d.ip || '';
        this.voicePort = d.port || 0;
        const modes = d.modes || [];

        const preferred = ['aead_aes256_gcm_rtpsize', 'aead_xchacha20_poly1305_rtpsize', 'xsalsa20_poly1305_lite'];
        for (const m of preferred) {
            if (modes.includes(m)) { this.encryptionMode = m; break; }
        }
        if (!this.encryptionMode && modes.length) this.encryptionMode = modes[0];

        const discovered = await this._udpDiscovery();
        if (!discovered) {
            warn(this.label, 'UDP discovery falhou, usando fallback');
            this.externalIp = '127.0.0.1';
            this.externalPort = 10000 + Math.floor(Math.random() * 50000);
        }

        const codecs = [{ name: 'opus', type: 'audio', priority: 1000, payload_type: 120 }];
        if (this.isStream) {
            codecs.push({ name: 'H264', type: 'video', priority: 1000, payload_type: 101, rtx_payload_type: 102, encode: true, decode: true });
            codecs.push({ name: 'VP8', type: 'video', priority: 2000, payload_type: 103, rtx_payload_type: 104, encode: true, decode: true });
        }

        this.ws.send(JSON.stringify({
            op: 1, d: {
                protocol: 'udp',
                data: { address: this.externalIp, port: this.externalPort, mode: this.encryptionMode },
                codecs,
            },
        }));

        const desc = await this._recvOp(4, 10000);
        if (desc) {
            const dd = desc.d || {};
            this.secretKey = Buffer.from(dd.secret_key || []);
            this.encryptionMode = dd.mode || this.encryptionMode;
            ok(this.label, `rota de mídia pronta (mode=${this.encryptionMode})`);
        }

        this.running = true;
        return true;
    }

    async _recvOp(targetOp, timeoutMs) {
        const deadline = Date.now() + timeoutMs;
        while (Date.now() < deadline) {
            const remaining = Math.max(100, deadline - Date.now());
            const msg = await this.ws.recv(Math.min(remaining, 2000));
            if (!msg) { if (this.ws.closed) return null; continue; }
            if (msg.op === 'close') return null;
            if (msg.op === targetOp) return msg;
        }
        return null;
    }

    _udpDiscovery() {
        return new Promise(resolve => {
            try {
                this.udpSock = dgram.createSocket('udp4');
                const packet = Buffer.alloc(74);
                packet.writeUInt16BE(0x0001, 0);
                packet.writeUInt16BE(70, 2);
                packet.writeUInt32BE(this.ssrc, 4);
                this.udpSock.send(packet, this.voicePort, this.voiceIp, (err) => {
                    if (err) { resolve(false); return; }
                });
                const timer = setTimeout(() => { resolve(false); }, 5000);
                this.udpSock.once('message', (data) => {
                    clearTimeout(timer);
                    if (data.length < 74) { resolve(false); return; }
                    const ipEnd = data.indexOf(0, 8);
                    this.externalIp = data.slice(8, ipEnd).toString('utf-8');
                    this.externalPort = data.readUInt16BE(72);
                    resolve(!!this.externalIp);
                });
            } catch { resolve(false); }
        });
    }

    startHeartbeat() {
        this._hbTimer = setInterval(() => {
            if (!this.running || !this.ws || this.ws.closed) return;
            try { this.ws.send(JSON.stringify({ op: 3, d: Date.now() })); } catch {}
        }, this.heartbeatInterval * 1000);

        this._startVoiceEventLoop();
    }

    async _startVoiceEventLoop() {
        while (this.running && this.ws && !this.ws.closed) {
            const msg = await this.ws.recv(1000);
            if (!msg) continue;
            if (msg.op === 'close') break;
            if (msg.op === 3) {
                try { this.ws.send(JSON.stringify({ op: 3, d: Date.now() })); } catch {}
            } else if (msg.op === 21) {
                const d = msg.d || {};
                const tId = d.transition_id;
                if (tId !== undefined && tId !== null) {
                    try { this.ws.send(JSON.stringify({ op: 23, d: { transition_id: tId } })); } catch {}
                }
            } else if (msg.op === 24) {
                const d = msg.d || {};
                const tId = d.transition_id;
                if (tId !== undefined && tId !== null) {
                    try { this.ws.send(JSON.stringify({ op: 23, d: { transition_id: tId } })); } catch {}
                }
            } else if (typeof msg.op === 'string' && msg.op === 'binary') {
                const raw = msg.data;
                if (raw && raw.length >= 3) {
                    const bOp = raw[0];
                    if (bOp === 29 || bOp === 30) {
                        const tId = raw.length >= 3 ? raw.readUInt16BE(1) : 0;
                        if (tId && this.ws && !this.ws.closed) {
                            try { this.ws.send(JSON.stringify({ op: 23, d: { transition_id: tId } })); } catch {}
                        }
                    }
                }
            }
        }
    }

    sendSpeaking(speaking, isVideo) {
        if (!this.ws || this.ws.closed) return;
        let mask;
        if (this.isStream) mask = speaking ? 2 : 0;
        else mask = speaking && isVideo ? 5 : (speaking ? 1 : 0);
        try { this.ws.send(JSON.stringify({ op: 5, d: { speaking: mask, delay: 0, ssrc: this.ssrc } })); } catch {}
    }

    startMediaStream(videoPath) {
        if (this._mediaPump) this._mediaPump.stop();
        this._mediaPump = new MediaStreamPump(this, videoPath);
        return this._mediaPump.start();
    }

    stopMediaStream() {
        if (this._mediaPump) { this._mediaPump.stop(); this._mediaPump = null; }
    }

    startSilencePump() {
        if (!this.udpSock || !this.secretKey) return;
        let seq = 0, ts = 0;
        this._silenceTimer = setInterval(() => {
            if (!this.running) return;
            if (this._mediaPump && this._mediaPump.running) return;
            if (this.encryptionMode.includes('aes256_gcm')) {
                const rtpHdr = Buffer.alloc(12);
                rtpHdr[0] = 0x80;
                rtpHdr[1] = 0x78;
                rtpHdr.writeUInt16BE(seq & 0xFFFF, 2);
                rtpHdr.writeUInt32BE(ts >>> 0, 4);
                rtpHdr.writeUInt32BE(this.ssrc >>> 0, 8);
                this.nonceCounter++;
                const packet = encryptRtp(this.secretKey, rtpHdr, OPUS_SILENCE, this.nonceCounter);
                try { this.udpSock.send(packet, this.voicePort, this.voiceIp); } catch {}
            } else {
                const keepalive = Buffer.alloc(5);
                keepalive.writeUInt32BE(seq, 0);
                keepalive[4] = 0xC9;
                try { this.udpSock.send(keepalive, this.voicePort, this.voiceIp); } catch {}
            }
            seq = (seq + 1) & 0xFFFF;
            ts = (ts + 960) >>> 0;
        }, 1000);
    }

    close() {
        this.running = false;
        this.stopMediaStream();
        if (this._hbTimer) { clearInterval(this._hbTimer); this._hbTimer = null; }
        if (this._silenceTimer) { clearInterval(this._silenceTimer); this._silenceTimer = null; }
        if (this.udpSock) { try { this.udpSock.close(); } catch {} this.udpSock = null; }
        if (this.ws) { this.ws.close(); this.ws = null; }
    }
}

// ── Viewer Engine ──

class ViewerEngine {
    constructor(token) {
        this.token = token.trim();
        this.ws = null;
        this.running = false;
        this.guildId = '';
        this.channelId = '';
        this.streamKey = '';
        this.userId = '';
        this.username = '';
        this.heartbeatInterval = 41.25;
        this.sequence = null;
        this._isWatching = false;
    }

    start(guildId, channelId) {
        this.guildId = guildId;
        this.channelId = channelId;
        this.running = true;
        this._run();
    }

    watch(streamKey) {
        this.streamKey = streamKey;
        if (!this.ws || this.ws.closed) return;
        try {
            this.ws.send(JSON.stringify({ op: 20, d: { stream_key: streamKey } }));
            if (!this._isWatching) {
                this._isWatching = true;
                ok('viewer', `alt (${this.username || 'alt'}) assistindo stream via Op 20`);
            }
        } catch {}
    }

    async _run() {
        while (this.running) {
            try {
                this.ws = new MiniWebSocket(GATEWAY_HOST, 443, '/?v=9&encoding=json');
                await this.ws.connect();
                let lastHb = Date.now();

                while (this.running && this.ws && !this.ws.closed) {
                    if (Date.now() - lastHb > this.heartbeatInterval * 1000) {
                        try { this.ws.send(JSON.stringify({ op: 1, d: this.sequence })); } catch {}
                        lastHb = Date.now();
                    }
                    const msg = await this.ws.recv(1000);
                    if (!msg) continue;
                    if (msg.op === 'close') break;

                    const op = msg.op;
                    const s = msg.s;
                    const t = msg.t;
                    const d = msg.d || {};

                    if (s !== undefined && s !== null) this.sequence = s;

                    if (op === 10) {
                        this.heartbeatInterval = (d.heartbeat_interval || 41250) / 1000;
                        lastHb = Date.now();
                        this.ws.send(JSON.stringify({ op: 1, d: this.sequence }));
                        this.ws.send(JSON.stringify({
                            op: 2, d: {
                                token: this.token, capabilities: 16381,
                                properties: localProps(),
                                presence: { status: 'online', since: 0, activities: [], afk: false },
                            },
                        }));
                    } else if (op === 1) {
                        this.ws.send(JSON.stringify({ op: 1, d: this.sequence }));
                        lastHb = Date.now();
                    } else if (op === 0) {
                        if (t === 'READY') {
                            const u = d.user || {};
                            this.userId = String(u.id || '');
                            this.username = u.username || 'alt';
                            ok('viewer', `alt conectado (${this.username})`);
                            this.ws.send(JSON.stringify({
                                op: 4, d: {
                                    guild_id: this.guildId, channel_id: this.channelId,
                                    self_mute: true, self_deaf: true, self_video: false,
                                },
                            }));
                            ok('viewer', `alt entrou no canal de voz #${this.channelId}`);
                            if (this.streamKey) {
                                await new Promise(r => setTimeout(r, 1000));
                                this.watch(this.streamKey);
                            }
                        } else if (t === 'STREAM_CREATE') {
                            const key = d.stream_key || '';
                            if (key && (!this.streamKey || key === this.streamKey)) {
                                await new Promise(r => setTimeout(r, 500));
                                this.watch(key);
                            }
                        }
                    }
                }
            } catch {}
            if (!this.running) break;
            await new Promise(r => setTimeout(r, 3000));
        }
    }

    stop() {
        this.running = false;
        if (this.ws && !this.ws.closed) {
            try {
                this.ws.send(JSON.stringify({
                    op: 4, d: { guild_id: this.guildId, channel_id: null, self_mute: true, self_deaf: true, self_video: false },
                }));
            } catch {}
            try { this.ws.close(); } catch {}
        }
    }
}

// ── Gateway Stream Engine ──

class GatewayStreamEngine {
    constructor(state) {
        this.state = state;
        this.superProps = buildSuperProps();
        this.ws = null;
        this.voiceConn = null;
        this.streamConn = null;
        this.running = false;
        this.heartbeatInterval = 41.25;
        this.sequence = null;
        this.startTime = 0;

        this.gatewaySessionId = '';
        this.userId = '';
        this.streamKey = '';

        this.voiceSessionId = '';
        this.voiceToken = '';
        this.voiceEndpoint = '';
        this.voiceConnected = false;

        this.streamToken = '';
        this.streamEndpoint = '';
        this.rtcServerId = '';
        this.streamConnected = false;
        this.streamEverActive = false;
        this._streamRecreateAttempts = 0;
        this._userLeftVc = false;
        this._wasAlreadyInVc = false;
        this.viewerEngine = null;

        this.guildId = '';
        this.channelId = '';
        this.channelName = '';
        this.detectedGuildId = '';
        this.detectedChannelId = '';
        this.channelMembers = new Set();
        this.streamViewerIds = new Set();
        this.countedStreamSeconds = 0;
        this.lastTickTime = 0;
        this._statusTimer = null;
        this._tickTimer = null;
        this._readyResolve = null;
        this._cachedSupplementalGuilds = [];
    }

    getViewerCount() {
        const members = new Set([...this.channelMembers, ...this.streamViewerIds]);
        if (this.userId) members.delete(String(this.userId));
        if (this.viewerEngine && this.viewerEngine.running) {
            if (this.viewerEngine.userId) members.add(String(this.viewerEngine.userId));
            else return Math.max(members.size, 1);
        }
        return members.size;
    }

    async startStream(presetGuildId, presetChannelId) {
        rule();
        info(`${C.MAGENTA}Headless Gateway Live Streamer${C.WHITE}`);
        rule();
        info('conectando ao gateway do Discord (wss://gateway.discord.gg)...');

        this.ws = new MiniWebSocket(GATEWAY_HOST, 443, '/?v=9&encoding=json');
        try {
            await this.ws.connect();
        } catch (e) {
            err('gateway', `falha na conexão: ${e.message}`);
            rule();
            await ask(`  ${C.ORANGE}›${C.R} pressione enter para voltar ao menu`);
            return;
        }
        ok('gateway', 'conectado');
        this.running = true;
        this.startTime = Date.now() / 1000;
        this.countedStreamSeconds = 0;
        this.userId = userIdFromToken(this.state.token) || '';
        this.streamEverActive = false;
        this._streamRecreateAttempts = 0;
        this._userLeftVc = false;
        this._wasAlreadyInVc = false;

        const readyPromise = new Promise(r => { this._readyResolve = r; });
        this._eventLoop();

        const readyTimer = setTimeout(() => { if (this._readyResolve) { this._readyResolve(); this._readyResolve = null; } }, 5000);
        await readyPromise;
        clearTimeout(readyTimer);

        if (!this.running) {
            rule();
            await ask(`  ${C.ORANGE}›${C.R} pressione enter para voltar ao menu`);
            return;
        }

        if (presetChannelId) {
            this.channelId = presetChannelId;
            this.guildId = presetGuildId || '';
            if (!this.guildId) {
                const nameInfo = await this._lookupChannelName(this.channelId);
                this.channelName = nameInfo.name;
                if (nameInfo.guildId) this.guildId = nameInfo.guildId;
            } else {
                const nameInfo = await this._lookupChannelName(this.channelId);
                this.channelName = nameInfo.name;
            }
            ok('voice', `canal preset: ${C.WHITE}#${this.channelName}${C.R} (${this.channelId})`);
        } else if (this.detectedChannelId) {
            this._wasAlreadyInVc = true;
            this.channelId = this.detectedChannelId;
            this.guildId = this.detectedGuildId;
            const nameInfo = await this._lookupChannelName(this.channelId);
            this.channelName = nameInfo.name;
            if (!this.guildId && nameInfo.guildId) this.guildId = nameInfo.guildId;
            ok('voice', `canal de voz detectado: ${C.WHITE}#${this.channelName}${C.R} (${this.channelId})`);
        } else {
            info('nenhum canal de voz ativo detectado.');
            while (true) {
                const defaultCid = this.state.last_channel_id;
                const promptStr = `  ${C.GREY}ID do canal de voz${defaultCid ? ` [padrão: ${defaultCid}]` : ''}:${C.R} `;
                let rawIn = await ask(promptStr);
                if (!rawIn && defaultCid) rawIn = defaultCid;
                if (!rawIn || rawIn === 'q' || rawIn === 'exit') {
                    this._cleanup();
                    return;
                }
                const cid = extractChannelId(rawIn);
                const result = await this._validateTarget(cid);
                if (result.valid) {
                    this.channelId = cid;
                    this.guildId = result.guildId;
                    this.channelName = result.name;
                    this.state.last_guild_id = result.guildId;
                    this.state.last_channel_id = cid;
                    this.state.save();
                    break;
                }
                const retry = await ask(`  ${C.ORANGE}›${C.R} tentar novamente? (s/n, padrão: s): `);
                if (retry === 'n' || retry === 'no') {
                    this._cleanup();
                    return;
                }
            }
        }

        for (const g of this._cachedSupplementalGuilds) {
            if (String(g.id) === String(this.guildId)) {
                for (const vs of (g.voice_states || [])) {
                    if (String(vs.channel_id) === String(this.channelId) && String(vs.user_id) !== String(this.userId)) {
                        this.channelMembers.add(String(vs.user_id));
                    }
                }
            }
        }

        if (this.state.viewer_token) {
            info('viewer', 'iniciando alt viewer automático...');
            this.viewerEngine = new ViewerEngine(this.state.viewer_token);
            this.viewerEngine.start(this.guildId, this.channelId);
        } else {
            info('viewer', `${C.GREY}sem alt viewer configurado · use Opção 3 no menu${C.R}`);
        }

        try {
            this.ws.send(JSON.stringify({
                op: 4, d: {
                    guild_id: this.guildId, channel_id: this.channelId,
                    self_mute: false, self_deaf: false, self_video: false,
                },
            }));
            ok('voice', `entrando no canal ${C.ORANGE}#${this.channelName}${C.R} (${this.channelId})`);
        } catch (e) {
            err('voice', `falha: ${e.message}`);
            this._cleanup();
            return;
        }

        this.lastTickTime = Date.now() / 1000;
        this._tickTimer = setInterval(() => {
            const now = Date.now() / 1000;
            const dt = now - this.lastTickTime;
            this.lastTickTime = now;
            if (this.streamConnected && this.getViewerCount() > 0) {
                this.countedStreamSeconds += dt;
            }
        }, 1000);

        this._statusTimer = setInterval(() => {
            if (!this.running) return;
            const countedHours = this.countedStreamSeconds / 3600;
            const timerStr = formatTimer(this.countedStreamSeconds);
            const viewers = this.getViewerCount();
            if (this.streamConnected) {
                if (viewers > 0) {
                    const lbl = viewers === 1 ? '1 viewer' : `${viewers} viewers`;
                    live('stream', `${C.MAGENTA}🔴 AO VIVO (${lbl})${C.R} · ${timerStr} (${countedHours.toFixed(2)}h) contadas`);
                } else {
                    live('stream', `${C.YELLOW}⚠️ AO VIVO (0 VIEWERS: PAUSADO)${C.R} · ${timerStr} (${countedHours.toFixed(2)}h) ${C.GREY}(aguardando viewer)${C.R}`);
                }
            }
            if (this.streamConnected && this.streamKey && this.ws && !this.ws.closed) {
                try { this.ws.send(JSON.stringify({ op: 22, d: { stream_key: this.streamKey, paused: false } })); } catch {}
                if (this.viewerEngine) this.viewerEngine.watch(this.streamKey);
            }
        }, 10000);

        console.log();
        info(`${C.GREY}pressione Enter a qualquer momento para parar...${C.R}`);
        rule();

        await new Promise(resolve => {
            const checkStop = () => {
                if (!this.running) { resolve(); return; }
                setTimeout(checkStop, 500);
            };
            const onLine = () => {
                process.stdin.removeListener('data', onLine);
                resolve();
            };
            if (process.stdin.isTTY) {
                process.stdin.setRawMode(true);
                process.stdin.resume();
            }
            process.stdin.on('data', onLine);
            checkStop();
        });

        if (process.stdin.isTTY) {
            try { process.stdin.setRawMode(false); } catch {}
        }
        process.stdin.pause();

        this._cleanup();
    }

    async _eventLoop() {
        let lastHb = Date.now();

        while (this.running) {
            if (!this.ws || this.ws.closed) {
                const ok = await this._reconnect(true);
                if (!ok) break;
                lastHb = Date.now();
                continue;
            }

            if (Date.now() - lastHb > this.heartbeatInterval * 1000) {
                try {
                    this.ws.send(JSON.stringify({ op: 1, d: this.sequence }));
                    lastHb = Date.now();
                } catch {
                    const ok = await this._reconnect(true);
                    if (!ok) break;
                    lastHb = Date.now();
                    continue;
                }
            }

            let msg;
            try { msg = await this.ws.recv(1000); } catch { continue; }
            if (!msg) continue;

            if (msg.op === 'close') {
                const code = msg.code;
                const reason = msg.reason || '';
                warn('gateway', `gateway fechou (code ${code}: ${reason})`);
                if (code === 4004) {
                    err('auth', 'token inválido (4004)');
                    this.running = false;
                    break;
                }
                const ok = await this._reconnect(true);
                if (!ok) break;
                lastHb = Date.now();
                continue;
            }

            const op = msg.op;
            const seq = msg.s;
            const t = msg.t;
            const d = msg.d || {};

            if (seq !== undefined && seq !== null) this.sequence = seq;

            if (op === 10) {
                this.heartbeatInterval = (d.heartbeat_interval || 41250) / 1000;
                lastHb = Date.now();
                this.ws.send(JSON.stringify({ op: 1, d: this.sequence }));
                this.ws.send(JSON.stringify({
                    op: 2, d: {
                        token: this.state.token, capabilities: 16381,
                        properties: localProps(),
                        presence: { status: 'online', since: 0, activities: [], afk: false },
                    },
                }));
            } else if (op === 1) {
                this.ws.send(JSON.stringify({ op: 1, d: this.sequence }));
                lastHb = Date.now();
            } else if (op === 11) {
                // heartbeat ack
            } else if (op === 0) {
                if (t === 'RESUMED') {
                    ok('gateway', 'sessão resumida');
                    if (this.channelId) {
                        this.ws.send(JSON.stringify({
                            op: 4, d: { guild_id: this.guildId, channel_id: this.channelId, self_mute: false, self_deaf: false, self_video: false },
                        }));
                    }
                } else {
                    await this._handleDispatch(t, d);
                }
            } else if (op === 7) {
                warn('gateway', 'reconnect solicitado (op 7)');
                const ok = await this._reconnect(true);
                if (!ok) break;
                lastHb = Date.now();
            } else if (op === 9) {
                warn('gateway', `sessão invalidada (op 9, resumable=${!!d})`);
                const ok = await this._reconnect(!!d);
                if (!ok) break;
                lastHb = Date.now();
            }
        }
    }

    async _handleDispatch(eventType, d) {
        if (eventType === 'READY') {
            this.gatewaySessionId = d.session_id || '';
            const u = d.user || {};
            this.userId = String(u.id || this.userId);
            ok('auth', `autenticado (${u.username || '?'})`);
        } else if (eventType === 'READY_SUPPLEMENTAL') {
            const guilds = d.guilds || [];
            this._cachedSupplementalGuilds = guilds;
            for (const g of guilds) {
                const gid = String(g.id);
                for (const vs of (g.voice_states || [])) {
                    const vsUid = String(vs.user_id);
                    const vsCid = String(vs.channel_id || '');
                    if (vsUid === String(this.userId) && vsCid) {
                        this.detectedGuildId = gid;
                        this.detectedChannelId = vsCid;
                        if (vs.session_id) this.voiceSessionId = vs.session_id;
                    } else if (this.channelId && vsCid === String(this.channelId) && vsUid !== String(this.userId)) {
                        this.channelMembers.add(vsUid);
                    }
                }
            }
            if (this._readyResolve) { this._readyResolve(); this._readyResolve = null; }
        } else if (eventType === 'VOICE_STATE_UPDATE') {
            const vsUid = String(d.user_id);
            const vsCid = d.channel_id;
            const vsGuild = String(d.guild_id || '');

            if (!this.detectedChannelId && !this._readyResolve) {
                if (vsUid === String(this.userId) && vsCid) {
                    this.detectedChannelId = String(vsCid);
                    this.detectedGuildId = vsGuild;
                }
            }

            if (vsUid === String(this.userId)) {
                if (d.session_id) this.voiceSessionId = d.session_id;
                if (this.voiceConnected || this.streamConnected || this.streamEverActive) {
                    if (vsCid === null || vsCid === undefined) {
                        warn('voice', 'usuário desconectou do canal de voz');
                        this._userLeftVc = true;
                        this.voiceConnected = false;
                        this.streamConnected = false;
                        this.running = false;
                        return;
                    }
                    if (this.channelId && String(vsCid) !== String(this.channelId)) {
                        warn('voice', `usuário mudou para outro canal (${vsCid})`);
                        this._userLeftVc = true;
                        this.running = false;
                        return;
                    }
                }
            } else {
                if (this.channelId) {
                    if (vsCid && String(vsCid) === String(this.channelId)) {
                        const wasZero = this.getViewerCount() === 0;
                        this.channelMembers.add(vsUid);
                        if (wasZero && this.streamConnected) {
                            ok('viewer', `viewer entrou no canal (${this.channelMembers.size} presentes) — acumulação RETOMADA!`);
                        }
                    } else {
                        if (this.channelMembers.has(vsUid)) {
                            this.channelMembers.delete(vsUid);
                            if (this.getViewerCount() === 0 && this.streamConnected) {
                                warn('viewer', '⚠️ todos os viewers saíram — acumulação PAUSADA!');
                            }
                        }
                    }
                }
            }
        } else if (eventType === 'VOICE_SERVER_UPDATE') {
            const token = d.token || '';
            const endpoint = d.endpoint || '';
            if (!endpoint || !token) { err('voice', 'endpoint/token vazio'); return; }

            if (this.voiceConnected && this.voiceConn) {
                this.voiceConn.close();
                this.voiceConnected = false;
            }

            this.voiceToken = token;
            this.voiceEndpoint = endpoint;
            ok('voice', `voice server: ${endpoint}`);

            const sessionId = this.voiceSessionId || this.gatewaySessionId;
            this.voiceConn = new VoiceConnection({
                endpoint: this.voiceEndpoint, serverId: this.guildId || d.guild_id,
                userId: this.userId, sessionId, token: this.voiceToken,
                label: 'voice', isStream: false, channelId: this.channelId,
            });

            info('realizando handshake voice WebSocket...');
            const connected = await this.voiceConn.connect();
            if (connected) {
                this.voiceConn.startHeartbeat();
                this.voiceConn.sendSpeaking(false);
                this.voiceConn.startSilencePump();
                this.voiceConnected = true;
                ok('voice', `${C.GREEN}conexão voice estabelecida (ssrc=${this.voiceConn.ssrc})${C.R}`);

                await new Promise(r => setTimeout(r, 500));
                info('solicitando Go Live (op 18 Stream Create)...');
                try {
                    this.ws.send(JSON.stringify({
                        op: 18, d: { type: 'guild', guild_id: this.guildId, channel_id: this.channelId, preferred_region: null },
                    }));
                } catch (e) { warn('stream', `erro: ${e.message}`); }
            } else {
                err('voice', 'handshake falhou, tentando novamente em 3s...');
                setTimeout(() => {
                    if (this.running && this.ws && !this.ws.closed) {
                        try {
                            this.ws.send(JSON.stringify({
                                op: 4, d: { guild_id: this.guildId, channel_id: this.channelId, self_mute: false, self_deaf: false, self_video: false },
                            }));
                        } catch {}
                    }
                }, 3000);
            }
        } else if (eventType === 'STREAM_CREATE') {
            this.streamKey = d.stream_key || '';
            this.rtcServerId = d.rtc_server_id || '';
            ok('stream', `Go Live criado! stream_key: ${C.CYAN}${this.streamKey}${C.R}`);
            this.streamConnected = true;
            this.streamEverActive = true;
            this._streamRecreateAttempts = 0;

            const viewerIds = d.viewer_ids;
            if (viewerIds) {
                this.streamViewerIds = new Set(viewerIds.map(String).filter(u => u !== String(this.userId)));
            }

            if (this.ws && !this.ws.closed && this.streamKey) {
                try { this.ws.send(JSON.stringify({ op: 22, d: { stream_key: this.streamKey, paused: false } })); } catch {}
            }
            if (this.viewerEngine && this.streamKey) {
                this.viewerEngine.watch(this.streamKey);
            }

            console.log();
            rule();
            live('stream', `${C.MAGENTA}● TRANSMITINDO AO VIVO${C.R}`);
            rule();
            console.log(`  ${C.YELLOW}⚠️  REQUISITOS PARA ACUMULAR HORAS:${C.R}`);
            console.log(`  ${C.ORANGE}1.${C.R} ${C.WHITE}Um alt ou amigo ${C.YELLOW}DEVE estar no canal de voz${C.R}`);
            console.log(`  ${C.ORANGE}2.${C.R} ${C.WHITE}'Personalizar minha experiência' ${C.GREEN}LIGADO${C.R} (Configurações → Privacidade)${C.R}`);
            rule();

            const viewers = this.getViewerCount();
            if (viewers === 0) {
                warn('viewer', '⚠️ NENHUM VIEWER DETECTADO (0 no VC) — acumulação PAUSADA!');
            } else {
                ok('viewer', `✓ ${viewers} viewer(s) detectados — acumulação ATIVA`);
            }
        } else if (eventType === 'STREAM_UPDATE') {
            const viewerIds = d.viewer_ids;
            if (viewerIds) {
                this.streamViewerIds = new Set(viewerIds.map(String).filter(u => u !== String(this.userId)));
            }
        } else if (eventType === 'STREAM_SERVER_UPDATE') {
            const token = d.token || '';
            const endpoint = d.endpoint || '';
            if (!endpoint || !token) return;
            this.streamToken = token;
            this.streamEndpoint = endpoint;
            ok('stream', `rota de mídia do stream: ${endpoint}`);

            if (this.streamConn) { this.streamConn.close(); this.streamConn = null; }
            const targetServer = this.rtcServerId || d.rtc_server_id || d.guild_id || this.guildId || this.channelId;
            const vSession = this.voiceSessionId || this.gatewaySessionId;
            this.streamConn = new VoiceConnection({
                endpoint, serverId: targetServer, userId: this.userId,
                sessionId: vSession, token, label: 'stream_rtc',
                isStream: true, streamKey: this.streamKey || d.stream_key, channelId: this.channelId,
            });

            const connected = await this.streamConn.connect();
            if (connected) {
                this.streamConn.startHeartbeat();
                try {
                    this.streamConn.ws.send(JSON.stringify({
                        op: 12, d: {
                            audio_ssrc: this.streamConn.ssrc,
                            video_ssrc: this.streamConn.videoSsrc,
                            rtx_ssrc: this.streamConn.rtxSsrc,
                            streams: [{
                                type: 'video', rid: '100', ssrc: this.streamConn.videoSsrc,
                                rtx_ssrc: this.streamConn.rtxSsrc, active: true, quality: 100,
                                max_bitrate: 2500000, max_framerate: 30,
                                max_resolution: { type: 'fixed', width: 848, height: 480 },
                            }],
                        },
                    }));
                    this.streamConn.sendSpeaking(true, true);
                } catch {}
                ok('stream_rtc', `conexão de mídia ativa (ssrc=${this.streamConn.ssrc})`);

                if (fs.existsSync(VIDEO_FILE)) {
                    if (!this.streamConn.startMediaStream(VIDEO_FILE)) {
                        warn('stream_rtc', 'fallback para silêncio');
                        this.streamConn.startSilencePump();
                    }
                } else {
                    this.streamConn.startSilencePump();
                }
            } else {
                warn('stream_rtc', 'handshake de mídia falhou');
            }
        } else if (eventType === 'STREAM_DELETE') {
            this.streamConnected = false;
            if (this.streamConn) { this.streamConn.close(); this.streamConn = null; }

            if (!this.running || !this.voiceConnected || this._userLeftVc) return;

            if (this._streamRecreateAttempts < 3) {
                this._streamRecreateAttempts++;
                warn('stream', `stream parado pelo servidor, recriando em 2s (tentativa ${this._streamRecreateAttempts}/3)...`);
                setTimeout(() => {
                    if (this.running && this.ws && !this.ws.closed && this.voiceConnected && !this._userLeftVc) {
                        try {
                            this.ws.send(JSON.stringify({
                                op: 18, d: { type: 'guild', guild_id: this.guildId, channel_id: this.channelId, preferred_region: null },
                            }));
                        } catch {}
                    }
                }, 2000);
            } else {
                err('stream', 'stream parado repetidamente — encerrando');
                this.running = false;
            }
        }
    }

    async _reconnect(canResume) {
        this.streamConnected = false;
        this.voiceConnected = false;
        if (this.streamConn) { this.streamConn.close(); this.streamConn = null; }
        if (this.voiceConn) { this.voiceConn.close(); this.voiceConn = null; }
        if (this.ws) { this.ws.close(); this.ws = null; }

        let attempts = 0, backoff = 3;
        while (this.running) {
            attempts++;
            warn('gateway', `reconectando em ${backoff}s (tentativa ${attempts})...`);
            await new Promise(r => setTimeout(r, backoff * 1000));
            if (!this.running) return false;

            try {
                this.ws = new MiniWebSocket(GATEWAY_HOST, 443, '/?v=9&encoding=json');
                await this.ws.connect();

                let helloMsg = null;
                for (let i = 0; i < 15; i++) {
                    const m = await this.ws.recv(1000);
                    if (m && m.op === 'close' && m.code === 4004) {
                        err('auth', 'token inválido (4004)');
                        this.running = false;
                        return false;
                    }
                    if (m && m.op === 10) { helloMsg = m; break; }
                }
                if (!helloMsg) { this.ws.close(); backoff = Math.min(15, backoff + 2); continue; }

                this.heartbeatInterval = ((helloMsg.d || {}).heartbeat_interval || 41250) / 1000;
                this.ws.send(JSON.stringify({ op: 1, d: this.sequence }));

                let resumed = false;
                if (canResume && this.gatewaySessionId && this.sequence !== null) {
                    this.ws.send(JSON.stringify({ op: 6, d: { token: this.state.token, session_id: this.gatewaySessionId, seq: this.sequence } }));
                    const resMsg = await this.ws.recv(4000);
                    if (resMsg) {
                        if (resMsg.op === 0 && resMsg.t === 'RESUMED') resumed = true;
                        else if (resMsg.op === 0 && resMsg.t === 'READY') { await this._handleDispatch('READY', resMsg.d || {}); resumed = true; }
                    }
                }

                if (!resumed) {
                    this.ws.send(JSON.stringify({
                        op: 2, d: {
                            token: this.state.token, capabilities: 16381, properties: localProps(),
                            presence: { status: 'online', since: 0, activities: [], afk: false },
                        },
                    }));
                    const testMsg = await this.ws.recv(2000);
                    if (testMsg && testMsg.op === 'close' && testMsg.code === 4004) {
                        err('auth', 'token inválido (4004)');
                        this.running = false;
                        return false;
                    }
                    if (testMsg && testMsg.op === 0 && testMsg.t === 'READY') {
                        await this._handleDispatch('READY', testMsg.d || {});
                        resumed = true;
                    }
                }

                if (resumed && this.channelId) {
                    this.ws.send(JSON.stringify({
                        op: 4, d: { guild_id: this.guildId, channel_id: this.channelId, self_mute: false, self_deaf: false, self_video: false },
                    }));
                }
                ok('gateway', 'reconectado');
                return true;
            } catch {
                if (this.ws) { this.ws.close(); this.ws = null; }
                backoff = Math.min(15, backoff + 2);
            }
        }
        return false;
    }

    async _lookupChannelName(channelId) {
        const { status, data } = await discordGet(`https://discord.com/api/v9/channels/${channelId}`, this.state.token, this.superProps);
        if (status === 200) return { name: data.name || 'channel', guildId: data.guild_id || '' };
        return { name: 'channel', guildId: '' };
    }

    async _validateTarget(cid) {
        if (!/^\d+$/.test(cid)) { err('channel', `ID inválido: ${cid}`); return { valid: false }; }

        const me = await discordGet('https://discord.com/api/v9/users/@me', this.state.token, this.superProps);
        if (me.status === 401) { err('auth', 'token inválido (401)'); return { valid: false }; }

        const ch = await discordGet(`https://discord.com/api/v9/channels/${cid}`, this.state.token, this.superProps);
        if (ch.status === 403 || ch.status === 404) { err('channel', `canal não encontrado (${cid})`); return { valid: false }; }
        if (ch.status !== 200) { err('channel', `erro ao buscar canal (HTTP ${ch.status})`); return { valid: false }; }

        const chData = ch.data;
        const guildId = String(chData.guild_id || '');
        if (!guildId) { err('channel', 'canal DM não suportado'); return { valid: false }; }
        if (chData.type !== 2 && chData.type !== 13) { err('channel', `tipo inválido (type=${chData.type}), precisa ser canal de voz`); return { valid: false }; }

        ok('channel', `canal verificado: ${C.WHITE}#${chData.name}${C.R}`);

        const rawPerms = chData.permissions;
        if (rawPerms !== undefined) {
            const perms = BigInt(rawPerms);
            const isAdmin = !!(perms & PERM_ADMIN);
            const canView = isAdmin || !!(perms & PERM_VIEW);
            const canConnect = isAdmin || !!(perms & PERM_CONNECT);
            const canStream = isAdmin || !!(perms & PERM_STREAM);
            if (!canView) { err('perms', 'sem permissão VIEW_CHANNEL'); return { valid: false }; }
            if (!canConnect) { err('perms', 'sem permissão CONNECT'); return { valid: false }; }
            if (!canStream) { err('perms', 'sem permissão STREAM / Go Live'); return { valid: false }; }
            ok('perms', `${C.GREEN}View ✓ · Connect ✓ · Stream ✓${C.R}`);
        }

        return { valid: true, guildId, name: chData.name || 'channel' };
    }

    _cleanup() {
        this.running = false;
        if (this._statusTimer) { clearInterval(this._statusTimer); this._statusTimer = null; }
        if (this._tickTimer) { clearInterval(this._tickTimer); this._tickTimer = null; }

        if (this.ws && !this.ws.closed && this.streamKey) {
            try { this.ws.send(JSON.stringify({ op: 19, d: { stream_key: this.streamKey } })); } catch {}
        }
        if (this.ws && !this.ws.closed && !this._userLeftVc && !this._wasAlreadyInVc && this.guildId) {
            try { this.ws.send(JSON.stringify({ op: 4, d: { guild_id: this.guildId, channel_id: null, self_mute: false, self_deaf: false, self_video: false } })); } catch {}
        }

        if (this.viewerEngine) { this.viewerEngine.stop(); this.viewerEngine = null; }
        if (this.streamConn) { this.streamConn.close(); this.streamConn = null; }
        if (this.voiceConn) { this.voiceConn.close(); this.voiceConn = null; }

        setTimeout(() => {
            if (this.ws) { this.ws.close(); this.ws = null; }
        }, 300);

        if (this.streamEverActive) {
            const countedHours = this.countedStreamSeconds / 3600;
            if (this.countedStreamSeconds >= 10) {
                this.state.total_stream_hours_claimed += countedHours;
                this.state.total_stream_sessions += 1;
                this.state.save();
                console.log();
                ok('stream', `encerrado · ${formatTimer(this.countedStreamSeconds)} (${countedHours.toFixed(2)}h) contadas`);
                info(`${C.GREY}progresso da badge sincroniza em 24-48h.${C.R}`);
            } else {
                console.log();
                if (this.countedStreamSeconds < 10) {
                    warn('stream', `encerrado · 0h contadas (0 viewers presentes)`);
                } else {
                    info('sessão de stream encerrada.');
                }
            }
        } else {
            console.log();
            info('sessão encerrada.');
        }
        rule();
    }
}

function extractChannelId(raw) {
    const m = raw.match(/channels\/(?:\d+|@me)\/(\d{17,21})/);
    if (m) return m[1];
    const all = raw.match(/\d{17,21}/g);
    if (all) return all[all.length - 1];
    return raw.trim();
}

// ── App ──

async function inspectProfile(state) {
    if (!state.token) { err('auth', 'sem token'); return; }
    info('buscando perfil...');
    const uid = userIdFromToken(state.token);
    const sp = buildSuperProps();
    const { status, data } = await discordGet(`${USERS_URL}/${uid}/profile?with_mutual_guilds=false&with_mutual_friends_count=false`, state.token, sp);
    if (status !== 200) { err('profile', `erro HTTP ${status}`); return; }
    const user = data.user || {};
    const badges = data.badges || [];
    rule();
    const display = user.global_name ? `${user.global_name} (@${user.username})` : `@${user.username}`;
    ok('account', `${display} · ID: ${uid}`);
    if (badges.length) {
        info(`badges (${badges.length}):`);
        for (const b of badges) info(`  ${C.CYAN}•${C.R} ${C.ORANGE}${b.id}${C.R}: ${b.description || ''}`);
    } else {
        info('nenhuma badge equipada');
    }
    rule();
}

async function main() {
    const state = State.load();

    const menu = async () => {
        while (true) {
            banner();
            const viewerStatus = state.viewer_token ? `${C.GREEN}ativo${C.R}` : `${C.GREY}nenhum${C.R}`;
            info(`horas de stream: ${C.ORANGE}${state.total_stream_hours_claimed.toFixed(1)}h${C.WHITE} (${state.total_stream_sessions} sessões) · alt viewer: ${viewerStatus}`);
            rule();

            info(`${C.CYAN}Tiers de Transmissão:${C.R}`);
            for (const [tier, name, hours] of STREAM_TIERS) {
                const done = state.total_stream_hours_claimed >= hours;
                const sym = done ? '●' : '○';
                const col = done ? C.GREEN : C.GREY;
                info(`  ${col}${sym} Tier ${String(tier).padStart(2)} · ${C.ORANGE}${name.padEnd(20)}${col} ${String(hours).padStart(5)}h${C.R}`);
            }
            console.log();

            info(`${C.ORANGE}1${C.R} · ${C.MAGENTA}Iniciar Stream${C.R} (Gateway Go Live)`);
            info(`${C.ORANGE}2${C.R} · Inspecionar Perfil & Badges`);
            info(`${C.ORANGE}3${C.R} · ${C.CYAN}Configurar Alt Viewer${C.R}`);
            info(`${C.ORANGE}4${C.R} · Atualizar Token`);
            info(`${C.ORANGE}5${C.R} · Sair`);
            rule();

            const choice = await ask(`  ${C.ORANGE}›${C.R} `);
            console.log();

            if (choice === '1') {
                if (!state.token) { err('token', 'configure o token primeiro (Opção 4)'); await ask(`  ${C.ORANGE}›${C.R} enter para continuar`); continue; }
                const engine = new GatewayStreamEngine(state);
                await engine.startStream();
                await ask(`  ${C.ORANGE}›${C.R} pressione enter para voltar ao menu`);
            } else if (choice === '2') {
                await inspectProfile(state);
                await ask(`  ${C.ORANGE}›${C.R} enter para continuar`);
            } else if (choice === '3') {
                rule();
                info(`${C.CYAN}Configuração do Alt Viewer${C.R}`);
                info('O Discord requer pelo menos 1 viewer no canal de voz.');
                const curr = state.viewer_token ? state.viewer_token.slice(0, 10) + '...' : 'Não configurado';
                info(`token atual: ${C.ORANGE}${curr}${C.R}`);
                const entered = await ask(`  ${C.GREY}token do alt (enter para limpar):${C.R} `);
                state.viewer_token = entered;
                state.save();
                if (entered) ok('viewer', 'token salvo');
                else warn('viewer', 'token limpo');
            } else if (choice === '4') {
                rule();
                info('Cole seu token do Discord:');
                const tok = await ask(`  ${C.GREY}token:${C.R} `);
                if (tok) {
                    state.token = tok;
                    state.fetched_at = 0;
                    state.save();
                    try {
                        await ensureAnalyticsToken(state);
                        ok('token', 'salvo e verificado');
                    } catch (e) { warn('token', `salvo (${e.message})`); }
                }
                info('Cole o cookie cf_clearance (ou enter para pular):');
                const ck = await ask(`  ${C.GREY}cookie:${C.R} `);
                if (ck) { state.cookie = ck; state.save(); ok('cookie', 'salvo'); }
            } else if (choice === '5' || choice === 'q' || choice === 'exit') {
                break;
            }
        }
    };

    process.on('SIGINT', () => {
        console.log();
        warn('exit', 'interrompido pelo usuário');
        process.exit(0);
    });

    const args = process.argv.slice(2);
    const getArg = (name) => { const a = args.find(a => a.startsWith(`--${name}=`)); return a ? a.split('=').slice(1).join('=') : ''; };
    const headlessToken = getArg('token');
    const headlessGuild = getArg('guild');
    const headlessChannel = getArg('channel');
    const headlessViewer = getArg('viewer-token');

    if (headlessToken && headlessChannel) {
        state.token = headlessToken;
        if (headlessViewer) state.viewer_token = headlessViewer;
        state.save();
        try { await ensureAnalyticsToken(state); } catch {}
        ok('headless', `token configurado, canal: ${headlessChannel}`);
        const engine = new GatewayStreamEngine(state);
        engine.guildId = headlessGuild;
        engine.channelId = headlessChannel;
        await engine.startStream(headlessGuild, headlessChannel);
    } else {
        await menu();
    }
}

main().catch(e => { err('fatal', e.message); process.exit(1); });
