# XAUView ni Windows Task Scheduler ga qo'shish (login da avtomatik ishga tushish).
# ADMIN huquqi kerak emas (joriy foydalanuvchi uchun).
# O'chirish: schtasks /Delete /TN "XAUView Start" /F
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$script = Join-Path $here "start-all.ps1"
$tr = "powershell.exe -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File "" + $script + """
schtasks /Create /SC ONLOGON /TN "XAUView Start" /TR $tr /F
schtasks /Query /TN "XAUView Start" /FO LIST
