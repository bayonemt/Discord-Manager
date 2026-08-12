#!/usr/bin/env python3
"""
Relay local para o discord resolver missoes do tipo ACHIEVEMENT_IN_ACTIVITY.

O Discord bloqueia por CSP qualquer fetch() da pagina para dominios como
*.discordsays.com, mas libera explicitamente http://127.0.0.1:*. Este
script escuta em 127.0.0.1 e repassa, por fora do navegador (sem CSP),
as duas chamadas que o resolver precisa fazer para o backend da Activity.

Uso: python3 discord_quest_relay.py
Deixe rodando numa aba de terminal enquanto usa a aba "Missoes" do script.
Feche com Ctrl+C quando terminar.
"""
import json
import urllib.request
import urllib.error
from http.server import BaseHTTPRequestHandler, HTTPServer

HOST = "127.0.0.1"
PORT = 43110
ALLOWED_HOST_SUFFIX = ".discordsays.com"


class RelayHandler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        print("[relay]", fmt % args)

    def _send_json(self, status, payload):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_GET(self):
        if self.path == "/health":
            self._send_json(200, {"ok": True})
        else:
            self._send_json(404, {"ok": False, "error": "not found"})

    def do_POST(self):
        if self.path != "/proxy":
            self._send_json(404, {"ok": False, "error": "not found"})
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
            raw = self.rfile.read(length)
            req = json.loads(raw)
        except Exception as e:
            self._send_json(400, {"ok": False, "error": f"bad request: {e}"})
            return

        url = req.get("url", "")
        headers = req.get("headers", {}) or {}
        body = req.get("body", "")

        from urllib.parse import urlparse
        host = urlparse(url).hostname or ""
        if not host.endswith(ALLOWED_HOST_SUFFIX):
            self._send_json(403, {"ok": False, "error": f"host not allowed: {host}"})
            return

        try:
            data = body.encode("utf-8") if isinstance(body, str) else json.dumps(body).encode("utf-8")
            browser_like = {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                              "(KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
                "Accept": "*/*",
                "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
                "Origin": "https://canary.discord.com",
                "Sec-Fetch-Site": "cross-site",
                "Sec-Fetch-Mode": "cors",
                "Sec-Fetch-Dest": "empty",
            }
            merged_headers = {**browser_like, **headers}
            r = urllib.request.Request(url, data=data, headers=merged_headers, method="POST")
            with urllib.request.urlopen(r, timeout=15) as resp:
                resp_body = resp.read().decode("utf-8", errors="replace")
                self._send_json(200, {"ok": True, "status": resp.status, "body": resp_body})
        except urllib.error.HTTPError as e:
            resp_body = e.read().decode("utf-8", errors="replace")
            self._send_json(200, {"ok": False, "status": e.code, "body": resp_body})
        except Exception as e:
            self._send_json(200, {"ok": False, "status": 0, "body": str(e)})


if __name__ == "__main__":
    server = HTTPServer((HOST, PORT), RelayHandler)
    print(f"Relay rodando em http://{HOST}:{PORT} (Ctrl+C para parar)")
    print(f"Só encaminha requisicoes para hosts terminados em '{ALLOWED_HOST_SUFFIX}'.")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nParando relay...")
        server.shutdown()
