# XAUView — TV-uslubidagi chart demo (P1)

**Bitta fayl:** `xauview-demo.html` (~1.3 MB). Internet **shart emas** — faylni ikki marta bosib Chrome'da ochas. Hammasi (ma'lumot + indikator + chizma tizimi) shu fayl ichida.

![demo](D:\Project\AI\tvclone\shots\e22-gbp-d1.png)

## Nima bor

| Bo'lim | Tafsilot |
|---|---|
| Assetlar | **OANDA:XAUUSD** va **FXCM:GBPUSD** (yuqori chapdagi nomni bosib almashtirasan) |
| Timeframe | **D1 · H4 · H1 · M15 · M5 · M3 · M1** (yuqoridagi tugmalar yoki 1..7 klavish) |
| Chart | shamlar + volume pane + CVD pane, pan (sudrash), zoom (g'ildirak), crosshair + OHLC, oxirgi narx chizig'i, auto-fit |
| Indikator | **ASIA-FU 3-IN-1**: Asian box + BSL/SSL + range pips (PRIME/TOO WIDE), London/NY killzone fonlari, sweeps (▲▼ SWEEP), sniper FVG, **FU/SFU/AFU zonalari** (joriy TF + ustki H4/H1/M15/M5), CVD proxy + divergensiya ko'rsatkichi, o'ng yuqorida dashboard |
| Chizish | **Trendline · Ray · Horizontal · Vertical · Rectangle · Text · Measure** + magnet (OHLC'ga yopishish), tanlash/ko'chirish, o'chirish, **Undo/Redo**, hindolarni sudrash, o'ng panelda chizmalar ro'yxati (ko'rsatish/yashirish/o'chirish) |
| Saqlash | chizmalar **localStorage**'da (faylni yopsang ham qoladi), oxirgi symbol/TF/tema eslab qolinadi |
| Boshqa | **3 tema** (dark web / light / o'lchangan ilova uslubi), PNG eksport, fullscreen, indikator sozlamalari paneli (checkbox + input) |

## Temalar (yuqori o'ngdagi ☾ tugmasi bilan almashadi)

1. **dark** — TradingView web uslubi: fon #131722, up #089981, down #f23645
2. **light** — oq fon (#ffffff), TV light uslubi
3. **app** — APK'dan **o'lchangan** tokenlar: fon #000000, panel #0F0F0F, up **#22AB94**, down **#F7525F**, matn #DBDBDB, accent #2962FF (manba: docs/DESIGN-TOKENS.md)

## Klavishlar

| Klavish | Amal |
|---|---|
| 1..7 | TF almashtirish (D1→M1) |
| T / R / H / V / B / X / M | trendline / ray / hline / vline / rectangle / text / measure |
| Esc | asbobdan chiqish, tanlovni bekor qilish |
| Delete | tanlangan chizmani o'chirish |
| Ctrl+Z / Ctrl+Y | undo / redo |
| ← → | chartni chapga/o'ngga surish |
| 2 marta bosish (dblclick) | auto-fit |

## Ma'lumot haqida (halol)

- Barlar **MetaTrader 5 demo** hisobidan olingan snapshot (2500 bar M1 ... 500 bar D1, 2 ta asset).
- **OANDA:/FXCM:** — bular TradingView'dagi kabi *feed yorlig'i*. Hozircha OANDA/FXCM API kalitlari ulanmagan; real feed P2 da (API kalit bo'lsa) ulanadi. Hozir narxlar MT5 Exness demo'dan.
- Demo **statik**: yangi bar avtomatik qo'shilmaydi (live — P2).

## Cheklovlar (P1 ataylab shunday)

- Indikator mantig'i Python engine'ga yaqinlashtirilgan, lekin **Pine bilan 100% paritet hali tekshirilmagan** (P3 da paritet test).
- **D1 da Asia moduli o'chirilgan** (kunlik barda Asia sessiyasi ma'nosiz — dashboard "Asia (D1 da yoq)" deb yozadi).
- Fib/Gann/brush guruhlari, alertlar, replay, savdo — keyingi bosqichlar (P4-P6).
- Mobil layout hali yo'q (desktop).

## Build (agar kodni o'zgartirsang)

```
demo/src/_p1_head.html   → HTML + CSS (dizayn tokenlari)
demo/src/_p2_ind.js      → Asia-FU indikatori (Asia sweep / FU zonalar / CVD)
demo/src/_p3_engine.js   → chart engine (masshtab, panes, shamlar, o'qlar, render)
demo/src/_p4_draw.js     → chizma asboblari + interaksiya
demo/src/_p5_ui.js       → UI, legenda, dashboard, panel, init
demo/data.json           → MT5 snapshot (2 asset × 7 TF)
node src/assemble.js     → xauview-demo.html ni qayta yig'adi
```

Skrinshotlar: `D:\Project\AI\tvclone\shots\`

