#!/usr/bin/env python3
"""Erzeugt synthetische Beispieldaten in data/ (120 Tage, Aktivitäten ab aktivitaeten_ab).

Nur zum Entwickeln und Testen. data/meta.json bekommt "sample": true; der echte
Abruf (fetch_garmin.py) verwirft Beispieldaten beim ersten Lauf vollständig.
"""
import argparse
import json
import random
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"


def save(name, obj):
    DATA.mkdir(exist_ok=True)
    (DATA / name).write_text(
        json.dumps(obj, indent=1, sort_keys=True, ensure_ascii=False) + "\n", encoding="utf-8")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--today")
    ap.add_argument("--days", type=int, default=120)
    args = ap.parse_args()
    settings = json.loads((ROOT / "config/settings.json").read_text())
    events = json.loads((ROOT / "config/events.json").read_text())
    tz = ZoneInfo(settings["zeitzone"])
    today = date.fromisoformat(args.today) if args.today else datetime.now(tz).date()
    rng = random.Random(20261028)

    def in_event(d):
        return any(e["von"] <= d.isoformat() <= e["bis"] for e in events)

    n = args.days
    off_days = {today - timedelta(days=k) for k in (17, 18, 19, 52)}  # Uhr nicht getragen
    no_sleep = {today - timedelta(days=k) for k in (5, 33, 34, 70)}
    daily, sleep, hrv = {}, {}, {}
    for i in range(n):
        d = today - timedelta(days=n - 1 - i)
        iso = d.isoformat()
        prog = i / n
        away = in_event(d)
        if d not in off_days:
            frac = 0.45 if d == today else 1.0  # heutiger Teiltag
            rec = {
                "rhr": round(54 - 3 * prog + (1.8 if away else 0) + rng.gauss(0, 1.3)),
                "steps": round(max(1500, (13500 if away else 8600) + (d.weekday() >= 5) * 1500
                                   + rng.gauss(0, 2200)) * frac),
                "stress": round(max(12, 28 + (4 if away else 0) + rng.gauss(0, 5))),
                "im_mod": round(max(0, 22 + rng.gauss(0, 14)) * frac),
                "im_vig": round(max(0, (18 if d.weekday() in (1, 5) else 3) + rng.gauss(0, 7)) * frac),
            }
            daily[iso] = rec
        if d not in off_days and d not in no_sleep:
            dur = max(4.8, 7.1 + rng.gauss(0, 0.7) - (0.6 if away else 0)) * 3600
            awake = max(600, rng.gauss(2400, 900))
            bed_min = 22 * 60 + 50 + rng.gauss(0, 40) + (90 if away else 0)
            bed = datetime(d.year, d.month, d.day) - timedelta(days=1) + timedelta(minutes=bed_min)
            wake = bed + timedelta(seconds=dur + awake)
            deep = dur * rng.uniform(0.14, 0.22)
            rem = dur * rng.uniform(0.18, 0.26)
            score = max(40, min(97, round(62 + (dur / 3600 - 6) * 12 - awake / 400 + rng.gauss(0, 4))))
            sleep[iso] = {
                "bed": bed.strftime("%Y-%m-%dT%H:%M"), "wake": wake.strftime("%Y-%m-%dT%H:%M"),
                "dur": round(dur), "deep": round(deep), "rem": round(rem),
                "awake": round(awake), "score": score,
            }
            avg = 56 + 4 * prog + rng.gauss(0, 5.5) - (4 if away else 0)
            lo, hi = 49 + 3 * prog, 65 + 3 * prog
            hrv[iso] = {
                "avg": round(avg), "weekly": round(56 + 4 * prog + rng.gauss(0, 1.5)),
                "low": round(lo), "high": round(hi),
                "status": "BALANCED" if lo <= avg <= hi else "UNBALANCED",
            }

    # Aktivitäten ab aktivitaeten_ab
    acts = {}
    d = date.fromisoformat(settings["aktivitaeten_ab"])
    aid = 9000000
    while d <= today:
        wd = d.weekday()
        plan = []
        if in_event(d):
            if rng.random() < 0.6:
                plan.append("walking")
            if rng.random() < 0.25:
                plan.append("lap_swimming")
        else:
            if wd == 1 and rng.random() < 0.85:
                plan.append("interval")
            if wd == 3 and rng.random() < 0.8:
                plan.append("easy")
            if wd == 5 and rng.random() < 0.8:
                plan.append("long")
            if wd in (0, 4) and rng.random() < 0.35:
                plan.append(rng.choice(["strength_training", "cycling"]))
            if wd == 6 and rng.random() < 0.3:
                plan.append("walking")
        for kind in plan:
            aid += 1
            h = rng.choice([6, 7, 17, 18])
            start = datetime(d.year, d.month, d.day, h, rng.randint(0, 59))
            if kind == "interval":
                typ, dist, dur = "running", rng.uniform(7, 9.5), rng.uniform(3000, 3700)
                z = [rng.gauss(300, 60), rng.gauss(450, 90), rng.gauss(650, 120), rng.gauss(900, 150), rng.gauss(380, 110)]
                avg_hr, max_hr = rng.gauss(151, 4), rng.randint(167, 172)
            elif kind == "easy":
                typ, dist, dur = "running", rng.uniform(7, 10), rng.uniform(2900, 3800)
                z = [rng.gauss(260, 60), rng.gauss(1500, 250), rng.gauss(1300, 250), rng.gauss(120, 80), 0]
                avg_hr, max_hr = rng.gauss(141, 4), rng.randint(152, 160)
            elif kind == "long":
                typ, dist, dur = "running", rng.uniform(14, 21), rng.uniform(5200, 7600)
                z = [rng.gauss(300, 60), rng.gauss(2600, 400), rng.gauss(2500, 400), rng.gauss(300, 150), rng.gauss(20, 20)]
                avg_hr, max_hr = rng.gauss(144, 4), rng.randint(155, 166)
            elif kind == "walking":
                typ, dist, dur = "walking", rng.uniform(3, 9), rng.uniform(2400, 6000)
                z = [rng.gauss(1500, 300), rng.gauss(900, 300), 0, 0, 0]
                avg_hr, max_hr = rng.gauss(102, 6), rng.randint(115, 130)
            elif kind == "cycling":
                typ, dist, dur = "cycling", rng.uniform(20, 45), rng.uniform(3000, 6500)
                z = [rng.gauss(400, 100), rng.gauss(1800, 400), rng.gauss(1000, 300), rng.gauss(200, 100), 0]
                avg_hr, max_hr = rng.gauss(130, 5), rng.randint(150, 165)
            elif kind == "lap_swimming":
                typ, dist, dur = "lap_swimming", rng.uniform(0.8, 1.6) * 1000 / 1000, rng.uniform(1800, 2700)
                z = [rng.gauss(500, 100), rng.gauss(900, 200), rng.gauss(300, 100), 0, 0]
                avg_hr, max_hr = rng.gauss(118, 5), rng.randint(135, 150)
            else:
                typ, dist, dur = "strength_training", 0.0, rng.uniform(2400, 3600)
                z = [rng.gauss(900, 200), rng.gauss(900, 200), rng.gauss(300, 100), 0, 0]
                avg_hr, max_hr = rng.gauss(110, 6), rng.randint(130, 148)
            zones = [max(0, round(v)) for v in z]
            if rng.random() < 0.03:
                zones = None  # z. B. ohne Herzfrequenz aufgezeichnet
            acts[str(aid)] = {
                "id": aid, "type": typ, "start": start.strftime("%Y-%m-%dT%H:%M:%S"),
                "dist": round(dist * 1000) if typ != "lap_swimming" else round(dist * 1000),
                "dur": round(dur), "avg_hr": round(avg_hr) if zones else None,
                "max_hr": max_hr if zones else None, "z": zones, "name": typ,
            }
        d += timedelta(days=1)

    fit, weight = {}, {}
    k = 0
    d = today - timedelta(days=n - 1)
    while d <= today:
        if k % 7 == 0 or d == today:
            age = 43.4 - 1.6 * k / n + rng.gauss(0, 0.25)
            fit[d.isoformat()] = {
                "age": round(age, 1), "achievable": round(age - 3.1, 1), "chrono": 47,
                "components": {
                    "rhr": {"value": 53, "targetValue": 50},
                    "bmi": {"value": 23.9, "targetValue": 23.0},
                    "vigorousDaysAvg": {"value": 2.3, "targetValue": 3.0},
                    "vigorousMinutesAvg": {"value": 58, "targetValue": 90},
                },
            }
        k += 1
        d += timedelta(days=1)
    d = today - timedelta(days=n - 1)
    while d <= today:
        kg = 78.6 - 1.5 * (d - (today - timedelta(days=n - 1))).days / n + rng.gauss(0, 0.35)
        weight[d.isoformat()] = {"kg": round(kg, 1), "bmi": round(kg / 1.80 ** 2, 1)}
        d += timedelta(days=rng.choice([2, 3, 4, 7]))

    save("daily.json", daily)
    save("sleep.json", sleep)
    save("hrv.json", hrv)
    save("activities.json", acts)
    save("fitnessage.json", fit)
    save("weight.json", weight)
    save("meta.json", {
        "sample": True,
        "fetched_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "activities_from": settings["aktivitaeten_ab"],
    })
    print(f"Beispieldaten: {len(daily)} Tage, {len(sleep)} Nächte, {len(acts)} Aktivitäten")


if __name__ == "__main__":
    main()
