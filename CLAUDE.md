# Hinweise für Claude (Projekt Garmin-Dashboard)

## Dauerhafte Freigabe vom Eigentümer (Robert, 11.11.2026)

Wartung und Optimierung über die angebundenen MCP-Zugänge (Supabase-Projekt `speed-lab`, Cloudflare Worker `garmin`) darf Claude
**ohne Rückfrage ausführen**: Migrationen, Indizes, Sicherheits- und Performance-Hinweise umsetzen, Logs und Advisors prüfen,
Worker-Einstellungen anpassen. Danach kurz berichten, was geändert wurde und wie es geprüft wurde.

Weiterhin nicht ohne ausdrückliches Okay: Nutzerdaten löschen, Kosten verursachen (neue Projekte, kostenpflichtige Branches/Add-ons),
Secrets oder Zugangscodes im Klartext ausgeben oder speichern, Repo-Sichtbarkeit oder Zugriffsschutz ändern.
Änderungen an der Datenbank immer auch in `supabase/garmin.sql` nachziehen, damit ein erneutes Ausführen nichts zurücksetzt.

## Eckdaten

- Website: https://garmin.robert-sang.workers.dev/ (Cloudflare Worker `garmin`, liefert den Ordner `site/`)
- Daten: GitHub-Workflow `Tägliches Update` holt Garmin-Daten, baut `site/data`, schreibt nach Supabase (Schema `garmin`)
- Supabase-Zugriff nur über `public.garmin_ingest` (Schreibcode) und `public.garmin_read` (Lesecode); siehe README
- Mehr dazu in `README.md`
