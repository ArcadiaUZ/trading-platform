# APK build (Gradle'siz, minimal)

APK **Android Studio va Gradle'siz** yig'iladi - faqat SDK `build-tools` + JDK 17.

## Kerakli to'plam (~440 MB)

| Nima | Joy | Hajm |
|---|---|---|
| JDK 17 (Temurin) | `D:\Project\AI\Trading-with-ai\jdk-17.0.21+9` | ~190 MB |
| cmdline-tools | `D:\Android\cmdline-tools\latest` | 136 MB |
| platforms;android-35 | `D:\Android\platforms\android-35` | ~60 MB |
| build-tools;35.0.0 | `D:\Android\build-tools\35.0.0` | ~56 MB |
| platform-tools (adb) | `D:\Android\platform-tools` | ~10 MB |

## Bir marta o'rnatish

```powershell
$env:JAVA_HOME='D:\Project\AI\Trading-with-ai\jdk-17.0.21+9'
$env:PATH="$env:JAVA_HOME\bin;$env:PATH"
& D:\Android\cmdline-tools\latest\bin\sdkmanager.bat --sdk_root=D:\Android --licenses
& D:\Android\cmdline-tools\latest\bin\sdkmanager.bat --sdk_root=D:\Android 'platform-tools' 'platforms;android-35' 'build-tools;35.0.0'
```

## Build

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File D:\Project\AI\tvclone\apk-build\build.ps1
```

Natija: `D:\Project\AI\tvclone\XAUView.apk` (~3 MB).

Quvur: `aapt2 compile` -> `aapt2 link` (-A assets) -> `javac` -> `d8` -> `jar uf classes.dex` -> `zipalign` -> `apksigner`.

## Telefonga o'rnatish

1. `adb install -r D:\Project\AI\tvclone\XAUView.apk`
2. yoki APK'ni telefonga ko'chirib ochish ("Noma'lum manbalar"ga ruxsat).
3. Ilova birinchi ochilishda **server manzili**ni so'raydi:
   - `http://10.149.101.17:8765` (bir Wi-Fi, internet kerak emas)
   - `offline` -> ilova ichidagi `assets/index.html` (snapshot, feed yo'q)
4. Manzilni keyin o'zgartirish: **Menyu -> Malumot manbasi -> APK server manzili**.

## Texnik tanlovlar

- `compileSdk 35`, `targetSdk 34` - Android 15'da majburiy edge-to-edge bezovta qilmasligi uchun.
- `minSdk 26` (Android 8+) - WebView + `env(safe-area-inset)` qo'llab-quvvatlanadi.
- `usesCleartextTraffic=true` - LAN `http://` uchun (https tunnel ham ishlaydi).
- WebView: JS, DOM storage, mixed content, `WebChromeClient.onPermissionRequest` (notification),
  `And` JS bridge (`getServer/setServer/chooseServer/platform`) - `_m10_open.js` orqali UI'ga bog'langan.
- TWA/Bubblewrap **ataylab ishlatilmadi**: u bitta HTTPS originga qulflanadi, tunnel URL o'zgarsa APK buziladi.

## Imzo

- `apk-build/xauview.keystore` birinchi build'da avtomatik yaratiladi (alias `xauview`, parol `xauview123`).
- Bu **debug/dev imzo** - Play Store uchun alohida keystore kerak (va targetSdk 35).
