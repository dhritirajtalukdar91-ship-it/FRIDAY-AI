#!/usr/bin/env python3
"""FRIDAY desktop agent. Listens on 127.0.0.1 only. Allowlisted actions only.
No spoken text is ever executed as a command; the web app can only pick from the actions below."""
import ctypes, hmac, json, os, secrets, subprocess, sys, time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

HOST, PORT = "127.0.0.1", 8765          # never change HOST to 0.0.0.0
cfg_path = Path(__file__).with_name("config.json")
cfg = json.loads(cfg_path.read_text(encoding="utf-8")) if cfg_path.exists() else {}
ORIGINS = set(cfg.get("allowed_origins", [])) | {"http://localhost:8000", "http://127.0.0.1:8000"}
NOWIN = 0x08000000 if os.name == "nt" else 0

# name -> (what to launch, process names to close or None if not closable)
APPS = {
    "notepad": ("notepad.exe", ["notepad.exe"]),
    "calculator": ("calc.exe", ["CalculatorApp.exe", "calc.exe"]),
    "chrome": ("chrome.exe", ["chrome.exe"]),
    "paint": ("mspaint.exe", ["mspaint.exe"]),
    "edge": ("msedge.exe", ["msedge.exe"]),
    "explorer": ("explorer.exe", None),
    "taskmgr": ("taskmgr.exe", None),
    "settings": ("ms-settings:", None),
}
H = Path.home()
ROOTS = {n: H / d for n, d in [("documents", "Documents"), ("downloads", "Downloads"), ("desktop", "Desktop"),
                                ("pictures", "Pictures"), ("music", "Music"), ("videos", "Videos")]}
BLOCKED_EXT = {".exe", ".bat", ".cmd", ".ps1", ".msi", ".vbs", ".js", ".lnk", ".scr", ".com", ".reg", ".hta", ".jar", ".dll", ".py"}

state = {"code": None, "token": None, "fails": 0}
pending = {}   # confirm_id -> (expires, function, message)

def new_code():
    state["code"] = f"{secrets.randbelow(10**6):06d}"; state["fails"] = 0
    print(f"\n>>> PAIRING CODE: {state['code']}  (enter it on the FRIDAY website)\n")

def ok(msg, **kw): return {"ok": True, "message": msg, **kw}
def err(msg): return {"ok": False, "error": msg, "message": msg}
def confirm(msg, fn):
    cid = secrets.token_urlsafe(8); pending[cid] = (time.time() + 30, fn, msg)
    return {"ok": True, "needs_confirm": True, "confirm_id": cid, "message": msg + " Confirm within 30 seconds."}

def key(vk, n=1):
    for _ in range(n):
        ctypes.windll.user32.keybd_event(vk, 0, 0, 0); ctypes.windll.user32.keybd_event(vk, 0, 2, 0)

def inside_roots(p: Path):
    p = p.resolve()
    return any(p == r.resolve() or r.resolve() in p.parents for r in ROOTS.values())

def search(q):
    q = q.lower().strip()[:60]
    if len(q) < 2: return err("Search term too short.")
    out, end = [], time.time() + 6
    for r in ROOTS.values():
        for dp, dn, fn in os.walk(r):
            dn[:] = [d for d in dn if not d.startswith(".") and d.lower() != "appdata"]
            for f in fn:
                if q in f.lower() and Path(f).suffix.lower() not in BLOCKED_EXT:
                    out.append({"name": f, "path": str(Path(dp) / f)})
            if len(out) >= 15 or time.time() > end: break
        if len(out) >= 15 or time.time() > end: break
    return ok(f"Found {len(out)} file(s)." if out else "No matching files in your user folders.", results=out)

def close_app(app):
    hit = False
    for p in APPS[app][1]:
        hit |= subprocess.run(["taskkill", "/IM", p], capture_output=True, creationflags=NOWIN).returncode == 0
    return ok(f"Closed {app}." if hit else f"{app} was not running.")

