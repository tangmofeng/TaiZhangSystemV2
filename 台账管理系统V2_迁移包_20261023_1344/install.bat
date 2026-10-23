@echo off
chcp 936 >nul
setlocal EnableExtensions
title TaiZhangSystem V2 Auto Installer
cd /d "%~dp0"
set "LOG=%~dp0install_log.txt"
echo. > "%LOG%"
call :LOG "=============================================="
call :LOG "TaiZhang V2 install start  %DATE% %TIME%"
call :LOG "=============================================="

rem ---- admin check & self-elevate ----
net session >nul 2>&1
if errorlevel 1 (
  call :LOG "need admin, request elevation..."
  echo requesting admin privilege, please click YES in UAC window...
  powershell -NoProfile -Command "$p = Start-Process -FilePath '%~f0' -Verb RunAs -PassThru -ErrorAction SilentlyContinue; if (-not $p) { exit 9 }" >nul 2>&1
  if errorlevel 9 (
    call :LOG "[ERROR] admin denied"
    echo.
    echo [ERROR] admin privilege denied. Right-click this file and choose "Run as administrator".
    echo.
    pause
    exit /b 1
  )
  exit /b 0
)
call :LOG "admin ok"

rem ---- locate migration package zip ----
set "ZIP="
for %%f in ("%~dp0*.zip") do set "ZIP=%%~f"
if not defined ZIP (
  for %%f in ("%~dp0..\*.zip") do set "ZIP=%%~f"
)
if not defined ZIP (
  call :LOG "[ERROR] zip not found"
  echo.
  echo [ERROR] migration package .zip not found.
  echo        Put the zip file in the same folder as this script, then run again.
  echo.
  pause
  exit /b 1
)
call :LOG "[1/7] ZIP=%ZIP%"

rem ---- target folder: D:\TaiZhangSystemV2, fallback C:\TaiZhangSystemV2 ----
set "TARGET=D:\TaiZhangSystemV2"
if not exist D:\ set "TARGET=C:\TaiZhangSystemV2"
call :LOG "[2/7] TARGET=%TARGET%"

rem ---- if target exists and port 8090 is listening, ask to stop service first ----
powershell -NoProfile -Command "if (Get-NetTCPConnection -LocalPort 8090 -State Listen -ErrorAction SilentlyContinue) { exit 1 } else { exit 0 }" >nul 2>&1
if errorlevel 1 (
  call :LOG "[WARN] port 8090 is in use - existing service is running"
  echo.
  echo [WARN] Port 8090 is already in use by a running service.
  echo        Please stop it first (Task Manager - end pythonw.exe of 8090), then run this script again.
  echo.
  pause
  exit /b 1
)

if exist "%TARGET%" (
  call :LOG "old install found, rename backup"
  ren "%TARGET%" "TaiZhangSystemV2_old_%DATE:~0,4%%DATE:~5,2%%DATE:~8,2%_%TIME:~0,2%%TIME:~3,2%" >nul 2>&1
)
powershell -NoProfile -ExecutionPolicy Bypass -Command "Expand-Archive -Path '%ZIP%' -DestinationPath '%TARGET%' -Force" >nul 2>&1
if errorlevel 1 (
  call :LOG "[ERROR] extract fail"
  echo [ERROR] extract fail, check zip file.
  pause
  exit /b 1
)
call :LOG "[3/7] extract ok"

rem ---- locate python ----
set "PY="
for %%P in ("%LOCALAPPDATA%\Programs\Python\Python312\python.exe" "%LOCALAPPDATA%\Programs\Python\Python311\python.exe" "%LOCALAPPDATA%\Programs\Python\Python310\python.exe" "C:\Python312\python.exe" "C:\Python311\python.exe") do (
  if exist %%P set "PY=%%~P"
)
if not defined PY (
  where python >nul 2>&1
  if not errorlevel 1 set "PY=python"
)
if not defined PY (
  call :LOG "python not found, install python 3.12..."
  echo installing Python 3.12, please wait a few minutes...
  where winget >nul 2>&1
  if errorlevel 1 (
    call :LOG "download official installer"
    powershell -NoProfile -Command "Invoke-WebRequest -Uri 'https://www.python.org/ftp/python/3.12.8/python-3.12.8-amd64.exe' -OutFile '%TEMP%\python-3.12.8-amd64.exe' -UseBasicParsing" >nul 2>&1
    "%TEMP%\python-3.12.8-amd64.exe" /quiet InstallAllUsers=0 PrependPath=1 Include_pip=1 Include_test=0
  ) else (
    call :LOG "install by winget"
    winget install --id Python.Python.3.12 -e --silent --accept-package-agreements --accept-source-agreements >nul 2>&1
  )
  for %%P in ("%LOCALAPPDATA%\Programs\Python\Python312\python.exe" "%LOCALAPPDATA%\Programs\Python\Python311\python.exe") do (
    if exist %%P set "PY=%%~P"
  )
  if not defined PY set "PY=python"
)
call :LOG "[4/7] PY=%PY%"

