(function () {
  'use strict';
  var TABS = [
    { id: 'heute', label: 'Heute', icon: 'home', area: 'steps', title: 'Heute' },
    { id: 'herz', label: 'Herz', icon: 'heartpulse', area: 'heart', title: 'Herz und Erholung' },
    { id: 'schlaf', label: 'Schlaf', icon: 'moon', area: 'sleep', title: 'Schlaf' },
    { id: 'training', label: 'Training', icon: 'route', area: 'train', title: 'Training' }
  ];
  var D = null, state = { view: 'heute', range: 30 };
  var $ = function (id) { return document.getElementById(id); };
  var C = function (n) { return 'var(--' + n + ')'; };
  var KP = { rhr: ['heart', 'heart'], hrv: ['activity', 'hrv'], sleep_score: ['moon', 'sleep'], stress: ['zap', 'stress'], steps: ['footprints', 'steps'] };

  $('foot-icon').innerHTML = G.icon('info');
  $('to-desktop').innerHTML = G.icon('monitor') + 'Desktop-Ansicht';
  $('to-desktop').addEventListener('click', function () { G.store.set('garmin-view', 'desktop'); });
  $('tabs').innerHTML = TABS.map(function (t) {
    return '<a href="#' + t.id + '" data-v="' + t.id + '" class="c-' + t.area + '">' + G.icon(t.icon) + t.label + '</a>';
  }).join('');
  var saved = parseInt(G.store.get('garmin-range-m'), 10);
  if (saved === 30 || saved === 90) state.range = saved;

  function start() { var s = G.addDays(D.meta.today, -(state.range - 1)); return s < D.meta.first ? D.meta.first : s; }
  function card(cls, html) { return '<div class="card ' + (cls || '') + '">' + html + '</div>'; }
  function head(icon, area, title, sub) { return '<h2 class="c-' + area + '">' + G.chip(icon, area) + title + '</h2><p class="sub">' + (sub || '') + '</p>'; }
  function wdLong(d) { return { So: 'Sonntag', Mo: 'Montag', Di: 'Dienstag', Mi: 'Mittwoch', Do: 'Donnerstag', Fr: 'Freitag', Sa: 'Samstag' }[G.wd(d)]; }

  function renderToday() {
    var ls = D.kpi.last_sleep, h = '<div class="stack">';
    if (ls) {
      var sc = ls.sleep_score;
      h += card('c-sleep', '<h2 class="c-sleep">' + G.chip('moon', 'sleep') + 'Letzte Nacht</h2><p class="sub" style="margin-bottom:0">Aufgewacht am ' + G.wd(ls.date) + ' ' + G.fmtDate(ls.date) + '</p>' +
        '<div class="night">' +
        '<div class="it"><div class="l">' + G.icon('bed') + 'Bett</div><div class="v">' + G.time(ls.bed) + '</div></div>' +
        '<div class="it"><div class="l">' + G.icon('sun') + 'Aufwachen</div><div class="v">' + G.time(ls.wake) + '</div></div>' +
        '<div class="it"><div class="l">' + G.icon('clock') + 'Schlafdauer</div><div class="v">' + G.dur(ls.sleep_dur) + '</div></div>' +
        '<div class="it"><div class="l">' + G.icon('alert') + 'Wach</div><div class="v">' + (ls.awake == null ? '–' : G.num(ls.awake / 60, 0) + ' min') + '</div></div>' +
        '<div class="it big"><div><div class="l">' + G.icon('moon') + 'Schlaf-Score</div><div class="v" style="font-size:2rem">' + (sc == null ? '–' : sc) + '</div></div>' +
        (D.kpi.kpis[2].status && D.kpi.kpis[2].date === ls.date ? G.pill(D.kpi.kpis[2].status) : '') + '</div></div>');
    } else h += card('', '<div class="empty">Noch keine Schlafdaten</div>');
    h += '<div class="tiles">';
    var z = D.kpi.z45, tiles = D.kpi.kpis.filter(function (k) { return KP[k.key]; });
    tiles.forEach(function (k) {
      var m = KP[k.key], d = k.delta, dg = k.digits || 0;
      var tr = d == null ? G.icon('info') + 'ohne Baseline' : G.icon(d > 0 ? 'up' : d < 0 ? 'down' : 'right') + (d > 0 ? '+' : d < 0 ? '−' : '±') + G.num(Math.abs(d), dg) + ' vs. Ø 28 T.';
      var tab = { rhr: 'herz', hrv: 'herz', stress: 'herz', sleep_score: 'schlaf', steps: 'training' }[k.key];
      h += '<a class="card tile c-' + m[1] + '" href="#' + tab + '"><div class="l">' + G.chip(m[0], m[1]) + k.label + '</div>' +
        '<div class="v">' + (k.value == null ? '–' : G.num(k.value, dg)) + '<small>' + (k.value == null ? '' : k.unit) + '</small></div>' +
        '<div class="tr">' + tr + '</div>' + G.pill(k.status) + '</a>';
    });
    // sechste Kachel: Zone 4/5 diese Woche
    h += '<a class="card tile c-train" href="#training"><div class="l">' + G.chip('target', 'train') + 'Zone 4/5 Woche</div>' +
      '<div class="v">' + G.num(z.value, 0) + '<small>von ' + z.goal + ' min</small></div>' +
      '<div class="tr">' + G.icon(z.value >= z.goal ? 'check' : 'right') + 'Wochenziel</div>' + (z.status ? G.pill(z.status) : '') + '</a>';
    h += '</div></div>';
    $('v-heute').innerHTML = h;
  }
  function renderHeart() {
    $('v-herz').innerHTML = '<div class="stack">' +
      card('', head('heart', 'heart', 'Ruhepuls', 'Punkte täglich, Linie 7-Tage-Mittel') + '<div id="m-rhr"></div>') +
      card('', head('activity', 'hrv', 'HRV nächtlich', 'Fläche = dein Baseline-Band') + '<div id="m-hrv"></div>') +
      card('', head('zap', 'stress', 'Stress', 'Tagesdurchschnitt') + '<div id="m-stress"></div>') + '</div>';
  }
  function base() { var r = G.inRange(D.daily, start()); return { rows: r, x0: start(), x1: D.meta.today, events: D.meta.events, height: 210, ml: 38 }; }
  function drawHeart() {
    var b = base();
    G.chart($('m-rhr'), Object.assign({}, b, { aria: 'Ruhepuls', series: [
      { key: 'rhr', kind: 'dots', color: C('heart'), label: 'Ruhepuls', fmt: function (v) { return v + ' bpm'; } },
      { key: 'rhr7', kind: 'line', color: C('heart'), label: '7-Tage-Mittel', dots: false, fmt: function (v) { return G.num(v, 1) + ' bpm'; } }] }));
    G.chart($('m-hrv'), Object.assign({}, b, { aria: 'HRV', band: { lo: 'hrv_low', hi: 'hrv_high', color: C('hrv') }, series: [
      { key: 'hrv', kind: 'line', color: C('hrv'), label: 'HRV', fmt: function (v) { return v + ' ms'; } }] }));
    G.chart($('m-stress'), Object.assign({}, b, { aria: 'Stress', series: [
      { key: 'stress', kind: 'dots', color: C('stress'), label: 'Stress', fmt: function (v) { return G.num(v); } },
      { key: 'stress7', kind: 'line', color: C('stress'), label: '7-Tage-Mittel', dots: false, fmt: function (v) { return G.num(v, 1); } }] }));
  }
  function renderSleep() {
    $('v-schlaf').innerHTML = '<div class="stack">' +
      card('', head('bed', 'sleep', 'Bett und Aufwachen', 'Jede Nacht ein Balken') + '<div id="m-night"></div>') +
      card('', head('moon', 'sleep', 'Schlafdauer', 'Stunden pro Nacht') + '<div id="m-dur"></div>') +
      card('', head('moon', 'sleep', 'Schlaf-Score') + '<div id="m-score"></div>') + '</div>';
  }
  function sleepRange(r) {
    var a = r.map(function (x) { return x.bed_min; }).filter(function (v) { return v != null; }), b = r.map(function (x) { return x.wake_min; }).filter(function (v) { return v != null; });
    var lo = a.length ? Math.floor((Math.min.apply(null, a) - 30) / 120) * 120 : 0, hi = b.length ? Math.ceil((Math.max.apply(null, b) + 30) / 120) * 120 : 1200, t = [];
    for (var v = lo; v <= hi; v += 120) t.push(v);
    return { y: [lo, hi], ticks: t };
  }
  function drawSleep() {
    var b = base(), rh = b.rows.map(function (x) { return Object.assign({}, x, { dur_h: x.sleep_dur == null ? null : x.sleep_dur / 3600 }); });
    G.chart($('m-night'), Object.assign({}, b, { height: 250, aria: 'Bett- und Aufwachzeit', y: sleepRange(b.rows).y, yTicks: sleepRange(b.rows).ticks, yfmt: function (v) { return G.hm(v + 720); },
      series: [{ kind: 'float', lo: 'bed_min', hi: 'wake_min', key: 'bed_min', color: C('sleep'), label: 'Schlaf' }],
      tip: function (x) { return '<b>' + G.wd(x.date) + ' ' + G.fmtDate(x.date) + '</b><div class="row"><span>Bett</span><span>' + G.time(x.bed) + '</span></div><div class="row"><span>Aufwachen</span><span>' + G.time(x.wake) + '</span></div>'; } }));
    G.chart($('m-dur'), Object.assign({}, b, { rows: rh, aria: 'Schlafdauer', refs: [{ y: 7, label: '7 h' }], series: [
      { key: 'dur_h', kind: 'bar', color: C('sleep'), label: 'Schlafdauer', fmt: function (v) { return G.num(v, 1) + ' h'; } }] }));
    G.chart($('m-score'), Object.assign({}, b, { aria: 'Schlaf-Score', y: [0, 100], series: [
      { key: 'sleep_score', kind: 'line', color: C('sleep'), label: 'Score', fmt: function (v) { return G.num(v); } }] }));
  }
  function renderTraining() {
    var z = D.kpi.z45, pct = z.value == null ? 0 : Math.min(100, z.value / z.goal * 100);
    $('v-training').innerHTML = '<div class="stack">' +
      card('', head('target', 'train', 'Intervall-Wochen', 'Minuten in Zone 4 und 5, Ziel ' + z.goal + ' min') +
        '<div class="progress" role="progressbar" aria-valuemin="0" aria-valuemax="' + z.goal + '" aria-valuenow="' + (z.value || 0) + '"><i style="width:' + pct + '%"></i></div>' +
        '<div class="muted" style="font-size:.875rem;margin-bottom:8px">Diese Woche: <b style="color:var(--text)">' + G.num(z.value, 0) + ' min</b></div><div id="m-z45"></div>') +
      card('', head('route', 'train', 'Laufen pro Woche', 'Kilometer') + '<div id="m-km"></div>') +
      card('', head('timer', 'train', 'Letzte Aktivitäten') + '<div class="alist">' + D.acts.slice(0, 8).map(function (a) {
        return '<div class="a"><b>' + a.label + '</b><span>' + G.dur(a.dur) + '</span><span class="s">' + G.wd(a.date) + ' ' + G.fmtDate(a.date) + ' ' + a.start.slice(11, 16) + '</span><span class="s">' + (a.dist_km ? G.num(a.dist_km, 1) + ' km' : '') + (a.avg_hr ? ' · Ø ' + a.avg_hr : '') + '</span></div>';
      }).join('') + '</div>') + '</div>';
  }
  function drawTraining() {
    var w = G.inRange(D.weeks, G.addDays(start(), -6)), s = D.meta.settings;
    var o = { rows: w, x0: w[0].date, x1: w[w.length - 1].date, step: 7, height: 210, ml: 38 };
    G.chart($('m-z45'), Object.assign({}, o, { aria: 'Zone 4 und 5 pro Woche', refs: [{ y: s.goal, label: 'Ziel', color: C('muted') }], series: [
      { key: 'z45', kind: 'bar', color: C('train'), label: 'Zone 4+5', partialKey: 'partial', fmt: function (v) { return G.num(v, 0) + ' min'; } }],
      tip: function (x) { return '<b>Woche ab ' + G.fmtDate(x.date) + (x.partial ? ' (läuft)' : '') + '</b><div class="row"><span>Zone 4+5</span><span>' + G.num(x.z45, 0) + ' min</span></div>'; } }));
    G.chart($('m-km'), Object.assign({}, o, { aria: 'Laufkilometer pro Woche', series: [
      { key: 'run_km', kind: 'bar', color: C('train'), label: 'Laufen', partialKey: 'partial', fmt: function (v) { return G.num(v, 1) + ' km'; } }],
      tip: function (x) { return '<b>Woche ab ' + G.fmtDate(x.date) + (x.partial ? ' (läuft)' : '') + '</b><div class="row"><span>Distanz</span><span>' + G.num(x.run_km, 1) + ' km</span></div><div class="row"><span>Läufe</span><span>' + G.num(x.runs) + '</span></div>'; } }));
  }

  var RENDER = { heute: [renderToday, null], herz: [renderHeart, drawHeart], schlaf: [renderSleep, drawSleep], training: [renderTraining, drawTraining] };
  function show() {
    var t = TABS.filter(function (x) { return x.id === state.view; })[0] || TABS[0];
    document.querySelectorAll('.view').forEach(function (e) { e.classList.toggle('on', e.id === 'v-' + t.id); });
    document.querySelectorAll('#tabs a').forEach(function (a) { if (a.dataset.v === t.id) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
    $('title').textContent = t.title; document.title = t.title + ' · Garmin';
    $('rangebar').hidden = t.id === 'heute';
    document.querySelectorAll('#rangebar button').forEach(function (b) { b.setAttribute('aria-pressed', String(parseInt(b.dataset.r, 10) === state.range)); });
    RENDER[t.id][0](); if (RENDER[t.id][1]) RENDER[t.id][1]();
  }
  function route() {
    var h = location.hash.slice(1);
    state.view = TABS.some(function (t) { return t.id === h; }) ? h : 'heute';
    if (D) show();
  }
  window.addEventListener('hashchange', function () { route(); window.scrollTo(0, 0); });
  $('rangebar').addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    state.range = parseInt(b.dataset.r, 10); G.store.set('garmin-range-m', String(state.range)); show();
  });
  window.addEventListener('resize', G.debounce(function () { if (D && RENDER[state.view][1]) RENDER[state.view][1](); }, 150));
  G.load(['meta', 'daily', 'weeks', 'activities', 'kpi']).then(function (d) {
    D = { meta: d.meta, daily: d.daily, weeks: d.weeks, acts: d.activities, kpi: d.kpi };
    $('stand').innerHTML = G.icon('clock') + 'Stand: ' + G.stand(D.meta).text;
    G.banners($('banners'), D.meta);
    route();
  }).catch(function (e) { G.err($('banners'), e); });
})();
