/* Gemeinsame Bibliothek: Formate, Icons, Daten, Charts, Tabellen. Keine externen Aufrufe. */
(function () {
  'use strict';
  var G = window.G = {};
  var TZ = 'Europe/Berlin';
  var pad = function (n) { return String(n).padStart(2, '0'); };
  var MONTHS = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
  var WD = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

  /* ---------- Formate ---------- */
  G.fmtDate = function (d) { return d ? d.slice(8, 10) + '.' + d.slice(5, 7) + '.' : '–'; };
  G.fmtDateY = function (d) { return d ? G.fmtDate(d) + d.slice(0, 4) : '–'; };
  G.wd = function (d) { return WD[new Date(d + 'T12:00:00Z').getUTCDay()]; };
  G.num = function (v, dg) {
    if (v == null || isNaN(v)) return '–';
    return Number(v).toLocaleString('de-DE', { minimumFractionDigits: dg || 0, maximumFractionDigits: dg || 0 });
  };
  G.dur = function (sec) {
    if (sec == null) return '–';
    var m = Math.round(sec / 60);
    return Math.floor(m / 60) + ' h ' + pad(m % 60) + ' min';
  };
  G.hm = function (min) { return pad(Math.floor(((min % 1440) + 1440) % 1440 / 60)) + ':' + pad(Math.round(((min % 1440) + 1440) % 1440 % 60)); };
  G.time = function (iso) { return iso ? iso.slice(11, 16) : '–'; };
  G.addDays = function (d, n) { var t = new Date(d + 'T12:00:00Z'); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); };
  G.dayIdx = function (d) { return Math.floor(Date.parse(d + "T12:00:00Z") / 86400000); };
  G.stand = function (meta) {
    if (!meta.updated) return { text: 'unbekannt', stale: true };
    var dt = new Date(meta.updated), p = {};
    new Intl.DateTimeFormat('de-DE', { timeZone: TZ, day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false })
      .formatToParts(dt).forEach(function (x) { p[x.type] = x.value; });
    return { text: p.day + '.' + p.month + '. ' + p.hour + ':' + p.minute + ' Uhr', stale: Date.now() - dt.getTime() > 36 * 3600e3 };
  };

  /* ---------- Icons (Lucide, ISC-Lizenz; siehe assets/ICONS-LICENSE.txt) ---------- */
  var P = {
    home: '<path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/><path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
    dashboard: '<rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/>',
    heartpulse: '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/><path d="M3.22 12H9.5l.5-1 2 4.5 2-7 1.5 3.5h5.27"/>',
    heart: '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>',
    activity: '<path d="M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2"/>',
    moon: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
    bed: '<path d="M2 4v16"/><path d="M2 8h18a2 2 0 0 1 2 2v10"/><path d="M2 17h20"/><path d="M6 8v9"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>',
    zap: '<path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"/>',
    footprints: '<path d="M4 16v-2.38C4 11.5 2.97 10.5 3 8c.03-2.72 1.49-6 4.5-6C9.37 2 10 3.8 10 5.5c0 3.11-2 5.66-2 8.68V16a2 2 0 1 1-4 0Z"/><path d="M20 20v-2.38c0-2.12 1.03-3.12 1-5.62-.03-2.72-1.49-6-4.5-6C14.63 6 14 7.8 14 9.5c0 3.11 2 5.66 2 8.68V20a2 2 0 1 0 4 0Z"/><path d="M16 17h4"/><path d="M4 13h4"/>',
    hourglass: '<path d="M5 22h14"/><path d="M5 2h14"/><path d="M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22"/><path d="M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2"/>',
    timer: '<line x1="10" x2="14" y1="2" y2="2"/><line x1="12" x2="15" y1="14" y2="11"/><circle cx="12" cy="14" r="8"/>',
    route: '<circle cx="6" cy="19" r="3"/><path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15"/><circle cx="18" cy="5" r="3"/>',
    scale: '<path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="M7 21h10"/><path d="M12 3v18"/><path d="M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2"/>',
    up: '<path d="m5 12 7-7 7 7"/><path d="M12 19V5"/>',
    down: '<path d="M12 5v14"/><path d="m19 12-7 7-7-7"/>',
    right: '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
    check: '<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>',
    alert: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
    xcircle: '<circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/>',
    info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>',
    search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
    phone: '<rect width="14" height="20" x="5" y="2" rx="2" ry="2"/><path d="M12 18h.01"/>',
    monitor: '<rect width="20" height="14" x="2" y="3" rx="2"/><line x1="8" x2="16" y1="21" y2="21"/><line x1="12" x2="12" y1="17" y2="21"/>',
    clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
    sort: '<path d="m7 15 5 5 5-5"/><path d="m7 9 5-5 5 5"/>',
    target: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
    calendar: '<path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/>'
  };
  G.icon = function (name, cls) {
    return '<svg class="i ' + (cls || '') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' + (P[name] || '') + '</svg>';
  };
  G.chip = function (icon, area) { return '<span class="chip-icon c-' + area + '">' + G.icon(icon) + '</span>'; };
  G.statusIcon = function (level) { return { green: 'check', yellow: 'alert', red: 'xcircle' }[level] || 'info'; };
  G.pill = function (st) {
    if (!st) return '';
    return '<span class="pill ' + st.level + '">' + G.icon(G.statusIcon(st.level)) + st.text + '</span>';
  };

  /* ---------- Daten, Ansichtswahl, Hinweise ---------- */
  G.load = function (names) {
    return Promise.all(names.map(function (n) {
      return fetch('/data/' + n + '.json', { credentials: 'same-origin' }).then(function (r) {
        if (!r.ok) throw new Error(n + ': HTTP ' + r.status);
        return r.json();
      });
    })).then(function (a) { var o = {}; names.forEach(function (n, i) { o[n] = a[i]; }); return o; });
  };
  G.store = {
    get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) { /* ignorieren */ } }
  };
  G.banners = function (host, meta) {
    var st = G.stand(meta), h = '';
    if (meta.sample) h += '<div class="banner sample" role="status">' + G.icon('info') + '<div><b>BEISPIELDATEN</b> – Diese Werte sind erfunden. Echte Daten erscheinen nach dem ersten erfolgreichen Abruf.</div></div>';
    if (st.stale) h += '<div class="banner warn" role="status">' + G.icon('alert') + '<div>Die Daten sind älter als 36 Stunden (Stand: ' + st.text + '). Prüfe den Workflow „Tägliches Update“ in GitHub Actions.</div></div>';
    if (meta.partial_failures && meta.partial_failures.length) h += '<div class="banner warn" role="status">' + G.icon('alert') + '<div>Beim letzten Abruf fehlten: ' + meta.partial_failures.join(', ') + '.</div></div>';
    host.innerHTML = h;
  };
  G.inRange = function (rows, start) { return rows.filter(function (r) { return r.date >= start; }); };
  G.err = function (host, e) { host.innerHTML = '<div class="banner warn">' + G.icon('alert') + '<div>Daten konnten nicht geladen werden (' + String(e.message || e) + ').</div></div>'; };

  /* ---------- SVG-Charts ---------- */
  var NS = 'http://www.w3.org/2000/svg';
  function s(tag, attrs, parent) {
    var e = document.createElementNS(NS, tag);
    for (var k in attrs) if (attrs[k] != null) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function niceTicks(lo, hi, n) {
    if (hi === lo) { hi = lo + 1; }
    var raw = (hi - lo) / Math.max(1, n), mag = Math.pow(10, Math.floor(Math.log10(raw))), f = raw / mag;
    var step = (f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10) * mag, out = [];
    for (var v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) out.push(+v.toFixed(6));
    return out;
  }
  function xTicks(i0, i1, W) {
    var n = i1 - i0 + 1, out = [], max = Math.max(3, Math.floor(W / 78));
    if (n > 100) {
      var d0 = new Date(i0 * 86400000), y = d0.getUTCFullYear(), m = d0.getUTCMonth(), all = [];
      for (;;) { var t = Date.UTC(y, m, 1) / 86400000; if (t > i1) break; if (t >= i0) all.push({ i: t, y: y, m: m }); m++; if (m > 11) { m = 0; y++; } }
      var k = Math.max(1, Math.ceil(all.length / max));
      all.forEach(function (x, j) { if (j % k === 0) out.push({ i: x.i, label: MONTHS[x.m] + (x.m === 0 ? ' ' + String(x.y).slice(2) : '') }); });
      return out;
    }
    var steps = [1, 2, 3, 5, 7, 10, 14, 21, 28], step = 28;
    for (var q = 0; q < steps.length; q++) if (n / steps[q] <= max) { step = steps[q]; break; }
    for (var i = i1; i >= i0; i -= step) out.unshift({ i: i, label: G.fmtDate(new Date(i * 86400000).toISOString().slice(0, 10)) });
    return out;
  }

  /* o: rows[{date,..}], x0, x1 (ISO), step (Tage je Balken, Standard 1), height, y:[min,max], yTicks, yfmt,
        series[{key,kind:line|bar|float|dots,color,label,fmt,lo,hi,dash,partialKey}], band{lo,hi,color,label},
        refs[{y,label,color,dash}], events[{von,bis,text}], tip(row)->html, aria */
  G.chart = function (host, o) {
    host.innerHTML = ''; host.classList.add('chart');
    var W = Math.max(host.clientWidth || 320, 240), H = o.height || 220, step = o.step || 1;
    var m = { l: o.ml || 44, r: 10, t: 10, b: 26 }, pw = W - m.l - m.r, ph = H - m.t - m.b;
    var i0 = G.dayIdx(o.x0), i1 = G.dayIdx(o.x1);
    var bars = o.series.some(function (q) { return q.kind === 'bar' || q.kind === 'float'; });
    var dmin = i0 - 0.5, dmax = i1 + (bars ? step - 0.5 : 0.5);
    var X = function (i) { return m.l + (i - dmin) / (dmax - dmin) * pw; };
    var rows = o.rows, idx = rows.map(function (r) { return G.dayIdx(r.date); });
    // y-Bereich
    var lo = Infinity, hi = -Infinity;
    var take = function (v) { if (v != null && !isNaN(v)) { if (v < lo) lo = v; if (v > hi) hi = v; } };
    rows.forEach(function (r) {
      o.series.forEach(function (q) { if (q.kind === 'float') { take(r[q.lo]); take(r[q.hi]); } else take(r[q.key]); });
      if (o.band) { take(r[o.band.lo]); take(r[o.band.hi]); }
    });
    (o.refs || []).forEach(function (r) { take(r.y); });
    if (!isFinite(lo)) { host.innerHTML = '<div class="empty">Keine Daten im Zeitraum</div>'; return null; }
    if (o.y) { lo = o.y[0] != null ? o.y[0] : lo; hi = o.y[1] != null ? o.y[1] : hi; }
    else {
      var padv = (hi - lo || 1) * 0.1;
      lo = bars && o.series.some(function (q) { return q.kind === 'bar'; }) ? 0 : lo - padv; hi = hi + padv;
    }
    var ticks = o.yTicks || niceTicks(lo, hi, Math.round(ph / 42));
    if (!o.y && !o.yTicks && ticks.length) { lo = Math.min(lo, ticks[0]); hi = Math.max(hi, ticks[ticks.length - 1]); }
    var Y = function (v) { return m.t + (1 - (v - lo) / (hi - lo)) * ph; };
    var tstep = ticks.length > 1 ? ticks[1] - ticks[0] : 1, ydg = tstep >= 1 ? 0 : Math.min(3, Math.ceil(-Math.log10(tstep) - 1e-9));

    var svg = s('svg', { viewBox: '0 0 ' + W + ' ' + H, width: W, height: H, role: 'group', tabindex: 0,
      'aria-label': (o.aria || 'Diagramm') + ' – mit Pfeiltasten durch die Werte gehen' }, host);
    // Ereignisphasen
    (o.events || []).forEach(function (ev) {
      var a = Math.max(G.dayIdx(ev.von) - 0.5, dmin), b = Math.min(G.dayIdx(ev.bis) + 0.5, dmax);
      if (b <= a) return;
      s('rect', { x: X(a), y: m.t, width: X(b) - X(a), height: ph, fill: 'var(--accent)', opacity: 0.12 }, svg);
      if (X(b) - X(a) > 70) s('text', { x: X(a) + 6, y: m.t + 13, class: 'ev-label' }, svg).textContent = ev.text;
    });
    ticks.forEach(function (t) {
      s('line', { x1: m.l, x2: W - m.r, y1: Y(t), y2: Y(t), stroke: 'var(--grid)', 'stroke-width': 1 }, svg);
      var tx = s('text', { x: m.l - 8, y: Y(t) + 4, 'text-anchor': 'end' }, svg);
      tx.textContent = o.yfmt ? o.yfmt(t) : G.num(t, ydg);
    });
    xTicks(i0, i1, W).forEach(function (t) {
      s('line', { x1: X(t.i), x2: X(t.i), y1: m.t + ph, y2: m.t + ph + 4, stroke: 'var(--muted)', opacity: 0.6 }, svg);
      s('text', { x: X(t.i), y: H - 6, 'text-anchor': 'middle' }, svg).textContent = t.label;
    });
    // Band
    if (o.band) {
      var seg = [], flush = function () {
        if (seg.length > 1) {
          var d = seg.map(function (p, k) { return (k ? 'L' : 'M') + X(p.i) + ' ' + Y(p.h); }).join('') +
            seg.slice().reverse().map(function (p) { return 'L' + X(p.i) + ' ' + Y(p.l); }).join('') + 'Z';
          s('path', { d: d, fill: o.band.color, opacity: 0.16 }, svg);
        }
        seg = [];
      };
      rows.forEach(function (r, k) {
        if (r[o.band.lo] != null && r[o.band.hi] != null) seg.push({ i: idx[k], l: r[o.band.lo], h: r[o.band.hi] }); else flush();
      }); flush();
    }
    (o.refs || []).forEach(function (r) {
      s('line', { x1: m.l, x2: W - m.r, y1: Y(r.y), y2: Y(r.y), stroke: r.color || 'var(--muted)', 'stroke-width': 1.5, 'stroke-dasharray': r.dash || '5 4' }, svg);
      if (r.label) s('text', { x: W - m.r - 4, y: Y(r.y) - 5, 'text-anchor': 'end', style: 'fill:' + (r.color || 'var(--muted)') }, svg).textContent = r.label;
    });
    var many = rows.length > 45;
    o.series.forEach(function (q) {
      var col = q.color;
      if (q.kind === 'line' || q.kind === 'dots') {
        var d = '', run = [], pts = [];
        var endRun = function () {
          if (run.length > 1 && q.kind === 'line') {
            s('path', { d: run.map(function (p, k) { return (k ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1); }).join(''),
              fill: 'none', stroke: col, 'stroke-width': q.width || 2.2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round', 'stroke-dasharray': q.dash || null, opacity: q.opacity || 1 }, svg);
          } else if (run.length === 1 && q.kind === 'line') {
            s('circle', { cx: run[0][0], cy: run[0][1], r: 3, fill: col }, svg);
          }
          run = [];
        };
        rows.forEach(function (r, k) {
          var v = r[q.key];
          if (v == null) { endRun(); return; }
          var p = [X(idx[k]), Y(v)]; run.push(p); pts.push(p);
        });
        endRun();
        if (q.kind === 'dots' || (!many && q.dots !== false && !q.dash)) pts.forEach(function (p) { s('circle', { cx: p[0], cy: p[1], r: q.kind === 'dots' ? 2.6 : 2.4, fill: col, opacity: q.kind === 'dots' ? 0.75 : 1 }, svg); });
      } else if (q.kind === 'bar' || q.kind === 'float') {
        var bw = Math.max(1.5, (X(dmin + step) - X(dmin)) * (step > 1 ? 0.72 : 0.7));
        rows.forEach(function (r, k) {
          var cx = X(idx[k] + (step - 1) / 2), a, b;
          if (q.kind === 'bar') { if (r[q.key] == null) return; a = Y(r[q.key]); b = Y(Math.max(lo, 0)); }
          else { if (r[q.lo] == null || r[q.hi] == null) return; a = Y(r[q.hi]); b = Y(r[q.lo]); }
          var part = q.partialKey && r[q.partialKey];
          s('rect', { x: cx - bw / 2, y: Math.min(a, b), width: bw, height: Math.max(1.5, Math.abs(b - a)), rx: Math.min(4, bw / 2),
            fill: col, opacity: part ? 0.45 : (q.opacity || 0.95), stroke: part ? col : null, 'stroke-dasharray': part ? '3 2' : null }, svg);
        });
      }
    });
    // Interaktion
    var cross = s('line', { y1: m.t, y2: m.t + ph, stroke: 'var(--muted)', 'stroke-width': 1, opacity: 0, 'stroke-dasharray': '3 3' }, svg);
    var marks = o.series.filter(function (q) { return q.kind === 'line' || q.kind === 'dots'; }).map(function (q) { return { q: q, el: s('circle', { r: 5, fill: q.color, stroke: 'var(--card)', 'stroke-width': 2, opacity: 0 }, svg) }; });
    var tip = document.createElement('div'); tip.className = 'tip'; tip.hidden = true; host.appendChild(tip);
    var live = document.createElement('div'); live.className = 'sr'; live.setAttribute('aria-live', 'polite'); host.appendChild(live);
    var has = []; rows.forEach(function (r, k) {
      if (o.series.some(function (q) { return q.kind === 'float' ? r[q.lo] != null : r[q.key] != null; })) has.push(k);
    });
    var cur = -1;
    function show(k) {
      if (k < 0) return; cur = k; var r = rows[k], cx = X(idx[k] + (bars ? (step - 1) / 2 : 0));
      cross.setAttribute('x1', cx); cross.setAttribute('x2', cx); cross.setAttribute('opacity', 0.7);
      marks.forEach(function (mk) { var v = r[mk.q.key]; if (v == null) mk.el.setAttribute('opacity', 0); else { mk.el.setAttribute('cx', cx); mk.el.setAttribute('cy', Y(v)); mk.el.setAttribute('opacity', 1); } });
      var html = o.tip ? o.tip(r) : '<b>' + G.wd(r.date) + ' ' + G.fmtDate(r.date) + '</b>' + o.series.map(function (q) {
        var v = q.kind === 'float' ? null : r[q.key];
        return '<div class="row"><span><span class="dot" style="background:' + q.color + '"></span>' + q.label + '</span><span>' + (v == null ? '–' : (q.fmt ? q.fmt(v) : G.num(v, 1))) + '</span></div>';
      }).join('');
      tip.innerHTML = html; tip.hidden = false;
      var tw = tip.offsetWidth, left = cx + 12; if (left + tw > W) left = cx - tw - 12; if (left < 0) left = 0;
      tip.style.left = left + 'px'; tip.style.top = (m.t + 4) + 'px';
      live.textContent = tip.textContent;
    }
    function hide() { cross.setAttribute('opacity', 0); marks.forEach(function (mk) { mk.el.setAttribute('opacity', 0); }); tip.hidden = true; cur = -1; }
    function nearest(ev) {
      var rect = svg.getBoundingClientRect(), px = (ev.clientX - rect.left) * (W / rect.width);
      var di = dmin + (px - m.l) / pw * (dmax - dmin) - (bars ? (step - 1) / 2 : 0), best = -1, bd = 1e9;
      has.forEach(function (k) { var dd = Math.abs(idx[k] - di); if (dd < bd) { bd = dd; best = k; } });
      return best;
    }
    var hit = s('rect', { x: m.l, y: m.t, width: pw, height: ph, fill: 'transparent' }, svg);
    hit.addEventListener('pointermove', function (e) { show(nearest(e)); });
    hit.addEventListener('pointerdown', function (e) { show(nearest(e)); });
    svg.addEventListener('pointerleave', hide);
    svg.addEventListener('blur', hide);
    svg.addEventListener('keydown', function (e) {
      var p = has.indexOf(cur), n = p;
      if (e.key === 'ArrowLeft') n = p < 0 ? has.length - 1 : Math.max(0, p - 1);
      else if (e.key === 'ArrowRight') n = p < 0 ? has.length - 1 : Math.min(has.length - 1, p + 1);
      else if (e.key === 'Home') n = 0; else if (e.key === 'End') n = has.length - 1;
      else if (e.key === 'Escape') { hide(); return; } else return;
      e.preventDefault(); if (has.length) show(has[n]);
    });
    return svg;
  };

  G.legend = function (items) {
    return '<div class="legend">' + items.map(function (i) {
      return '<span style="--c:' + i.color + '"><i' + (i.box ? ' class="box"' : '') + '></i>' + i.label + '</span>';
    }).join('') + '</div>';
  };
  G.zoneLegend = function () {
    return '<div class="legend zonelegend">' + ['Z1', 'Z2', 'Z3', 'Z4', 'Z5'].map(function (z) { return '<span><i class="zl ' + z.toLowerCase() + '" style="height:10px"></i>' + z + '</span>'; }).join('') + '</div>';
  };

  G.spark = function (vals, color, w, h) {
    w = w || 120; h = h || 34;
    var v = vals.filter(function (x) { return x != null; });
    if (v.length < 2) return '<svg viewBox="0 0 ' + w + ' ' + h + '" width="' + w + '" height="' + h + '" aria-hidden="true"></svg>';
    var lo = Math.min.apply(null, v), hi = Math.max.apply(null, v), span = hi - lo || 1, n = vals.length;
    var X = function (i) { return 3 + i / (n - 1) * (w - 6); }, Y = function (x) { return 3 + (1 - (x - lo) / span) * (h - 6); };
    var d = '', pen = false, last = null;
    vals.forEach(function (x, i) { if (x == null) { pen = false; return; } d += (pen ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(x).toFixed(1); pen = true; last = [X(i), Y(x)]; });
    return '<svg viewBox="0 0 ' + w + ' ' + h + '" width="' + w + '" height="' + h + '" aria-hidden="true" style="overflow:visible"><path d="' + d + '" fill="none" stroke="' + color + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="' + last[0] + '" cy="' + last[1] + '" r="3" fill="' + color + '"/></svg>';
  };
  G.zonebar = function (z) {
    if (!z) return '–';
    var t = z.reduce(function (a, b) { return a + (b || 0); }, 0) || 1;
    var title = z.map(function (v, i) { return 'Z' + (i + 1) + ' ' + G.num((v || 0) / 60, 0) + ' min'; }).join(', ');
    return '<div class="zonebar" role="img" aria-label="' + title + '" title="' + title + '">' + z.map(function (v) { return '<i style="width:' + ((v || 0) / t * 100).toFixed(1) + '%"></i>'; }).join('') + '</div>';
  };

  /* ---------- Sortierbare Tabellen ---------- */
  G.table = function (host, o) {
    var state = { key: o.sortKey, dir: o.sortDir || -1, q: '' }, rows = o.rows;
    host.innerHTML = '';
    if (o.search) {
      var lab = document.createElement('label'); lab.className = 'search';
      lab.innerHTML = '<span class="sr">Tabelle durchsuchen</span>' + G.icon('search') + '<input type="search" placeholder="Suchen (Datum, Wert …)" autocomplete="off">';
      host.appendChild(lab);
      lab.querySelector('input').addEventListener('input', function (e) { state.q = e.target.value.trim().toLowerCase(); draw(); });
    }
    var wrap = document.createElement('div'); wrap.className = 'table-wrap'; host.appendChild(wrap);
    var info = document.createElement('p'); info.className = 'sub'; host.appendChild(info);
    function val(c, r) { return c.sort ? c.sort(r) : r[c.key]; }
    function draw() {
      var list = rows.slice();
      if (state.q) list = list.filter(function (r) { return o.cols.some(function (c) { var t = String(c.text ? c.text(r) : (r[c.key] == null ? '' : r[c.key])); return t.toLowerCase().indexOf(state.q) >= 0; }); });
      var col = o.cols.filter(function (c) { return c.key === state.key; })[0];
      if (col) list.sort(function (a, b) {
        var x = val(col, a), y = val(col, b);
        if (x == null && y == null) return 0; if (x == null) return 1; if (y == null) return -1;
        return (x < y ? -1 : x > y ? 1 : 0) * state.dir;
      });
      var html = '<table><thead><tr>' + o.cols.map(function (c) {
        var cur = c.key === state.key;
        return '<th scope="col" aria-sort="' + (cur ? (state.dir > 0 ? 'ascending' : 'descending') : 'none') + '"' + (c.num ? ' class="num"' : '') + '><button type="button" data-k="' + c.key + '">' + c.label + (cur ? (state.dir > 0 ? ' ▲' : ' ▼') : '') + '</button></th>';
      }).join('') + '</tr></thead><tbody>' + list.map(function (r) {
        return '<tr>' + o.cols.map(function (c) { return '<td' + (c.num ? ' class="num"' : '') + '>' + (c.html ? c.html(r) : (c.text ? c.text(r) : (r[c.key] == null ? '–' : r[c.key]))) + '</td>'; }).join('') + '</tr>';
      }).join('') + '</tbody></table>';
      wrap.innerHTML = list.length ? html : '<div class="empty">Keine Einträge</div>';
      info.textContent = list.length + ' von ' + rows.length + ' Einträgen';
      wrap.querySelectorAll('th button').forEach(function (b) {
        b.addEventListener('click', function () {
          var k = b.getAttribute('data-k'); if (state.key === k) state.dir = -state.dir; else { state.key = k; state.dir = -1; }
          draw(); var nb = wrap.querySelector('th button[data-k="' + k + '"]'); if (nb) nb.focus();
        });
      });
    }
    draw();
  };

  G.debounce = function (fn, ms) { var t; return function () { clearTimeout(t); t = setTimeout(fn, ms); }; };
})();
