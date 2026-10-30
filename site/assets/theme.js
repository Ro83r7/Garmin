/* Design-Wahl: früh laden, damit nichts flackert. Speicherung nur im Browser (try/catch). */
(function () {
  var LIST = ['aurora', 'sorbet', 'klassisch'], KEY = 'garmin-theme', COLORS = { aurora: '#0a0e1f', sorbet: '#fff8f1' };
  function get() {
    var v = null;
    try { v = localStorage.getItem(KEY); } catch (e) { /* ignorieren */ }
    return LIST.indexOf(v) >= 0 ? v : 'aurora';
  }
  function apply(t) {
    document.documentElement.setAttribute('data-theme', t);
    var metas = document.querySelectorAll('meta[name="theme-color"]');
    for (var i = 0; i < metas.length; i++) {
      var m = metas[i];
      if (!m.hasAttribute('data-orig')) m.setAttribute('data-orig', m.getAttribute('content'));
      m.setAttribute('content', COLORS[t] || m.getAttribute('data-orig'));
    }
  }
  function set(t) {
    if (LIST.indexOf(t) < 0) return;
    try { localStorage.setItem(KEY, t); } catch (e) { /* ignorieren */ }
    apply(t);
  }
  window.GTheme = { list: LIST, get: get, set: set };
  apply(get());
})();
