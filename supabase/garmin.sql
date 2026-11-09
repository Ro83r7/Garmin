-- Garmin-Daten zentral in Supabase (einmal im SQL-Editor des Projekts ausführen, mehrfaches Ausführen ist unschädlich).
-- Aufbau wie bei Speed Lab / Fit Lab: kein Direktzugriff auf die Tabellen, Zugriff nur über zwei Funktionen und
-- einen langen geheimen Code. Die Tabellen liegen im Schema "garmin", das die REST-API nicht ausliefert.
--
-- Schritt 1: dieses Skript ausführen.
-- Schritt 2: zwei eigene, lange Zugangscodes wählen (je mindestens 24 Zeichen, z. B. aus einem Passwortmanager) und
--            EINMAL diese zwei Zeilen mit deinen Codes ausführen (Codes nicht in Dateien oder Chats speichern):
--
--   -- Schreibcode (nur für den GitHub-Workflow, darf schreiben und lesen):
--   insert into garmin.access(code_hash, can_write) values (encode(sha256(convert_to('DEIN-SCHREIBCODE', 'UTF8')), 'hex'), true);
--   -- Lesecode (für andere Apps, darf nur lesen):
--   insert into garmin.access(code_hash, can_write) values (encode(sha256(convert_to('DEIN-LESECODE', 'UTF8')), 'hex'), false);
--
-- Der Klartext steht nirgends in der Datenbank, nur der Hash. Der Schreibcode geht als GitHub-Secret SUPABASE_GARMIN_CODE
-- an den Workflow, der Lesecode an andere Apps (Funktion garmin_read). Einen Code entziehen:
--   delete from garmin.access where code_hash = encode(sha256(convert_to('DER-CODE', 'UTF8')), 'hex');

create schema if not exists garmin;

create table if not exists garmin.access (
  code_hash text primary key,
  can_write boolean not null default true,
  created_at timestamptz not null default now()
);
alter table garmin.access add column if not exists can_write boolean not null default true;

-- Tageswerte (Datum = Kalendertag, Zeitzone Europe/Berlin)
create table if not exists garmin.daily (
  date date primary key,
  resting_hr int,
  steps int,
  stress_avg int,
  intensity_moderate_min int,
  intensity_vigorous_min int,
  updated_at timestamptz not null default now()
);

-- Schlaf (Datum = Aufwachtag, Uhrzeiten als Orts-Wanduhrzeit ohne Zeitzone)
create table if not exists garmin.sleep (
  date date primary key,
  bed_local timestamp,
  wake_local timestamp,
  duration_s int,
  deep_s int,
  rem_s int,
  awake_s int,
  score int,
  updated_at timestamptz not null default now()
);

create table if not exists garmin.hrv (
  date date primary key,
  last_night_avg int,
  weekly_avg int,
  status text,
  baseline_low int,
  baseline_high int,
  updated_at timestamptz not null default now()
);

-- Aktivitäten (Laufdynamik nur bei Läufen mit passender Uhr oder passendem Sensor)
create table if not exists garmin.activities (
  id bigint primary key,
  type text,
  name text,
  start_local timestamp,
  distance_m numeric,
  duration_s numeric,
  moving_s numeric,
  avg_hr int,
  max_hr int,
  avg_speed_ms numeric,
  elevation_gain_m numeric,
  calories numeric,
  location text,
  cadence_spm numeric,
  ground_contact_ms numeric,
  vertical_osc_cm numeric,
  vertical_ratio_pct numeric,
  stride_length numeric,
  power_avg numeric,
  power_norm numeric,
  best_1km_s numeric,
  hr_zone_s_1 int, hr_zone_s_2 int, hr_zone_s_3 int, hr_zone_s_4 int, hr_zone_s_5 int,
  updated_at timestamptz not null default now()
);
create index if not exists activities_start_idx on garmin.activities (start_local);
create index if not exists activities_type_idx on garmin.activities (type);

create table if not exists garmin.weight (
  date date primary key,
  kg numeric,
  bmi numeric,
  updated_at timestamptz not null default now()
);

create table if not exists garmin.fitness_age (
  date date primary key,
  fitness_age numeric,
  achievable_age numeric,
  chronological_age numeric,
  components jsonb,
  updated_at timestamptz not null default now()
);

