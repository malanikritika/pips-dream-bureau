(function () {
  if (window.__pipFx) return;
  window.__pipFx = true;

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- Sound on/off (remembered across pages) ---------- */
  var muted = false;
  try { muted = localStorage.getItem('pipMuted') === '1'; } catch (e) {}

  var btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'fx-sound';
  btn.setAttribute('aria-label', 'Sound effects');
  function paint() {
    btn.textContent = muted ? '🔇' : '🔔';
    btn.setAttribute('aria-pressed', String(!muted));
    btn.title = muted ? 'Sound effects off' : 'Sound effects on';
  }
  paint();
  btn.addEventListener('click', function () {
    muted = !muted;
    try { localStorage.setItem('pipMuted', muted ? '1' : '0'); } catch (e) {}
    paint();
    chime();
  });
  document.body.appendChild(btn);

  /* ---------- Soft chime (Web Audio) ---------- */
  var ac;
  var notes = [0, 2, 4, 7, 9, 12];
  function chime() {
    if (muted) return;
    try {
      ac = ac || new (window.AudioContext || window.webkitAudioContext)();
      if (ac.state === 'suspended') ac.resume();
      var f = 523.25 * Math.pow(2, notes[Math.floor(Math.random() * notes.length)] / 12);
      var t = ac.currentTime;
      var o = ac.createOscillator();
      var g = ac.createGain();
      o.type = 'sine';
      o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.12, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);
      o.connect(g);
      g.connect(ac.destination);
      o.start(t);
      o.stop(t + 0.75);
    } catch (e) { /* sound is optional */ }
  }

  /* ---------- Sparkle cursor trail ---------- */
  var glyphs = ['✦', '✧', '⭐', '✨'];
  var lastT = 0;
  window.addEventListener('pointermove', function (e) {
    if (reduce) return;
    var now = performance.now();
    if (now - lastT < 45) return;
    lastT = now;
    var s = document.createElement('span');
    s.className = 'fx-sparkle';
    s.textContent = glyphs[Math.floor(Math.random() * glyphs.length)];
    s.style.left = e.clientX + 'px';
    s.style.top = e.clientY + 'px';
    document.body.appendChild(s);
    setTimeout(function () { s.remove(); }, 800);
  }, { passive: true });

  /* ---------- Click burst + chime ---------- */
  var burstGlyphs = ['⭐', '✦', '🌙', '✨', '💫'];
  window.addEventListener('pointerdown', function (e) {
    chime();
    if (reduce || e.target.closest('.fx-sound')) return;
    for (var i = 0; i < 8; i++) {
      var p = document.createElement('span');
      p.className = 'fx-burst';
      p.textContent = burstGlyphs[Math.floor(Math.random() * burstGlyphs.length)];
      p.style.left = e.clientX + 'px';
      p.style.top = e.clientY + 'px';
      document.body.appendChild(p);
      var a = (Math.PI * 2 * i) / 8 + Math.random() * 0.5;
      var d = 40 + Math.random() * 40;
      (function (el, dx, dy) {
        var anim = el.animate([
          { transform: 'translate(0,0) scale(1)', opacity: 1 },
          { transform: 'translate(' + dx + 'px,' + dy + 'px) scale(.3)', opacity: 0 }
        ], { duration: 700, easing: 'ease-out' });
        anim.onfinish = function () { el.remove(); };
      })(p, Math.cos(a) * d, Math.sin(a) * d);
    }
  });

  /* ---------- Pip follows the cursor (main page only) ---------- */
  var pip = document.getElementById('pipBody') || document.querySelector('.pip-body');
  if (pip && !reduce) {
    var tx = 0, ty = 0, cx = 0, cy = 0, raf = 0;
    function tick() {
      cx += (tx - cx) * 0.12;
      cy += (ty - cy) * 0.12;
      pip.style.translate = cx.toFixed(1) + 'px ' + cy.toFixed(1) + 'px';
      pip.style.rotate = (cx * 0.35).toFixed(2) + 'deg';
      if (Math.abs(tx - cx) > 0.1 || Math.abs(ty - cy) > 0.1) {
        raf = requestAnimationFrame(tick);
      } else {
        raf = 0;
      }
    }
    window.addEventListener('pointermove', function (e) {
      tx = (e.clientX / window.innerWidth - 0.5) * 28;
      ty = (e.clientY / window.innerHeight - 0.5) * 18;
      if (!raf) raf = requestAnimationFrame(tick);
    }, { passive: true });

    /* Click Pip: bounce + a new line in his speech bubble */
    var lines = ['Hehe, that tickles! ☁️', 'Boop! ✨', 'Shh... I was dreaming 💤', 'Want to see my lanterns? 🏮', 'Sweet dreams! 🌙'];
    var bubbleText = document.getElementById('bubbleText');
    pip.addEventListener('click', function () {
      pip.animate(
        [{ scale: 1 }, { scale: 1.1 }, { scale: 0.96 }, { scale: 1 }],
        { duration: 450, easing: 'ease-out' }
      );
      if (bubbleText) {
        bubbleText.textContent = lines[Math.floor(Math.random() * lines.length)];
      }
    });
  }
})();