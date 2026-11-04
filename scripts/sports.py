"""Auswertungen für die Seiten Laufen, Radfahren und Golf (aus den Aktivitäten).

Alle Hinweise und Vorschläge sind regelbasiert: Vergleich mit den eigenen früheren Läufen und groben Richtwerten.
Sie sind keine Trainings- oder medizinische Beratung. Fehlende Werte bleiben None.
"""
import json
import statistics
from datetime import date, timedelta
from pathlib import Path

RUN_TYPES = {"running", "trail_running", "treadmill_running", "track_running", "virtual_run"}
BIKE_TYPES = {"cycling", "indoor_cycling", "road_biking", "mountain_biking", "gravel_cycling", "virtual_ride", "e_bike_fitness"}
# Richtwerte für Scratch-Golfer pro Runde (Arccos/Golf-Monthly-Auswertungen, grobe Mittelwerte)
SCRATCH = {"putts": 29.9, "gir_pct": 59.0, "fir_pct": 51.0}


def mean(v):
    v = [x for x in v if x is not None]
    return sum(v) / len(v) if v else None


def r(v, n=1):
    return None if v is None else round(v, n)


def rng(v, lo, hi):
    return v if v is not None and lo <= v <= hi else None


def rolling(items, key, win=5, min_n=3):
    out = []
    for i in range(len(items)):
        vals = [x[key] for x in items[max(0, i - win + 1):i + 1] if x.get(key) is not None]
        out.append(r(sum(vals) / len(vals), 2) if len(vals) >= min_n else None)
    return out


def period(items, end, days, offset=0):
    hi = (end - timedelta(days=offset)).isoformat()
    lo = (end - timedelta(days=offset + days)).isoformat()
    return [x for x in items if lo < x["date"] <= hi]


def compare(items, keys, end, days=90):
    cur, prev = period(items, end, days), period(items, end, days, days)
    out = {"n": len(cur), "n_prev": len(prev)}
    for k in keys:
        a, b = mean([x.get(k) for x in cur]), mean([x.get(k) for x in prev])
        out[k] = r(a, 2)
        out[k + "_prev"] = r(b, 2)
    return out


def monthly(items, key, end, months=12):
    out = {}
    for x in items:
        out[x["date"][:7]] = out.get(x["date"][:7], 0) + (x.get(key) or 0)
    ms, y, m = [], end.year, end.month
    for _ in range(months):
        ms.append(f"{y}-{m:02d}")
        m -= 1
        if m == 0:
            y, m = y - 1, 12
    return [{"month": k, "v": r(out.get(k, 0), 1)} for k in reversed(ms)]


def fmt_pace(sec):
    return f"{int(sec // 60)}:{int(round(sec % 60)):02d}" if sec else "–"


