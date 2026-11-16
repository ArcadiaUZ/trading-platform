# XAUView: feed server + HTTPS tunnel ni bitta buyruq bilan ishga tushirish (Windows PowerShell 5)
# Ishlatish: powershell -NoProfile -ExecutionPolicy Bypass -File D:\Project\AI\tvclone\server\start-all.ps1
$ErrorActionPreference = "Continue"
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$proj = Split-Path -Parent $here
$py = "D:\Project\AI\Trading-with-ai\.venv\Scripts\python.exe"
$logDir = Join-Path $here "logs"
New-Item -ItemType Directory -Force -Path $logDir | Out-Null

function Test-Port([int]$Port) {
  try {
    $c = New-Object System.Net.Sockets.TcpClient
    $ar = $c.BeginConnect("127.0.0.1", $Port, $null, $null)
    $ok = $ar.AsyncWaitHandle.WaitOne(700)
    if ($ok -and $c.Connected) { $c.Close(); return $true }
    $c.Close(); return $false
  } catch { return $false }
}

Write-Output "[1/3] feed server (8765) ..."
if (Test-Port 8765) {
  Write-Output "  allaqachon ishlayapti"
} else {
  Start-Process -FilePath $py -ArgumentList "-m","uvicorn","app:app","--host","0.0.0.0","--port","8765" -WorkingDirectory $here -WindowStyle Hidden -RedirectStandardOutput (Join-Path $logDir "server.out.log") -RedirectStandardError (Join-Path $logDir "server.err.log")
  for ($i = 0; $i -lt 20; $i++) { Start-Sleep -Milliseconds 500; if (Test-Port 8765) { break } }
  if (Test-Port 8765) { Write-Output "  ishga tushdi" } else { Write-Output "  XATO: port ochilmadi (log: logs\server.err.log)" }
}

Write-Output "[2/3] HTTPS tunnel (cloudflared) ..."
$cf = Join-Path $proj "work\cloudflared.exe"
$cfLog = Join-Path $proj "work\cloudflared.log"
$urlFile = Join-Path $here "tunnel-url.txt"
$proc = Get-Process cloudflared -ErrorAction SilentlyContinue
if ($proc) {
  Write-Output "  allaqachon ishlayapti (PID $($proc.Id))"
} elseif (Test-Path $cf) {
  Start-Process -FilePath $cf -ArgumentList "tunnel","--url","http://127.0.0.1:8765","--no-autoupdate","--logfile","$cfLog","--loglevel","info" -WindowStyle Hidden
  Start-Sleep -Seconds 10
} else {
  Write-Output "  cloudflared topilmadi: $cf"
}
Start-Sleep -Seconds 2
$url = $null
if (Test-Path $cfLog) {
  $txt = Get-Content $cfLog -Raw
  $m = [regex]::Matches($txt, "https://[a-z0-9-]+\.trycloudflare\.com")
  if ($m.Count -gt 0) { $url = $m[$m.Count - 1].Value }
}
if ($url) { Set-Content -Path $urlFile -Value $url -NoNewline; Write-Output "  URL: $url" } else { Write-Output "  URL topilmadi (log: $cfLog)" }

Write-Output "[3/3] health ..."
try {
  $h = Invoke-RestMethod -Uri "http://127.0.0.1:8765/api/health" -TimeoutSec 8
  Write-Output ("  lokal: ok=" + $h.ok + " mt5=" + $h.mt5 + " symbols=" + ($h.symbols -join ","))
} catch { Write-Output ("  lokal health XATO: " + $_.Exception.Message) }
if ($url) {
  try {
    $h2 = Invoke-RestMethod -Uri ($url + "/api/health") -TimeoutSec 20
    Write-Output ("  tunnel: ok=" + $h2.ok + " (https tayyor: " + $url + ")")
  } catch { Write-Output ("  tunnel health XATO: " + $_.Exception.Message) }
}
Write-Output ""
Write-Output "Tayyor. Telefonda: $url yoki http://<LAN-IP>:8765"
