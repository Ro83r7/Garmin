#!/usr/bin/env python3
"""Berechnet Aggregate aus data/*.json und schreibt site/data/*.json.

Regeln: fehlende Werte bleiben None (Lücke), nie 0. Tageswerte des heutigen Teiltags
(Ruhepuls, Schritte, Stress, Intensität) werden verworfen und fließen in keinen Mittelwert.
"""
import argparse
import json
import math
import statistics
from datetime import date, datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
OUT = ROOT / "site" / "data"

RUN_TYPES = {"running", "trail_running", "treadmill_running", "track_running", "virtual_run"}
TYPE_LABELS = {
    "running": "Laufen", "trail_running": "Traillauf", "treadmill_running": "Laufband",
    "track_running": "Bahnlauf", "virtual_run": "Virtuell Laufen", "walking": "Gehen",
    "hiking": "Wandern", "cycling": "Radfahren", "indoor_cycling": "Indoor-Rad",
    "road_biking": "Rennrad", "mountain_biking": "Mountainbike", "lap_swimming": "Schwimmen",
    "open_water_swimming": "Freiwasser", "strength_training": "Krafttraining",
    "golf": "Golf", "resort_skiing": "Skifahren", "resort_skiing_snowboarding": "Ski/Snowboard",
    "indoor_cardio": "Indoor-Cardio", "hiit": "HIIT", "indoor_rowing": "Rudergerät", "pilates": "Pilates",
    "stand_up_paddleboarding": "SUP", "e_bike_fitness": "E-Bike", "yoga": "Yoga", "elliptical": "Crosstrainer", "other": "Sonstiges",
}
COMPONENT_LABELS = {
    "rhr": "Ruhepuls", "restingheartrate": "Ruhepuls", "bmi": "BMI",
    "vigorousdaysavg": "Intensive Tage pro Woche", "vigorousminutesavg": "Intensive Minuten pro Woche",
    "vo2max": "VO2max", "bodyfat": "Körperfett", "bodyfatpercentage": "Körperfett",
}


def load(name, default):
    p = DATA / name
    return json.loads(p.read_text(encoding="utf-8")) if p.exists() else default


def load_cfg(name):
    return json.loads((ROOT / "config" / name).read_text(encoding="utf-8"))


def write(name, obj):
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / name).write_text(json.dumps(obj, separators=(",", ":"), ensure_ascii=False) + "\n",
                            encoding="utf-8")


def mean(vals):
    vals = [v for v in vals if v is not None]
    return sum(vals) / len(vals) if vals else None


def r(v, n=1):
    return None if v is None else round(v, n)


def iso(d):
    return d.isoformat()


def rolling(rows, key, win=7, min_n=4):
    out = []
    for i in range(len(rows)):
        vals = [rows[j][key] for j in range(max(0, i - win + 1), i + 1) if rows[j][key] is not None]
        out.append(r(sum(vals) / len(vals), 1) if len(vals) >= min_n else None)
    return out


def minutes_after_noon(ts):
    """'YYYY-MM-DDTHH:MM' -> Minuten seit 12:00 (so liegt die Nacht an einem Stück)."""
    if not ts:
        return None
    h, m = int(ts[11:13]), int(ts[14:16])
    return (h * 60 + m - 720) % 1440


def status_for(v, base_mean, base_sd, good, worse_word):
    if v is None or base_mean is None:
        return {"level": "none", "text": "Keine Baseline"}
    sd = max(base_sd or 0, abs(base_mean) * 0.05, 0.1)
    z = (v - base_mean) / sd
    dirz = z if good == "high" else -z
    if dirz <= -1.5:
        return {"level": "red", "text": f"Deutlich {worse_word} als sonst", "z": r(dirz, 2)}
    if dirz <= -0.75:
        return {"level": "yellow", "text": f"Etwas {worse_word} als sonst", "z": r(dirz, 2)}
    if dirz >= 1.0:
        return {"level": "green", "text": "Besser als sonst", "z": r(dirz, 2)}
    return {"level": "green", "text": "Im Rahmen", "z": r(dirz, 2)}


