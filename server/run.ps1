<#
    XAUUSD/GBPUSD live feed serverni ishga tushirish.
    Foydalanish:  pwsh -File run.ps1
    Port: 8765 (FEED_PORT env bilan o'zgartiriladi)
#>
$ErrorActionPreference = "Stop"
Set-Location -Path $PSScriptRoot

# venv python (yoki PYTHON_EXE env, yoki PATH'dagi python)
$Python = $env:PYTHON_EXE
if (-not $Python) {
    $Python = "D:\Project\AI\Trading-with-ai\.venv\Scripts\python.exe"
}
if (-not (Test-Path $Python)) {
    Write-Warning "venv python topilmadi: $Python - PATH'dagi python ishlatiladi"
    $Python = "python"
}

$Port = $env:FEED_PORT
if (-not $Port) { $Port = "8765" }

Write-Host "Python: $Python"
Write-Host "Port:   $Port"

& $Python -m uvicorn app:app --host 0.0.0.0 --port $Port
