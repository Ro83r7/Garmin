#!/usr/bin/env python3
"""Holt Daten aus der Garmin Personal API und hängt sie an data/*.json an.

Nur Standardbibliothek. Upsert nach Datum (idempotent): Erstlauf ab historie_ab,
danach werden die letzten 14 Tage neu geholt. Der API-Key kommt ausschließlich aus
der Umgebungsvariable GARMIN_PERSONAL_API_KEY und wird nie ausgegeben.
"""
import argparse
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
BASE = "https://personal.connectapi.garmin.com"
TOKEN_PATH = "/personalapitoken-service/personal-api/personal-api-key/token"
RECENT_DAYS = 14
CHUNK = 28


class ApiError(Exception):
    pass


def warn(msg):
    print(f"::warning::{msg}", flush=True)


def load(name, default):
    p = DATA / name
    return json.loads(p.read_text(encoding="utf-8")) if p.exists() else default


def save(name, obj):
    DATA.mkdir(exist_ok=True)
    (DATA / name).write_text(
        json.dumps(obj, indent=1, sort_keys=True, ensure_ascii=False) + "\n", encoding="utf-8")


def dig(obj, *path):
    for k in path:
        if not isinstance(obj, dict):
            return None
        obj = obj.get(k)
    return obj


def num(v):
    """Zahl aus Wert oder {"value": Wert}; sonst None. Nie 0 als Ersatz."""
    if isinstance(v, dict):
        v = v.get("value")
    if isinstance(v, bool) or v is None:
        return None
    return v if isinstance(v, (int, float)) else None


def chunks(start, end, size=CHUNK):
    s = start
    while s <= end:
        e = min(s + timedelta(days=size - 1), end)
        yield s, e
        s = e + timedelta(days=1)


class Api:
    def __init__(self, key):
        self.key = key
        self.token = None

    def login(self):
        req = urllib.request.Request(
            BASE + TOKEN_PATH, data=b"", method="POST",
            headers={"Authorization": f"ApiKey {self.key}", "Accept": "*/*"})
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                tok = r.read().decode().strip().strip('"')
        except urllib.error.HTTPError as e:
            raise ApiError(f"Token-Abruf fehlgeschlagen (HTTP {e.code})") from None
        except urllib.error.URLError as e:
            raise ApiError(f"Token-Abruf fehlgeschlagen ({e.reason})") from None
        if not tok:
            raise ApiError("Token-Antwort war leer")
        self.token = tok

    def get(self, path, params=None):
        url = BASE + path + ("?" + urllib.parse.urlencode(params) if params else "")
        relogged = False
        for attempt in range(4):
            req = urllib.request.Request(url, headers={
                "Authorization": f"Bearer {self.token}", "Accept": "application/json"})
            try:
                with urllib.request.urlopen(req, timeout=60) as r:
                    body = r.read().decode("utf-8")
                return json.loads(body) if body.strip() else None
            except urllib.error.HTTPError as e:
                if e.code == 401 and not relogged:
                    relogged = True
                    self.login()
                    continue
                if e.code in (429, 500, 502, 503, 504) and attempt < 3:
                    time.sleep(2 ** (attempt + 1))
                    continue
                if e.code in (204, 404):
                    return None
                raise ApiError(f"HTTP {e.code} bei {path}") from None
            except (urllib.error.URLError, TimeoutError) as e:
                if attempt < 3:
                    time.sleep(2 ** (attempt + 1))
                    continue
                raise ApiError(f"Netzwerkfehler bei {path}: {e}") from None
        raise ApiError(f"Abruf erschöpft: {path}")


# ---- Abruf je Datenart ------------------------------------------------------

def fetch_daily(api, start, end):
    out = {}
    for s, e in chunks(start, end):
        res = api.get("/usersummary-service/v2/dailysummaries",
                      {"startDate": s.isoformat(), "endDate": e.isoformat()})
        for it in (res or {}).get("data", []) or []:
            d = it.get("calendarDate")
            if not d:
                continue
            rhr = num(dig(it, "heartRate", "restingValue"))
            steps = num(dig(it, "movement", "steps", "value"))
            stress = num(dig(it, "stress", "avgLevel"))
            if stress is not None and stress < 0:
                stress = None
            # Uhr nicht getragen: 0 Schritte ohne Ruhepuls sind eine Lücke, kein Messwert.
            if steps == 0 and rhr is None:
                steps = None
            out[d] = {
                "rhr": rhr, "steps": steps, "stress": stress,
                "im_mod": num(dig(it, "intensityMinutes", "moderate")),
                "im_vig": num(dig(it, "intensityMinutes", "vigorous")),
            }
    return out


