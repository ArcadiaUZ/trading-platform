# cloudflared quick tunnel kuzatuvchisi: o'lsa qayta ishga tushiradi, URL ni tunnel-url.txt ga yozadi.
# Ishlatish: powershell -NoProfile -ExecutionPolicy Bypass -File D:\Project\AI\tvclone\server\tunnel-watch.ps1
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$proj = Split-Path -Parent $here
$cf = Join-Path $proj "work\cloudflared.exe"
$cfLog = Join-Path $proj "work\cloudflared.log"
$urlFile = Join-Path $here "tunnel-url.txt"
Write-Output "tunnel-watch boshlandi. To'xtatish: Ctrl+C"
while ($true) {
  $p = Get-Process cloudflared -ErrorAction SilentlyContinue
  if (-not $p) {
    if (Test-Path $cf) {
      Start-Process -FilePath $cf -ArgumentList "tunnel","--url","http://127.0.0.1:8765","--no-autoupdate","--logfile","$cfLog","--loglevel","info" -WindowStyle Hidden
      Write-Output ("[" + (Get-Date -Format "HH:mm:ss") + "] tunnel qayta ishga tushirildi")
      Start-Sleep -Seconds 12
      $txt = Get-Content $cfLog -Raw
      $m = [regex]::Matches($txt, "https://[a-z0-9-]+\.trycloudflare\.com")
      if ($m.Count -gt 0) {
        $url = $m[$m.Count - 1].Value
        Set-Content -Path $urlFile -Value $url -NoNewline
        Write-Output ("[" + (Get-Date -Format "HH:mm:ss") + "] yangi URL: " + $url)
      }
    } else { Write-Output "cloudflared.exe topilmadi: $cf" }
  }
  Start-Sleep -Seconds 20
}
