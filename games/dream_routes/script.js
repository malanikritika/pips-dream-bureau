/* ===========================================================
   Dream Delivery Routes — self-contained interactive map (plain JS + SVG, no libraries, no map tiles)
   • Tap rooftops to plan a route, then Pip floats across town delivering a dream to each one
   • "Smart route" finds the shortest tour; speed + chimes options
   • Public API: window.DreamRoutes.{deliver, stop, clear, smart}
   • Events on document: "dreamroutes:start", "dreamroutes:done"
   =========================================================== */
(function () {
  "use strict";

  const W = 900, H = 520, NS = "http://www.w3.org/2000/svg";
  const HOME = { x: 84, y: 106 };
  const SPEED = { cozy: 140, normal: 230, zoom: 380 };   // px per second
  const HOVER = { cozy: 2.3, normal: 1.6, zoom: 1.0 };   // seconds spent at each house

  const HOUSES = [
    { name: "Ollie's Attic",          to: "Ollie",                 emoji: "🐋", dream: "Flying Whale Dream",     cx: 100, base: 440, w: 64, h: 56,  r: 30 },
    { name: "Mia's Treehouse",        to: "Mia",                   emoji: "🦄", dream: "Rainbow Pony Picnic",    cx: 210, base: 390, w: 58, h: 48,  r: 30 },
    { name: "The Night Owl Café",     to: "the Night Owls",        emoji: "☕", dream: "Cocoa River Cruise",     cx: 320, base: 450, w: 74, h: 64,  r: 34 },
    { name: "Grandma Bea's Bakery",   to: "Grandma Bea",           emoji: "🍪", dream: "Cookie Mountain Hike",   cx: 435, base: 410, w: 70, h: 60,  r: 32 },
    { name: "Compile Street Cottage", to: "the Compile Street Crew", emoji: "🐛", dream: "Bunnies That Fix Bugs", cx: 545, base: 455, w: 66, h: 56,  r: 32 },
    { name: "Moonbeam Tower",         to: "Luna",                  emoji: "🌙", dream: "A Ladder to the Moon",   cx: 650, base: 400, w: 48, h: 120, r: 36 },
    { name: "Lullaby Lighthouse",     to: "Captain Nod",           emoji: "🐙", dream: "Octopus Orchestra",      cx: 750, base: 460, w: 56, h: 90,  r: 30 },
    { name: "Snuggle Farm",           to: "Farmer Fern",           emoji: "🐑", dream: "Counting Sheep Parade",  cx: 840, base: 420, w: 66, h: 54,  r: 30 },
  ];
  HOUSES.forEach((h, i) => { h.id = "h" + i; h.pt = { x: h.cx, y: h.base - h.h - h.r - 10 }; });

  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const ease = (u) => 0.5 - Math.cos(Math.PI * u) / 2;

  /* ---------- geometry: each leg is a gentle upward arc (quadratic Bézier) ---------- */
  function makeLeg(a, b, stopIdx) {
    const d = dist(a, b);
    const c = { x: (a.x + b.x) / 2, y: Math.max(16, Math.min(a.y, b.y) - 40 - d * 0.18) };
    let len = 0, prev = a;
    for (let i = 1; i <= 24; i++) { const p = bez({ a, c, b }, i / 24); len += dist(prev, p); prev = p; }
    return { a, c, b, len, stopIdx };
  }
  function bez(L, t) {
    const m = 1 - t;
    return { x: m * m * L.a.x + 2 * m * t * L.c.x + t * t * L.b.x, y: m * m * L.a.y + 2 * m * t * L.c.y + t * t * L.b.y };
  }
  function tangent(L, t) {
    return { x: 2 * (1 - t) * (L.c.x - L.a.x) + 2 * t * (L.b.x - L.c.x), y: 2 * (1 - t) * (L.c.y - L.a.y) + 2 * t * (L.b.y - L.c.y) };
  }

  /* ---------- shortest tour (brute force, ≤ 8 stops) ---------- */
  function shortestTour(stops) {
    let best = null, bestLen = Infinity;
    const used = new Array(stops.length).fill(false), cur = [];
    (function go(last, len) {
      if (len >= bestLen) return;
      if (cur.length === stops.length) {
        const total = len + dist(last, HOME);
        if (total < bestLen) { bestLen = total; best = cur.slice(); }
        return;
      }
      for (let i = 0; i < stops.length; i++) {
        if (used[i]) continue;
        used[i] = true; cur.push(stops[i]);
        go(stops[i].pt, len + dist(last, stops[i].pt));
        cur.pop(); used[i] = false;
      }
    })(HOME, 0);
    return best || stops;
  }

  const Api = {};
  window.DreamRoutes = Api;

  function init() {
    const root = document.getElementById("dreamRoutes");
    if (!root || root.dataset.ready) return;
    root.dataset.ready = "1";

    const $ = (id) => document.getElementById(id);
    const el = {
      svg: $("drMap"), wrap: $("drWrap"), bubble: $("drBubble"), info: $("drInfo"), list: $("drList"),
      stops: $("drStatStops"), done: $("drStatDone"), miles: $("drStatMiles"),
      go: $("drDeliver"), smart: $("drSmart"), clear: $("drClear"), speed: $("drSpeed"), chime: $("drChime"),
    };
    const htmlEl = document.documentElement;
    const theme = () => (htmlEl.getAttribute("data-theme") === "day" ? "day" : "night");
    const svgEl = (tag, attrs, parent) => {
      const n = document.createElementNS(NS, tag);
      for (const k in attrs) n.setAttribute(k, attrs[k]);
      if (parent) parent.appendChild(n);
      return n;
    };

    let route = [], delivered = new Set();
    let flying = false, legs = [], legIdx = 0, elapsed = 0, legDur = 1, phase = "fly", hoverLeft = 0, raf = 0, last = 0, hideT = 0;
    const nodes = {};                  // house id -> { g, badgeText }
    let pipG, pipImg, routePath;

    /* ---------- build the SVG town ---------- */
    function build() {
      const svg = el.svg;
      svg.innerHTML = "";
      const defs = svgEl("defs", {}, svg);
      const sky = svgEl("linearGradient", { id: "drSky", x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
      svgEl("stop", { class: "dr-s1", offset: 0 }, sky);
      svgEl("stop", { class: "dr-s2", offset: 1 }, sky);
      const glow = svgEl("radialGradient", { id: "drGlow" }, defs);
      svgEl("stop", { offset: 0, style: "stop-color:var(--dr-orb);stop-opacity:.55" }, glow);
      svgEl("stop", { offset: 1, style: "stop-color:var(--dr-orb);stop-opacity:0" }, glow);

      svgEl("rect", { width: W, height: H, fill: "url(#drSky)" }, svg);

      const stars = svgEl("g", { class: "dr-stars" }, svg);
      for (let i = 0; i < 42; i++) {
        const c = svgEl("circle", { class: "dr-star", cx: (i * 137.5) % W, cy: 12 + ((i * 53.3) % 230), r: 0.8 + (i % 3) * 0.5 }, stars);
        c.style.animationDelay = (i % 7) * 0.45 + "s";
      }
      svgEl("circle", { cx: 815, cy: 72, r: 78, fill: "url(#drGlow)" }, svg);
      svgEl("circle", { class: "dr-orb", cx: 815, cy: 72, r: 27 }, svg);

      [[560, 70, "dr-cloud-drift"], [280, 150, "dr-cloud-drift slow"]].forEach(([x, y, cls]) => {
        const g = svgEl("g", { class: cls }, svg);
        [[0, 0, 34, 13], [28, -8, 28, 15], [-26, 4, 24, 11], [52, 5, 22, 10]].forEach(([dx, dy, rx, ry]) =>
          svgEl("ellipse", { class: "dr-cloud-bit", cx: x + dx, cy: y + dy, rx, ry }, g));
      });

      svgEl("path", { class: "dr-hill-a", d: "M0 430 Q150 372 300 416 T600 404 T900 392 L900 520 L0 520Z" }, svg);

      HOUSES.forEach((h, i) => nodes[h.id] = buildHouse(svg, h, i));

      svgEl("path", { class: "dr-hill-b", d: "M0 482 Q200 444 420 480 T900 470 L900 520 L0 520Z" }, svg);

      routePath = svgEl("path", { class: "dr-route", d: "" }, svg);

      const home = svgEl("g", {}, svg);
      [[0, 0, 40, 15], [-22, 6, 24, 11], [26, 6, 26, 12], [8, -10, 24, 14]].forEach(([dx, dy, rx, ry]) =>
        svgEl("ellipse", { cx: HOME.x + dx, cy: HOME.y + 14 + dy, rx, ry, fill: "#fff", opacity: 0.92 }, home));
      const label = svgEl("text", { class: "dr-home-label", x: HOME.x, y: HOME.y + 48, "text-anchor": "middle" }, home);
      label.textContent = "Midnight Nursery";

      pipG = svgEl("g", { class: "dr-pip-svg" }, svg);
      const bob = svgEl("g", { class: "dr-bob" }, pipG);
      pipImg = svgEl("image", { x: -27, y: -60, width: 54, height: 70, preserveAspectRatio: "xMidYMid meet" }, bob);
      setPipImage();
      setPip(HOME, 0);
    }

    function buildHouse(svg, h, i) {
      const x = h.cx - h.w / 2, top = h.base - h.h, apex = top - h.r;
      const g = svgEl("g", { class: "dr-house", tabindex: 0, role: "button", "aria-pressed": "false",
        "aria-label": `${h.name}. Dream waiting: ${h.dream}. Add to route.` }, svg);
      svgEl("rect", { class: "dr-hit", x: x - 8, y: apex - 14, width: h.w + 16, height: h.h + h.r + 14, rx: 8 }, g);
      svgEl("rect", { class: "dr-chimney", x: x + h.w * 0.66, y: top - h.r * 0.85, width: 9, height: h.r * 0.85 + 4 }, g);
      svgEl("rect", { class: "dr-wall", x, y: top, width: h.w, height: h.h, rx: 4 }, g);
      svgEl("path", { class: "dr-roof", d: `M${x - 8} ${top} L${h.cx} ${apex} L${x + h.w + 8} ${top} Z` }, g);
      const rows = Math.max(1, Math.floor((h.h - 26) / 34));
      for (let r = 0; r < rows; r++) {
        const wy = top + 10 + r * 30;
        svgEl("rect", { class: "dr-window", x: x + h.w * 0.22, y: wy, width: 10, height: 12, rx: 2 }, g);
        svgEl("rect", { class: "dr-window", x: x + h.w * 0.78 - 10, y: wy, width: 10, height: 12, rx: 2 }, g);
      }
      svgEl("rect", { class: "dr-door", x: h.cx - 7, y: h.base - 22, width: 14, height: 22, rx: 6 }, g);
      const z = svgEl("text", { class: "dr-zzz", x: h.cx + h.w * 0.3, y: apex - 4 }, g);
      z.textContent = "💤";
      const badge = svgEl("g", { class: "dr-badge", transform: `translate(${x + h.w + 12} ${top - 6})` }, g);
      svgEl("circle", { r: 12 }, badge);
      const bt = svgEl("text", { y: 5, "text-anchor": "middle" }, badge);

      g.addEventListener("click", () => toggle(h));
      g.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(h); } });
      const showInfo = () => { if (!flying) el.info.textContent = `${h.emoji} ${h.name}: a "${h.dream}" is waiting for ${h.to}.`; };
      g.addEventListener("mouseenter", showInfo);
      g.addEventListener("focus", showInfo);
      return { g, bt };
    }

   
    function setPipImage() { if (pipImg) pipImg.setAttribute("href", "../../assests/pip.png"); }
    function setPip(p, tilt) { pipG.setAttribute("transform", `translate(${p.x.toFixed(1)} ${p.y.toFixed(1)}) rotate(${tilt.toFixed(1)})`); }

    /* ---------- overlays ---------- */
    const pct = (p) => ({ l: (p.x / W) * 100, t: (p.y / H) * 100 });
    function showBubble(html, p) {
      const q = pct(p), below = p.y < 150;
      el.bubble.innerHTML = html;
      el.bubble.classList.toggle("below", below);
      el.bubble.style.left = clamp(q.l, 16, 84) + "%";
      el.bubble.style.top = (below ? ((p.y + 26) / H) * 100 : ((p.y - 68) / H) * 100) + "%";
      el.bubble.classList.add("show");
    }
    function hideBubble() { el.bubble.classList.remove("show"); }
    function dropDream(emoji, from, to) {
      const d = document.createElement("span");
      d.className = "dr-drop"; d.textContent = emoji;
      const a = pct(from), b = pct(to);
      d.style.left = a.l + "%"; d.style.top = a.t + "%";
      el.wrap.appendChild(d);
      requestAnimationFrame(() => requestAnimationFrame(() => { d.style.top = b.t + "%"; d.classList.add("go"); }));
      setTimeout(() => d.remove(), 1100);
    }

    /* ---------- chime (Web Audio, only after a click) ---------- */
    let ac;
    function chime(idx) {
      if (!el.chime.checked) return;
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!ac) ac = new AC();
        if (ac.state === "suspended") ac.resume();
        const base = 72 + [0, 2, 4, 7, 9, 12, 14, 16][idx % 8], t = ac.currentTime;
        [0, 4, 7].forEach((semi, k) => {
          const f = 440 * Math.pow(2, (base + semi - 69) / 12), s = t + k * 0.12;
          const o = ac.createOscillator(), g = ac.createGain();
          o.type = "sine"; o.frequency.value = f;
          g.gain.setValueAtTime(0.0001, s);
          g.gain.linearRampToValueAtTime(0.12, s + 0.01);
          g.gain.exponentialRampToValueAtTime(0.0001, s + 1.2);
          o.connect(g); g.connect(ac.destination); o.start(s); o.stop(s + 1.3);
        });
      } catch (e) { /* audio is optional */ }
    }

    /* ---------- route planning ---------- */
    function routePoints() { return [HOME, ...route.map((h) => h.pt), HOME]; }
    function totalLen() {
      const p = routePoints(); let s = 0;
      for (let i = 1; i < p.length; i++) s += makeLeg(p[i - 1], p[i], -1).len;
      return route.length ? s : 0;
    }
    function resetDelivered() { if (delivered.size) { delivered = new Set(); } }

    function toggle(h) {
      if (flying) return;
      resetDelivered();
      const i = route.indexOf(h);
      if (i >= 0) route.splice(i, 1); else route.push(h);
      refresh();
    }

    function refresh() {
      // house states + badges
      HOUSES.forEach((h) => {
        const n = nodes[h.id], idx = route.indexOf(h), inRoute = idx >= 0, done = delivered.has(h.id);
        n.g.classList.toggle("in-route", inRoute);
        n.g.classList.toggle("delivered", done);
        n.g.setAttribute("aria-pressed", String(inRoute));
        n.g.setAttribute("aria-label", `${h.name}. Dream waiting: ${h.dream}. ${inRoute ? "In route, stop " + (idx + 1) + ". Activate to remove." : "Activate to add to route."}`);
        n.bt.textContent = done ? "✓" : inRoute ? String(idx + 1) : "";
      });
      // dashed route line
      let d = "";
      if (route.length) {
        d = `M${HOME.x} ${HOME.y}`;
        let prev = HOME;
        route.forEach((h) => { const L = makeLeg(prev, h.pt, -1); d += ` Q${L.c.x.toFixed(1)} ${L.c.y.toFixed(1)} ${h.pt.x} ${h.pt.y}`; prev = h.pt; });
      }
      routePath.setAttribute("d", d);
      // chips
      el.list.innerHTML = "";
      route.forEach((h, i) => {
        const li = document.createElement("li");
        if (delivered.has(h.id)) li.className = "done";
        li.append(`${i + 1}. ${h.emoji} ${h.name}`);
        if (delivered.has(h.id)) li.append(" ✓");
        const b = document.createElement("button");
        b.type = "button"; b.textContent = "✕"; b.setAttribute("aria-label", `Remove ${h.name} from route`);
        b.disabled = flying;
        b.addEventListener("click", () => toggle(h));
        li.appendChild(b);
        el.list.appendChild(li);
      });
      // stats + buttons
      el.stops.textContent = route.length;
      el.done.textContent = delivered.size;
      el.miles.textContent = Math.round(totalLen() / 40);
      el.go.disabled = !flying && !route.length;
      el.go.setAttribute("aria-pressed", String(flying));
      el.go.querySelector(".dr-go-ico").textContent = flying ? "⏹" : "🚀";
      el.go.querySelector(".dr-go-label").textContent = flying ? "Stop" : "Deliver dreams";
      el.smart.disabled = flying; el.clear.disabled = flying || !route.length;
      root.classList.toggle("is-flying", flying);
    }

    function smart() {
      if (flying) return;
      resetDelivered();
      route = shortestTour(route.length ? route.slice() : HOUSES.slice());
      refresh();
      el.info.textContent = "✨ Pip found the shortest route: about " + Math.round(totalLen() / 40) + " cloud-miles.";
    }
    function clear() {
      if (flying) return;
      route = []; resetDelivered(); hideBubble(); refresh();
      el.info.textContent = "Tap a rooftop to add it to Pip's route.";
    }

    /* ---------- flying ---------- */
    function startLeg() {
      elapsed = 0; phase = "fly";
      const L = legs[legIdx];
      legDur = Math.max(0.9, L.len / SPEED[el.speed.value]);
    }
    function deliver() {
      if (flying || !route.length) return;
      delivered = new Set(); hideBubble();
      const pts = routePoints();
      legs = [];
      for (let i = 1; i < pts.length; i++) legs.push(makeLeg(pts[i - 1], pts[i], i <= route.length ? i - 1 : -1));
      legIdx = 0; flying = true;
      startLeg(); refresh();
      el.info.textContent = "Pip is off! 🚀";
      document.dispatchEvent(new CustomEvent("dreamroutes:start"));
      last = performance.now(); raf = requestAnimationFrame(loop);
    }
    function stop() {
      if (!flying) return;
      flying = false; cancelAnimationFrame(raf); clearTimeout(hideT);
      hideBubble(); setPip(HOME, 0); delivered = new Set(); refresh();
      el.info.textContent = "Pip came home early. Tap Deliver to try again.";
    }
    function loop(ts) {
      if (!flying) return;
      const dt = Math.min(0.05, Math.max(0, (ts - last) / 1000)); last = ts;
      step(dt);
      if (flying) raf = requestAnimationFrame(loop);
    }
    function step(dt) {
      const L = legs[legIdx];
      if (phase === "fly") {
        elapsed += dt;
        const u = Math.min(1, elapsed / legDur), e = ease(u), p = bez(L, e), tg = tangent(L, e);
        const tilt = clamp(Math.atan2(tg.y, Math.abs(tg.x)) * 180 / Math.PI * 0.35, -12, 12) * (tg.x < 0 ? -1 : 1);
        setPip(p, tilt);
        if (u >= 1) arrive(L);
      } else {
        hoverLeft -= dt;
        if (hoverLeft <= 0) {
          hideBubble(); legIdx++;
          if (legIdx >= legs.length) finish(); else startLeg();
        }
      }
    }
    function arrive(L) {
      if (L.stopIdx < 0) { finish(); return; }
      const h = route[L.stopIdx];
      delivered.add(h.id);
      refresh();
      dropDream(h.emoji, { x: h.pt.x, y: h.pt.y + 6 }, { x: h.cx, y: h.base - h.h - h.r * 0.4 });
      chime(L.stopIdx);
      showBubble(`Dream for ${h.to}:<br><b>${h.emoji} ${h.dream}</b>`, L.b);
      el.info.textContent = `💤 ${h.name} is dreaming of the ${h.dream}.`;
      phase = "hover"; hoverLeft = HOVER[el.speed.value];
    }
    function finish() {
      flying = false; cancelAnimationFrame(raf);
      setPip(HOME, 0); refresh();
      const n = delivered.size;
      showBubble(`Home sweet cloud! 🌙<br><b>${n} dream${n === 1 ? "" : "s"} delivered, 0 bugs.</b>`, HOME);
      el.info.textContent = "All done. Plan another route or press Deliver to watch it again.";
      clearTimeout(hideT); hideT = setTimeout(hideBubble, 4000);
      document.dispatchEvent(new CustomEvent("dreamroutes:done"));
    }

    /* ---------- wiring ---------- */
    el.go.addEventListener("click", () => (flying ? stop() : deliver()));
    el.smart.addEventListener("click", smart);
    el.clear.addEventListener("click", clear);
    new MutationObserver(setPipImage).observe(htmlEl, { attributes: true, attributeFilter: ["data-theme"] });

    Api.deliver = deliver; Api.stop = stop; Api.clear = clear; Api.smart = smart;
    Api._shortestTour = shortestTour;

    build();
    refresh();
  }

  Api._houses = HOUSES;
  Api._shortestTour = shortestTour;
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();