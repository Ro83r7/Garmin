/* Telefone zur mobilen Ansicht, außer die Wahl "Desktop" ist gespeichert oder per ?view=desktop gesetzt. */
(function () {
  try {
    var pref = null, q = location.search;
    try { pref = localStorage.getItem('garmin-view'); } catch (e) {}
    if (/[?&]view=desktop/.test(q)) { try { localStorage.setItem('garmin-view', 'desktop'); } catch (e) {} return; }
    var phone = /iPhone/.test(navigator.userAgent) || Math.min(screen.width || 9999, window.innerWidth) < 700;
    if (pref === 'mobile' || (pref !== 'desktop' && phone)) location.replace('/m/');
  } catch (e) {}
})();
