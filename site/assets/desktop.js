(function () {
  'use strict';
  var VIEWS = [
    { id: 'uebersicht', label: 'Übersicht', icon: 'dashboard', area: 'steps', title: 'Übersicht' },
    { id: 'herz', label: 'Herz und Erholung', icon: 'heartpulse', area: 'heart', title: 'Herz und Erholung' },
    { id: 'schlaf', label: 'Schlaf', icon: 'moon', area: 'sleep', title: 'Schlaf' },
    { id: 'training', label: 'Training', icon: 'route', area: 'train', title: 'Training' },
    { id: 'laufen', label: 'Laufen', icon: 'gauge', area: 'run', title: 'Laufen' },
    { id: 'rad', label: 'Radfahren', icon: 'bike', area: 'bike', title: 'Radfahren' },
    { id: 'golf', label: 'Golf', icon: 'flag', area: 'golf', title: 'Golf' },
    { id: 'koerper', label: 'Körper', icon: 'scale', area: 'fit', title: 'Körper' }
  ];
  var RANGES = [30, 90, 180, 365, 0];
  var D = null, state = { view: 'uebersicht', range: 90 };
  var $ = function (id) { return document.getElementById(id); };
  var C = function (n) { return 'var(--' + n + ')'; };

  document.getElementById('brand-icon').innerHTML = G.icon('heartpulse');
  document.getElementById('foot-icon').innerHTML = G.icon('info');
  $('to-mobile').innerHTML = G.icon('phone') + 'Mobile Ansicht';
  $('to-mobile').addEventListener('click', function () { G.store.set('garmin-view', 'mobile'); });
  $('nav').innerHTML = VIEWS.map(function (v) {
    return '<a href="#' + v.id + '" data-v="' + v.id + '" class="c-' + v.area + '">' + G.chip(v.icon, v.area) + v.label + '</a>';
  }).join('');
  $('range').innerHTML = RANGES.map(function (r) {
    return '<button type="button" data-r="' + r + '" aria-pressed="false">' + (r ? r + ' Tage' : 'Alles') + '</button>';
  }).join('');
  var saved = parseInt(G.store.get('garmin-range'), 10);
  if (RANGES.indexOf(saved) >= 0) state.range = saved;

  function start() {
    if (!state.range) return D.meta.first;
    var s = G.addDays(D.meta.today, -(state.range - 1));
    return s < D.meta.first ? D.meta.first : s;
  }
  function daily() { return G.inRange(D.daily, start()); }
  function weeks() { return G.inRange(D.weeks, G.addDays(start(), -6)); }
  function ev() { return D.meta.events; }
  function x0() { return start(); }
  function x1() { return D.meta.today; }
  function card(cls, html) { return '<div class="card ' + (cls || '') + '">' + html + '</div>'; }
  function head(icon, area, title, sub) {
    return '<h2 class="c-' + area + '">' + G.chip(icon, area) + title + '</h2>' + (sub ? '<p class="sub">' + sub + '</p>' : '<p class="sub"></p>');
  }
  function area(id, h) { return '<div id="' + id + '" role="figure"></div>'; }
  function kpiVal(k) {
    if (k.value == null) return '–';
    return (k.key === 'longevity' && k.value > 0 ? '+' : '') + G.num(k.value, k.digits || 0);
  }

  /* ---------- Übersicht ---------- */
  var KP = {
    rhr: ['heart', 'heart'], hrv: ['activity', 'hrv'], sleep_score: ['moon', 'sleep'], sleep_dur: ['bed', 'sleep'],
    stress: ['zap', 'stress'], steps: ['footprints', 'steps'], fitness_age: ['hourglass', 'fit'], im_week: ['timer', 'train'],
    vo2: ['wind', 'fit'], longevity: ['trending', 'fit']
  };
  function arrow(d, good) {
    if (d == null || d === 0) return G.icon('right');
    return G.icon(d > 0 ? 'up' : 'down');
  }
  function renderOverview() {
    var k = D.kpi, h = '<div class="grid kpis">';
    k.kpis.forEach(function (x) {
      var m = KP[x.key], d = x.delta, dg = x.digits || 0;
      var dtxt = d == null ? 'keine Baseline (zu wenige Werte)' : G.signed(d, dg) + (x.unit ? ' ' + x.unit : '') + ' <span class="muted">vs. Ø ' + G.num(x.base, dg) + '</span>';
      h += card('kpi c-' + m[1],
        '<div class="head">' + G.chip(m[0], m[1]) + x.label + '</div>' +
        '<div class="val">' + kpiVal(x) + '<small>' + (x.value == null ? '' : x.unit) + '</small>' + G.altBadge(x) + '</div>' +
        '<div class="delta">' + (d == null ? G.icon('info') : arrow(d, x.good)) + '<span><b>' + dtxt + '</b></span></div>' +
        '<div class="foot2"><span class="muted" style="font-size:.8125rem">' + (x.date ? (x.key === 'im_week' ? 'Woche ab ' : '') + G.fmtDate(x.date) : 'keine Daten') + '</span>' + G.spark(x.spark, 'currentColor') + '</div>');
    });
    h += '</div><div class="grid cols2">';
    var z = k.z45, pct = z.value == null ? 0 : Math.min(100, z.value / z.goal * 100);
    h += card('c-train', head('target', 'train', 'Wochenziel Zone 4/5', 'Minuten in Herzfrequenzzone 4 und 5, Woche Mo bis So') +
      '<div class="kpi"><div class="val">' + G.num(z.value, 0) + '<small>von ' + z.goal + ' min</small></div></div>' +
      '<div class="progress" role="progressbar" aria-valuemin="0" aria-valuemax="' + z.goal + '" aria-valuenow="' + (z.value || 0) + '"><i style="width:' + pct + '%"></i></div>' +
      (z.status ? G.pill(z.status) : '') +
      '<div class="facts"><div class="fact"><div class="l">HFmax</div><div class="v">' + D.meta.settings.hfmax + ' bpm</div></div>' +
      '<div class="fact"><div class="l">Intervall-Zielzone</div><div class="v">' + D.meta.settings.zone.von + '–' + D.meta.settings.zone.bis + ' bpm</div></div></div>');
    var last = D.acts.slice(0, 5);
    h += card('c-train', head('route', 'train', 'Letzte Aktivitäten') + '<div>' + last.map(function (a) {
      return '<div style="display:flex;justify-content:space-between;gap:12px;padding:8px 0;border-bottom:1px solid var(--border)"><span><b>' + a.label + '</b> <span class="muted">' + G.wd(a.date) + ' ' + G.fmtDate(a.date) + '</span></span><span>' + (a.dist_km ? G.num(a.dist_km, 1) + ' km · ' : '') + G.dur(a.dur) + '</span></div>';
    }).join('') + '</div>');
    h += '</div>';
    $('v-uebersicht').innerHTML = h;
  }

  /* ---------- Herz und Erholung ---------- */
  function renderHeart() {
    var h = '<div class="grid">';
    h += card('', head('heart', 'heart', 'Ruhepuls', 'Täglich mit 7-Tage-Mittel (nur wenn mindestens 4 von 7 Tagen Werte haben)') + area('ch-rhr') +
      G.legend([{ color: C('heart'), label: 'Ruhepuls täglich' }, { color: C('heart'), label: '7-Tage-Mittel' }]));
    h += card('', head('activity', 'hrv', 'HRV nächtlich', 'Nächtlicher Mittelwert mit deinem Garmin-Baseline-Band') + area('ch-hrv') +
      G.legend([{ color: C('hrv'), label: 'HRV Nacht' }, { color: C('hrv'), label: 'Baseline-Band', box: true }]));
    h += card('', head('zap', 'stress', 'Stress', 'Durchschnittlicher Tages-Stresslevel') + area('ch-stress') +
      G.legend([{ color: C('stress'), label: 'Stress täglich' }, { color: C('stress'), label: '7-Tage-Mittel' }]));
    h += '</div>';
    $('v-herz').innerHTML = h;
  }
  function drawHeart() {
    var r = daily(), base = { rows: r, x0: x0(), x1: x1(), events: ev(), height: 240 };
    G.chart($('ch-rhr'), Object.assign({}, base, { aria: 'Ruhepuls', yfmt: function (v) { return G.num(v); }, series: [
      { key: 'rhr', kind: 'dots', color: C('heart'), label: 'Ruhepuls', fmt: function (v) { return v + ' bpm'; } },
      { key: 'rhr7', kind: 'line', color: C('heart'), label: '7-Tage-Mittel', fmt: function (v) { return G.num(v, 1) + ' bpm'; }, dots: false, width: 2.6 }] }));
    G.chart($('ch-hrv'), Object.assign({}, base, { aria: 'HRV', band: { lo: 'hrv_low', hi: 'hrv_high', color: C('hrv') }, series: [
      { key: 'hrv', kind: 'line', color: C('hrv'), label: 'HRV Nacht', fmt: function (v) { return v + ' ms'; } }],
      tip: function (x) {
        return '<b>' + G.wd(x.date) + ' ' + G.fmtDate(x.date) + '</b><div class="row"><span>HRV Nacht</span><span>' + (x.hrv == null ? '–' : x.hrv + ' ms') + '</span></div>' +
          '<div class="row"><span>Baseline</span><span>' + (x.hrv_low == null ? '–' : x.hrv_low + '–' + x.hrv_high) + '</span></div>' +
          '<div class="row"><span>7-Tage-Schnitt</span><span>' + (x.hrv_weekly == null ? '–' : x.hrv_weekly + ' ms') + '</span></div>';
      } }));
    G.chart($('ch-stress'), Object.assign({}, base, { aria: 'Stress', series: [
      { key: 'stress', kind: 'dots', color: C('stress'), label: 'Stress', fmt: function (v) { return G.num(v); } },
      { key: 'stress7', kind: 'line', color: C('stress'), label: '7-Tage-Mittel', fmt: function (v) { return G.num(v, 1); }, dots: false, width: 2.6 }] }));
  }

  /* ---------- Schlaf ---------- */
  function renderSleep() {
    var h = '<div class="grid">';
    h += card('', head('bed', 'sleep', 'Bett- und Aufwachzeit', 'Jede Nacht als Balken vom Einschlafen bis zum Aufwachen (Datum = Aufwachtag)') + area('ch-night'));
    h += '<div class="grid cols2">' + card('', head('moon', 'sleep', 'Schlafdauer', 'Reiner Schlaf in Stunden') + area('ch-dur')) +
      card('', head('moon', 'sleep', 'Schlaf-Score') + area('ch-score')) + '</div>';
    h += card('', head('moon', 'sleep', 'Nächte als Tabelle') + '<div id="tb-sleep"></div>');
    h += '</div>';
    $('v-schlaf').innerHTML = h;
  }
  function sleepRange(r) {
    var a = r.map(function (x) { return x.bed_min; }).filter(function (v) { return v != null; }), b = r.map(function (x) { return x.wake_min; }).filter(function (v) { return v != null; });
    var lo = a.length ? Math.floor((Math.min.apply(null, a) - 30) / 120) * 120 : 0, hi = b.length ? Math.ceil((Math.max.apply(null, b) + 30) / 120) * 120 : 1200, t = [];
    for (var v = lo; v <= hi; v += 120) t.push(v);
    return { y: [lo, hi], ticks: t };
  }
  function drawSleep() {
    var r = daily();
    G.chart($('ch-night'), { rows: r, x0: x0(), x1: x1(), events: ev(), height: 280, ml: 48, aria: 'Bett- und Aufwachzeit',
      y: sleepRange(r).y, yTicks: sleepRange(r).ticks, yfmt: function (v) { return G.hm(v + 720); },
      series: [{ kind: 'float', lo: 'bed_min', hi: 'wake_min', key: 'bed_min', color: C('sleep'), label: 'Schlafenszeit' }],
      tip: function (x) { return '<b>' + G.wd(x.date) + ' ' + G.fmtDate(x.date) + '</b><div class="row"><span>Bett</span><span>' + G.time(x.bed) + '</span></div><div class="row"><span>Aufwachen</span><span>' + G.time(x.wake) + '</span></div><div class="row"><span>Schlaf</span><span>' + G.dur(x.sleep_dur) + '</span></div>'; } });
    var rh = r.map(function (x) { return Object.assign({}, x, { dur_h: x.sleep_dur == null ? null : x.sleep_dur / 3600, dur7_h: x.sleep_dur7 == null ? null : x.sleep_dur7 / 3600 }); });
    G.chart($('ch-dur'), { rows: rh, x0: x0(), x1: x1(), events: ev(), height: 220, aria: 'Schlafdauer', refs: [{ y: 7, label: '7 h' }],
      series: [{ key: 'dur_h', kind: 'dots', color: C('sleep'), label: 'Schlafdauer', fmt: function (v) { return G.num(v, 1) + ' h'; } },
        { key: 'dur7_h', kind: 'line', color: C('sleep'), label: '7-Tage-Mittel', fmt: function (v) { return G.num(v, 1) + ' h'; }, dots: false }] });
    G.chart($('ch-score'), { rows: r, x0: x0(), x1: x1(), events: ev(), height: 220, aria: 'Schlaf-Score', y: [0, 100],
      series: [{ key: 'sleep_score', kind: 'dots', color: C('sleep'), label: 'Score', fmt: function (v) { return G.num(v); } },
        { key: 'sleep_score7', kind: 'line', color: C('sleep'), label: '7-Tage-Mittel', fmt: function (v) { return G.num(v, 1); }, dots: false }] });
    var rows = r.filter(function (x) { return x.sleep_dur != null; });
    G.table($('tb-sleep'), { rows: rows, search: true, sortKey: 'date', sortDir: -1, cols: [
      { key: 'date', label: 'Datum', text: function (x) { return G.wd(x.date) + ' ' + G.fmtDate(x.date); } },
      { key: 'bed', label: 'Bett', text: function (x) { return G.time(x.bed); } },
      { key: 'wake', label: 'Aufwachen', text: function (x) { return G.time(x.wake); } },
      { key: 'sleep_dur', label: 'Dauer', num: 1, text: function (x) { return G.dur(x.sleep_dur); } },
      { key: 'awake', label: 'Wach', num: 1, text: function (x) { return x.awake == null ? '–' : G.num(x.awake / 60, 0) + ' min'; } },
      { key: 'deep', label: 'Tiefschlaf', num: 1, text: function (x) { return x.deep == null ? '–' : G.num(x.deep / 60, 0) + ' min'; } },
      { key: 'rem', label: 'REM', num: 1, text: function (x) { return x.rem == null ? '–' : G.num(x.rem / 60, 0) + ' min'; } },
      { key: 'sleep_score', label: 'Score', num: 1, text: function (x) { return x.sleep_score == null ? '–' : x.sleep_score; } }] });
  }

  /* ---------- Training ---------- */
  function renderTraining() {
    var y = D.year, s = D.meta.settings;
    var h = '<div class="grid">';
    h += card('', head('target', 'train', 'Intervall-Wochen', 'Minuten in Zone 4 und 5 pro Woche (Mo bis So). Gestrichelt = laufende Woche. Ziel: ' + s.goal + ' min.') + area('ch-z45') +
      G.legend([{ color: C('train'), label: 'Zone 4+5 Minuten' }, { color: C('muted'), label: 'Wochenziel' }]) +
      '<p class="sub" style="margin-top:8px">HFmax ' + s.hfmax + ' bpm · Intervall-Zielzone ' + s.zone.von + '–' + s.zone.bis + ' bpm</p>');
    h += '<div class="grid cols2">' + card('', head('route', 'train', 'Wochenumfang Laufen', 'Kilometer pro Woche (alle Laufarten)') + area('ch-km')) +
      card('', head('calendar', 'train', 'Jahresvergleich bis ' + y.upto, 'Kumulierte Laufkilometer ' + y.year + ' gegen ' + y.prev_year) + area('ch-year') +
        G.legend([{ color: C('train'), label: String(y.year) }, { color: C('muted'), label: String(y.prev_year) }]) +
        '<div class="facts"><div class="fact"><div class="l">' + y.year + '</div><div class="v">' + y.cur.runs + ' Läufe</div><div class="d">' + G.num(y.cur.km, 1) + ' km</div></div>' +
        '<div class="fact"><div class="l">' + y.prev_year + '</div><div class="v">' + (y.prev_complete ? y.prev.runs + ' Läufe' : '–') + '</div><div class="d">' + (y.prev_complete ? G.num(y.prev.km, 1) + ' km' : 'Vorjahr nicht geladen') + '</div></div></div>') + '</div>';
    h += card('', head('timer', 'train', 'Aktivitäten') + G.zoneLegend() + '<div id="tb-act" style="margin-top:10px"></div>');
    h += '</div>';
    $('v-training').innerHTML = h;
  }
  function drawTraining() {
    var w = weeks(), s = D.meta.settings, y = D.year;
    G.chart($('ch-z45'), { rows: w, x0: w.length ? w[0].date : x0(), x1: w.length ? w[w.length - 1].date : x1(), step: 7, height: 260, events: [], aria: 'Zone-4-und-5-Minuten pro Woche',
      refs: [{ y: s.goal, label: 'Ziel ' + s.goal + ' min', color: C('muted') }],
      series: [{ key: 'z45', kind: 'bar', color: C('train'), label: 'Zone 4+5', partialKey: 'partial', fmt: function (v) { return G.num(v, 0) + ' min'; } }],
      tip: function (x) { return '<b>Woche ab ' + G.fmtDate(x.date) + (x.partial ? ' (läuft)' : '') + '</b><div class="row"><span>Zone 4</span><span>' + G.num(x.z4, 0) + ' min</span></div><div class="row"><span>Zone 5</span><span>' + G.num(x.z5, 0) + ' min</span></div><div class="row"><span>Summe</span><span>' + G.num(x.z45, 0) + ' min</span></div>'; } });
    G.chart($('ch-km'), { rows: w, x0: w.length ? w[0].date : x0(), x1: w.length ? w[w.length - 1].date : x1(), step: 7, height: 240, aria: 'Laufkilometer pro Woche',
      series: [{ key: 'run_km', kind: 'bar', color: C('train'), label: 'Laufen', partialKey: 'partial', fmt: function (v) { return G.num(v, 1) + ' km'; } }],
      tip: function (x) { return '<b>Woche ab ' + G.fmtDate(x.date) + (x.partial ? ' (läuft)' : '') + '</b><div class="row"><span>Distanz</span><span>' + G.num(x.run_km, 1) + ' km</span></div><div class="row"><span>Läufe</span><span>' + G.num(x.runs) + '</span></div>'; } });
    // Jahresvergleich: Tag im Jahr -> Pseudodatum im aktuellen Jahr
    var base = y.year + '-01-01', mk = function (series, key) {
      series.forEach(function (p) { var d = G.addDays(base, p[0] - 1); (map[d] = map[d] || { date: d })[key] = p[1]; });
    }, map = {};
    mk(y.cur.series, 'cur'); if (y.prev_complete) mk(y.prev.series, 'prev');
    var yr = Object.keys(map).sort().map(function (k) { return map[k]; });
    G.chart($('ch-year'), { rows: yr, x0: base, x1: yr.length ? yr[yr.length - 1].date : base, height: 240, aria: 'Kumulierte Laufkilometer im Jahresvergleich', y: [0, null],
      series: [{ key: 'prev', kind: 'line', color: C('muted'), label: String(y.prev_year), dots: false, fmt: function (v) { return G.num(v, 0) + ' km'; } },
        { key: 'cur', kind: 'line', color: C('train'), label: String(y.year), dots: false, width: 2.8, fmt: function (v) { return G.num(v, 0) + ' km'; } }] });
    var rs = start(), acts = D.acts.filter(function (a) { return a.date >= rs; });
    G.table($('tb-act'), { rows: acts, search: true, sortKey: 'start', sortDir: -1, cols: [
      { key: 'label', label: 'Typ', html: function (a) { return '<b>' + a.label + '</b>'; }, text: function (a) { return a.label; } },
      { key: 'start', label: 'Datum', text: function (a) { return G.wd(a.date) + ' ' + G.fmtDate(a.date) + ' ' + a.start.slice(11, 16); } },
      { key: 'dur', label: 'Dauer', num: 1, text: function (a) { return G.dur(a.dur); } },
      { key: 'dist_km', label: 'Distanz', num: 1, text: function (a) { return a.dist_km ? G.num(a.dist_km, 1) + ' km' : '–'; } },
      { key: 'avg_hr', label: 'Ø-HF', num: 1, text: function (a) { return a.avg_hr == null ? '–' : a.avg_hr; } },
      { key: 'max_hr', label: 'Max-HF', num: 1, text: function (a) { return a.max_hr == null ? '–' : a.max_hr; } },
      { key: 'z45', label: 'Z4+5', num: 1, text: function (a) { return a.z45 == null ? '–' : G.num(a.z45, 0) + ' min'; } },
      { key: 'z', label: 'Zonen', sort: function (a) { return a.z45; }, html: function (a) { return G.zonebar(a.z); }, text: function (a) { return ''; } }] });
  }

  /* ---------- Körper ---------- */
  function renderBody() {
    var b = D.body, h = '<div class="grid">';
    h += '<div class="grid cols2">' + card('', head('scale', 'fit', 'Gewicht', 'Einzelne Wägungen, Lücken bleiben Lücken') + area('ch-weight')) +
      card('', head('scale', 'fit', 'BMI') + area('ch-bmi')) + '</div>';
    h += '<div class="grid cols2">' + card('', head('wind', 'fit', 'VO2max', 'Nach Uth: 15,3 × HFmax ÷ Ruhepuls (Mittel der 28 Tage davor), in ml/kg/min') + area('ch-vo2')) +
      card('', head('trending', 'fit', 'Longevity+', 'Kalenderalter minus Fitness-Alter in Jahren. Positiv heißt: dein Fitness-Alter liegt unter deinem Kalenderalter.') + area('ch-lon')) + '</div>';
    h += '<div class="grid cols2">' + card('', head('hourglass', 'fit', 'Fitness-Alter', 'Wert von Garmin (kleiner ist besser), gestrichelt = erreichbares Fitness-Alter') + area('ch-fit') +
      G.legend([{ color: C('fit'), label: 'Fitness-Alter' }, { color: C('fit'), label: 'Erreichbar' }])) +
      card('', head('hourglass', 'fit', 'Komponenten') + '<div id="fit-comp"></div>') + '</div>';
    h += '</div>';
    $('v-koerper').innerHTML = h;
  }
  function drawBody() {
    var b = D.body, rs = start(), w = b.weight.filter(function (x) { return x.date >= rs; }), f = b.fitness.filter(function (x) { return x.date >= rs; });
    G.chart($('ch-weight'), { rows: w, x0: x0(), x1: x1(), events: ev(), height: 230, aria: 'Gewicht',
      series: [{ key: 'kg', kind: 'line', color: C('fit'), label: 'Gewicht', fmt: function (v) { return G.num(v, 1) + ' kg'; } }] });
    G.chart($('ch-bmi'), { rows: w, x0: x0(), x1: x1(), events: ev(), height: 230, aria: 'BMI',
      series: [{ key: 'bmi', kind: 'line', color: C('fit'), label: 'BMI', fmt: function (v) { return G.num(v, 1); } }] });
    G.chart($('ch-fit'), { rows: f, x0: x0(), x1: x1(), events: ev(), height: 230, aria: 'Fitness-Alter',
      series: [{ key: 'achievable', kind: 'line', color: C('fit'), label: 'Erreichbar', dash: '5 4', width: 1.8, dots: false, fmt: function (v) { return G.num(v, 1) + ' Jahre'; } },
        { key: 'age', kind: 'line', color: C('fit'), label: 'Fitness-Alter', fmt: function (v) { return G.num(v, 1) + ' Jahre'; } }] });
    var vr = daily().filter(function (x) { return x.vo2 != null; });
    G.chart($('ch-vo2'), { rows: vr, x0: x0(), x1: x1(), events: ev(), height: 230, aria: 'VO2max',
      series: [{ key: 'vo2', kind: 'line', color: C('fit'), label: 'VO2max', fmt: function (v) { return G.num(v, 1) + ' ml/kg/min'; } }] });
    G.chart($('ch-lon'), { rows: f, x0: x0(), x1: x1(), events: ev(), height: 230, aria: 'Longevity+', refs: [{ y: 0, label: 'Kalenderalter' }],
      series: [{ key: 'longevity', kind: 'line', color: C('fit'), label: 'Longevity+', fmt: function (v) { return (v > 0 ? '+' : '') + G.num(v, 1) + ' Jahre'; } }] });
    var lf = b.fitness.length ? b.fitness[b.fitness.length - 1] : null;
    var comp = b.components;
    $('fit-comp').innerHTML = !lf ? '<div class="empty">Noch keine Fitness-Alter-Daten</div>' :
      '<div class="facts"><div class="fact"><div class="l">Fitness-Alter</div><div class="v">' + G.num(lf.age, 1) + '</div><div class="d">Stand ' + G.fmtDate(lf.date) + '</div></div>' +
      '<div class="fact"><div class="l">Erreichbar</div><div class="v">' + G.num(lf.achievable, 1) + '</div></div>' +
      (lf.chrono != null ? '<div class="fact"><div class="l">Kalendarisch</div><div class="v">' + G.num(lf.chrono, 0) + '</div></div>' : '') + '</div>' +
      (comp.length ? '<div class="facts">' + comp.map(function (c) {
        return '<div class="fact"><div class="l">' + c.label + '</div><div class="v">' + G.num(c.value, 1) + '</div><div class="d">' + (c.target != null ? 'Ziel ' + G.num(c.target, 1) : '&nbsp;') + '</div></div>';
      }).join('') + '</div>' : '');
  }


  /* ---------- Laufen, Radfahren, Golf ---------- */
  function mmss(sec) { return sec == null ? '–' : Math.floor(sec / 60) + ':' + String(Math.round(sec % 60)).padStart(2, '0'); }
  function tipList(tips) {
    return '<ul class="tips">' + tips.map(function (t) {
      return '<li class="' + t.level + '">' + G.icon(t.level === 'good' ? 'check' : t.level === 'warn' ? 'alert' : 'info') + '<div><b>' + t.title + '</b>' + t.text + '</div></li>';
    }).join('') + '</ul><p class="note" style="margin:10px 0 0">Orientierung aus deinen eigenen Daten und groben Richtwerten, keine Trainings- oder medizinische Beratung.</p>';
  }
  /* m: [label, key, unit, digits, lowerBetter, formatter] */
  function statTiles(sum, defs, area) {
    return '<div class="grid kpis dyn">' + defs.map(function (m) {
      var cur = sum[m[1]], prev = sum[m[1] + '_prev'], d = cur != null && prev != null ? cur - prev : null, f = m[5] || function (v) { return G.num(v, m[3]); };
      var dtxt = d == null ? 'kein Vergleich' : (Math.abs(d) < Math.pow(10, -(m[3] || 0)) / 2 ? '±0' : (d > 0 ? '+' : '−') + (m[5] ? f(Math.abs(d)) : G.num(Math.abs(d), m[3]))) + (d == null ? '' : ' <span class="muted">vs. ' + f(prev) + '</span>');
      return card('kpi c-' + area, '<div class="head">' + m[0] + '</div><div class="val">' + (cur == null ? '–' : f(cur)) + '<small>' + (cur == null ? '' : m[2]) + '</small></div><div class="delta">' + (d == null ? G.icon('info') : G.icon(d > 0 ? 'up' : d < 0 ? 'down' : 'right')) + '<span><b>' + dtxt + '</b></span></div>');
    }).join('') + '</div>';
  }
  function perItem(id, rows, key, label, fmt, color, opts) {
    opts = opts || {};
    G.chart($(id), Object.assign({ rows: rows, x0: x0(), x1: x1(), events: ev(), height: 220, aria: label, yfmt: opts.yfmt, series: [
      { key: key, kind: 'dots', color: color, label: label, fmt: fmt },
      { key: key + '_r5', kind: 'line', color: color, label: 'Ø 5 Einheiten', dots: false, fmt: fmt }] }, opts.extra || {}));
  }
  function weeklyKm(items) {
    var map = {}, out = [];
    items.forEach(function (x) {
      var d = new Date(x.date + 'T12:00:00Z'), wd = (d.getUTCDay() + 6) % 7, k = G.addDays(x.date, -wd);
      map[k] = (map[k] || 0) + (x.dist_km || 0);
    });
    var k0 = Object.keys(map).sort()[0];
    if (!k0) return out;
    for (var k = k0; k <= x1(); k = G.addDays(k, 7)) out.push({ date: k, km: map[k] != null ? Math.round(map[k] * 10) / 10 : 0, partial: G.addDays(k, 6) >= x1() });
    return out;
  }

  function renderRun() {
    var R = D.run, s = R.summary, h = '<div class="grid">';
    h += '<p class="note" style="margin:0">Letzte 90 Tage im Vergleich zu den 90 Tagen davor. Tempo: kleiner ist schneller.</p>';
    var defs = [['Läufe', 'n', '', 0], ['Kilometer', 'km', 'km', 0], ['Ø Tempo', 'pace', '/km', 0, 1, mmss], ['Ø Herzfrequenz', 'hr', 'bpm', 0]];
    if (R.has_dynamics) defs = defs.concat([['Kadenz', 'cad', 'spm', 0], ['Bodenkontaktzeit', 'gct', 'ms', 0], ['Vertikale Oszillation', 'vo', 'cm', 1], ['Vertikales Verhältnis', 'vr', '%', 1], ['Schrittlänge', 'sl', 'm', 2]]);
    if (R.has_power) defs.push(['Leistung', 'pw', 'W', 0]);
    h += statTiles(s, defs, 'run');
    h += card('', head('gauge', 'run', 'Auffälligkeiten und Ideen', 'Aus deinen Läufen der letzten 90 Tage') + tipList(R.tips));
    h += '<div class="grid cols2">' + card('', head('gauge', 'run', 'Tempo', 'Minuten pro Kilometer pro Lauf, Linie = Ø der letzten 5 Läufe') + area('ch-r-pace')) +
      card('', head('heart', 'heart', 'Herzfrequenz', 'Durchschnitt pro Lauf') + area('ch-r-hr')) +
      card('', head('wind', 'run', 'Effizienz', 'Meter pro Minute je Herzschlag pro Minute. Höher heißt mehr Tempo für dieselbe Herzfrequenz.') + area('ch-r-eff')) +
      card('', head('footprints', 'run', 'Kilometer pro Monat', 'Alle Laufarten, letzte 12 Monate') + area('ch-r-km')) + '</div>';
    if (R.has_dynamics) {
      h += '<div class="grid cols2">' + card('', head('timer', 'run', 'Bodenkontaktzeit', 'Millisekunden, kürzer ist reaktiver') + area('ch-r-gct')) +
        card('', head('footprints', 'run', 'Kadenz', 'Schritte pro Minute') + area('ch-r-cad')) +
        card('', head('activity', 'run', 'Vertikale Oszillation', 'Zentimeter, weniger Auf und Ab ist sparsamer') + area('ch-r-vo')) +
        card('', head('activity', 'run', 'Vertikales Verhältnis', 'Prozent, Oszillation im Verhältnis zur Schrittlänge') + area('ch-r-vr')) +
        card('', head('route', 'run', 'Schrittlänge', 'Meter') + area('ch-r-sl')) +
        (R.has_power ? card('', head('zap', 'run', 'Laufleistung', 'Watt im Durchschnitt pro Lauf') + area('ch-r-pw')) : '') + '</div>';
    } else {
      h += card('', head('info', 'run', 'Laufdynamik') + '<p class="note" style="margin:0">Für Bodenkontaktzeit, Kadenz, vertikales Verhältnis und Schrittlänge enthalten deine Läufe noch keine Werte. Nach dem nächsten vollständigen Abruf („Komplette Historie“ im Workflow) erscheinen sie hier, sofern deine Uhr sie aufzeichnet.</p>');
    }
    h += card('', head('timer', 'run', 'Läufe') + '<div id="tb-run"></div>');
    h += '</div>';
    $('v-laufen').innerHTML = h;
  }
  function drawRun() {
    var R = D.run, rows = R.runs.filter(function (x) { return x.date >= start(); });
    perItem('ch-r-pace', rows, 'pace', 'Tempo', function (v) { return mmss(v) + ' /km'; }, C('train'), { yfmt: mmss });
    perItem('ch-r-hr', rows, 'hr', 'Herzfrequenz', function (v) { return G.num(v) + ' bpm'; }, C('heart'));
    perItem('ch-r-eff', rows, 'eff', 'Effizienz', function (v) { return G.num(v, 2); }, C('steps'), { yfmt: function (v) { return G.num(v, 1); } });
    G.chart($('ch-r-km'), { rows: R.monthly_km.map(function (m) { return { date: m.month + '-01', v: m.v }; }), x0: R.monthly_km[0].month + '-01', x1: R.monthly_km[11].month + '-28', step: 30, height: 220, aria: 'Kilometer pro Monat',
      series: [{ key: 'v', kind: 'bar', color: C('train'), label: 'Kilometer', fmt: function (v) { return G.num(v, 0) + ' km'; } }] });
    if (R.has_dynamics) {
      perItem('ch-r-gct', rows, 'gct', 'Bodenkontaktzeit', function (v) { return G.num(v) + ' ms'; }, C('train'));
      perItem('ch-r-cad', rows, 'cad', 'Kadenz', function (v) { return G.num(v) + ' spm'; }, C('steps'));
      perItem('ch-r-vo', rows, 'vo', 'Vertikale Oszillation', function (v) { return G.num(v, 1) + ' cm'; }, C('hrv'), { yfmt: function (v) { return G.num(v, 1); } });
      perItem('ch-r-vr', rows, 'vr', 'Vertikales Verhältnis', function (v) { return G.num(v, 1) + ' %'; }, C('sleep'), { yfmt: function (v) { return G.num(v, 1); } });
      perItem('ch-r-sl', rows, 'sl', 'Schrittlänge', function (v) { return G.num(v, 2) + ' m'; }, C('fit'), { yfmt: function (v) { return G.num(v, 2); } });
      if (R.has_power) perItem('ch-r-pw', rows, 'pw', 'Leistung', function (v) { return G.num(v) + ' W'; }, C('stress'));
    }
    G.table($('tb-run'), { rows: rows, search: true, sortKey: 'date', sortDir: -1, cols: [
      { key: 'date', label: 'Datum', text: function (x) { return G.wd(x.date) + ' ' + G.fmtDate(x.date); } },
      { key: 'type', label: 'Art', text: function (x) { return x.treadmill ? 'Laufband' : 'Draußen'; } },
      { key: 'dist_km', label: 'km', num: 1, text: function (x) { return G.num(x.dist_km, 1); } },
      { key: 'dur', label: 'Dauer', num: 1, text: function (x) { return G.dur(x.dur); } },
      { key: 'pace', label: 'Tempo', num: 1, text: function (x) { return mmss(x.pace) + ' /km'; } },
      { key: 'hr', label: 'Ø HF', num: 1, text: function (x) { return x.hr == null ? '–' : x.hr; } },
      { key: 'cad', label: 'Kadenz', num: 1, text: function (x) { return x.cad == null ? '–' : G.num(x.cad); } },
      { key: 'gct', label: 'GCT ms', num: 1, text: function (x) { return x.gct == null ? '–' : G.num(x.gct); } },
      { key: 'vo', label: 'VO cm', num: 1, text: function (x) { return x.vo == null ? '–' : G.num(x.vo, 1); } },
      { key: 'vr', label: 'VR %', num: 1, text: function (x) { return x.vr == null ? '–' : G.num(x.vr, 1); } },
      { key: 'sl', label: 'Schritt m', num: 1, text: function (x) { return x.sl == null ? '–' : G.num(x.sl, 2); } }] });
  }

  function renderBike() {
    var B = D.bike, s = B.summary, h = '<div class="grid">';
    h += '<p class="note" style="margin:0">Letzte 90 Tage im Vergleich zu den 90 Tagen davor.</p>';
    h += statTiles(s, [['Fahrten', 'n', '', 0], ['Kilometer', 'km', 'km', 0], ['Stunden', 'hours', 'h', 1], ['Ø Tempo', 'kmh', 'km/h', 1], ['Ø Herzfrequenz', 'hr', 'bpm', 0], ['Ø Strecke', 'dist_km', 'km', 1]], 'bike');
    h += card('', head('bike', 'bike', 'Auffälligkeiten und Ideen', 'Aus deinen Fahrten der letzten 90 Tage') + tipList(B.tips));
    h += '<div class="grid cols2">' + card('', head('bike', 'bike', 'Kilometer pro Woche', 'Draußen und Indoor, Mo bis So. Gestrichelt = laufende Woche.') + area('ch-b-km')) +
      card('', head('wind', 'bike', 'Tempo', 'Durchschnitt pro Fahrt in km/h, Linie = Ø der letzten 5 Fahrten') + area('ch-b-kmh')) +
      card('', head('heart', 'heart', 'Herzfrequenz', 'Durchschnitt pro Fahrt') + area('ch-b-hr')) +
      card('', head('activity', 'bike', 'Effizienz', 'km/h je 100 Herzschläge pro Minute, höher ist besser (Strecke und Wind beeinflussen es)') + area('ch-b-eff')) + '</div>';
    h += card('', head('timer', 'bike', 'Fahrten') + '<div id="tb-bike"></div>');
    h += '<p class="note">Dein Garmin liefert für Radfahrten hier keine Leistungs- oder Trittfrequenzwerte (dafür bräuchte es Sensoren).</p></div>';
    $('v-rad').innerHTML = h;
  }
  function drawBike() {
    var B = D.bike, rows = B.rides.filter(function (x) { return x.date >= start(); });
    var wk = weeklyKm(B.rides).filter(function (x) { return x.date >= G.addDays(start(), -6); });
    G.chart($('ch-b-km'), { rows: wk, x0: wk.length ? wk[0].date : x0(), x1: wk.length ? wk[wk.length - 1].date : x1(), step: 7, height: 220, aria: 'Kilometer pro Woche',
      series: [{ key: 'km', kind: 'bar', color: C('steps'), label: 'Kilometer', partialKey: 'partial', fmt: function (v) { return G.num(v, 1) + ' km'; } }] });
    perItem('ch-b-kmh', rows, 'kmh', 'Tempo', function (v) { return G.num(v, 1) + ' km/h'; }, C('steps'), { yfmt: function (v) { return G.num(v, 0); } });
    perItem('ch-b-hr', rows, 'hr', 'Herzfrequenz', function (v) { return G.num(v) + ' bpm'; }, C('heart'));
    perItem('ch-b-eff', rows, 'eff', 'Effizienz', function (v) { return G.num(v, 1); }, C('train'), { yfmt: function (v) { return G.num(v, 1); } });
    G.table($('tb-bike'), { rows: rows, search: true, sortKey: 'date', sortDir: -1, cols: [
      { key: 'date', label: 'Datum', text: function (x) { return G.wd(x.date) + ' ' + G.fmtDate(x.date); } },
      { key: 'indoor', label: 'Art', text: function (x) { return x.indoor ? 'Indoor' : 'Draußen'; } },
      { key: 'dist_km', label: 'km', num: 1, text: function (x) { return G.num(x.dist_km, 1); } },
      { key: 'dur', label: 'Dauer', num: 1, text: function (x) { return G.dur(x.dur); } },
      { key: 'kmh', label: 'Ø km/h', num: 1, text: function (x) { return G.num(x.kmh, 1); } },
      { key: 'hr', label: 'Ø HF', num: 1, text: function (x) { return x.hr == null ? '–' : x.hr; } },
      { key: 'gain', label: 'Höhenmeter', num: 1, text: function (x) { return x.gain == null ? '–' : G.num(x.gain); } },
      { key: 'cal', label: 'kcal', num: 1, text: function (x) { return x.cal == null ? '–' : G.num(x.cal); } }] });
  }

  function renderGolf() {
    var Gf = D.golf, h = '<div class="grid">';
    h += '<div class="grid kpis dyn">' +
      card('kpi c-golf', '<div class="head">Runden gesamt</div><div class="val">' + Gf.n_rounds + '</div><div class="delta">' + G.icon('info') + '<span>' + Gf.n_other + ' kürzere Einheiten (zum Beispiel Range) nicht mitgezählt</span></div>') +
      card('kpi c-golf', '<div class="head">Dieses Jahr bis heute</div><div class="val">' + Gf.ytd.cur + '<small>Runden</small></div><div class="delta">' + G.icon(Gf.ytd.cur >= Gf.ytd.prev ? 'up' : 'down') + '<span><b>Vorjahr: ' + Gf.ytd.prev + '</b></span></div>') +
      card('kpi c-golf', '<div class="head">Ø Dauer pro Runde</div><div class="val">' + G.dur(Gf.avg.dur) + '</div><div class="delta">' + G.icon('clock') + '<span>Ø Strecke ' + G.num(Gf.avg.km, 1) + ' km</span></div>') +
      card('kpi c-golf', '<div class="head">Ø Herzfrequenz</div><div class="val">' + G.num(Gf.avg.hr) + '<small>bpm</small></div><div class="delta">' + G.icon('heart') + '<span>über alle Runden</span></div>') + '</div>';
    h += '<div class="grid cols2">' + card('', head('flag', 'golf', 'Runden pro Monat', 'Letzte 12 Monate') + area('ch-g-month')) +
      card('', head('clock', 'golf', 'Dauer pro Runde', 'Stunden, Linie = Ø der letzten 5 Runden') + area('ch-g-dur')) +
      card('', head('route', 'golf', 'Gelaufene Strecke', 'Kilometer pro Runde (Uhr im Gehen)') + area('ch-g-km')) +
      card('', head('heart', 'heart', 'Herzfrequenz', 'Durchschnitt pro Runde') + area('ch-g-hr')) + '</div>';
    h += card('', head('flag', 'golf', 'Plätze') + '<div id="tb-g-course"></div>');
    h += card('', head('flag', 'golf', 'Strokes Gained und Scorekarten') + golfSgBody(Gf));
    h += card('', head('timer', 'golf', 'Runden') + '<div id="tb-golf"></div>');
    h += '</div>';
    $('v-golf').innerHTML = h;
  }
  function golfSgBody(Gf) {
    var s = Gf.scratch, h = '<p style="margin:0 0 10px">Garmin liefert über deinen Zugang <b>keine Scorekarten und keine Schlagdaten</b> (Schläge, Putts, Fairways, Grüns). Echte Strokes-Gained-Werte brauchen die Entfernung zum Loch vor und nach jedem Schlag und sind damit hier nicht berechenbar.</p>' +
      '<p style="margin:0 0 10px">Als Näherung kannst du Runden von Hand in <code>config/golf_runden.json</code> eintragen. Dann vergleiche ich Putts, Grüns in Regulation und Fairways mit Scratch-Richtwerten (Putts ' + G.num(s.putts, 1) + ', GIR ' + s.gir_pct + ' %, Fairways ' + s.fir_pct + ' % pro Runde; grobe Mittelwerte aus Arccos-Auswertungen).</p>' +
      '<p class="note" style="margin:0 0 10px">Beispiel: <code>{ "date": "2026-10-20", "course": "Platzname", "par": 72, "score": 84, "putts": 33, "gir": 6, "fir": 7, "fir_total": 14, "holes": 18 }</code></p>';
    if (Gf.manual.length) {
      h += '<div class="table-wrap"><table><thead><tr><th>Datum</th><th class="num">Score</th><th class="num">zu Par</th><th class="num">Putts</th><th class="num">vs. Scratch</th><th class="num">GIR %</th><th class="num">vs. Scratch</th><th class="num">Fairways %</th><th class="num">vs. Scratch</th></tr></thead><tbody>' + Gf.manual.map(function (m) {
        var f = function (v, u) { return v == null ? '–' : (v > 0 ? '+' : v < 0 ? '−' : '±') + G.num(Math.abs(v), u || 0); };
        return '<tr><td>' + G.fmtDate(m.date) + '</td><td class="num">' + (m.score == null ? '–' : m.score) + '</td><td class="num">' + f(m.to_par) + '</td><td class="num">' + (m.putts == null ? '–' : m.putts) + '</td><td class="num">' + f(m.putts_vs_scratch, 1) + '</td><td class="num">' + (m.gir_pct == null ? '–' : m.gir_pct) + '</td><td class="num">' + f(m.gir_vs_scratch) + '</td><td class="num">' + (m.fir_pct == null ? '–' : m.fir_pct) + '</td><td class="num">' + f(m.fir_vs_scratch) + '</td></tr>';
      }).join('') + '</tbody></table></div>';
    }
    return h;
  }
  function drawGolf() {
    var Gf = D.golf, rs = start(), rounds = Gf.rounds.filter(function (x) { return x.round; });
    var rows = rounds.map(function (x, i) { return Object.assign({}, x, { dur_h: x.dur / 3600 }); });
    var r5 = function (key) { rows.forEach(function (x, i) { var v = rows.slice(Math.max(0, i - 4), i + 1).map(function (y) { return y[key]; }).filter(function (y) { return y != null; }); x[key + '_r5'] = v.length >= 3 ? v.reduce(function (a, b) { return a + b; }, 0) / v.length : null; }); };
    ['dur_h', 'dist_km', 'hr'].forEach(r5);
    var vis = rows.filter(function (x) { return x.date >= rs; });
    var M = Gf.monthly_rounds;
    G.chart($('ch-g-month'), { rows: M.map(function (m) { return { date: m.month + '-01', v: m.v }; }), x0: M[0].month + '-01', x1: M[11].month + '-28', step: 30, height: 220, aria: 'Runden pro Monat',
      series: [{ key: 'v', kind: 'bar', color: C('golf'), label: 'Runden', fmt: function (v) { return G.num(v, 0); } }] });
    perItem('ch-g-dur', vis, 'dur_h', 'Dauer', function (v) { return G.num(v, 1) + ' h'; }, C('golf'), { yfmt: function (v) { return G.num(v, 1); } });
    perItem('ch-g-km', vis, 'dist_km', 'Strecke', function (v) { return G.num(v, 1) + ' km'; }, C('steps'), { yfmt: function (v) { return G.num(v, 0); } });
    perItem('ch-g-hr', vis, 'hr', 'Herzfrequenz', function (v) { return G.num(v) + ' bpm'; }, C('heart'));
    G.table($('tb-g-course'), { rows: Gf.courses, sortKey: 'n', sortDir: -1, cols: [
      { key: 'loc', label: 'Ort / Platz' },
      { key: 'n', label: 'Runden', num: 1 },
      { key: 'dur', label: 'Ø Dauer', num: 1, text: function (x) { return G.dur(x.dur); } },
      { key: 'km', label: 'Ø km', num: 1, text: function (x) { return G.num(x.km, 1); } },
      { key: 'hr', label: 'Ø HF', num: 1, text: function (x) { return x.hr == null ? '–' : G.num(x.hr); } },
      { key: 'last', label: 'Zuletzt', text: function (x) { return G.fmtDateY(x.last); } }] });
    G.table($('tb-golf'), { rows: rounds.filter(function (x) { return x.date >= rs; }), search: true, sortKey: 'date', sortDir: -1, cols: [
      { key: 'date', label: 'Datum', text: function (x) { return G.wd(x.date) + ' ' + G.fmtDate(x.date); } },
      { key: 'loc', label: 'Ort / Platz' },
      { key: 'dur', label: 'Dauer', num: 1, text: function (x) { return G.dur(x.dur); } },
      { key: 'dist_km', label: 'km', num: 1, text: function (x) { return G.num(x.dist_km, 1); } },
      { key: 'hr', label: 'Ø HF', num: 1, text: function (x) { return x.hr == null ? '–' : x.hr; } },
      { key: 'cal', label: 'kcal', num: 1, text: function (x) { return x.cal == null ? '–' : G.num(x.cal); } }] });
  }

  /* ---------- Steuerung ---------- */
  var DRAW = { uebersicht: function () {}, herz: drawHeart, schlaf: drawSleep, training: drawTraining, laufen: drawRun, rad: drawBike, golf: drawGolf, koerper: drawBody };
  var RENDER = { uebersicht: renderOverview, herz: renderHeart, schlaf: renderSleep, training: renderTraining, laufen: renderRun, rad: renderBike, golf: renderGolf, koerper: renderBody };
  function show() {
    var v = VIEWS.filter(function (x) { return x.id === state.view; })[0] || VIEWS[0];
    document.querySelectorAll('.view').forEach(function (e) { e.classList.toggle('on', e.id === 'v-' + v.id); });
    document.querySelectorAll('#nav a').forEach(function (a) { if (a.dataset.v === v.id) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
    document.querySelectorAll('#range button').forEach(function (b) { b.setAttribute('aria-pressed', String(parseInt(b.dataset.r, 10) === state.range)); });
    $('title').textContent = v.title;
    document.title = v.title + ' · Garmin Dashboard';
    RENDER[v.id](); DRAW[v.id]();
  }
  function route() {
    var h = location.hash.slice(1);
    state.view = VIEWS.some(function (v) { return v.id === h; }) ? h : 'uebersicht';
    if (D) show();
  }
  window.addEventListener('hashchange', function () { route(); window.scrollTo(0, 0); });
  $('range').addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    state.range = parseInt(b.dataset.r, 10); G.store.set('garmin-range', String(state.range)); show();
  });
  window.addEventListener('resize', G.debounce(function () { if (D) { DRAW[state.view](); } }, 150));

  G.themeSwitch($('themes'));
  G.load(['meta', 'daily', 'weeks', 'activities', 'kpi', 'year', 'body', 'running', 'cycling', 'golf']).then(function (d) {
    D = { meta: d.meta, daily: d.daily, weeks: d.weeks, acts: d.activities, kpi: d.kpi, year: d.year, body: d.body, run: d.running, bike: d.cycling, golf: d.golf };
    var st = G.stand(D.meta);
    $('stand').innerHTML = G.icon('clock') + 'Stand: ' + st.text;
    G.banners($('banners'), D.meta);
    route();
  }).catch(function (e) { G.err($('banners'), e); });
})();
