#!/usr/bin/env python3
"""Diagnose: zeigt nur die STRUKTUR (Schlüssel, Typen, Längen) einiger Garmin-Endpunkte, nie Werte.
Dient dazu, den Fundort der VO2max herauszufinden. Das Protokoll eines öffentlichen Repos ist öffentlich,
darum werden hier bewusst keine Messwerte ausgegeben."""
import os
import sys
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import fetch_garmin as fg  # noqa: E402


def shape(o, depth=0, maxdepth=4):
    pad = "  " * depth
    if isinstance(o, dict):
        for k, v in list(o.items())[:60]:
            t = type(v).__name__
            if isinstance(v, (dict, list)) and depth < maxdepth:
                print(f"{pad}{k}: {t}" + (f"[{len(v)}]" if isinstance(v, list) else ""))
                shape(v, depth + 1, maxdepth)
            else:
                print(f"{pad}{k}: {t}")
    elif isinstance(o, list) and o:
        print(f"{pad}[0]:")
        shape(o[0], depth + 1, maxdepth)


def vo2_keys(o, path=""):
    out = []
    if isinstance(o, dict):
        for k, v in o.items():
            p = f"{path}.{k}" if path else k
            if "vo2" in k.lower() or "maxmet" in k.lower():
                out.append((p, type(v).__name__, v is not None))
            out += vo2_keys(v, p)
    elif isinstance(o, list):
        for v in o[:3]:
            out += vo2_keys(v, path + "[]")
    return out


def main():
    key = os.environ.get("GARMIN_PERSONAL_API_KEY", "").strip()
    if not key:
        print("Kein Key gesetzt")
        return 2
    api = fg.Api(key)
    api.login()
    today = datetime.now(ZoneInfo("Europe/Berlin")).date()
    s, t = (today - timedelta(days=30)).isoformat(), today.isoformat()
    cands = [
        f"/metrics-service/metrics/maxmet/daily/{s}/{t}",
        f"/metrics-service/metrics/maxmet/latest/{t}",
        f"/metrics-service/metrics/trainingstatus/daily/{t}",
        f"/metrics-service/metrics/trainingstatus/aggregated/{t}",
        "/userprofile-service/userprofile/user-settings",
        f"/fitnessage-service/fitnessage/v2/{t}",
        f"/usersummary-service/usersummary/daily?calendarDate={t}",
        f"/usersummary-service/v2/dailysummaries?startDate={s}&endDate={t}",
    ]
    for path in cands:
        print(f"\n=== {path.split('?')[0]}")
        try:
            res = api.get(path)
        except fg.ApiError as e:
            print("FEHLER:", e)
            continue
        if res is None:
            print("leer (204/404)")
            continue
        shape(res)
        for p, typ, nn in vo2_keys(res)[:15]:
            print(f"  >> VO2-Feld: {p} ({typ}, gefüllt={nn})")
    print("\n=== Aktivitäts-Details (VO2-Felder)")
    try:
        res = api.get("/activitylist-service/activities/search/activities",
                      {"start": 0, "limit": 40, "startDate": (today - timedelta(days=200)).isoformat(), "endDate": t})
        acts = res if isinstance(res, list) else []
        picks = {}
        for a in acts:
            tk = (a.get("activityType") or {}).get("typeKey")
            if tk in ("running", "trail_running", "cycling", "treadmill_running") and tk not in picks:
                picks[tk] = a.get("activityId")
        print("Typen mit Auswahl:", sorted(picks))
        for tk, aid in picks.items():
            for suffix in ("", "/details"):
                path = f"/activity-service/activity/{aid}{suffix}"
                try:
                    d = api.get(path)
                except fg.ApiError as e:
                    print(f"  {tk}{suffix}: FEHLER {e}")
                    continue
                if d is None:
                    print(f"  {tk}{suffix}: leer (204/404)")
                    continue
                found = vo2_keys(d)
                print(f"  {tk}{suffix}: {len(found)} VO2-Felder")
                for p, typ, nn in found[:10]:
                    print(f"    >> {p} ({typ}, gefüllt={nn})")
    except fg.ApiError as e:
        print("FEHLER:", e)
    print("\n=== Aktivitäten (VO2-Felder)")
    try:
        res = api.get("/activitylist-service/activities/search/activities",
                      {"start": 0, "limit": 40, "startDate": s, "endDate": t})
        acts = res if isinstance(res, list) else []
        print("Anzahl:", len(acts))
        seen = {}
        for a in acts:
            for p, typ, nn in vo2_keys(a):
                d = seen.setdefault(p, [0, 0, set()])
                d[0] += 1
                d[1] += 1 if nn else 0
                d[2].add((a.get("activityType") or {}).get("typeKey"))
        for p, (n, filled, types) in seen.items():
            print(f"  {p}: in {n} Aktivitäten, gefüllt {filled}, Typen {sorted(x for x in types if x)}")
        if not seen:
            print("  kein VO2-Feld in den Aktivitäten")
    except fg.ApiError as e:
        print("FEHLER:", e)
    return 0


if __name__ == "__main__":
    sys.exit(main())
