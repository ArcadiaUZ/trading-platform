# API namunalari (aniq JSON maydonlari)

XAUUSD/GBPUSD feed server. Barcha endpoint va WebSocket xabarlarining aniq shakli.

**Server:** http://127.0.0.1:8765 (LAN: http://10.149.101.17:8765), **PID 12092**

## 1. Umumiy alert maydonlari

Har bir alert POST javobida va GET ro'yxatida quyidagi maydonlarni qaytaradi:

| Maydon | Tur | Izoh |
|---|---|---|
| id | string | 8 belgili qisqa uuid |
| type | string | price / zone / sweep / session |
| symbol | string | XAUUSD / GBPUSD |
| status | string | armed / triggered |
| active | bool | status == "armed" (eski maydon) |
| created | int | epoch sekund (UTC) |
| triggered_at | int | null - oxirgi trigger vaqti |
| triggered | int | null - triggered_at bilan bir xil (eski maydon) |
| price_at | float | null - trigger paytida narx |
| message | string | null - trigger xabari (o'zbekcha) |
| trigger_count | int | trigger soni |
| note | string | foydalanuvchi izohi |
| distance | float | null - joriy narxga masofa (GET/POST javobida) |

Turga xos maydonlar:

* price: dir (above|below), price
* zone: tf, lo, hi, label, repeat, on_cross
* sweep: after_date, range = {high, low, day}, sides = {bsl, ssl}
* session: which (london|ny), target_ts

## 2. POST /api/alerts

### 2.1 price (eski format o'zgarmagan)

```json
{
  "symbol": "XAUUSD",
  "dir": "above",
  "price": 6000,
  "note": "sample price"
}
```

Javob:

```json
{
  "alert": {
    "id": "ca7be705",
    "type": "price",
    "symbol": "XAUUSD",
    "status": "armed",
    "active": true,
    "created": 1794829744,
    "triggered_at": null,
    "triggered": null,
    "price_at": null,
    "message": null,
    "trigger_count": 0,
    "note": "sample price",
    "dir": "above",
    "price": 6000,
    "distance": 2125.76
  }
}
```

### 2.2 zone - narx [lo, hi] ga kirganda

```json
{
  "symbol": "XAUUSD",
  "type": "zone",
  "tf": "M15",
  "lo": 3800,
  "hi": 3801.5,
  "label": "H4 muhim zona",
  "repeat": false,
  "note": "sample zone"
}
```

Javob (narx zonadan tashqarida - status armed):

```json
{
  "alert": {
    "id": "92cbe298",
    "type": "zone",
    "symbol": "XAUUSD",
    "status": "armed",
    "active": true,
    "created": 1794829744,
    "triggered_at": null,
    "triggered": null,
    "price_at": null,
    "message": null,
    "trigger_count": 0,
    "note": "sample zone",
    "tf": "M15",
    "lo": 3800,
    "hi": 3801.5,
    "label": "H4 muhim zona",
    "repeat": false,
    "on_cross": false,
    "distance": 72.74
  }
}
```

### 2.3 zone + on_cross=true - faqat tashqaridan ICHKARIGA kirganda

```json
{
  "symbol": "XAUUSD",
  "type": "zone",
  "tf": "M15",
  "lo": 3800,
  "hi": 3801.5,
  "on_cross": true,
  "label": "cross zona",
  "note": "sample on_cross"
}
```

Javob (ichkarida bo'lsa ham armed qoladi):

```json
{
  "alert": {
    "id": "b360a637",
    "type": "zone",
    "symbol": "XAUUSD",
    "status": "armed",
    "active": true,
    "created": 1794829744,
    "triggered_at": null,
    "triggered": null,
    "price_at": null,
    "message": null,
    "trigger_count": 0,
    "note": "sample on_cross",
    "tf": "M15",
    "lo": 3800,
    "hi": 3801.5,
    "label": "cross zona",
    "repeat": false,
    "on_cross": true,
    "distance": 72.74
  }
}
```

### 2.4 sweep - Asia HIGH/LOW sweep (range POST javobida darhol)

```json
{
  "symbol": "XAUUSD",
  "type": "sweep",
  "after_date": "2026-11-13",
  "note": "sample sweep"
}
```

Javob (range va sides darhol to'ldiriladi):

```json
{
  "alert": {
    "id": "d3267116",
    "type": "sweep",
    "symbol": "XAUUSD",
    "status": "armed",
    "active": true,
    "created": 1794829744,
    "triggered_at": null,
    "triggered": null,
    "price_at": null,
    "message": null,
    "trigger_count": 0,
    "note": "sample sweep",
    "after_date": "2026-11-13",
    "range": {
      "high": 3923.191,
      "low": 3878.852,
      "day": "2026-11-13"
    },
    "sides": {
      "bsl": false,
      "ssl": false
    },
    "distance": 4.612
  }
}
```

### 2.5 session - killzone eslatmasi

```json
{
  "symbol": "GBPUSD",
  "type": "session",
  "which": "london",
  "note": "sample session"
}
```

Javob (target_ts - keyingi eslatma vaqti; London 11:30, NY 16:30 UTC+5):

```json
{
  "alert": {
    "id": "faaf03f0",
    "type": "session",
    "symbol": "GBPUSD",
    "status": "armed",
    "active": true,
    "created": 1794829744,
    "triggered_at": null,
    "triggered": null,
    "price_at": null,
    "message": null,
    "trigger_count": 0,
    "note": "sample session",
    "which": "london",
    "target_ts": 1794897000,
    "distance": null
  }
}
```

## 3. GET /api/alerts

```json
{
  "alerts": [
    {
      "id": "ca7be705",
      "type": "price",
      "symbol": "XAUUSD",
      "status": "armed",
      "active": true,
      "created": 1794829744,
      "triggered_at": null,
      "triggered": null,
      "price_at": null,
      "message": null,
      "trigger_count": 0,
      "note": "sample price",
      "dir": "above",
      "price": 6000,
      "distance": 2125.998
    },
    {
      "id": "92cbe298",
      "type": "zone",
      "symbol": "XAUUSD",
      "status": "armed",
      "active": true,
      "created": 1794829744,
      "triggered_at": null,
      "triggered": null,
      "price_at": null,
      "message": null,
      "trigger_count": 0,
      "note": "sample zone",
      "tf": "M15",
      "lo": 3800,
      "hi": 3801.5,
      "label": "H4 muhim zona",
      "repeat": false,
      "on_cross": false,
      "distance": 72.502
    },
    {
      "id": "b360a637",
      "type": "zone",
      "symbol": "XAUUSD",
      "status": "armed",
      "active": true,
      "created": 1794829744,
      "triggered_at": null,
      "triggered": null,
      "price_at": null,
      "message": null,
      "trigger_count": 0,
      "note": "sample on_cross",
      "tf": "M15",
      "lo": 3800,
      "hi": 3801.5,
      "label": "cross zona",
      "repeat": false,
      "on_cross": true,
      "distance": 72.502
    },
    {
      "id": "d3267116",
      "type": "sweep",
      "symbol": "XAUUSD",
      "status": "armed",
      "active": true,
      "created": 1794829744,
      "triggered_at": null,
      "triggered": null,
      "price_at": null,
      "message": null,
      "trigger_count": 0,
      "note": "sample sweep",
      "after_date": "2026-11-13",
      "range": {
        "high": 3923.191,
        "low": 3878.852,
        "day": "2026-11-13"
      },
      "sides": {
        "bsl": false,
        "ssl": false
      },
      "distance": 4.85
    },
    {
      "id": "faaf03f0",
      "type": "session",
      "symbol": "GBPUSD",
      "status": "armed",
      "active": true,
      "created": 1794829744,
      "triggered_at": null,
      "triggered": null,
      "price_at": null,
      "message": null,
      "trigger_count": 0,
      "note": "sample session",
      "which": "london",
      "target_ts": 1794897000,
      "distance": null
    }
  ]
}
```

## 4. DELETE

DELETE /api/alerts - hammasini o'chirish:

```json
{
  "deleted": true,
  "count": 5
}
```

DELETE /api/alerts/{id} - bittasini o'chirish:

```json
{
  "deleted": true
}
```

## 5. WebSocket alert xabari (type: "alert")

Tashqi maydonlar (mobil ilova uchun) + to'liq alert obyekti birga yuboriladi.

Zone trigger misoli:

```json
{
  "type": "alert",
  "id": "3ed0a1e3",
  "symbol": "XAUUSD",
  "message": "XAUUSD WS sample zonasiga kirdi (3873.502-3874.502): 3874.002",
  "price": 3874.002,
  "ts": 1794829745,
  "alert": {
    "id": "3ed0a1e3",
    "type": "zone",
    "symbol": "XAUUSD",
    "status": "triggered",
    "active": false,
    "created": 1794829745,
    "triggered_at": 1794829745,
    "triggered": 1794829745,
    "price_at": 3874.002,
    "message": "XAUUSD WS sample zonasiga kirdi (3873.502-3874.502): 3874.002",
    "trigger_count": 1,
    "note": "sample ws",
    "tf": "M15",
    "lo": 3873.502,
    "hi": 3874.502,
    "label": "WS sample",
    "repeat": false,
    "on_cross": false,
    "distance": 0
  }
}
```

Price trigger misoli:

```json
{
  "type": "alert",
  "id": "c4aa3657",
  "symbol": "GBPUSD",
  "message": "GBPUSD 1.31826 dan yuqoriga o'tdi: 1.31876",
  "price": 1.31876,
  "ts": 1794829745,
  "alert": {
    "id": "c4aa3657",
    "type": "price",
    "symbol": "GBPUSD",
    "status": "triggered",
    "active": false,
    "created": 1794829745,
    "triggered_at": 1794829745,
    "triggered": 1794829745,
    "price_at": 1.31876,
    "message": "GBPUSD 1.31826 dan yuqoriga o'tdi: 1.31876",
    "trigger_count": 1,
    "note": "sample ws price",
    "dir": "above",
    "price": 1.31826,
    "distance": 0.0005
  }
}
```

## 6. Xatti-harakat qisqacha

* price: narx dir bo'yicha chegaradan o'tganda bir marta trigger.
* zone, on_cross=false (default): narx zona ichida bo'lsa POST'dan keyin ~50-150 ms da trigger.
* zone, on_cross=true: faqat tashqaridan ichkariga kirganda trigger; ichkarida bo'lsa armed qoladi.
* zone + repeat=true: narx zonadan chiqsa yana armed, qayta kirganda yana trigger (trigger_count oshadi).
* sweep: Asia 05:00-11:00 UTC+5 diapazoni M15'dan hisoblanadi; M1 bar wick bilan tashqariga
  chiqib ichkariga close qilsa trigger; har tomon (BSL/SSL) kuniga bir marta; POST javobida range/sides tayyor.
* session: London 11:30, NY 16:30 (UTC+5); keyingi ochilishda bir marta eslatma.
* Trigger xabari WS orqali BARCHA klientlarga ketadi; message har doim o'zbekcha.

Bu fayl jonli serverdan olingan namunalar asosida yozildi: 2026-11-16 16:46:11 da ishga tushgan server (PID 12092).