def fetch_steps_fallback(api, start, end):
    out = {}
    for s, e in chunks(start, end):
        res = api.get(f"/usersummary-service/stats/steps/daily/{s.isoformat()}/{e.isoformat()}")
        items = res if isinstance(res, list) else (res or {}).get("data", [])
        for it in items or []:
            d = it.get("calendarDate")
            v = num(it.get("totalSteps"))
            if d and v:
                out[d] = v
    return out


def ms_local(ms):
    if not isinstance(ms, (int, float)):
        return None
    # Orts-Wanduhrzeit als Millisekunden-Epoch -> als UTC formatieren
    return datetime.fromtimestamp(ms / 1000, tz=timezone.utc).strftime("%Y-%m-%dT%H:%M")


def fetch_sleep(api, start, end):
    out = {}
    for s, e in chunks(start, end):
        res = api.get("/sleep-service/sleep/dailySleepSummariesByDate",
                      {"startDate": s.isoformat(), "endDate": e.isoformat()})
        items = res if isinstance(res, list) else (res or {}).get("data", [])
        for it in items or []:
            d = it.get("calendarDate")
            dur = num(it.get("sleepTimeSeconds"))
            if not d or not dur:
                continue
            out[d] = {
                "bed": ms_local(it.get("sleepStartTimestampLocal")),
                "wake": ms_local(it.get("sleepEndTimestampLocal")),
                "dur": dur, "deep": num(it.get("deepSleepSeconds")),
                "rem": num(it.get("remSleepSeconds")),
                "awake": num(it.get("awakeSleepSeconds")),
                "score": num(dig(it, "sleepScores", "overall", "value")),
            }
    return out


def fetch_hrv(api, start, end):
    out = {}
    for s, e in chunks(start, end):
        res = api.get(f"/hrv-service/hrv/daily/{s.isoformat()}/{e.isoformat()}")
        for it in (res or {}).get("hrvSummaries", []) or []:
            d = it.get("calendarDate")
            if not d:
                continue
            out[d] = {
                "avg": num(it.get("lastNightAvg")), "weekly": num(it.get("weeklyAvg")),
                "status": it.get("status"),
                "low": num(dig(it, "baseline", "balancedLow")),
                "high": num(dig(it, "baseline", "balancedUpper")),
            }
    return out


def fetch_fitnessage(api, dates):
    out = {}
    for d in dates:
        res = api.get(f"/fitnessage-service/fitnessage/v2/{d.isoformat()}")
        if not isinstance(res, dict) or num(res.get("fitnessAge")) is None:
            continue
        out[d.isoformat()] = {
            "age": num(res.get("fitnessAge")), "achievable": num(res.get("achievableFitnessAge")),
            "chrono": num(res.get("chronologicalAge")), "components": res.get("components"),
        }
    return out


def fetch_weight(api, start, end):
    out = {}
    for s, e in chunks(start, end, 90):
        res = api.get(f"/weight-service/weight/range/{s.isoformat()}/{e.isoformat()}",
                      {"includeAll": "true"})
        entries = []
        for it in (res or {}).get("dailyWeightSummaries", []) or []:
            lw = it.get("latestWeight") or {}
            entries.append((it.get("summaryDate") or lw.get("calendarDate"), lw))
        for it in (res or {}).get("dateWeightList", []) or []:
            entries.append((it.get("calendarDate"), it))
        for d, lw in entries:
            w = num(lw.get("weight"))
            if not d or not w:
                continue
            kg = w / 1000 if w > 1000 else w  # Garmin liefert Gramm
            bmi = num(lw.get("bmi"))
            out[d] = {"kg": round(kg, 1), "bmi": round(bmi, 1) if bmi else None}
    return out


