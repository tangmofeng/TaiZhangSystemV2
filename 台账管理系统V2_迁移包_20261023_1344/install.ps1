# -*- coding: utf-8 -*-
# ============================================================
#  台账管理系统 V1 - 自动安装脚本 (PowerShell)
#  功能: 自动装环境+依赖 / 自动改防火墙 / 自动开机自启 /
#        默认安装到 D:\台账管理系统V1 (无D盘则 C:\台账管理系统V1)
#  用法: 右键"使用 PowerShell 运行"，或:
#        powershell -ExecutionPolicy Bypass -File install.ps1
#  要求: Windows 10/11 (Win7 请使用同目录 install.bat)
# ============================================================
$ErrorActionPreference = 'Continue'
$logFile = Join-Path $env:TEMP 'taizhang_install_log.txt'
function Log($msg) {
    $line = "[{0}] {1}" -f (Get-Date -Format 'HH:mm:ss'), $msg
    Write-Host $line
    Add-Content -Path $logFile -Value $line -Encoding UTF8
}

# ---- 0. 管理员权限自动提升 ----
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host '需要管理员权限，正在请求提升...'
    $ps = "-NoProfile -ExecutionPolicy Bypass -File `"$($MyInvocation.MyCommand.Path)`""
    Start-Process powershell -Verb RunAs -ArgumentList $ps
    exit 0
}

Log '======== 台账管理系统 V1 自动安装开始 ========'

# ---- 1. 定位迁移包 zip ----
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$Zip = $null
if (Test-Path (Join-Path $ScriptDir '台账管理系统_迁移包.zip')) { $Zip = Join-Path $ScriptDir '台账管理系统_迁移包.zip' }
else {
    $z = Get-ChildItem $ScriptDir -Filter '*.zip' -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($z) { $Zip = $z.FullName }
}
if (-not $Zip) {
    Log '[错误] 未找到迁移包 .zip，请将 zip 与本脚本放在同一目录'
    Read-Host '按回车退出'; exit 1
}
Log ('[1/7] 迁移包: ' + $Zip)

# ---- 2. 目标路径: 默认 D 盘, 无 D 盘则 C 盘 ----
$Target = 'D:\台账管理系统V1'
if (-not (Test-Path 'D:\')) { $Target = 'C:\台账管理系统V1' }
Log ('[2/7] 安装路径: ' + $Target)

# ---- 3. 解压（已存在则先备份旧版再覆盖） ----
if (Test-Path $Target) {
    $oldBak = $Target + '_旧版备份_' + (Get-Date -Format 'yyyyMMdd_HHmmss')
    Log ('检测到旧安装，备份为: ' + $oldBak)
    Rename-Item $Target $oldBak -ErrorAction SilentlyContinue
}
try {
    Expand-Archive -Path $Zip -DestinationPath $Target -Force
    Log '[3/7] 解压完成'
} catch {
    Log ('[错误] 解压失败: ' + $_.Exception.Message)
    Read-Host '按回车退出'; exit 1
}

# ---- 4. 检测/安装 Python 并安装依赖 ----
$Py = $null
$cands = @("$env:LOCALAPPDATA\Programs\Python\Python312\python.exe", "$env:LOCALAPPDATA\Programs\Python\Python311\python.exe", "$env:LOCALAPPDATA\Programs\Python\Python310\python.exe", 'C:\Python312\python.exe', 'C:\Python311\python.exe')
foreach ($c in $cands) { if (Test-Path $c) { $Py = $c; break } }
if (-not $Py) {
    $cmd = Get-Command python -ErrorAction SilentlyContinue
    if ($cmd) { $Py = $cmd.Source }
}
if (-not $Py) {
    Log '未检测到 Python，尝试通过 winget 自动安装 Python 3.12...'
    $wg = Get-Command winget -ErrorAction SilentlyContinue
    if ($wg) {
        & winget install --id Python.Python.3.12 -e --silent --accept-package-agreements --accept-source-agreements
    } else {
        Log 'winget 不可用，下载官方安装包...'
        $dl = Join-Path $env:TEMP 'python-3.12.8-amd64.exe'
        Invoke-WebRequest -Uri 'https://www.python.org/ftp/python/3.12.8/python-3.12.8-amd64.exe' -OutFile $dl -UseBasicParsing
        Start-Process -FilePath $dl -ArgumentList '/quiet InstallAllUsers=0 PrependPath=1 Include_pip=1 Include_test=0' -Wait
    }
    foreach ($c in @("$env:LOCALAPPDATA\Programs\Python\Python312\python.exe", "$env:LOCALAPPDATA\Programs\Python\Python311\python.exe")) {
        if (Test-Path $c) { $Py = $c; break }
    }
    if (-not $Py) { $Py = 'python' }
$PyW = $Py -replace 'python.exe$','pythonw.exe'
if (-not (Test-Path $PyW)) { $PyW = 'pythonw' }
}
Log ('[4/7] Python: ' + $Py)
$env:PYTHONUTF8 = '1'
& $Py -m pip install -r (Join-Path $Target 'requirements.txt') --disable-pip-version-check -q -i https://pypi.tuna.tsinghua.edu.cn/simple
if ($LASTEXITCODE -ne 0) {
    Log '清华镜像失败，尝试官方源...'
    & $Py -m pip install -r (Join-Path $Target 'requirements.txt') --disable-pip-version-check -q
}
if ($LASTEXITCODE -ne 0) {
    Log '网络源均失败，尝试离线包安装(无需联网)...'
    & $Py -m pip install --no-index --find-links (Join-Path $Target 'wheels') -r (Join-Path $Target 'requirements.txt') -q
}
if ($LASTEXITCODE -ne 0) {
    Log '[错误] 依赖安装失败(含离线包)，请检查: python -m pip --version'
    Read-Host '按回车退出'; exit 1
}
& $Py -c "import flask, openpyxl"
if ($LASTEXITCODE -ne 0) { Log '[错误] 依赖验证失败'; Read-Host '按回车退出'; exit 1 }
Log '      依赖安装完成并验证 (Flask / openpyxl)'

# ---- 5. 生成开机自启 (注册表 Run + start_server.vbs) ----
$vbs = Join-Path $Target 'start_server.vbs'
$vbsContent = "Set ws = CreateObject(`"Wscript.Shell`")`r`nws.CurrentDirectory = `"$Target`"`r`nws.Run `"`"$PyW`" server\app.py`", 0, False`r`n"
# VBS 以 ANSI(GBK) 写入，避免中文乱码
[IO.File]::WriteAllText($vbs, $vbsContent, [Text.Encoding]::GetEncoding(936))
$runKey = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Run'
Set-ItemProperty -Path $runKey -Name 'TaiZhangSystem' -Value ('wscript.exe "' + $vbs + '"') -Force
Log '[5/7] 开机自启已设置 (注册表 TaiZhangSystem)'