# ---------------------------------------------------------------- Laufen
def build_running(acts, end):
    runs = []
    for a in sorted(acts, key=lambda a: a["start"]):
        if a["type"] not in RUN_TYPES or not a.get("dist") or not a.get("dur") or a["dist"] < 1000 or a["dur"] < 300:
            continue
        sec = a.get("mov") or a["dur"]
        sl = a.get("sl")
        if sl is not None and sl > 10:
            sl = sl / 100  # cm -> m
        hr = a.get("avg_hr")
        row = {
            "date": a["start"][:10], "type": a["type"], "treadmill": a["type"] == "treadmill_running",
            "dist_km": r(a["dist"] / 1000, 2), "dur": a["dur"], "pace": r(sec / a["dist"] * 1000, 1), "hr": hr,
            "cad": rng(a.get("cad"), 100, 230), "gct": rng(a.get("gct"), 150, 400), "vo": rng(a.get("vo"), 3, 20),
            "vr": rng(a.get("vr"), 3, 15), "sl": rng(sl, 0.4, 2.5), "pw": rng(a.get("pw"), 50, 700),
            "gain": a.get("gain"), "best1k": a.get("best1k"),
        }
        row["eff"] = r((a["dist"] / sec * 60) / hr, 3) if hr else None  # Meter pro Minute je Herzschlag/min
        runs.append(row)
    keys = ["pace", "hr", "cad", "gct", "vo", "vr", "sl", "pw", "eff"]
    for k in keys:
        for row, v in zip(runs, rolling(runs, k)):
            row[k + "_r5"] = v
    summ = compare(runs, keys + ["dist_km"], end)
    cur = period(runs, end, 90)
    summ["km"] = r(sum(x["dist_km"] for x in cur), 1)
    summ["km_prev"] = r(sum(x["dist_km"] for x in period(runs, end, 90, 90)), 1)
    summ["with_dyn"] = sum(1 for x in runs if x["gct"] is not None)
    summ["total"] = len(runs)

    tips = []
    c = summ

    def add(level, title, text):
        tips.append({"level": level, "title": title, "text": text})

    if runs and summ["with_dyn"] < max(3, len(runs) * 0.5):
        add("info", "Wenig Laufdynamik-Daten", f"Nur {summ['with_dyn']} von {len(runs)} Läufen enthalten Bodenkontaktzeit & Co. Dafür braucht es eine kompatible Uhr, einen Brustgurt oder Pod.")
    if c.get("cad") and c["n"] >= 3:
        if c["cad"] < 165:
            add("info", "Kadenz", f"Deine Kadenz liegt im Schnitt bei {c['cad']:.0f} Schritten/min. Als Richtwert fühlen sich viele Läufer bei etwa 165–180 effizient, bei sehr lockerem Tempo liegt sie natürlich niedriger. Probier zum Test +5 % mit einem Metronom oder einer Musik-Playlist im passenden Takt.")
        elif c.get("cad_prev") and c["cad"] - c["cad_prev"] >= 3:
            add("good", "Kadenz steigt", f"Deine Kadenz ist von {c['cad_prev']:.0f} auf {c['cad']:.0f} Schritte/min gestiegen.")
    if c.get("gct") and c["n"] >= 3:
        if c.get("gct_prev") and c["gct"] - c["gct_prev"] >= 5:
            add("info", "Bodenkontaktzeit steigt", f"Die Bodenkontaktzeit liegt im Schnitt bei {c['gct']:.0f} ms (vorher {c['gct_prev']:.0f} ms). Müdigkeit oder mehr Dauerlauf-Tempo können dahinterstecken. Kurze Steigerungsläufe und Lauf-ABC bringen oft Reaktivität zurück.")
        elif c["gct"] > 270:
            add("info", "Lange Bodenkontaktzeit", f"{c['gct']:.0f} ms im Schnitt gelten als eher lang. Das ist bei lockeren Läufen normal; bei schnelleren Einheiten lohnt sich ein Blick auf kürzere Schritte.")
        elif c.get("gct_prev") and c["gct_prev"] - c["gct"] >= 5:
            add("good", "Bodenkontaktzeit sinkt", f"Von {c['gct_prev']:.0f} auf {c['gct']:.0f} ms. Das spricht für einen reaktiveren Laufstil.")
    if c.get("vr") and c["n"] >= 3 and c["vr"] > 8.5:
        add("info", "Vertikales Verhältnis", f"Mit {c['vr']:.1f} % springst du relativ viel im Verhältnis zur Schrittlänge (Richtwert: unter etwa 8 % wirkt effizient). Flachere, schnellere Schritte und eine leichte Vorneigung aus den Knöcheln können helfen.")
    if c.get("vo") and c.get("vo_prev") and c["n"] >= 3 and c["vo"] - c["vo_prev"] >= 0.5:
        add("info", "Vertikale Bewegung", f"Die vertikale Oszillation ist von {c['vo_prev']:.1f} auf {c['vo']:.1f} cm gestiegen.")
    if c.get("eff") and c.get("eff_prev") and c["n"] >= 3 and c["n_prev"] >= 3:
        d = (c["eff"] / c["eff_prev"] - 1) * 100
        if d >= 2:
            add("good", "Effizienz verbessert", f"Du läufst bei gleicher Herzfrequenz etwa {d:.0f} % schneller als in den 90 Tagen davor.")
        elif d <= -3:
            add("info", "Effizienz gesunken", f"Pro Herzschlag legst du etwa {abs(d):.0f} % weniger Strecke zurück als vorher. Ermüdung, Hitze oder Krankheit können eine Rolle spielen.")
    k4, k4p = sum(x["dist_km"] for x in period(runs, end, 28)), sum(x["dist_km"] for x in period(runs, end, 28, 28))
    if k4p >= 10 and k4 > k4p * 1.3:
        add("warn", "Umfang steigt schnell", f"In den letzten 4 Wochen {k4:.0f} km gegenüber {k4p:.0f} km davor (+{(k4 / k4p - 1) * 100:.0f} %). Starke Sprünge erhöhen bei vielen die Beschwerdewahrscheinlichkeit.")
    if not tips and runs:
        add("good", "Keine Auffälligkeiten", "Im Vergleich zu deinen eigenen letzten 90 Tagen fällt nichts Besonderes auf.")
    return {"runs": runs, "summary": summ, "monthly_km": monthly(runs, "dist_km", end), "tips": tips,
            "has_dynamics": summ["with_dyn"] > 0, "has_power": any(x["pw"] is not None for x in runs)}


