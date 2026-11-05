@echo off
cd /d "%~dp0agent"
py -3 friday_agent.py || python friday_agent.py
pause