# ---- 6. 防火墙放行 TCP 8090 ----
& netsh advfirewall firewall delete rule name="TaiZhangSystem8090" 2>$null
& netsh advfirewall firewall add rule name="TaiZhangSystem8090" dir=in action=allow protocol=TCP localport=8090
Log '[6/7] 防火墙已放行 TCP 8090'

# ---- 7. 启动服务并探活 ----
Log '[7/7] 启动服务...'
Set-Location $Target
Start-Process -FilePath $PyW -ArgumentList 'server\app.py' -WorkingDirectory $Target -WindowStyle Hidden
Start-Sleep -Seconds 8
$ok = $false
try {
    $r = Test-NetConnection -ComputerName 127.0.0.1 -Port 8090 -WarningAction SilentlyContinue
    $ok = $r.TcpTestSucceeded
} catch { $ok = $false }
if ($ok) {
    Log '============================================'
    Log '  安装成功！系统已启动'
    Log '  本机访问: http://127.0.0.1:8090'
    Log '  局域网访问: http://本机IP:8090  (账号 admin / admin123)'
    Log '============================================'
} else {
    Log '[警告] 服务未响应，请手动启动: 到安装目录运行 python server\app.py'
}
Log '安装日志已保存到: ' + $logFile
Read-Host '按回车退出'