# ---------------------------------------------------------------- Radfahren
def build_cycling(acts, end):
    rides = []
    for a in sorted(acts, key=lambda a: a["start"]):
        if a["type"] not in BIKE_TYPES or not a.get("dist") or not a.get("dur") or a["dist"] < 2000:
            continue
        sec = a.get("mov") or a["dur"]
        kmh = a["dist"] / sec * 3.6
        z = a.get("z")
        rides.append({
            "date": a["start"][:10], "type": a["type"], "indoor": a["type"] in ("indoor_cycling", "virtual_ride"),
            "dist_km": r(a["dist"] / 1000, 1), "dur": a["dur"], "kmh": r(kmh, 1), "hr": a.get("avg_hr"),
            "gain": a.get("gain"), "cal": a.get("cal"), "loc": a.get("loc"),
            "eff": r(kmh / a["avg_hr"] * 100, 2) if a.get("avg_hr") else None,
            "z45": r(((z[3] or 0) + (z[4] or 0)) / 60, 1) if z else None,
        })
    keys = ["kmh", "hr", "eff", "dist_km", "gain"]
    for k in keys:
        for row, v in zip(rides, rolling(rides, k)):
            row[k + "_r5"] = v
    summ = compare(rides, keys, end)
    cur, prev = period(rides, end, 90), period(rides, end, 90, 90)
    summ["km"] = r(sum(x["dist_km"] for x in cur), 0)
    summ["km_prev"] = r(sum(x["dist_km"] for x in prev), 0)
    summ["hours"] = r(sum(x["dur"] for x in cur) / 3600, 1)
    summ["hours_prev"] = r(sum(x["dur"] for x in prev) / 3600, 1)
    summ["total"] = len(rides)
    tips = []
    outdoor = [x for x in cur if not x["indoor"]]
    if len(cur) >= 3:
        longest = max(x["dist_km"] for x in cur)
        if summ["dist_km"] and longest < summ["dist_km"] * 1.5:
            tips.append({"level": "info", "title": "Alle Fahrten ähnlich lang", "text": f"Deine längste Fahrt der letzten 90 Tage hatte {longest:.0f} km bei einem Schnitt von {summ['dist_km']:.0f} km. Eine gelegentliche längere, ruhige Ausfahrt trainiert die Grundlage."})
        z = [x["z45"] for x in cur if x["z45"] is not None]
        if z and sum(1 for v in z if v >= 10) / len(z) < 0.15:
            tips.append({"level": "info", "title": "Wenig intensive Minuten", "text": "Nur wenige Fahrten enthalten nennenswert Zeit in Zone 4/5. Kurze Intervalle (zum Beispiel 4 × 4 min) setzen einen anderen Reiz."})
        if summ.get("eff") and summ.get("eff_prev") and summ["eff"] / summ["eff_prev"] >= 1.03:
            tips.append({"level": "good", "title": "Effizienz verbessert", "text": f"Du fährst bei gleicher Herzfrequenz etwa {(summ['eff'] / summ['eff_prev'] - 1) * 100:.0f} % schneller als in den 90 Tagen davor (Tempo hängt von Strecke und Wind ab)."})
    if not tips and rides:
        tips.append({"level": "good", "title": "Keine Auffälligkeiten", "text": "Im Vergleich zu deinen eigenen letzten 90 Tagen fällt nichts Besonderes auf."})
    return {"rides": rides, "summary": summ, "monthly_km": monthly(rides, "dist_km", end), "tips": tips,
            "has_outdoor": bool(outdoor)}


