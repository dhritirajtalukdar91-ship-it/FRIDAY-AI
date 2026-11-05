# FRIDAY AI

Free, open-source voice assistant in two parts. No API keys, no paid services, no custom domain.

1. **Web assistant** (`docs/`) – HTML/CSS/JS, deploys on GitHub Pages.
2. **Desktop agent** (`agent/`) – Python, runs on your Windows 10/11 PC, listens on `127.0.0.1` only.

```
FRIDAY-AI/
├── docs/            index.html  style.css  app.js     ← GitHub Pages site
├── agent/           friday_agent.py  config.json      ← local Windows agent
├── requirements.txt  (stdlib only – nothing to install)
├── start_agent.bat   start_local_site.bat
└── README.md
```

## What works (and what doesn't)
**Web:** voice + typed commands (English, Hindi, Hinglish); open Google/YouTube/Gmail/GitHub/Maps/any `name.com`; Google & YouTube search; calculator ("5 plus 3", "10 गुणा 4"); date/time; notes (saved in your browser); command history; study helper (Wikipedia summaries in English/Hindi + study timer).
**Desktop:** open/close allowlisted apps (Notepad, Calculator, Chrome, Edge, Paint, Explorer, Task Manager, Settings); open Documents/Downloads/Desktop/Pictures/Music/Videos; search files by name in those folders; volume up/down/mute; lock, shutdown, restart (with confirmation).

**Honest limits**
- It is a **rule-based command parser**, not ChatGPT. Unknown sentences get "I didn't understand".
- Study help = Wikipedia summaries, not tutoring or reasoning.
- Speech recognition works in **Chrome/Edge** (and Safari partly); **Firefox has none** – use typing. Chrome's recognizer sends audio to Google's servers (this is the browser's feature, not ours).
- Hinglish: speak with "English / Hinglish" mode; keywords like *kholo, band karo, dhundo, kya hai* are understood. Numbers in calculator must be digits.
- Female voice is used only if your system has one (Windows: Zira, Heera, etc.; Hindi voices may need installing in *Settings → Time & language → Speech*). Otherwise the default voice is used.
- Brightness, Wi-Fi, Bluetooth, screenshots, sleep are **not supported**.
- Safari blocks web→localhost connections; use Chrome or Edge for desktop control.

## Security design
- Agent binds to `127.0.0.1` only – never reachable from the network or internet.
- **Pairing:** on start it prints a random 6-digit code. Entering it on the website returns a secret token (new random token each agent run). 5 wrong codes → code rotates.
- Every request needs the token **and** an `Origin` that is in `agent/config.json` (plus a Host check against DNS-rebinding).
- Only fixed actions exist. Spoken text is **never** run as a terminal command, no shell is used, apps come from a fixed allowlist.
- File opening is limited to your user folders and refuses executables/scripts.
- Confirmation required (button or "yes/haan") for: closing apps, opening files, lock, shutdown, restart.
- Stop the agent (close its window) and all control stops.

## Beginner setup
### A. Put the website on GitHub Pages (free)
1. Create a free account at github.com → **New repository** → name it `friday-ai` → Public → Create.
2. Click **uploading an existing file**, drag the whole project contents (including the `docs` folder) in, **Commit**.
3. Repo **Settings → Pages** → Source: *Deploy from a branch* → Branch `main`, folder `/docs` → Save.
4. After ~1 minute your site is at `https://YOUR-USERNAME.github.io/friday-ai/`.

### B. Install the Windows agent
1. Install Python 3.9+ from python.org (tick **"Add python.exe to PATH"**).
2. Copy the project folder to your PC (e.g. `C:\FRIDAY-AI`).
3. Edit `agent\config.json`: replace `YOUR-USERNAME` with your GitHub username (origin is `https://username.github.io`, no path).
4. Double-click **start_agent.bat**. A window shows a **6-digit pairing code**. Keep it open. If Windows Firewall asks, no network access is needed – you may click Cancel/Deny.

### C. Connect
1. Open your GitHub Pages site in Chrome/Edge. Allow the microphone.
2. If Chrome asks to allow access to "local network / devices on your network", click **Allow**.
3. In the **Desktop Agent** card type the code → **Connect**. Status turns green.
4. Say or type: "open notepad", "find file resume", "volume up".

### Test locally first (optional)
Double-click `start_local_site.bat`, open `http://localhost:8000`. This origin is already allowed.

## Customising
- Add apps: edit `APPS` in `friday_agent.py` (and the matching regex in `docs/app.js`). Only add programs you trust.
- Add folders: edit `ROOTS`.
- Pairing again after restart is required (tokens are not saved on the PC).

## Troubleshooting
- *"Agent not reachable"*: agent window closed, or browser blocked local access (Safari / Brave shields / Chrome permission).
- *"Origin not allowed"*: fix `allowed_origins` in `config.json`, restart agent.
- *Popup blocked*: click the link FRIDAY shows in the log.
- *No female voice*: install more voices in Windows speech settings.

License: MIT (use freely).
