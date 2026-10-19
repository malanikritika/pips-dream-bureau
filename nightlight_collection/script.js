/* Day / Night toggle for this page */
(function () {
  const btn = document.getElementById('nl-theme');
  if (!btn) return;
  btn.addEventListener('click', function () {
    const goingNight = document.body.classList.contains('day-mode');
    document.body.classList.toggle('day-mode', !goingNight);
    document.body.classList.toggle('night-mode', goingNight);
    btn.textContent = goingNight ? '☀️ Day Mode' : '🌙 Night Mode';
  });
})();

/* Nightlight Collection */
(function () {
  const section = document.getElementById('nightlights');
  if (!section) return;

  const cards = Array.from(section.querySelectorAll('.lamp-card'));
  const countEl = document.getElementById('lamp-count');
  const secretEl = document.getElementById('lamp-secret');
  const allOnBtn = document.getElementById('lamps-all-on');
  const allOffBtn = document.getElementById('lamps-all-off');
  const darkBtn = document.getElementById('lamps-dark-toggle');

  function setLamp(card, on) {
    card.classList.toggle('is-on', on);
    card.querySelector('.lamp-button').setAttribute('aria-pressed', String(on));
    card.querySelector('.lamp-status').textContent = on ? 'glowing' : 'off';
  }

  function updateCount() {
    const lit = cards.filter(function (c) { return c.classList.contains('is-on'); }).length;
    countEl.textContent = lit + ' of ' + cards.length + ' lamps glowing';
    secretEl.hidden = lit !== cards.length;
  }

  cards.forEach(function (card) {
    card.querySelector('.lamp-button').addEventListener('click', function () {
      setLamp(card, !card.classList.contains('is-on'));
      updateCount();
    });
  });

  allOnBtn.addEventListener('click', function () {
    cards.forEach(function (c, i) {
      setTimeout(function () { setLamp(c, true); updateCount(); }, i * 140);
    });
  });

  allOffBtn.addEventListener('click', function () {
    cards.forEach(function (c) { setLamp(c, false); });
    updateCount();
  });

  darkBtn.addEventListener('click', function () {
    const dark = section.classList.toggle('is-dark');
    darkBtn.setAttribute('aria-pressed', String(dark));
    darkBtn.textContent = dark ? 'Brighten the room ☀️' : 'Dim the room 🌑';
  });
})();