def normalize_components(raw):
    items = []
    if isinstance(raw, dict):
        for k, v in raw.items():
            items.append((k, v))
    elif isinstance(raw, list):
        for v in raw:
            if isinstance(v, dict):
                items.append((v.get("name") or v.get("type") or v.get("key") or "?", v))
    out = []
    for k, v in items:
        if isinstance(v, dict):
            val = next((v[x] for x in ("value", "currentValue", "current") if isinstance(v.get(x), (int, float))), None)
            tgt = next((v[x] for x in ("targetValue", "target", "optimalValue") if isinstance(v.get(x), (int, float))), None)
        elif isinstance(v, (int, float)) and not isinstance(v, bool):
            val, tgt = v, None
        else:
            continue
        if val is None:
            continue
        label = COMPONENT_LABELS.get(str(k).replace("_", "").lower(), str(k))
        out.append({"label": label, "value": r(val, 1), "target": r(tgt, 1)})
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--today")
    args = ap.parse_args()
    settings = load_cfg("settings.json")
    events = load_cfg("events.json")
    tz = ZoneInfo(settings["zeitzone"])
    today = date.fromisoformat(args.today) if args.today else datetime.now(tz).date()
    today_s = iso(today)

    daily = load("daily.json", {})
    sleep = load("sleep.json", {})
    hrv = load("hrv.json", {})
    acts_raw = load("activities.json", {})
    weight = load("weight.json", {})
    fit = load("fitnessage.json", {})
    meta = load("meta.json", {})

    all_dates = [d for d in list(daily) + list(sleep) + list(hrv) if d <= today_s]
    if not all_dates:
        raise SystemExit("Keine Daten in data/. Erst fetch_garmin.py oder make_sample_data.py ausführen.")
    first = date.fromisoformat(min(all_dates))

    # ---- Tageszeilen --------------------------------------------------------
    rows = []
    d = first
    while d <= today:
        k = iso(d)
        dy = daily.get(k) or {}
        if k == today_s:
            dy = {}  # Teiltag: kein Tageswert
        sl = sleep.get(k) or {}
        hv = hrv.get(k) or {}
        light = None
        if sl.get("dur") is not None and sl.get("deep") is not None and sl.get("rem") is not None:
            light = max(0, sl["dur"] - sl["deep"] - sl["rem"])
        im = None
        if dy.get("im_mod") is not None or dy.get("im_vig") is not None:
            im = (dy.get("im_mod") or 0) + 2 * (dy.get("im_vig") or 0)
        rows.append({
            "date": k, "rhr": dy.get("rhr"), "steps": dy.get("steps"), "stress": dy.get("stress"),
            "im": im, "hrv": hv.get("avg"), "hrv_weekly": hv.get("weekly"),
            "hrv_low": hv.get("low"), "hrv_high": hv.get("high"), "hrv_status": hv.get("status"),
            "sleep_score": sl.get("score"), "sleep_dur": sl.get("dur"), "deep": sl.get("deep"),
            "rem": sl.get("rem"), "light": light, "awake": sl.get("awake"),
            "bed": sl.get("bed"), "wake": sl.get("wake"),
            "bed_min": minutes_after_noon(sl.get("bed")), "wake_min": minutes_after_noon(sl.get("wake")),
        })
        d += timedelta(days=1)
    for key, name in (("rhr", "rhr7"), ("stress", "stress7"), ("steps", "steps7"),
                      ("sleep_score", "sleep_score7"), ("sleep_dur", "sleep_dur7"), ("hrv", "hrv7")):
        for row, v in zip(rows, rolling(rows, key)):
            row[name] = v

    # ---- Aktivitäten ---------------------------------------------------------
    acts = []
    for a in acts_raw.values():
        z = a.get("z")
        acts.append({
            "id": a["id"], "type": a["type"], "label": TYPE_LABELS.get(a["type"], a["type"].replace("_", " ").capitalize()),
            "run": a["type"] in RUN_TYPES, "start": a["start"], "date": a["start"][:10],
            "dist_km": r(a["dist"] / 1000, 2) if a.get("dist") is not None else None,
            "dur": a.get("dur"), "avg_hr": a.get("avg_hr"), "max_hr": a.get("max_hr"),
            "z": z, "z45": r(((z[3] or 0) + (z[4] or 0)) / 60, 1) if z else None,
        })
    acts.sort(key=lambda a: a["start"], reverse=True)
    acts = [a for a in acts if a["date"] <= today_s]

    # ---- Wochen (Mo bis So) ---------------------------------------------------
    a_from = date.fromisoformat(meta.get("activities_from") or iso(first))
    w0 = min(first, a_from) if acts else first
    w0 -= timedelta(days=w0.weekday())
    weeks = []
    w = w0
    by_week = {}
    for a in acts:
        ad = date.fromisoformat(a["date"])
        by_week.setdefault(iso(ad - timedelta(days=ad.weekday())), []).append(a)
    rowmap = {x["date"]: x for x in rows}
    while w <= today:
        k = iso(w)
        al = by_week.get(k, [])
        with_z = [a for a in al if a["z"]]
        ims = [rowmap[iso(w + timedelta(days=i))]["im"] for i in range(7) if iso(w + timedelta(days=i)) in rowmap]
        ims = [v for v in ims if v is not None]
        runs = [a for a in al if a["run"]]
        covered = w + timedelta(days=6) >= a_from  # Aktivitäten liegen ab a_from vor
        weeks.append({
            "date": k, "partial": w + timedelta(days=6) >= today,
            "z4": r(sum((a["z"][3] or 0) for a in with_z) / 60, 1) if covered else None,
            "z5": r(sum((a["z"][4] or 0) for a in with_z) / 60, 1) if covered else None,
            "z45": r(sum(a["z45"] for a in with_z), 1) if covered else None,
            "run_km": r(sum(a["dist_km"] or 0 for a in runs), 1) if covered else None,
            "runs": len(runs) if covered else None, "acts": len(al) if covered else None,
            "dur_min": r(sum((a["dur"] or 0) for a in al) / 60, 0) if covered else None,
            "im": sum(ims) if ims else None,
        })
        w += timedelta(days=7)

    # ---- Jahresvergleich ------------------------------------------------------
    def ytd(year):
        lim = f"{year}-{today.month:02d}-{today.day:02d}"
        sel = [a for a in acts if a["run"] and f"{year}-01-01" <= a["date"] <= lim]
        cum, tot, series = 0.0, 0, []
        by_day = {}
        for a in sel:
            by_day.setdefault(a["date"], 0.0)
            by_day[a["date"]] += a["dist_km"] or 0
        dd = date(year, 1, 1)
        end = date(year, today.month, today.day)
        while dd <= end:
            cum += by_day.get(iso(dd), 0.0)
            series.append([dd.timetuple().tm_yday, r(cum, 1)])
            dd += timedelta(days=1)
        return {"runs": len(sel), "km": r(sum(a["dist_km"] or 0 for a in sel), 1), "series": series}

    year = {
        "year": today.year, "prev_year": today.year - 1,
        "upto": f"{today.day:02d}.{today.month:02d}.",
        "cur": ytd(today.year), "prev": ytd(today.year - 1),
        "prev_complete": a_from <= date(today.year - 1, 1, 1),
    }

    # ---- KPIs -----------------------------------------------------------------
    def kpi_series(key, label, unit, good, worse_word, digits=0, scale=1.0):
        vals = [(x["date"], x[key]) for x in rows if x[key] is not None]
        if not vals:
            return {"key": key, "label": label, "unit": unit, "value": None, "spark": []}
        ld, lv = vals[-1]
        prev = [x[key] for x in rows if x[key] is not None and ld > x["date"] >= iso(date.fromisoformat(ld) - timedelta(days=28))]
        bm = mean(prev) if len(prev) >= 7 else None
        bsd = statistics.pstdev(prev) if len(prev) >= 7 else None
        delta = (lv - bm) if bm is not None else None
        spark = [x[key] for x in rows[-30:]]
        return {
            "key": key, "label": label, "unit": unit, "date": ld, "digits": digits,
            "value": r(lv * scale, 2), "base": r(bm * scale, 2) if bm is not None else None,
            "delta": r(delta * scale, 2) if delta is not None else None,
            "spark": [r(v * scale, 2) if v is not None else None for v in spark],
            "status": status_for(lv, bm, bsd, good, worse_word), "good": good,
        }

    kpis = [
        kpi_series("rhr", "Ruhepuls", "bpm", "low", "höher"),
        kpi_series("hrv", "HRV", "ms", "high", "niedriger"),
        kpi_series("sleep_score", "Schlaf-Score", "", "high", "niedriger"),
        kpi_series("sleep_dur", "Schlafdauer", "h", "high", "kürzer", digits=1, scale=1 / 3600),
        kpi_series("stress", "Stress", "", "low", "höher"),
        kpi_series("steps", "Schritte", "", "high", "niedriger"),
    ]
    fit_rows = sorted(({"date": k, **v} for k, v in fit.items() if k <= today_s), key=lambda x: x["date"])
    fk = {"key": "fitness_age", "label": "Fitness-Alter", "unit": "Jahre", "digits": 1, "value": None,
          "spark": [x["age"] for x in fit_rows[-30:]], "good": "low"}
    if fit_rows:
        last = fit_rows[-1]
        prev = [x["age"] for x in fit_rows if x["age"] is not None and last["date"] > x["date"] >= iso(date.fromisoformat(last["date"]) - timedelta(days=28))]
        bm = mean(prev) if prev else None
        fk.update(date=last["date"], value=last["age"], base=r(bm, 1),
                  delta=r(last["age"] - bm, 1) if bm is not None else None,
                  status=status_for(last["age"], bm, statistics.pstdev(prev) if len(prev) > 1 else 0.3, "low", "höher"))
    kpis.append(fk)
    full = [wk for wk in weeks if not wk["partial"] and wk["im"] is not None]
    ik = {"key": "im_week", "label": "Intensitätsminuten pro Woche", "unit": "min", "digits": 0, "value": None,
          "spark": [wk["im"] for wk in weeks[-12:]], "good": "high"}
    if full:
        last = full[-1]
        prev = [wk["im"] for wk in full[-5:-1]]
        bm = mean(prev) if len(prev) >= 2 else None
        ik.update(date=last["date"], value=last["im"], base=r(bm, 0),
                  delta=r(last["im"] - bm, 0) if bm is not None else None,
                  status=status_for(last["im"], bm, statistics.pstdev(prev) if len(prev) > 1 else None, "high", "niedriger"))
    kpis.append(ik)
    cur_week = weeks[-1] if weeks else None
    goal = settings["wochenziel_zone45_min"]
    z45 = {"label": "Zone 4/5 diese Woche", "unit": "min", "value": cur_week["z45"] if cur_week else None,
           "goal": goal, "key": "z45_week"}
    if z45["value"] is not None:
        z45["status"] = ({"level": "green", "text": "Ziel erreicht"} if z45["value"] >= goal
                         else {"level": "yellow", "text": f"Noch {r(goal - z45['value'], 0):.0f} min bis zum Ziel"})
    last_sleep = next((x for x in reversed(rows) if x["sleep_dur"] is not None), None)

    # ---- Körper ---------------------------------------------------------------
    body = {
        "weight": sorted(({"date": k, **v} for k, v in weight.items() if k <= today_s), key=lambda x: x["date"]),
        "fitness": [{"date": x["date"], "age": x["age"], "achievable": x.get("achievable"),
                     "chrono": x.get("chrono")} for x in fit_rows],
        "components": normalize_components(fit_rows[-1].get("components")) if fit_rows else [],
        "height_cm": settings.get("groesse_cm"),
    }
    if settings.get("groesse_cm"):
        h = settings["groesse_cm"] / 100
        for x in body["weight"]:
            if x.get("bmi") is None:
                x["bmi"] = r(x["kg"] / h ** 2, 1)

    # ---- Ausgabe ----------------------------------------------------------------
    write("meta.json", {
        "updated": meta.get("fetched_at"), "sample": bool(meta.get("sample")), "today": today_s,
        "first": iso(first), "events": events, "partial_failures": meta.get("partial_failures", []),
        "settings": {"hfmax": settings["hfmax"], "zone": settings["intervall_zielzone"],
                     "goal": goal, "tz": settings["zeitzone"]},
    })
    write("daily.json", rows)
    write("weeks.json", weeks)
    write("activities.json", acts)
    write("kpi.json", {"kpis": kpis, "z45": z45, "last_sleep": last_sleep})
    write("year.json", year)
    write("body.json", body)
    print(f"Build: {len(rows)} Tage, {len(weeks)} Wochen, {len(acts)} Aktivitäten, heute={today_s}")


if __name__ == "__main__":
    main()