rem ---- windowless launcher (pythonw) ----
set "PYW=pythonw"
for /f "delims=" %%i in ("%PY%") do set "PYD=%%~dpi"
if exist "%PYD%pythonw.exe" set "PYW=%PYD%pythonw.exe"

rem ---- deps: mirror -> official -> offline wheels; fail => abort ----
set PYTHONUTF8=1
echo installing dependencies (pip)...
"%PY%" -m pip install -r "%TARGET%\requirements.txt" --disable-pip-version-check -q -i https://pypi.tuna.tsinghua.edu.cn/simple
if errorlevel 1 (
  call :LOG "mirror fail, retry official pypi"
  echo mirror fail, retry official pypi...
  "%PY%" -m pip install -r "%TARGET%\requirements.txt" --disable-pip-version-check -q
)
if errorlevel 1 (
  call :LOG "network fail, try offline wheels"
  echo network source fail, try offline wheels, no internet needed...
  "%PY%" -m pip install --no-index --find-links "%TARGET%\wheels" -r "%TARGET%\requirements.txt"
)
if errorlevel 1 (
  call :LOG "[ERROR] deps install fail"
  echo.
  echo [ERROR] dependency install failed even with offline package. Manual:
  echo   "%PY%" -m pip install --no-index --find-links "%TARGET%\wheels" -r "%TARGET%\requirements.txt"
  echo.
  pause
  exit /b 1
)
"%PY%" -c "import flask, openpyxl" >nul 2>&1
if errorlevel 1 (
  call :LOG "[ERROR] flask check fail"
  echo [ERROR] flask/openpyxl import check failed, deps not ready.
  pause
  exit /b 1
)
call :LOG "deps ok"
echo dependencies installed and verified

rem ---- windowless start script (vbs) with port env ----
> "%TARGET%\start_server.vbs" echo Set ws = CreateObject("Wscript.Shell")
>> "%TARGET%\start_server.vbs" echo ws.CurrentDirectory = "%TARGET%"
>> "%TARGET%\start_server.vbs" echo ws.Environment("PROCESS")("TZ_PORT") = "8090"
>> "%TARGET%\start_server.vbs" echo ws.Run """%PYW%"" server\app.py", 0, False
reg add "HKCU\Software\Microsoft\Windows\CurrentVersion\Run" /v TaiZhangSystemV2 /t REG_SZ /d "wscript.exe \"%TARGET%\start_server.vbs\"" /f >nul 2>&1
call :LOG "[5/7] autostart set"

rem ---- firewall: allow TCP 8090 for LAN access ----
netsh advfirewall firewall delete rule name="TaiZhangSystem8090" >nul 2>&1
netsh advfirewall firewall add rule name="TaiZhangSystem8090" dir=in action=allow protocol=TCP localport=8090 >nul 2>&1
call :LOG "[6/7] firewall ok"

rem ---- start service & verify ----
call :LOG "[7/7] start service..."
cd /d "%TARGET%"
start "" "%PYW%" server\app.py
timeout /t 8 /nobreak >nul
powershell -NoProfile -Command "$r = Test-NetConnection -ComputerName 127.0.0.1 -Port 8090 -WarningAction SilentlyContinue; if ($r.TcpTestSucceeded) { Write-Host 'OK' } else { Write-Host 'FAIL' }" >nul 2>&1
if errorlevel 1 (
  call :LOG "[WARN] service not responding"
  echo.
  echo [WARN] service not responding in 8s. manual: cd /d "%TARGET%" ^&^& "%PY%" server\app.py
) else (
  call :LOG "service ok"
  set "LANIP="
  for /f %%i in ('powershell -NoProfile -Command "$a=Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue|Where-Object{$_.IPAddress -notlike '127.*'}|Select-Object -First 1; if($a){$a.IPAddress}"') do set "LANIP=%%i"
  echo.
  echo ============================================
  echo   install success! system started
  echo   local:  http://127.0.0.1:8090
  if defined LANIP echo   lan:    http://%LANIP%:8090
  echo   account: admin / admin123
  echo ============================================
)
echo.
echo install log: %LOG%
echo.
pause
exit /b 0

:LOG
echo %DATE% %TIME%  %~1
echo %DATE% %TIME%  %~1 >> "%LOG%"
exit /b 0