-- Sicherheit: kein Zugriff über die API-Rollen, nur über die Funktionen unten
alter table garmin.access enable row level security;
alter table garmin.daily enable row level security;
alter table garmin.sleep enable row level security;
alter table garmin.hrv enable row level security;
alter table garmin.activities enable row level security;
alter table garmin.weight enable row level security;
alter table garmin.fitness_age enable row level security;
revoke all on schema garmin from public, anon, authenticated;
revoke all on all tables in schema garmin from public, anon, authenticated;

drop function if exists garmin.check_code(text);
create or replace function garmin.check_code(p_code text, p_write boolean default false)
returns boolean language sql stable security definer set search_path = garmin, public as $$
  select length(coalesce(p_code, '')) >= 24
     and exists (select 1 from garmin.access
                 where code_hash = encode(sha256(convert_to(p_code, 'UTF8')), 'hex') and (not p_write or can_write));
$$;

-- Schreiben: p_table = daily | sleep | hrv | activities | weight | fitness_age, p_rows = JSON-Array mit den Spaltennamen
create or replace function public.garmin_ingest(p_code text, p_table text, p_rows jsonb)
returns integer language plpgsql security definer set search_path = garmin, public as $$
declare n integer := 0;
begin
  if not garmin.check_code(p_code, true) then raise exception 'access denied'; end if;
  if jsonb_typeof(p_rows) <> 'array' then raise exception 'rows must be an array'; end if;
  if octet_length(p_rows::text) > 5000000 then raise exception 'data too large'; end if;

  if p_table = 'daily' then
    insert into garmin.daily(date, resting_hr, steps, stress_avg, intensity_moderate_min, intensity_vigorous_min)
    select date, resting_hr, steps, stress_avg, intensity_moderate_min, intensity_vigorous_min
    from jsonb_to_recordset(p_rows) as x(date date, resting_hr int, steps int, stress_avg int, intensity_moderate_min int, intensity_vigorous_min int)
    on conflict (date) do update set resting_hr = excluded.resting_hr, steps = excluded.steps, stress_avg = excluded.stress_avg,
      intensity_moderate_min = excluded.intensity_moderate_min, intensity_vigorous_min = excluded.intensity_vigorous_min, updated_at = now();
  elsif p_table = 'sleep' then
    insert into garmin.sleep(date, bed_local, wake_local, duration_s, deep_s, rem_s, awake_s, score)
    select date, bed_local, wake_local, duration_s, deep_s, rem_s, awake_s, score
    from jsonb_to_recordset(p_rows) as x(date date, bed_local timestamp, wake_local timestamp, duration_s int, deep_s int, rem_s int, awake_s int, score int)
    on conflict (date) do update set bed_local = excluded.bed_local, wake_local = excluded.wake_local, duration_s = excluded.duration_s,
      deep_s = excluded.deep_s, rem_s = excluded.rem_s, awake_s = excluded.awake_s, score = excluded.score, updated_at = now();
  elsif p_table = 'hrv' then
    insert into garmin.hrv(date, last_night_avg, weekly_avg, status, baseline_low, baseline_high)
    select date, last_night_avg, weekly_avg, status, baseline_low, baseline_high
    from jsonb_to_recordset(p_rows) as x(date date, last_night_avg int, weekly_avg int, status text, baseline_low int, baseline_high int)
    on conflict (date) do update set last_night_avg = excluded.last_night_avg, weekly_avg = excluded.weekly_avg, status = excluded.status,
      baseline_low = excluded.baseline_low, baseline_high = excluded.baseline_high, updated_at = now();
  elsif p_table = 'activities' then
    insert into garmin.activities(id, type, name, start_local, distance_m, duration_s, moving_s, avg_hr, max_hr, avg_speed_ms, elevation_gain_m,
      calories, location, cadence_spm, ground_contact_ms, vertical_osc_cm, vertical_ratio_pct, stride_length, power_avg, power_norm, best_1km_s,
      hr_zone_s_1, hr_zone_s_2, hr_zone_s_3, hr_zone_s_4, hr_zone_s_5)
    select id, type, name, start_local, distance_m, duration_s, moving_s, avg_hr, max_hr, avg_speed_ms, elevation_gain_m,
      calories, location, cadence_spm, ground_contact_ms, vertical_osc_cm, vertical_ratio_pct, stride_length, power_avg, power_norm, best_1km_s,
      hr_zone_s_1, hr_zone_s_2, hr_zone_s_3, hr_zone_s_4, hr_zone_s_5
    from jsonb_to_recordset(p_rows) as x(id bigint, type text, name text, start_local timestamp, distance_m numeric, duration_s numeric, moving_s numeric,
      avg_hr int, max_hr int, avg_speed_ms numeric, elevation_gain_m numeric, calories numeric, location text, cadence_spm numeric,
      ground_contact_ms numeric, vertical_osc_cm numeric, vertical_ratio_pct numeric, stride_length numeric, power_avg numeric, power_norm numeric,
      best_1km_s numeric, hr_zone_s_1 int, hr_zone_s_2 int, hr_zone_s_3 int, hr_zone_s_4 int, hr_zone_s_5 int)
    on conflict (id) do update set type = excluded.type, name = excluded.name, start_local = excluded.start_local, distance_m = excluded.distance_m,
      duration_s = excluded.duration_s, moving_s = excluded.moving_s, avg_hr = excluded.avg_hr, max_hr = excluded.max_hr,
      avg_speed_ms = excluded.avg_speed_ms, elevation_gain_m = excluded.elevation_gain_m, calories = excluded.calories, location = excluded.location,
      cadence_spm = excluded.cadence_spm, ground_contact_ms = excluded.ground_contact_ms, vertical_osc_cm = excluded.vertical_osc_cm,
      vertical_ratio_pct = excluded.vertical_ratio_pct, stride_length = excluded.stride_length, power_avg = excluded.power_avg,
      power_norm = excluded.power_norm, best_1km_s = excluded.best_1km_s, hr_zone_s_1 = excluded.hr_zone_s_1, hr_zone_s_2 = excluded.hr_zone_s_2,
      hr_zone_s_3 = excluded.hr_zone_s_3, hr_zone_s_4 = excluded.hr_zone_s_4, hr_zone_s_5 = excluded.hr_zone_s_5, updated_at = now();
  elsif p_table = 'weight' then
    insert into garmin.weight(date, kg, bmi)
    select date, kg, bmi from jsonb_to_recordset(p_rows) as x(date date, kg numeric, bmi numeric)
    on conflict (date) do update set kg = excluded.kg, bmi = excluded.bmi, updated_at = now();
  elsif p_table = 'fitness_age' then
    insert into garmin.fitness_age(date, fitness_age, achievable_age, chronological_age, components)
    select date, fitness_age, achievable_age, chronological_age, components
    from jsonb_to_recordset(p_rows) as x(date date, fitness_age numeric, achievable_age numeric, chronological_age numeric, components jsonb)
    on conflict (date) do update set fitness_age = excluded.fitness_age, achievable_age = excluded.achievable_age,
      chronological_age = excluded.chronological_age, components = excluded.components, updated_at = now();
  else
    raise exception 'unknown table %', p_table;
  end if;
  get diagnostics n = row_count;
  return n;
