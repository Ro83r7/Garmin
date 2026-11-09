#!/usr/bin/env python3
"""Schreibt die Garmin-Rohdaten aus data/*.json in die Supabase-Datenbank (Upsert, idempotent).

Nur Standardbibliothek. Zugriff über die Funktion garmin_ingest (siehe supabase/garmin.sql) mit einem geheimen Code.
Umgebungsvariablen: SUPABASE_URL, SUPABASE_KEY (publishable key, öffentlich), SUPABASE_GARMIN_CODE (geheim).
Fehlen sie, wird der Schritt übersprungen. Standard: nur die letzten 30 Tage (--all für alles). Werte werden nie ausgegeben.
"""
import argparse
import json
import os
import sys
import time
import urllib.error
import urllib.request
from datetime import date, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
CHUNK = 200


def load(name):
    p = DATA / name
    return json.loads(p.read_text(encoding="utf-8")) if p.exists() else {}


def build_rows(since):
    lo = since.isoformat() if since else ""
    out = {}
    out["daily"] = [
        {"date": d, "resting_hr": v.get("rhr"), "steps": v.get("steps"), "stress_avg": v.get("stress"),
         "intensity_moderate_min": v.get("im_mod"), "intensity_vigorous_min": v.get("im_vig")}
        for d, v in sorted(load("daily.json").items()) if d >= lo]
    out["sleep"] = [
        {"date": d, "bed_local": v.get("bed"), "wake_local": v.get("wake"), "duration_s": v.get("dur"),
         "deep_s": v.get("deep"), "rem_s": v.get("rem"), "awake_s": v.get("awake"), "score": v.get("score")}
        for d, v in sorted(load("sleep.json").items()) if d >= lo]
    out["hrv"] = [
        {"date": d, "last_night_avg": v.get("avg"), "weekly_avg": v.get("weekly"), "status": v.get("status"),
         "baseline_low": v.get("low"), "baseline_high": v.get("high")}
        for d, v in sorted(load("hrv.json").items()) if d >= lo]
    acts = []
    for v in load("activities.json").values():
        if v["start"][:10] < lo:
            continue
        z = v.get("z") or [None] * 5
        acts.append({
            "id": v["id"], "type": v.get("type"), "name": v.get("name"), "start_local": v["start"],
            "distance_m": v.get("dist"), "duration_s": v.get("dur"), "moving_s": v.get("mov"),
            "avg_hr": None if v.get("avg_hr") is None else round(v["avg_hr"]),
            "max_hr": None if v.get("max_hr") is None else round(v["max_hr"]),
            "avg_speed_ms": v.get("speed"), "elevation_gain_m": v.get("gain"), "calories": v.get("cal"),
            "location": v.get("loc"), "cadence_spm": v.get("cad"), "ground_contact_ms": v.get("gct"),
            "vertical_osc_cm": v.get("vo"), "vertical_ratio_pct": v.get("vr"), "stride_length": v.get("sl"),
            "power_avg": v.get("pw"), "power_norm": v.get("npw"), "best_1km_s": v.get("best1k"),
            **{f"hr_zone_s_{i + 1}": (None if z[i] is None else round(z[i])) for i in range(5)},
        })
    out["activities"] = sorted(acts, key=lambda a: a["start_local"])
    out["weight"] = [{"date": d, "kg": v.get("kg"), "bmi": v.get("bmi")}
                     for d, v in sorted(load("weight.json").items()) if d >= lo]
    out["fitness_age"] = [
        {"date": d, "fitness_age": v.get("age"), "achievable_age": v.get("achievable"),
         "chronological_age": v.get("chrono"), "components": v.get("components")}
        for d, v in sorted(load("fitnessage.json").items()) if d >= lo]
    return out


def rpc(url, key, fn, args):
    req = urllib.request.Request(
        url.rstrip("/") + "/rest/v1/rpc/" + fn, data=json.dumps(args).encode("utf-8"), method="POST",
        headers={"Content-Type": "application/json", "apikey": key,
                 **({"Authorization": "Bearer " + key} if key.startswith("eyJ") else {})})
    for attempt in range(4):
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                return json.loads(r.read().decode() or "null")
        except urllib.error.HTTPError as e:
            msg = e.read().decode("utf-8", "replace")[:160]
            if e.code >= 500 and attempt < 3:
                time.sleep(2 ** (attempt + 1))
                continue
            raise RuntimeError(f"HTTP {e.code} bei {fn}: {msg}") from None
        except (urllib.error.URLError, TimeoutError):
            if attempt < 3:
                time.sleep(2 ** (attempt + 1))
                continue
            raise RuntimeError(f"Netzwerkfehler bei {fn}") from None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--all", action="store_true", help="komplette Historie senden")
    ap.add_argument("--days", type=int, default=30)
    args = ap.parse_args()
    url, key, code = (os.environ.get(k, "").strip() for k in ("SUPABASE_URL", "SUPABASE_KEY", "SUPABASE_GARMIN_CODE"))
    if not (url and key and code):
        print("Supabase-Sync übersprungen: SUPABASE_URL, SUPABASE_KEY oder SUPABASE_GARMIN_CODE fehlt.")
        return 0
    since = None if args.all else date.today() - timedelta(days=args.days)
    rows = build_rows(since)
    total = 0
    try:
        for table, items in rows.items():
            for i in range(0, len(items), CHUNK):
                total += rpc(url, key, "garmin_ingest", {"p_code": code, "p_table": table, "p_rows": items[i:i + CHUNK]}) or 0
            print(f"{table}: {len(items)} Zeilen gesendet")
    except RuntimeError as e:
        print(f"::warning::Supabase-Sync fehlgeschlagen: {e}")
        return 1
    print(f"Supabase-Sync fertig ({total} Zeilen geschrieben/aktualisiert).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