# ---------------------------------------------------------------- Golf
def build_golf(acts, end, manual_path):
    items = []
    for a in sorted(acts, key=lambda a: a["start"]):
        if a["type"] != "golf" or not a.get("dur"):
            continue
        km = a["dist"] / 1000 if a.get("dist") else None
        if a["dur"] > 36000:
            continue  # über 10 h: vermutlich vergessen zu beenden, zählt weder als Runde noch als Einheit
        is_round = a["dur"] >= 7200 or (km or 0) >= 3
        items.append({
            "date": a["start"][:10], "round": is_round, "dur": a["dur"], "dist_km": r(km, 1), "hr": a.get("avg_hr"),
            "cal": a.get("cal"), "gain": a.get("gain"), "loc": a.get("loc") or "Unbekannt",
        })
    rounds = [x for x in items if x["round"]]
    years = {}
    for x in rounds:
        y = years.setdefault(x["date"][:4], {"n": 0, "dur": 0, "km": 0.0})
        y["n"] += 1
        y["dur"] += x["dur"]
        y["km"] += x["dist_km"] or 0
    courses = {}
    for x in rounds:
        c = courses.setdefault(x["loc"], {"loc": x["loc"], "n": 0, "dur": [], "km": [], "hr": [], "last": ""})
        c["n"] += 1
        c["dur"].append(x["dur"])
        c["km"].append(x["dist_km"])
        c["hr"].append(x["hr"])
        c["last"] = max(c["last"], x["date"])
    course_list = sorted(({"loc": c["loc"], "n": c["n"], "dur": r(mean(c["dur"]), 0), "km": r(mean(c["km"]), 1),
                           "hr": r(mean(c["hr"]), 0), "last": c["last"]} for c in courses.values()),
                         key=lambda c: -c["n"])
    ytd_cur = [x for x in rounds if x["date"][:4] == str(end.year) and x["date"] <= end.isoformat()]
    lim = f"{end.year - 1}-{end.month:02d}-{end.day:02d}"
    ytd_prev = [x for x in rounds if x["date"][:4] == str(end.year - 1) and x["date"] <= lim]
    manual = []
    if manual_path.exists():
        try:
            manual = json.loads(manual_path.read_text(encoding="utf-8"))
        except ValueError:
            manual = []
    mrows = []
    for m in manual:
        if not m.get("date"):
            continue
        row = {"date": m["date"], "course": m.get("course"), "par": m.get("par"), "score": m.get("score"),
               "putts": m.get("putts"), "gir": m.get("gir"), "fir": m.get("fir"), "fir_total": m.get("fir_total"),
               "holes": m.get("holes", 18)}
        sc = row["score"]
        row["to_par"] = sc - row["par"] if sc is not None and row["par"] else None
        row["gir_pct"] = r(row["gir"] / row["holes"] * 100, 0) if row["gir"] is not None and row["holes"] else None
        row["fir_pct"] = r(row["fir"] / row["fir_total"] * 100, 0) if row["fir"] is not None and row["fir_total"] else None
        scale = 18 / row["holes"] if row["holes"] else 1
        row["putts_vs_scratch"] = r(row["putts"] - SCRATCH["putts"] / scale, 1) if row["putts"] is not None else None
        row["gir_vs_scratch"] = r(row["gir_pct"] - SCRATCH["gir_pct"], 0) if row["gir_pct"] is not None else None
        row["fir_vs_scratch"] = r(row["fir_pct"] - SCRATCH["fir_pct"], 0) if row["fir_pct"] is not None else None
        mrows.append(row)
    return {
        "rounds": items, "n_rounds": len(rounds), "n_other": len(items) - len(rounds),
        "monthly_rounds": monthly([{"date": x["date"], "n": 1} for x in rounds], "n", end),
        "years": {k: {"n": v["n"], "hours": r(v["dur"] / 3600, 0), "km": r(v["km"], 0)} for k, v in sorted(years.items())},
        "ytd": {"cur": len(ytd_cur), "prev": len(ytd_prev)}, "courses": course_list,
        "avg": {"dur": r(mean([x["dur"] for x in rounds]), 0), "km": r(mean([x["dist_km"] for x in rounds]), 1),
                "hr": r(mean([x["hr"] for x in rounds]), 0)},
        "manual": sorted(mrows, key=lambda m: m["date"], reverse=True), "scratch": SCRATCH,
    }