end $$;

-- Lesen für andere Apps: p_since optional (Datum bzw. Startdatum der Aktivität), Ergebnis als JSON-Array
create or replace function public.garmin_read(p_code text, p_table text, p_since date default null)
returns jsonb language plpgsql security definer set search_path = garmin, public as $$
declare res jsonb;
begin
  if not garmin.check_code(p_code) then raise exception 'access denied'; end if;
  if p_table = 'daily' then
    select coalesce(jsonb_agg(to_jsonb(t) order by t.date), '[]') into res from garmin.daily t where p_since is null or t.date >= p_since;
  elsif p_table = 'sleep' then
    select coalesce(jsonb_agg(to_jsonb(t) order by t.date), '[]') into res from garmin.sleep t where p_since is null or t.date >= p_since;
  elsif p_table = 'hrv' then
    select coalesce(jsonb_agg(to_jsonb(t) order by t.date), '[]') into res from garmin.hrv t where p_since is null or t.date >= p_since;
  elsif p_table = 'activities' then
    select coalesce(jsonb_agg(to_jsonb(t) order by t.start_local), '[]') into res from garmin.activities t where p_since is null or t.start_local >= p_since;
  elsif p_table = 'weight' then
    select coalesce(jsonb_agg(to_jsonb(t) order by t.date), '[]') into res from garmin.weight t where p_since is null or t.date >= p_since;
  elsif p_table = 'fitness_age' then
    select coalesce(jsonb_agg(to_jsonb(t) order by t.date), '[]') into res from garmin.fitness_age t where p_since is null or t.date >= p_since;
  else
    raise exception 'unknown table %', p_table;
  end if;
  return res;
end $$;

revoke all on function public.garmin_ingest(text, text, jsonb), public.garmin_read(text, text, date) from public;
grant execute on function public.garmin_ingest(text, text, jsonb), public.garmin_read(text, text, date) to anon;
