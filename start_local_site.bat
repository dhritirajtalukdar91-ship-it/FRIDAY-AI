@echo off
cd /d "%~dp0docs"
echo Open http://localhost:8000 in Chrome or Edge
py -3 -m http.server 8000 --bind 127.0.0.1 || python -m http.server 8000 --bind 127.0.0.1
