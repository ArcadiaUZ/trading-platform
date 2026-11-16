# XAUView APK build (Gradle YOQ - faqat SDK build-tools bilan)
param(
  [string]$Sdk = "D:\Android",
  [string]$Jdk = "D:\Project\AI\Trading-with-ai\jdk-17.0.21+9",
  [string]$Project = "D:\Project\AI\tvclone",
  [string]$Out = ""
)
$ErrorActionPreference = "Stop"
$env:JAVA_HOME = $Jdk
$env:PATH = "$Jdk\bin;$env:PATH"

$BT   = Join-Path $Sdk "build-tools\35.0.0"
$PLAT = Join-Path $Sdk "platforms\android-35\android.jar"
$Root = $PSScriptRoot
if ($Out -eq "") { $Out = Join-Path $Project "XAUView.apk" }

if (-not (Test-Path $BT)) { throw "Topilmadi: $BT (sdkmanager: build-tools;35.0.0)" }
if (-not (Test-Path $PLAT)) { throw "Topilmadi: $PLAT (sdkmanager: platforms;android-35)" }

# 0) web assetlar
$assets = Join-Path $Root "assets"
New-Item -ItemType Directory -Force $assets | Out-Null
Copy-Item (Join-Path $Project "mobile\index.html") (Join-Path $assets "index.html") -Force
Write-Host "[0/6] assets/index.html" ((Get-Item (Join-Path $assets "index.html")).Length) "bytes"

$work = Join-Path $Root "work"
Remove-Item -Recurse -Force $work -ErrorAction SilentlyContinue
foreach ($d in @("gen","classes","dex","apk")) { New-Item -ItemType Directory -Force (Join-Path $work $d) | Out-Null }

# 1) res compile
& (Join-Path $BT "aapt2.exe") compile --dir (Join-Path $Root "res") -o (Join-Path $work "apk\res.zip")
if ($LASTEXITCODE -ne 0) { throw "aapt2 compile FAIL" }
Write-Host "[1/6] aapt2 compile OK"

# 2) link -> base apk
$linkArgs = @("link", "-o", (Join-Path $work "apk\base.apk"), "-I", $PLAT, "--manifest", (Join-Path $Root "AndroidManifest.xml"), "-R", (Join-Path $work "apk\res.zip"), "-A", $assets, "--java", (Join-Path $work "gen"), "--min-sdk-version", "26", "--target-sdk-version", "34", "--version-code", "2", "--version-name", "1.1", "--auto-add-overlay")
& (Join-Path $BT "aapt2.exe") @linkArgs
if ($LASTEXITCODE -ne 0) { throw "aapt2 link FAIL" }
Write-Host "[2/6] aapt2 link OK"

# 3) javac
$srcs = @()
$srcs += (Get-ChildItem -Recurse (Join-Path $Root "java") -Filter *.java | ForEach-Object { $_.FullName })
$srcs += (Get-ChildItem -Recurse (Join-Path $work "gen") -Filter *.java | ForEach-Object { $_.FullName })
$jArgs = @("-source", "17", "-target", "17", "-encoding", "UTF-8", "-nowarn", "-classpath", $PLAT, "-d", (Join-Path $work "classes")) + $srcs
& (Join-Path $Jdk "bin\javac.exe") @jArgs
if ($LASTEXITCODE -ne 0) { throw "javac FAIL" }
Write-Host "[3/6] javac OK" $srcs.Count "fayl"

# 4) d8 -> classes.dex
$classes = @(Get-ChildItem -Recurse (Join-Path $work "classes") -Filter *.class | ForEach-Object { $_.FullName })
$d8Args = @("--lib", $PLAT, "--min-api", "26", "--output", (Join-Path $work "dex")) + $classes
& (Join-Path $BT "d8.bat") @d8Args
if ($LASTEXITCODE -ne 0) { throw "d8 FAIL" }
Write-Host "[4/6] d8 OK"

# 5) dex qoshish + align
& (Join-Path $Jdk "bin\jar.exe") uf (Join-Path $work "apk\base.apk") -C (Join-Path $work "dex") classes.dex
if ($LASTEXITCODE -ne 0) { throw "jar merge FAIL" }
& (Join-Path $BT "zipalign.exe") -f 4 (Join-Path $work "apk\base.apk") (Join-Path $work "apk\aligned.apk")
if ($LASTEXITCODE -ne 0) { throw "zipalign FAIL" }
Write-Host "[5/6] dex + zipalign OK"

# 6) imzolash
$ks = Join-Path $Root "xauview.keystore"
if (-not (Test-Path $ks)) {
  $ktArgs = @("-genkeypair", "-keystore", $ks, "-alias", "xauview", "-keyalg", "RSA", "-keysize", "2048", "-validity", "10000", "-storepass", "xauview123", "-keypass", "xauview123", "-dname", "CN=XAUView,O=XAUView,C=UZ")
  & (Join-Path $Jdk "bin\keytool.exe") @ktArgs
  if ($LASTEXITCODE -ne 0) { throw "keytool FAIL" }
  Write-Host "      keystore yaratildi: $ks (parol: xauview123)"
}
$sArgs = @("sign", "--ks", $ks, "--ks-pass", "pass:xauview123", "--key-pass", "pass:xauview123", "--out", $Out, (Join-Path $work "apk\aligned.apk"))
& (Join-Path $BT "apksigner.bat") @sArgs
if ($LASTEXITCODE -ne 0) { throw "apksigner FAIL" }
& (Join-Path $BT "apksigner.bat") verify --print-certs $Out | Select-Object -First 6
Write-Host "[6/6] imzolandi"
$apk = Get-Item $Out
Write-Host ""
Write-Host ("TAYYOR: " + $apk.FullName + "  " + [math]::Round($apk.Length/1MB,2) + " MB")
Write-Host ("Telefonga: adb install -r " + $apk.FullName)
