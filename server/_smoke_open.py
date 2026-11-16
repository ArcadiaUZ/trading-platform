
import asyncio, json, sys, time
sys.path.insert(0, r"D:\Project\AI\tvclone\server")
import providers_open as po

async def main():
    for name, prov in po.OPEN.providers.items():
        for sym in ("XAUUSD", "GBPUSD"):
            for tf in ("M1", "D1"):
                t0 = time.time()
                try:
                    res = await prov.bars(sym, tf, 600)
                except Exception as exc:
                    print(f"{name:8} {sym:6} {tf:3} BARS EXC {type(exc).__name__}: {exc}")
                    continue
                if res:
                    print(f"{name:8} {sym:6} {tf:3} BARS ok n={len(res['bars'])} last={res['bars'][-1]} delay={res['delay_s']}s ms={round((time.time()-t0)*1000)}")
                else:
                    print(f"{name:8} {sym:6} {tf:3} BARS None ms={round((time.time()-t0)*1000)}")
        t0 = time.time()
        q = await prov.quote("XAUUSD")
        print(f"{name:8} XAUUSD QUOTE {q} ms={round((time.time()-t0)*1000)}")
    print("--- manager ---")
    print(json.dumps(await po.OPEN.bars("XAUUSD", "M1", 600) and {"ok": True}, default=str))
    res = await po.OPEN.bars("XAUUSD", "M1", 600)
    print("manager bars:", res and (len(res["bars"]), res["provider"], res["bars"][-1], res["delay_s"]))
    q = await po.OPEN.quote("XAUUSD")
    print("manager quote:", q)
    print(json.dumps(po.OPEN.status_json(), indent=1))

asyncio.run(main())