# ---------------------------------------------------------------- Wochenrückblick
def build_weeks(rows, acts, end, goal, count=12):
    """Letzte vollständige Wochen (Mo bis So) mit Kennzahlen, Tageswerten und Highlights. Lücken bleiben None."""
    by_date = {x["date"]: x for x in rows}
    cur_monday = end - timedelta(days=end.weekday())
    weeks = []
    for i in range(count, 0, -1):
        mon = cur_monday - timedelta(days=7 * i)
        days = []
        for d in range(7):
            dt = (mon + timedelta(days=d)).isoformat()
            row = by_date.get(dt, {})
            day_acts = [a for a in acts if a["start"][:10] == dt]
            days.append({
                "date": dt, "steps": row.get("steps"), "sleep_score": row.get("sleep_score"),
                "sleep_h": r(row["sleep_dur"] / 3600, 1) if row.get("sleep_dur") else None, "rhr": row.get("rhr"),
                "stress": row.get("stress"), "hrv": row.get("hrv"),
                "acts": [{"label": a.get("label"), "dist_km": a.get("dist_km"), "dur": a.get("dur")} for a in day_acts],
            })
        wacts = [a for a in acts if days[0]["date"] <= a["start"][:10] <= days[6]["date"]]
        runs = [a for a in wacts if a["type"] in RUN_TYPES]
        bikes = [a for a in wacts if a["type"] in BIKE_TYPES]
        rounds = [a for a in wacts if a["type"] == "golf" and (a.get("dur") or 0) <= 36000 and ((a.get("dur") or 0) >= 7200 or (a.get("dist_km") or 0) >= 3)]
        z45 = [((a["z"][3] or 0) + (a["z"][4] or 0)) / 60 for a in wacts if a.get("z")]
        steps = [d["steps"] for d in days if d["steps"] is not None]
        m = {
            "sleep_score": r(mean([d["sleep_score"] for d in days]), 0), "sleep_h": r(mean([d["sleep_h"] for d in days]), 1),
            "nights": sum(1 for d in days if d["sleep_h"] is not None), "hrv": r(mean([d["hrv"] for d in days]), 0),
            "rhr": r(mean([d["rhr"] for d in days]), 0), "stress": r(mean([d["stress"] for d in days]), 0),
            "steps_avg": r(mean(steps), 0), "steps_days": len(steps),
            "im": sum(by_date.get(d["date"], {}).get("im") or 0 for d in days) if any(by_date.get(d["date"], {}).get("im") is not None for d in days) else None,
            "acts": len(wacts), "hours": r(sum(a.get("dur") or 0 for a in wacts) / 3600, 1),
            "run_km": r(sum(a.get("dist_km") or 0 for a in runs), 1), "runs": len(runs),
            "bike_km": r(sum(a.get("dist_km") or 0 for a in bikes), 1), "rounds": len(rounds),
            "z45": r(sum(z45), 0) if z45 else 0,
        }
        hl = []

        def best(key, icon, label, unit, digits, reverse=True):
            cand = [d for d in days if d.get(key) is not None]
            if cand:
                d = (max if reverse else min)(cand, key=lambda x: x[key])
                hl.append({"icon": icon, "label": label, "v": d[key], "unit": unit, "digits": digits, "date": d["date"]})
        best("sleep_score", "moon", "Beste Nacht (Schlaf-Score)", "", 0)
        best("steps", "footprints", "Aktivster Tag", "Schritte", 0)
        best("rhr", "heart", "Niedrigster Ruhepuls", "bpm", 0, reverse=False)
        if runs:
            lr = max(runs, key=lambda a: a["dist_km"] or 0)
            hl.append({"icon": "gauge", "label": "Längster Lauf", "v": lr["dist_km"], "unit": "km", "digits": 1, "date": lr["start"][:10]})
        if wacts:
            hl.append({"icon": "target", "label": f"Zone 4/5 (Ziel {goal} min)", "v": m["z45"], "unit": "min", "digits": 0, "date": None, "ok": m["z45"] >= goal})
        weeks.append({"start": days[0]["date"], "end": days[6]["date"], "m": m, "days": days, "highlights": hl,
                      "acts": [{"date": a["start"][:10], "label": a.get("label"), "dist_km": a.get("dist_km"), "dur": a.get("dur")} for a in sorted(wacts, key=lambda a: a["start"])]})
    return weeks
