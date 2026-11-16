
import asyncio, json, sys
try:
    import websockets
except ImportError:
    print("no websockets"); sys.exit(1)

async def main():
    for sym, tf in [("XAUUSD","M1"), ("GBPUSD","M15")]:
        try:
            async with websockets.connect("ws://127.0.0.1:8765/ws?symbol=%s&tf=%s" % (sym, tf)) as ws:
                snap = json.loads(await asyncio.wait_for(ws.recv(), timeout=6))
                print(sym, tf, "snapshot bars:", len(snap.get("bars", [])), "digits:", snap.get("digits"))
                ticks = 0
                t0 = None
                try:
                    while ticks < 5:
                        m = json.loads(await asyncio.wait_for(ws.recv(), timeout=4))
                        if m.get("type") == "tick":
                            ticks += 1
                            if t0 is None: t0 = m.get("time")
                            last = m
                    print("   ticks:", ticks, "last price:", last.get("price"), "bar:", last.get("bar"))
                except asyncio.TimeoutError:
                    print("   tick timeout, got", ticks)
        except Exception as e:
            print(sym, tf, "WS ERR", repr(e))

asyncio.run(main())