def act(a, g):
    if os.name != "nt": return err("This agent supports Windows only.")
    if a == "open_app":
        app = g.get("app")
        if app not in APPS: return err("App is not on the allowlist.")
        os.startfile(APPS[app][0]); return ok(f"Opening {app}.")
    if a == "close_app":
        app = g.get("app")
        if app not in APPS or not APPS[app][1]: return err("That app cannot be closed by FRIDAY.")
        return confirm(f"Close {app}? Unsaved work may be lost.", lambda: close_app(app))
    if a == "open_folder":
        f = g.get("folder")
        if f not in ROOTS: return err("Folder is not on the allowlist.")
        os.startfile(str(ROOTS[f])); return ok(f"Opening {f}.")
    if a == "search_files": return search(str(g.get("query", "")))
    if a == "open_file":
        p = Path(str(g.get("path", "")))
        if not p.is_file() or not inside_roots(p) or p.suffix.lower() in BLOCKED_EXT: return err("File not allowed.")
        return confirm(f"Open file {p.name}?", lambda: (os.startfile(str(p)), ok(f"Opening {p.name}."))[1])
    if a == "volume":
        d = g.get("direction")
        if d not in ("up", "down", "mute"): return err("Bad direction.")
        key({"up": 0xAF, "down": 0xAE, "mute": 0xAD}[d], 5 if d != "mute" else 1); return ok(f"Volume {d}.")
    if a == "lock": return confirm("Lock the computer?", lambda: (ctypes.windll.user32.LockWorkStation(), ok("Locked."))[1])
    if a in ("shutdown", "restart"):
        flag = "/s" if a == "shutdown" else "/r"
        return confirm(f"{a.title()} the computer in 30 seconds? Say 'cancel shutdown' to abort.",
                       lambda: (subprocess.run(["shutdown", flag, "/t", "30"], creationflags=NOWIN), ok(f"{a.title()} in 30 seconds."))[1])
    if a == "cancel_shutdown":
        subprocess.run(["shutdown", "/a"], capture_output=True, creationflags=NOWIN); return ok("Shutdown cancelled if one was pending.")
    return err("Unknown action.")

class Handler(BaseHTTPRequestHandler):
    def log_message(self, *a): pass
    def _send(self, code, obj=None):
        self.send_response(code)
        o = self.headers.get("Origin", "")
        if o in ORIGINS:
            self.send_header("Access-Control-Allow-Origin", o); self.send_header("Vary", "Origin")
            self.send_header("Access-Control-Allow-Headers", "Authorization, Content-Type")
            self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
            self.send_header("Access-Control-Allow-Private-Network", "true")
        body = json.dumps(obj or {}).encode()
        self.send_header("Content-Type", "application/json"); self.send_header("Content-Length", str(len(body)))
        self.end_headers(); self.wfile.write(body)
    def _guard(self):
        if self.headers.get("Host", "") not in (f"127.0.0.1:{PORT}", f"localhost:{PORT}"):  # anti DNS-rebinding
            self._send(403, err("Bad host.")); return False
        o = self.headers.get("Origin")
        if o is not None and o not in ORIGINS:
            self._send(403, err("Origin not allowed. Add it to agent/config.json.")); return False
        return True
    def do_OPTIONS(self):
        if self._guard(): self._send(204)
    def do_POST(self):
        if not self._guard(): return
        try:
            n = int(self.headers.get("Content-Length", 0))
            if n > 4096: return self._send(413, err("Too large."))
            data = json.loads(self.rfile.read(n) or b"{}")
        except Exception: return self._send(400, err("Bad JSON."))
        if self.path == "/pair":
            if state["fails"] >= 5: new_code(); return self._send(429, err("Too many attempts. A new code was printed in the agent window."))
            if hmac.compare_digest(str(data.get("code", "")), state["code"]):
                state["token"] = secrets.token_urlsafe(32); new_code()
                print("Paired with browser."); return self._send(200, {"ok": True, "token": state["token"]})
            state["fails"] += 1; return self._send(401, err("Wrong pairing code."))
        auth = self.headers.get("Authorization", "")
        if not state["token"] or not hmac.compare_digest(auth, "Bearer " + state["token"]):
            return self._send(401, err("Not authorised. Pair first."))
        if self.path == "/status": return self._send(200, ok("online"))
        if self.path == "/action":
            print("action:", data.get("action"), data.get("args"))
            try: return self._send(200, act(str(data.get("action")), data.get("args") or {}))
            except Exception as e: return self._send(200, err(f"Action failed: {e}"))
        if self.path == "/confirm":
            exp, fn, _ = pending.pop(str(data.get("id")), (0, None, ""))
            if not fn or time.time() > exp: return self._send(200, err("Confirmation expired or invalid."))
            try: return self._send(200, fn())
            except Exception as e: return self._send(200, err(f"Action failed: {e}"))
        self._send(404, err("Not found."))

if __name__ == "__main__":
    if os.name != "nt": print("Warning: desktop actions only work on Windows.")
    new_code()
    print(f"FRIDAY agent listening on http://{HOST}:{PORT}  (localhost only). Ctrl+C to stop.")
    print("Allowed origins:", ", ".join(sorted(ORIGINS)))
    try: ThreadingHTTPServer((HOST, PORT), Handler).serve_forever()
    except KeyboardInterrupt: sys.exit(0)
