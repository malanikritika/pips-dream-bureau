const cv = document.getElementById('c'), ctx = cv.getContext('2d');
const dark = document.createElement('canvas'), dctx = dark.getContext('2d');
const $ = id => document.getElementById(id);
let W, H, dpr;

function resize() {
  dpr = window.devicePixelRatio || 1;
  W = cv.clientWidth; H = cv.clientHeight;
  cv.width = dark.width = W * dpr;
  cv.height = dark.height = H * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  dctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
addEventListener('resize', () => { resize(); if (running) layout(); });
resize();

// ---- Game settings ----
const COUNTS = [3, 4, 6, 8, 10];    // lanterns per level
const TIMES = [30, 35, 40, 45, 50]; // seconds per level

let time = 30, level = 1, lanterns = [], sparks = [], stars = [];
let running = false, mx = 0, my = 0, idle = 0, last = 0, t = 0, ripple = 0;

// Background stars
for (let i = 0; i < 90; i++) {
  stars.push({ x: Math.random(), y: Math.random() * .7, r: Math.random() * 1.3 + .2, p: Math.random() * 6 });
}

// Radius of the player's light (gets smaller each level)
const R = () => Math.max(80, Math.min(130, Math.min(W, H) * .17)) - level * 4;

// ---- Place lanterns randomly ----
function layout() {
  lanterns = [];
  const n = COUNTS[level - 1], m = 60;
  let tries = 0;
  while (lanterns.length < n && tries++ < 4000) {
    const x = m + Math.random() * (W - 2 * m);
    const y = H * .12 + Math.random() * (H * .62);
    if (lanterns.every(l => Math.hypot(l.x - x, l.y - y) > Math.min(W, H) * .2 / (1 + n / 14))) {
      lanterns.push({ x, y, lit: 0, on: false, ph: Math.random() * 6, s: 1 });
    }
  }
  while (lanterns.length < n) {
    lanterns.push({ x: m + Math.random() * (W - 2 * m), y: H * .15 + Math.random() * H * .55, lit: 0, on: false, ph: Math.random() * 6, s: 1 });
  }
  $('tot').textContent = n;
}

// ---- Start / HUD ----
function start(newGame) {
  if (newGame) level = 1;
  sparks = []; idle = 0; ripple = 0; running = true;
  mx = W / 2; my = H / 2;
  time = TIMES[level - 1];
  layout(); upd();
  $('lv').textContent = level;
  $('panel').classList.add('hide');
  last = performance.now();
  requestAnimationFrame(loop);
}

function upd() {
  $('lit').textContent = lanterns.filter(l => l.on).length;
  const e = $('tm');
  e.textContent = Math.ceil(time);
  e.style.color = time <= 10 ? '#ff7a7a' : ''; // red in last 10 seconds
}

// ---- Controls: mouse and touch ----
function pos(e) {
  const r = cv.getBoundingClientRect(), p = e.touches ? e.touches[0] : e;
  mx = p.clientX - r.left; my = p.clientY - r.top;
}
addEventListener('mousemove', pos);
addEventListener('touchmove', e => pos(e), { passive: true });
addEventListener('touchstart', e => { pos(e); tap(); }, { passive: true });
addEventListener('mousedown', () => tap());

// Click or tap: light a lantern if it is inside the player's light
function tap() {
  if (!running) return;
  for (const l of lanterns) {
    if (l.on) continue;
    const bob = Math.sin(t * 1.2 + l.ph) * 5;
    if (Math.hypot(l.x - mx, l.y + bob - my) < 44 && Math.hypot(l.x - mx, l.y - my) < R()) {
      l.on = true; idle = 0; ripple = 0;
      for (let i = 0; i < 26; i++) {
        sparks.push({ x: l.x, y: l.y + bob, vx: (Math.random() - .5) * 160, vy: -Math.random() * 150 - 20, l: 1.2 });
      }
      upd();
      if (lanterns.every(q => q.on)) setTimeout(finish, 1300);
      return;
    }
  }
}

// ---- Level won ----
function finish() {
  running = false;
  $('panel').classList.remove('hide');
  if (level >= COUNTS.length) {
    $('pt').textContent = 'The night is alight';
    $('pm').innerHTML = 'You woke every lantern across all ' + COUNTS.length + ' levels. The sky is glowing because of you.';
    $('go').textContent = 'Play again';
    $('go').onclick = () => start(true);
  } else {
    $('pt').textContent = 'Level ' + level + ' glowing';
    $('pm').innerHTML = 'All ' + COUNTS[level - 1] + ' lanterns are lit. Next, ' + COUNTS[level] + ' lanterns hide in a darker sky and your light is a little smaller.';
    $('go').textContent = 'Next level';
    $('go').onclick = () => { level++; start(false); };
  }
}
$('go').onclick = () => start(true);

// ---- Time ran out ----
function lose() {
  running = false;
  $('panel').classList.remove('hide');
  $('pt').textContent = 'The night won this time';
  $('pm').innerHTML = 'You lit ' + lanterns.filter(l => l.on).length + ' of ' + lanterns.length + ' lanterns before time ran out. Try level ' + level + ' again.';
  $('go').textContent = 'Try again';
  $('go').onclick = () => start(false);
}

// ---- Draw one lantern ----
function lantern(l) {
  const bob = Math.sin(t * 1.2 + l.ph) * 5, x = l.x, y = l.y + bob, w = 17, h = 24;
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = l.on ? '#ffd9a0' : '#5b4a3a';
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(0, -h - 14); ctx.lineTo(0, -h); ctx.stroke();
  if (l.on) { ctx.shadowColor = '#ff9a2e'; ctx.shadowBlur = 34 * l.lit; }
  const g = ctx.createLinearGradient(0, -h, 0, h);
  if (l.on) { g.addColorStop(0, '#ffe29a'); g.addColorStop(1, '#ff8a3d'); }
  else { g.addColorStop(0, '#6b5646'); g.addColorStop(1, '#3d3029'); }
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.ellipse(0, 0, w, h, 0, 0, 7); ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = l.on ? '#c4501f' : '#2a201a';
  ctx.lineWidth = 1.5;
  for (const k of [-.55, 0, .55]) {
    ctx.beginPath(); ctx.ellipse(0, 0, w * Math.abs(k) + .1, h, 0, 0, 7); ctx.stroke();
  }
  ctx.fillStyle = l.on ? '#7a2e14' : '#2a201a';
  ctx.fillRect(-9, -h - 3, 18, 6);
  ctx.fillRect(-9, h - 3, 18, 6);
  ctx.restore();
}

// ---- Main loop ----
function loop(now) {
  if (!running) return;
  const dt = Math.min((now - last) / 1000, .05);
  last = now; t += dt; idle += dt;
  if (!lanterns.every(q => q.on)) time -= dt; // timer stops when all are lit

  for (const l of lanterns) if (l.on) l.lit = Math.min(1, l.lit + dt * 1.5);
  for (const s of sparks) { s.x += s.vx * dt; s.y += s.vy * dt; s.vy -= 30 * dt; s.l -= dt; }
  sparks = sparks.filter(s => s.l > 0);
  if (idle > 8) ripple = (ripple + dt * .5) % 1;

  upd();
  if (time <= 0) { time = 0; upd(); draw(); lose(); return; }
  draw();
  requestAnimationFrame(loop);
}

// ---- Draw the whole scene ----
function draw() {
  // Sky
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, '#07102e'); sky.addColorStop(.6, '#13264f'); sky.addColorStop(1, '#1f6f78');
  ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);

  // Stars
  for (const s of stars) {
    ctx.fillStyle = 'rgba(255,255,255,' + (.35 + .3 * Math.sin(t + s.p)) + ')';
    ctx.beginPath(); ctx.arc(s.x * W, s.y * H, s.r, 0, 7); ctx.fill();
  }

  // Hills
  ctx.fillStyle = '#0a1a2c';
  ctx.beginPath(); ctx.moveTo(0, H);
  for (let x = 0; x <= W; x += 20) {
    ctx.lineTo(x, H * .86 - Math.sin(x * .008) * H * .05 - Math.sin(x * .021) * H * .02);
  }
  ctx.lineTo(W, H); ctx.fill();

  // Lanterns and sparks
  for (const l of lanterns) lantern(l);
  for (const s of sparks) {
    ctx.globalAlpha = Math.max(0, s.l);
    ctx.fillStyle = '#ffc766';
    ctx.fillRect(s.x, s.y, 3, 3);
  }
  ctx.globalAlpha = 1;

  // Darkness layer with light holes
  dctx.globalCompositeOperation = 'source-over';
  dctx.clearRect(0, 0, W, H);
  dctx.fillStyle = 'rgba(3,6,18,.95)';
  dctx.fillRect(0, 0, W, H);
  dctx.globalCompositeOperation = 'destination-out';
  const hole = (x, y, r, a) => {
    const g = dctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(0,0,0,' + a + ')');
    g.addColorStop(.55, 'rgba(0,0,0,' + a * .7 + ')');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    dctx.fillStyle = g;
    dctx.beginPath(); dctx.arc(x, y, r, 0, 7); dctx.fill();
  };
  hole(mx, my, R(), 1);
  for (const l of lanterns) if (l.on) hole(l.x, l.y, 150 * l.lit, .95 * l.lit);
  ctx.drawImage(dark, 0, 0, W, H);

  // Warm glow around lit lanterns
  ctx.globalCompositeOperation = 'lighter';
  for (const l of lanterns) {
    if (l.on) {
      const g = ctx.createRadialGradient(l.x, l.y, 0, l.x, l.y, 110);
      g.addColorStop(0, 'rgba(255,160,60,' + .35 * l.lit + ')');
      g.addColorStop(1, 'rgba(255,160,60,0)');
      ctx.fillStyle = g;
      ctx.fillRect(l.x - 110, l.y - 110, 220, 220);
    }
  }
  ctx.globalCompositeOperation = 'source-over';

  // Hint ripple around the nearest sleeping lantern
  if (idle > 8) {
    const u = lanterns.filter(l => !l.on);
    if (u.length) {
      const n = u.reduce((a, b) => Math.hypot(a.x - mx, a.y - my) < Math.hypot(b.x - mx, b.y - my) ? a : b);
      ctx.strokeStyle = 'rgba(255,200,120,' + (1 - ripple) * .6 + ')';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(n.x, n.y, 20 + ripple * 70, 0, 7); ctx.stroke();
    }
  }

  // Firefly cursor
  const f = ctx.createRadialGradient(mx, my, 0, mx, my, 16);
  f.addColorStop(0, 'rgba(255,248,214,1)');
  f.addColorStop(.4, 'rgba(255,220,130,.6)');
  f.addColorStop(1, 'rgba(255,220,130,0)');
  ctx.fillStyle = f;
  ctx.beginPath(); ctx.arc(mx, my, 16, 0, 7); ctx.fill();
}

mx = W / 2; my = H / 2;
draw();