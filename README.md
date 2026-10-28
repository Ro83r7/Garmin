# Garmin Dashboard

Privates, täglich aktualisiertes Trainings- und Gesundheits-Dashboard als statische Website
(Deutsch, ohne Backend, ohne Framework, ohne Tracker).

- `/` – Desktop-Ansicht mit Details (Übersicht, Herz und Erholung, Schlaf, Training, Körper)
- `/m/` – iPhone-Ansicht (Heute, Herz, Schlaf, Training), installierbar als Web-App

Telefone (Breite unter 700 px oder iPhone) werden automatisch auf `/m/` geleitet. In beiden Ansichten
gibt es einen Umschalt-Link, die Wahl wird im Browser gespeichert.

## So funktioniert es

```
GitHub Action (täglich 05:30 UTC)
  scripts/fetch_garmin.py  →  data/*.json        (Rohdaten, Upsert nach Datum)
  scripts/build.py         →  site/data/*.json   (Wochen, Mittel, Baselines, KPIs)
  Commit nach main (nur bei Änderung)
Cloudflare Pages veröffentlicht den Ordner site/ direkt aus dem Repo
```

- `fetch_garmin.py` nutzt nur die Python-Standardbibliothek. Erster Lauf: Historie ab `2026-01-01`
  (Aktivitäten ab `2025-01-01`, damit der Jahresvergleich ein Vorjahr hat). Danach werden täglich die
  letzten 14 Tage neu geholt.
- Fehlende Werte bleiben Lücken (`null`), nie `0`. Der heutige Teiltag fließt in keinen Mittelwert ein.
- Einstellungen: `config/settings.json` (HFmax, Intervall-Zielzone, Wochenziel Zone 4/5),
  Phasen in den Charts: `config/events.json`.
- Der „Stand“-Zeitpunkt ist der letzte erfolgreiche Abruf. Ist er älter als 36 Stunden, erscheint ein gelber Hinweis.
  Da sich dieser Zeitpunkt täglich ändert, entsteht jeden Tag ein Commit.

## Das musst du einmal selbst tun

1. **Pull Request mergen.** Der Zeitplan der Action läuft nur auf dem Standardzweig (`main`).
2. **Secret prüfen oder anlegen:** GitHub → Repo → Settings → Secrets and variables → Actions →
   *New repository secret*, Name `GARMIN_PERSONAL_API_KEY`, Wert = dein Garmin-Personal-API-Key.
   Der Key gehört nie in Dateien, Commits oder Issues.
3. **Cloudflare Pages mit dem Repo verbinden:** Workers & Pages → Create → Pages → Connect to Git →
   dieses Repo wählen. *Build command* leer lassen, *Build output directory* = `site`.
4. **Zugriffsschutz aktivieren:** Cloudflare Zero Trust → Access → Applications → Self-hosted, die
   Pages-Domain eintragen, Richtlinie „Allow“ nur für deine E-Mail-Adresse (Einmal-PIN).
   (Alternativ in den Pages-Einstellungen „Enable access policy“.) Die Web-App-Manifest-Datei wird mit
   Anmeldedaten geladen (`crossorigin="use-credentials"`), damit die Installation hinter Access funktioniert.
5. **Workflow einmal manuell starten:** Actions → „Tägliches Update“ → *Run workflow*.
   Beim ersten Lauf werden die Beispieldaten verworfen und die echte Historie geladen.
6. Falls in den Repo-Einstellungen (Settings → Actions → General → Workflow permissions) oder durch einen
   Branch-Schutz das Pushen der Action blockiert wird: *Read and write permissions* erlauben bzw. der Action
   das Pushen auf `main` gestatten.

### Optional: Deploy-Hook

Veröffentlicht Cloudflare nach dem Action-Commit nicht von selbst neu (normalerweise tut es das, weil der
Push ein Git-Ereignis ist), lege in Cloudflare Pages → Settings → Builds → *Deploy hooks* einen Hook an,
speichere die URL als Secret `CLOUDFLARE_DEPLOY_HOOK` und entferne die Kommentarzeichen beim letzten Schritt in
`.github/workflows/daily.yml`.

## Lokal ausprobieren

```bash
python3 scripts/make_sample_data.py   # 120 Tage Beispieldaten (Seite zeigt BEISPIELDATEN)
python3 scripts/build.py
python3 -m http.server 8000 --directory site
```

Dann `http://localhost:8000/` (Desktop) bzw. `/m/` öffnen. Echte Daten lokal holen:
`GARMIN_PERSONAL_API_KEY=… python3 scripts/fetch_garmin.py` (Key nur in der Shell setzen).

## Datenschutz

- `noindex` per Meta-Tag, `robots.txt` und `X-Robots-Tag` (`site/_headers`); das Repo bleibt privat.
- Keine CDN-Aufrufe zur Laufzeit, keine Tracker, keine Analytics. Icons sind als Inline-SVG eingebettet
  (Lucide, ISC-Lizenz, siehe `site/assets/ICONS-LICENSE.txt`).
- Auf jeder Seite steht der Hinweis „Keine medizinische Bewertung“. Ampeln vergleichen dich nur mit deiner
  eigenen Baseline (Ø der letzten 28 Tage), nie mit Normwerten.

## Berechnungen in Kürze

- **Veränderung:** letzter vollständiger Wert minus Mittel der 28 Tage davor (mindestens 7 Werte nötig).
- **Ampel:** Abweichung in Standardabweichungen der eigenen 28 Tage; grün „Im Rahmen/Besser“, gelb „Etwas schwächer“
  (ab 0,75 σ), rot „Deutlich schwächer“ (ab 1,5 σ). Immer mit Symbol und Text.
- **Intervall-Wochen:** Minuten in Zone 4 + 5 (`hrTimeInZone_4/5`) aller Aktivitäten, Woche Mo bis So.
- **Intensitätsminuten:** moderat + 2 × intensiv (wie bei Garmin), Woche Mo bis So.