def fetch_activities(api, start, end):
    out = {}
    offset, limit = 0, 40
    while True:
        res = api.get("/activitylist-service/activities/search/activities", {
            "start": offset, "limit": limit,
            "startDate": start.isoformat(), "endDate": end.isoformat()})
        items = res if isinstance(res, list) else []
        for it in items:
            aid = it.get("activityId")
            st = it.get("startTimeLocal")
            if aid is None or not st:
                continue
            zones = [num(it.get(f"hrTimeInZone_{i}")) for i in range(1, 6)]
            out[str(aid)] = {
                "id": aid, "type": dig(it, "activityType", "typeKey") or "other",
                "start": st.replace(" ", "T")[:19], "dist": num(it.get("distance")),
                "dur": num(it.get("duration")), "avg_hr": num(it.get("averageHR")),
                "max_hr": num(it.get("maxHR")),
                "z": zones if any(z is not None for z in zones) else None,
                "name": it.get("activityName"),
            }
        if len(items) < limit:
            break
        offset += limit
    return out


# ---- Hauptprogramm ----------------------------------------------------------

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--full", action="store_true", help="komplette Historie neu holen")
    args = ap.parse_args()

    key = os.environ.get("GARMIN_PERSONAL_API_KEY", "").strip()
    if not key:
        print("Fehler: GARMIN_PERSONAL_API_KEY ist nicht gesetzt.", file=sys.stderr)
        return 2

    settings = json.loads((ROOT / "config/settings.json").read_text(encoding="utf-8"))
    today = datetime.now(ZoneInfo(settings["zeitzone"])).date()
    meta = load("meta.json", {})
    sample = bool(meta.get("sample"))
    state = {n: ({} if sample else load(f"{n}.json", {}))
             for n in ("daily", "sleep", "hrv", "activities", "fitnessage", "weight")}
    first_run = args.full or sample or not state["daily"]
    start = date.fromisoformat(settings["historie_ab"]) if first_run else today - timedelta(days=RECENT_DAYS)
    a_start = date.fromisoformat(settings["aktivitaeten_ab"]) if first_run else start
    print(f"Abruf {start} bis {today} (Aktivitäten ab {a_start}, Erstlauf={first_run}, "
          f"Beispieldaten verwerfen={sample})")

    api = Api(key)
    try:
        api.login()
    except ApiError as e:
        print(f"Fehler: {e}", file=sys.stderr)
        return 1

    ok_daily = False
    failed = []

    def run(label, fn, *a):
        try:
            return fn(*a)
        except (ApiError, ValueError, TypeError, KeyError) as e:
            failed.append(label)
            warn(f"{label}: {e}")
            return None

    r = run("Tageswerte", fetch_daily, api, start, today)
    if r is not None:
        state["daily"].update(r)
        ok_daily = True
        missing = [d for d, v in state["daily"].items() if v.get("steps") is None and d >= start.isoformat()]
        if missing:
            fb = run("Schritte (Fallback)", fetch_steps_fallback, api, start, today) or {}
            for d in missing:
                if d in fb:
                    state["daily"][d]["steps"] = fb[d]
    r = run("Schlaf", fetch_sleep, api, start, today)
    if r is not None:
        state["sleep"].update(r)
    r = run("HRV", fetch_hrv, api, start, today)
    if r is not None:
        state["hrv"].update(r)
    r = run("Gewicht", fetch_weight, api, start, today)
    if r is not None:
        state["weight"].update(r)
    r = run("Aktivitäten", fetch_activities, api, a_start, today)
    if r is not None:
        lo = a_start.isoformat()
        state["activities"] = {k: v for k, v in state["activities"].items() if v["start"][:10] < lo}
        state["activities"].update(r)
    span = (today - start).days
    fdates = [start + timedelta(days=i) for i in range(0, span + 1, 1 if span <= RECENT_DAYS else 7)]
    if fdates[-1] != today:
        fdates.append(today)
    r = run("Fitness-Alter", fetch_fitnessage, api, fdates)
    if r is not None:
        state["fitnessage"].update(r)

    if not ok_daily:
        print("Fehler: Tageswerte konnten nicht geholt werden; es wird nichts gespeichert.", file=sys.stderr)
        return 1
    for n, v in state.items():
        save(f"{n}.json", v)
    save("meta.json", {
        "sample": False,
        "fetched_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "activities_from": settings["aktivitaeten_ab"],
        "partial_failures": failed,
    })
    print("Fertig." + (f" Teilweise fehlgeschlagen: {', '.join(failed)}" if failed else ""))
    return 0


if __name__ == "__main__":
    sys.exit(main())
