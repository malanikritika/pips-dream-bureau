/* ===========================================================
   Pip's Nursery — behaviour for page 1 (intro) and page 2 (menu)
   • Night ⇄ Day theme + outfit swap (Pip stays quiet until you ask)
   • Cute pitched voice (Web Speech API) that tells Pip's story
   • Soft generative lullaby (Web Audio API, no audio files!)
   • 3D tilt, waving, talking bounce, floating sparkles
   • Short star shower + menu + quick-nav bar
   =========================================================== */
(() => {
  "use strict";

  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const root = document.documentElement;
  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------------------------------------------------------
     STORY CONTENT  (edit the words here!)
     --------------------------------------------------------- */
  const STORY = {
    night: {
      greet: [
        { text: "Hi hi! I’m Pip! 👋", say: "Hi hi! I’m Pip!" },
        { text: "Cloud by night, code wizard by dawn. Welcome to the Midnight Nursery! 🌙",
          say: "Cloud by night, code wizard by dawn. Welcome to the Midnight Nursery!" },
        { text: "Ready for my story? It’s short and sparkly!", say: "Ready for my story? It’s short and sparkly!" },
      ],
      lines: [
        { text: "Night shift: I debug the sky. 🌙", say: "Night shift. I debug the sky." },
        { text: "Rescue mission: lost stars get walked home. ⭐", say: "Rescue mission. Lost stars get walked home." },
        { text: "Last stop: “One last dream… just for you.” 💗",
          say: "Last stop. One last dream... just for you.", quote: true },
      ],
      emoji: ["✨", "⭐", "💗", "🌙"],
    },
    day: {
      greet: [
        { text: "Ooh, good morning! ☀️", say: "Ooh! Good morning!" },
        { text: "Pyjamas out, sunny work outfit on!", say: "Pyjamas out, sunny work outfit on!" },
      ],
      lines: [
        { text: "Morning shift: I open the windows so every dream gets sunshine. ☀️",
          say: "Morning shift. I open the windows so every dream gets sunshine." },
        { text: "Ship mode: last night’s ideas become playful little websites. 🚀",
          say: "Ship mode. Last night’s ideas become playful little websites." },
        { text: "“Good morning, sunshine! Ready to make magic?” 🌻",
          say: "Good morning, sunshine! Ready to make magic?", quote: true },
      ],
      emoji: ["☀️", "🌻", "💗", "✨"],
    },
  };
  const GIGGLES = ["Hehe! That tickles!", "Boop! You found me!", "Eee! Hi again, friend!", "Careful, I’m 90% cloud!"];

  /* ---------------------------------------------------------
     STATE + ELEMENTS
     --------------------------------------------------------- */
  const el = {
    page1: $("#page1"), page2: $("#page2"),
    pipWrap: $("#pipWrap"), pip3d: $("#pip3d"), particles: $("#particles"),
    bubble: $("#bubble"), bubbleText: $("#bubbleText"), story: $("#story"),
    themeBtn: $("#themeBtn"), replayBtn: $("#replayBtn"), musicBtn: $("#musicBtn"),
    nextBtn: $("#nextBtn"), menuBtn: $("#menuBtn"), menuPanel: $("#menuPanel"),
    toast: $("#toast"), canvas: $("#shower"),
  };
  const state = { started: false, theme: "night", page: 1, token: 0, musicOn: true, speaking: false };

  /* ---------------------------------------------------------
     BACKGROUND STARS / DUST
     --------------------------------------------------------- */
  (function makeStars() {
    const frag = document.createDocumentFragment();
    const n = window.innerWidth < 600 ? 55 : 95;
    for (let i = 0; i < n; i++) {
      const s = document.createElement("i");
      const size = rand(1.5, 4);
      s.style.cssText = `left:${rand(0, 100)}%;top:${rand(0, 100)}%;width:${size}px;height:${size}px;` +
        `--d:${rand(2.5, 6)}s;--delay:${rand(0, 5)}s`;
      frag.appendChild(s);
    }
    $("#stars").appendChild(frag);
  })();

  /* ---------------------------------------------------------
     TOAST
     --------------------------------------------------------- */
  let toastTimer;
  function toast(msg) {
    el.toast.textContent = msg;
    el.toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.toast.classList.remove("show"), 2200);
  }

  /* ---------------------------------------------------------
     PARTICLES (floating emoji around Pip)
     --------------------------------------------------------- */
  function sparkle(n = 4, list = STORY[state.theme].emoji) {
    if (reduceMotion) return;
    for (let i = 0; i < n; i++) {
      const p = document.createElement("span");
      p.className = "p";
      p.textContent = pick(list);
      p.style.cssText = `left:${rand(12, 84)}%;top:${rand(18, 68)}%;--s:${rand(1.1, 2).toFixed(2)}rem;` +
        `--dx:${rand(-40, 40).toFixed(0)}px;--r:${rand(-40, 40).toFixed(0)}deg;animation-delay:${(i * 0.12).toFixed(2)}s`;
      el.particles.appendChild(p);
      setTimeout(() => p.remove(), 2600 + i * 120);
    }
  }

  /* ---------------------------------------------------------
     CUTE ACTIONS (wave / giggle / pop)
     --------------------------------------------------------- */
  function act(cls, ms) {
    el.pipWrap.classList.remove(cls);
    void el.pipWrap.offsetWidth; // restart animation
    el.pipWrap.classList.add(cls);
    setTimeout(() => el.pipWrap.classList.remove(cls), ms);
  }
  const wave = () => act("waving", 1700);
  setInterval(() => { if (state.started && state.page === 1 && !state.speaking) wave(); }, 8000);

  /* ---------------------------------------------------------
     3D TILT — Pip leans toward your pointer / finger
     --------------------------------------------------------- */
  function tilt(e) {
    if (state.page !== 1 || reduceMotion) return;
    const x = (e.clientX / window.innerWidth - 0.5) * 2;
    const y = (e.clientY / window.innerHeight - 0.5) * 2;
    el.pip3d.style.transform = `rotateY(${(x * 14).toFixed(1)}deg) rotateX(${(-y * 9).toFixed(1)}deg)`;
  }
  window.addEventListener("pointermove", tilt, { passive: true });
  window.addEventListener("pointerleave", () => (el.pip3d.style.transform = ""));

  /* ---------------------------------------------------------
     VOICE — Web Speech API, pitched up to sound tiny & cute
     --------------------------------------------------------- */
  const synth = "speechSynthesis" in window ? window.speechSynthesis : null;
  let voice = null;
  function pickVoice() {
    if (!synth) return;
    const list = synth.getVoices();
    if (!list.length) return;
    const en = list.filter((v) => /^en/i.test(v.lang));
    const pref = /(samantha|google uk english female|google us english|aria|jenny|zira|karen|moira|tessa|serena|female)/i;
    voice = en.find((v) => pref.test(v.name)) || en[0] || list[0];
  }
  if (synth) { pickVoice(); synth.addEventListener?.("voiceschanged", pickVoice); }

  function stopSpeaking() {
    state.token++;
    if (synth && (synth.speaking || synth.pending)) synth.cancel();
    el.pipWrap.classList.remove("talking");
    state.speaking = false;
    Music.duck(false);
  }

  // Speak one sentence. Resolves when finished (or cancelled / unsupported).
  function say(text, token) {
    return new Promise((resolve) => {
      const done = () => { clearTimeout(safety); el.pipWrap.classList.remove("talking"); resolve(); };
      const est = text.length * 75 + 1200;
      const safety = setTimeout(done, est + 5000);
      el.pipWrap.classList.add("talking");
      if (!synth || token !== state.token) {
        setTimeout(done, est); // silent fallback keeps the story moving
        return;
      }
      const u = new SpeechSynthesisUtterance(text);
      if (voice) { u.voice = voice; u.lang = voice.lang; } else { u.lang = "en-US"; }
      u.pitch = 1.9;   // high = tiny & cute
      u.rate = 1.02;
      u.volume = 1;
      u.onend = done;
      u.onerror = done;
      synth.speak(u);
    });
  }

  /* ---------------------------------------------------------
     STORY ENGINE — shows lines, speaks them, animates Pip
     --------------------------------------------------------- */
  function showBubble(text) {
    el.bubble.classList.remove("quiet");
    el.bubbleText.textContent = text;
  }

  function renderStoryLines(theme) {
    el.story.innerHTML = "";
    STORY[theme].lines.forEach((l) => {
      const p = document.createElement("p");
      p.textContent = l.text;
      if (l.quote) p.classList.add("quote");
      el.story.appendChild(p);
    });
  }

  async function tell(theme, { withGreeting = true } = {}) {
    stopSpeaking();
    const token = state.token;
    const data = STORY[theme];
    state.speaking = true;
    Music.duck(true);
    renderStoryLines(theme);
    const paras = $$("p", el.story);

    const sequence = [];
    if (withGreeting) data.greet.forEach((g) => sequence.push({ ...g, kind: "greet" }));
    data.lines.forEach((l, i) => sequence.push({ ...l, kind: "line", i }));

    for (const item of sequence) {
      if (token !== state.token) return;
      showBubble(item.text);
      if (item.kind === "greet" || item.i === 0) wave();
      sparkle(3);
      if (item.kind === "line") {
        paras.forEach((p) => p.classList.remove("now"));
        paras[item.i].classList.add("show", "now");
      }
      await say(item.say, token);
      if (token !== state.token) return;
      await sleep(350);
    }
    if (token !== state.token) return;
    paras.forEach((p) => p.classList.remove("now"));
    state.speaking = false;
    Music.duck(false);
    showBubble(theme === "night" ? "Psst… boop me! 💗" : "Boop me! Hehe! 🌻");
    sparkle(6);
  }

  /* ---------------------------------------------------------
     THEME — night ⇄ day (+ outfit swap). Pip no longer talks on
     switch; he speaks only when tapped or on "Hear Pip again".
     --------------------------------------------------------- */
  function applyTheme(theme) {
    state.theme = theme;
    root.setAttribute("data-theme", theme);
    const night = theme === "night";
    $(".theme-ico", el.themeBtn).textContent = night ? "☀️" : "🌙";
    $(".theme-label", el.themeBtn).textContent = night ? "Wake up the day" : "Back to bedtime";
    $$("[data-theme-set]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.themeSet === theme)));
    Music.setMode(theme);
    Shower.recolor();
  }

  function switchTheme(theme) {
    if (theme === state.theme) return;
    stopSpeaking();           // make sure Pip is quiet after a switch
    applyTheme(theme);
    renderStoryLines(theme);
    $$("p", el.story).forEach((p) => p.classList.add("show"));
    if (state.page === 1 && state.started) {
      act("pop", 950);
      sparkle(8, theme === "day" ? ["☀️", "🌻", "✨"] : ["🌙", "⭐", "✨"]);
      Shower.burst(window.innerWidth * 0.5, window.innerHeight * 0.4, 36);
      showBubble(theme === "day" ? "Good morning! Boop me to chat 🌻" : "Back to bedtime! Boop me 🌙");
    }
  }

  el.themeBtn.addEventListener("click", () => switchTheme(state.theme === "night" ? "day" : "night"));
  $$("[data-theme-set]").forEach((b) => b.addEventListener("click", () => switchTheme(b.dataset.themeSet)));
  el.replayBtn.addEventListener("click", () => { if (state.started) tell(state.theme, { withGreeting: false }); });

  // Tap Pip → giggle
  el.pipWrap.addEventListener("click", () => {
    if (!state.started) return;
    act("giggle", 650);
    sparkle(5, ["💗", "✨", "⭐"]);
    if (!state.speaking) {
      const token = ++state.token;
      const line = pick(GIGGLES);
      showBubble(line);
      Music.duck(true);
      say(line, token).then(() => { if (token === state.token) Music.duck(false); });
    }
  });

  /* ---------------------------------------------------------
     MUSIC — soft music-box lullaby made with the Web Audio API
     --------------------------------------------------------- */
  const Music = (() => {
    let ctx, master, bus, timer, mode = "night", step = 0, nextTime = 0;
    let enabled = true, active = false, ducked = false;
    const LEVEL = 0.8;

    const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);
    const PATTERNS = {
      night: { // slow, dreamy, sparse music-box
        bpm: 56,
        chords: [[48, 55, 59, 64], [45, 52, 55, 60], [41, 48, 52, 57], [43, 50, 52, 59]],
        mel: [
          [76, 0, 79, 0, 81, 0, 79, 0], [76, 0, 74, 0, 72, 0, 0, 0],
          [74, 0, 76, 0, 79, 0, 76, 0], [74, 0, 72, 0, 0, 0, 0, 0],
        ],
        sparkle: [84, 88, 91, 86],
      },
      day: { // lighter, bouncier, still gentle
        bpm: 82,
        chords: [[48, 55, 60, 64], [43, 50, 55, 59], [45, 52, 57, 60], [41, 48, 53, 57]],
        mel: [
          [72, 76, 79, 76, 84, 79, 76, 79], [71, 74, 79, 74, 83, 79, 74, 79],
          [69, 72, 76, 72, 81, 76, 72, 76], [69, 72, 77, 72, 81, 77, 72, 76],
        ],
        sparkle: [88, 91, 93, 86],
      },
    };

    function impulse(seconds, decay) {
      const rate = ctx.sampleRate, len = rate * seconds;
      const buf = ctx.createBuffer(2, len, rate);
      for (let c = 0; c < 2; c++) {
        const d = buf.getChannelData(c);
        for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
      }
      return buf;
    }

    function init() {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain(); master.gain.value = 0;
      const comp = ctx.createDynamicsCompressor();
      master.connect(comp); comp.connect(ctx.destination);
      bus = ctx.createGain(); bus.connect(master);
      const conv = ctx.createConvolver(); conv.buffer = impulse(2.8, 2.4);
      const wet = ctx.createGain(); wet.gain.value = 0.55;
      bus.connect(conv); conv.connect(wet); wet.connect(master);
      return true;
    }

    function bell(m, t, vel, dur) {
      const f = hz(m);
      [[1, "sine", 1], [2, "sine", 0.28], [4.1, "sine", 0.08]].forEach(([mult, type, amp], idx) => {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = type; o.frequency.value = f * mult;
        const d = dur / (idx + 1);
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(vel * amp, t + 0.012);
        g.gain.exponentialRampToValueAtTime(0.0001, t + d);
        o.connect(g); g.connect(bus);
        o.start(t); o.stop(t + d + 0.05);
      });
    }

    function pad(m, t, dur) {
      const o = ctx.createOscillator(), g = ctx.createGain(), lp = ctx.createBiquadFilter();
      o.type = "triangle"; o.frequency.value = hz(m);
      lp.type = "lowpass"; lp.frequency.value = 700;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.035, t + dur * 0.35);
      g.gain.linearRampToValueAtTime(0, t + dur);
      o.connect(lp); lp.connect(g); g.connect(bus);
      o.start(t); o.stop(t + dur + 0.05);
    }

    function schedule(s, t) {
      const P = PATTERNS[mode], eighth = 30 / P.bpm;
      const bar = Math.floor(s / 8) % 4, beat = s % 8;
      if (beat === 0) {
        P.chords[bar].forEach((m) => pad(m, t, eighth * 8));
        bell(P.chords[bar][0] - 12, t, 0.16, 2.4); // soft bass note
      }
      const note = P.mel[bar][beat];
      if (note) bell(note, t, 0.13, mode === "night" ? 2.2 : 1.4);
      else if (beat % 2 === 1 && Math.random() < 0.14) bell(pick(P.sparkle), t, 0.045, 2.6); // random twinkle
    }

    function tick() {
      const eighth = 30 / PATTERNS[mode].bpm;
      while (nextTime < ctx.currentTime + 0.3) {
        schedule(step, nextTime);
        nextTime += eighth; step++;
      }
    }

    function apply(time = 1.2) {
      if (!ctx) return;
      const target = enabled && active ? LEVEL * (ducked ? 0.35 : 1) : 0;
      master.gain.cancelScheduledValues(ctx.currentTime);
      master.gain.setTargetAtTime(target, ctx.currentTime, time / 3);
    }

    return {
      start() {
        if (!ctx && !init()) return;
        ctx.resume();
        active = true;
        if (!timer) { nextTime = ctx.currentTime + 0.15; step = 0; timer = setInterval(tick, 50); }
        apply(2);
      },
      pause() { // used when leaving page 1
        active = false; apply(0.8);
        setTimeout(() => { if (!active && timer) { clearInterval(timer); timer = null; } }, 1500);
      },
      resume() { if (state.started) this.start(); },
      setEnabled(on) { enabled = on; apply(0.5); },
      isEnabled: () => enabled,
      duck(on) { ducked = on; apply(0.6); },
      setMode(m) { mode = m; step = Math.ceil(step / 8) * 8; },
      suspend() { if (ctx) ctx.suspend(); },
      unsuspend() { if (ctx && active && enabled) ctx.resume(); },
    };
  })();

  el.musicBtn.addEventListener("click", () => {
    state.musicOn = !state.musicOn;
    Music.setEnabled(state.musicOn);
    el.musicBtn.setAttribute("aria-pressed", String(state.musicOn));
    el.musicBtn.setAttribute("aria-label", state.musicOn ? "Mute music" : "Unmute music");
  });
  document.addEventListener("visibilitychange", () => (document.hidden ? Music.suspend() : Music.unsuspend()));

  /* ---------------------------------------------------------
     STAR SHOWER (canvas) — now a short, gentle burst that stops
     --------------------------------------------------------- */
  const Shower = (() => {
    const c = el.canvas, g = c.getContext("2d");
    let W = 0, H = 0, dpr = 1, parts = [], running = false, rate = 0, heavyUntil = 0;
    const PAL = {
      night: ["#ffe08a", "#ffffff", "#b9a4ff", "#ffb3d9", "#9fd3ff"],
      day:   ["#ffd37a", "#fff1c1", "#e07a10", "#c2410c", "#7a3b12"],
    };

    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = window.innerWidth; H = window.innerHeight;
      c.width = W * dpr; c.height = H * dpr;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    window.addEventListener("resize", resize); resize();

    function starPath(x, y, r, rot) {
      g.beginPath();
      for (let i = 0; i < 10; i++) {
        const rr = i % 2 ? r * 0.45 : r, a = rot + (i * Math.PI) / 5 - Math.PI / 2;
        g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
      }
      g.closePath();
    }

    function spawnFall() {
      const col = pick(PAL[state.theme]);
      parts.push({
        x: rand(-0.1 * W, 1.1 * W), y: -20, vx: rand(-1.6, -0.2), vy: rand(2.4, 6),
        r: rand(5, 13), rot: rand(0, 6), vr: rand(-0.05, 0.05), col, life: 1, trail: true, tw: rand(0, 6),
      });
    }

    function frame(t) {
      if (!running) return;
      g.clearRect(0, 0, W, H);
      const heavy = t < heavyUntil;
      rate += heavy ? 0.3 : 0;   // gentle: ~18 stars a second, only during the start
      while (rate >= 1 && parts.length < 80) { spawnFall(); rate -= 1; }
      if (rate >= 1) rate = 0;
      parts = parts.filter((p) => p.y < H + 40 && p.life > 0.02);
      for (const p of parts) {
        p.x += p.vx; p.y += p.vy; p.rot += p.vr; p.tw += 0.15;
        if (p.burst) { p.vy += 0.06; p.life -= 0.016; }
        const alpha = Math.max(0, p.life) * (0.75 + 0.25 * Math.sin(p.tw));
        g.globalAlpha = alpha;
        if (p.trail) { // glowing streak behind each star
          const grad = g.createLinearGradient(p.x, p.y, p.x - p.vx * 12, p.y - p.vy * 12);
          grad.addColorStop(0, p.col); grad.addColorStop(1, "transparent");
          g.strokeStyle = grad; g.lineWidth = p.r * 0.35; g.lineCap = "round";
          g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(p.x - p.vx * 12, p.y - p.vy * 12); g.stroke();
        }
        g.fillStyle = p.col; g.shadowColor = p.col; g.shadowBlur = 12;
        starPath(p.x, p.y, p.r, p.rot); g.fill();
      }
      g.shadowBlur = 0; g.globalAlpha = 1;
      if (!parts.length && !heavy) { running = false; g.clearRect(0, 0, W, H); return; }  // all done: stop
      requestAnimationFrame(frame);
    }

    function run() { if (!running) { running = true; requestAnimationFrame(frame); } }

    return {
      start(ms = 2500) { heavyUntil = performance.now() + ms; run(); },
      burst(x, y, n = 30) {
        if (reduceMotion) return;
        for (let i = 0; i < n; i++) {
          const a = rand(0, Math.PI * 2), s = rand(2, 7);
          parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 2, r: rand(4, 9), rot: rand(0, 6),
            vr: rand(-0.1, 0.1), col: pick(PAL[state.theme]), life: 1, burst: true, tw: rand(0, 6) });
        }
        run();
      },
      recolor() { parts.forEach((p) => (p.col = pick(PAL[state.theme]))); },
      clear() { parts = []; },
    };
  })();

  /* ---------------------------------------------------------
     NAVIGATION (page 1 ⇄ page 2) + QUICK-NAV BAR + MENU
     --------------------------------------------------------- */
  function setActiveNav(key) {
    $$(".nav-link").forEach((b) => b.classList.toggle("active", b.dataset.nav === key));
  }

  function show(n) {
    state.page = n;
    el.page1.classList.toggle("active", n === 1);
    el.page2.classList.toggle("active", n === 2);
    el.page1.setAttribute("aria-hidden", String(n !== 1));
    el.page2.setAttribute("aria-hidden", String(n !== 2));
    setActiveNav(n === 1 ? "meet" : "dream");
    window.scrollTo(0, 0);
  }

  function goPage2() {
    show(2);                           // switch page first, so nothing can block it
    try { stopSpeaking(); } catch (e) { /* voice not available */ }
    try { Music.pause(); } catch (e) { /* music lives on page 1 only */ }
    try {
      Shower.burst(window.innerWidth / 2, window.innerHeight - 70, 14);
      Shower.start(2500);              // ✨ short star shower, then it stops
    } catch (e) { /* canvas problem – page still opens */ }
  }

  function goPage1() {
    show(1);
    Music.resume();
    sparkle(6);
  }

  el.nextBtn.addEventListener("click", goPage2);

  const NAV = {
    meet:    { page: 1, sel: null },
    story:   { page: 1, sel: "#storyCard" },
    dream:   { page: 2, sel: null },
    secrets: { page: 2, sel: "#secrets" },
  };

  function goTo(key) {
    const t = NAV[key];
    if (!t) return;
    if (state.page !== t.page) (t.page === 2 ? goPage2 : goPage1)();
    setActiveNav(key);
    const behavior = reduceMotion ? "auto" : "smooth";
    setTimeout(() => {
      if (t.sel) $(t.sel).scrollIntoView({ behavior, block: "start" });
      else window.scrollTo({ top: 0, behavior });
    }, 80);
  }
  $$(".nav-link").forEach((b) => b.addEventListener("click", () => goTo(b.dataset.nav)));

  function toggleMenu(open) {
    const isOpen = open ?? !el.menuPanel.classList.contains("open");
    el.menuPanel.classList.toggle("open", isOpen);
    el.menuBtn.setAttribute("aria-expanded", String(isOpen));
    el.menuBtn.setAttribute("aria-label", isOpen ? "Close menu" : "Open menu");
  }
  el.menuBtn.addEventListener("click", (e) => { e.stopPropagation(); toggleMenu(); });
  document.addEventListener("click", (e) => { if (!el.menuPanel.contains(e.target) && e.target !== el.menuBtn) toggleMenu(false); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") toggleMenu(false); });

  $$(".menu-link").forEach((b) =>
    b.addEventListener("click", () => {
      if (b.dataset.go === "home") {
        toggleMenu(false);
        goPage1();
      } else if (b.dataset.soon) {
        toast(`${b.dataset.soon} is coming soon ✨`);
      }
    })
  );

  /* ---------------------------------------------------------
     FIRST TAP  (browsers allow sound + voice only after a tap)
     --------------------------------------------------------- */
  applyTheme("night");

  renderStoryLines("night");
  $$("p", el.story).forEach((p) => p.classList.add("show"));
  showBubble("Psst… tap anywhere and I’ll spill my dreams! 👋");
  setTimeout(wave, 600);

  function begin(e) {
    if (state.started) return;
    state.started = true;
    ["click", "touchend", "keydown"].forEach((ev) => window.removeEventListener(ev, begin));
    if (state.page !== 1) return;
    Music.setMode(state.theme);
    Music.start();
    // Tapping the theme switch or the nav bar should NOT make Pip talk
    const quietTap = e && e.target && e.target.closest && e.target.closest("#themeBtn, .seg-btn, .navbar");
    if (!quietTap) tell(state.theme);   // starts inside the tap, so iOS/Safari allow the voice
  }
  ["click", "touchend", "keydown"].forEach((ev) => window.addEventListener(ev, begin));
})();