# XAUView — RUNBOOK (ishga tushirish / to'xtatish / diagnostika)

Loyiha: `D:\Project\AI\tvclone`. Bu hujjat — "nima qilib ishga tushiriladi" bo'yicha yagona yo'l xaritasi.

## 1. Tez start (bitta buyruq)

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File D:\Project\AI\tvclone\server\start-all.ps1
```

Bu skript:
1. **Feed server** (port 8765) allaqachon ishlayotganini tekshiradi, bo'lmasa ishga tushiradi;
2. **cloudflared** HTTPS quick tunnel ni tekshiradi/ishga tushiradi;
3. Tunnel URL ni `server/tunnel-url.txt` ga yozadi;
4. Lokal va tunnel `/api/health` ni tekshirib natijani chiqaradi.

Misol chiqish:
```
[1/3] feed server (8765) ... allaqachon ishlayapti
[2/3] HTTPS tunnel (cloudflared) ... allaqachon ishlayapti (PID 12636)
  URL: https://xxxx.trycloudflare.com
[3/3] health ... lokal: ok=True mt5=True symbols=XAUUSD,GBPUSD
  tunnel: ok=True
```

## 2. Telefonda ochish

| Rejim | Manzil | Notification |
|---|---|---|
| **HTTPS (tavsiya)** | `server/tunnel-url.txt` dagi URL (masalan `https://xxxx.trycloudflare.com`) | ✅ system notification ishlaydi |
| LAN | `http://<PC-LAN-IP>:8765` (hozir `http://10.149.101.17:8765`) | ❌ faqat sahifa ichidagi toast |

Telefonda: Chrome → URL → `LIVE` badge kutiladi → menyu (⋮) → **Add to Home screen** → ikonkadan ochish → **Alertlar → Bildirishnoma ruxsati → Allow**.

## 3. To'xtatish

```powershell
# server
Get-Process python | Where-Object { $_.Path -like "*Trading-with-ai*" } | Stop-Process
# tunnel
Get-Process cloudflared -ErrorAction SilentlyContinue | Stop-Process
```

## 4. Avtomatik ishga tushish (login da)

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File D:\Project\AI\tvclone\server\install-autostart.ps1
# o'chirish:
schtasks /Delete /TN "XAUView Start" /F
```

Quick tunnel URL **vaqtinchalik** — har qayta ishga tushganda o'zgaradi. Barqaror URL kerak bo'lsa: Cloudflare named tunnel (bepul akkaunt + `cloudflared tunnel login`) yoki ngrok fixed domain.

## 5. Tunnel uzilib qolsa

```powershell
# kuzatuvchi: har 20 s tekshiradi, o'lsa qayta ishga tushiradi va URL ni yangilaydi
powershell -NoProfile -ExecutionPolicy Bypass -File D:\Project\AI\tvclone\server\tunnel-watch.ps1
```

## 6. Diagnostika

| Nima | Buyruq |
|---|---|
| Health | `Invoke-RestMethod http://127.0.0.1:8765/api/health` |
| Server PID | `Get-Content server\PID.txt` yoki `Get-Process python` |
| Server log | `Get-Content server\server.log -Tail 40` |
| Tunnel log | `Get-Content work\cloudflared.log -Tail 20` |
| Joriy tunnel URL | `Get-Content server\tunnel-url.txt` |
| Alertlar | `Invoke-RestMethod http://127.0.0.1:8765/api/alerts` |
| Testlar (15 band) | `D:\Project\AI\Trading-with-ai\.venv\Scripts\python.exe server\test_feed.py --soak 60` |

## 7. Tez-tez uchraydigan muammolar

| Alomat | Sabab / yechim |
|---|---|
| `ok:false`, `mt5:false` | MetaTrader 5 terminali yopilgan yoki login qilinmagan. Terminalni oching (Exness demo 474932446), server o'zi qayta ulanadi (1-30 s backoff). |
| `GET /` 404 | `mobile/index.html` yo'q — `node mobile/src/assemble.js` bilan qayta yig'ing. |
| Telefonda `OFFLINE` | Telefon va PC bir Wi-Fi da emas, yoki Windows Firewall 8765 ni to'sgan: `netsh advfirewall firewall add rule name="XAUView 8765" dir=in action=allow protocol=TCP localport=8765` |
| Notification chiqmaydi | Sahifa `https://` emas (yoki localhost emas). Tunnel URL dan foydalaning va ruxsat bering. |
| App eski ko'rinadi | Service worker kesh: Chrome → DevTools → Application → Service Workers → Unregister (yoki sahifani hard-reload). SW navigation network-first, lekin keshlangan ikonkalar qoladi. |
| Chart `OFFLINE` ga tushib qoladi | Watchdog 25 s da o'zi qayta ulanadi; agar davom etsa server logini ko'ring. |

## 8. Build (kod o'zgargandan keyin)

```powershell
cd D:\Project\AI\tvclone
node mobile/src/assemble.js    # -> mobile/index.html
node demo/src/assemble.js      # -> demo/xauview-demo.html
```

## 9. Fayl xaritasi (asosiy)

| Yo'l | Nima |
|---|---|
| `mobile/index.html` | Mobil app (build natijasi) |
| `mobile/src/*` | Manba qismlar (`_m1_head`, `_p2_ind`, `_m3_chart`, `_m4_ui`, `_m5_feed`, `_m6_pwa`, `_m7_alerts`, `_m8_charttype`) |
| `mobile/sw.js`, `manifest.webmanifest`, `icons/` | PWA qatlami |
| `server/app.py` | FastAPI: candles, alerts (price/zone/sweep/session), WS tick 0.3 s |
| `server/start-all.ps1`, `tunnel-watch.ps1`, `install-autostart.ps1` | Ishga tushirish skriptlari |
| `demo/xauview-demo.html` | Desktop demo (oflayn snapshot) |
| `docs/PROGRESS.md` | To'liq progress / handoff |
| `docs/STATE.json` | Mashina o'qiydigan holat |
| `docs/PWA-HTTPS.md` | PWA + tunnel tafsilotlari |
| `server/API-SAMPLES.md` | Alert API JSON namunalari |
