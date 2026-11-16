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

## v1.1 - standart manba = bulut server (setup yo'q)

Maqsad: APK o'rnatildi -> ochildi -> darhol jonli XAUUSD. Hech qanday server manzili so'ralmaydi.

O'zgarishlar:

1. `mobile/src/_m4_ui.js` -> `feedBase()` oxirida `return DEFAULT_FEED;`
   `var DEFAULT_FEED = 'wss://xauview.onrender.com';` (faqat `file://`/APK uchun;
   brauzerda avvalgidek `location.host`).
2. `MainActivity` -> `DEFAULT_URL = "wss://xauview.onrender.com"`; `onCreate`da dialog yo'q,
   **har doim** `file:///android_asset/index.html` yuklanadi (tez, internetsiz ham chart chiziladi).
3. `And.chooseServer()` / `setServer()` -> sahifani almashtirmaydi, `localStorage['xauview.feed']`
   ga yozib `location.reload()` qiladi (ilova local qoladi, faqat ma'lumot manbai o'zgaradi).
   "Standart" tugmasi -> `removeItem` (yana bulutga qaytadi).
4. `versionCode 2`, `versionName 1.1`.

Tekshiruv (`mobile/_t_apk_default.js`, Chrome `file://`): `feedBase() = wss://xauview.onrender.com`,
600 bar, chip `YAHOO`, badge `LIVE`, narx jonli, **0 console error** -> `shots/r21-apk-default.png`.

```
node mobile/src/assemble.js
powershell -NoProfile -ExecutionPolicy Bypass -File apk-build\build.ps1
```

Natija: `D:\Project\AI\tvclone\XAUView.apk` - 483 879 B, sha256 `b0c6ec08...`, imzo o'sha keystore.
