const cv = document.getElementById('c'), ctx = cv.getContext('2d');
const $ = id => document.getElementById(id);
let W, H, dpr;

function resize() {
  dpr = window.devicePixelRatio || 1;
  W = cv.clientWidth; H = cv.clientHeight;
  cv.width = W * dpr; cv.height = H * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
addEventListener('resize', resize);
resize();

// ---- Game state ----
let level = 1, score = 0, goal = 10, time = 30, lives = 3;
let running = false, items = [], parts = [], bg = [], spawnT = 0, last = 0, shake = 0;
const bask = { x: 0, w: 100, h: 46 };
const keys = {};

// Background stars
for (let i = 0; i < 70; i++) {
  bg.push({ x: Math.random(), y: Math.random(), r: Math.random() * 1.6 + .3, s: Math.random() * .02 + .005 });
}

// ---- Controls: mouse, touch, keyboard ----
function setMouse(px) {
  const r = cv.getBoundingClientRect();
  bask.x = Math.max(bask.w / 2, Math.min(W - bask.w / 2, px - r.left));
}
addEventListener('mousemove', e => setMouse(e.clientX));
addEventListener('touchmove', e => setMouse(e.touches[0].clientX), { passive: true });
addEventListener('touchstart', e => setMouse(e.touches[0].clientX), { passive: true });
addEventListener('keydown', e => {
  keys[e.key] = true;
  if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') e.preventDefault();
});
addEventListener('keyup', e => keys[e.key] = false);

// ---- Start / end ----
function start(newGame) {
  if (newGame) level = 1;
  goal = 8 + level * 4;          // target score for this level
  score = 0; time = 30; lives = 3; // 30-second round
  items = []; parts = []; spawnT = 0; running = true;
  bask.x = W / 2;
  bask.w = Math.max(70, 110 - level * 5); // basket shrinks each level
  $('panel').classList.add('hide');
  updateHUD();
  last = performance.now();
  requestAnimationFrame(loop);
}

function updateHUD() {
  $('lv').textContent = level;
  $('sc').textContent = score;
  $('goal').textContent = goal;
  $('tm').textContent = Math.ceil(time);
  $('fill').style.width = (time / 30 * 100) + '%';
}

function end(won, reason) {
  running = false;
  $('panel').classList.remove('hide');
  if (won) {
    $('ptitle').textContent = 'Level ' + level + ' cleared!';
    $('pmsg').innerHTML = 'You scored <b>' + score + '</b>. Level ' + (level + 1) + ' brings faster stars, more meteoroids and a smaller basket.';
    $('go').textContent = 'Next level';
    $('go').onclick = () => { level++; start(false); };
  } else {
    $('ptitle').textContent = reason === 'hit' ? 'Meteoroid strike!' : 'Time\u2019s up';
    $('pmsg').innerHTML = (reason === 'hit' ? 'Your basket took three hits. ' : 'You needed ' + goal + ' points and got ' + score + '. ') + 'Try level ' + level + ' again.';
    $('go').textContent = 'Play again';
    $('go').onclick = () => start(false);
  }
}
$('go').onclick = () => start(true);

// ---- Falling objects ----
function spawn() {
  const rock = Math.random() < Math.min(.18 + level * .05, .42); // meteoroid chance rises per level
  const r = rock ? 16 + Math.random() * 10 : 12 + Math.random() * 4;
  items.push({
    x: r + Math.random() * (W - 2 * r), y: -30, r, rock,
    vy: (rock ? 150 : 120) + level * 28 + Math.random() * 60, // speed rises per level
    rot: Math.random() * 6, vr: (Math.random() - .5) * 4
  });
}

function burst(x, y, col) {
  for (let i = 0; i < 14; i++) {
    parts.push({ x, y, vx: (Math.random() - .5) * 260, vy: (Math.random() - .8) * 260, l: .6, col });
  }
}

function starPath(x, y, r, rot) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = rot + i * Math.PI / 5 - Math.PI / 2, d = i % 2 ? r * .45 : r;
    ctx.lineTo(x + Math.cos(a) * d, y + Math.sin(a) * d);
  }
  ctx.closePath();
}

// ---- Main loop ----
function loop(t) {
  if (!running) return;
  const dt = Math.min((t - last) / 1000, .05);
  last = t;
  time -= dt;

  if (keys.ArrowLeft || keys.a) bask.x -= 520 * dt;
  if (keys.ArrowRight || keys.d) bask.x += 520 * dt;
  bask.x = Math.max(bask.w / 2, Math.min(W - bask.w / 2, bask.x));

  spawnT -= dt;
  if (spawnT <= 0) { spawn(); spawnT = Math.max(.28, .7 - level * .06); }

  const by = H - bask.h - 18;
  for (const it of items) {
    it.y += it.vy * dt;
    it.rot += it.vr * dt;
    // Collision with basket
    if (!it.dead && it.y + it.r > by && it.y < by + bask.h * .6 && Math.abs(it.x - bask.x) < bask.w / 2) {
      it.dead = true;
      if (it.rock) {
        score = Math.max(0, score - 3); // penalty
        lives--;
        shake = .3;
        burst(it.x, it.y, '#ff5a4d');
      } else {
        score++;
        burst(it.x, it.y, '#ffd84d');
      }
    }
    if (it.y > H + 40) it.dead = true;
  }
  items = items.filter(i => !i.dead);

  for (const p of parts) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 500 * dt; p.l -= dt; }
  parts = parts.filter(p => p.l > 0);
  shake = Math.max(0, shake - dt);

  updateHUD();
  draw();

  if (lives <= 0) { end(false, 'hit'); return; }
  if (score >= goal) { end(true); return; }
  if (time <= 0) { time = 0; updateHUD(); end(false, 'time'); return; }
  requestAnimationFrame(loop);
}

// ---- Drawing ----
function draw() {
  ctx.clearRect(0, 0, W, H);
  ctx.save();
  if (shake > 0) ctx.translate((Math.random() - .5) * 8, (Math.random() - .5) * 8);

  // Background stars
  for (const s of bg) {
    s.y = (s.y + s.s * .016) % 1;
    ctx.fillStyle = 'rgba(255,255,255,' + (.3 + s.r / 3) + ')';
    ctx.beginPath(); ctx.arc(s.x * W, s.y * H, s.r, 0, 7); ctx.fill();
  }

  // Stars and meteoroids
  for (const it of items) {
    if (it.rock) {
      ctx.save();
      ctx.translate(it.x, it.y); ctx.rotate(it.rot);
      ctx.shadowColor = '#ff5a4d'; ctx.shadowBlur = 18;
      ctx.fillStyle = '#c93a2e';
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const a = i * Math.PI / 4, d = it.r * (i % 2 ? .8 : 1.05);
        ctx.lineTo(Math.cos(a) * d, Math.sin(a) * d);
      }
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#7a1f1a';
      ctx.beginPath();
      ctx.arc(-it.r * .25, -it.r * .1, it.r * .22, 0, 7);
      ctx.arc(it.r * .25, it.r * .3, it.r * .15, 0, 7);
      ctx.fill();
      ctx.restore();
    } else {
      ctx.save();
      ctx.shadowColor = '#ffd84d'; ctx.shadowBlur = 20;
      const g = ctx.createRadialGradient(it.x, it.y, 2, it.x, it.y, it.r);
      g.addColorStop(0, '#fff6b0'); g.addColorStop(1, '#ffc400');
      ctx.fillStyle = g;
      starPath(it.x, it.y, it.r, it.rot); ctx.fill();
      ctx.restore();
    }
  }

  // Particles
  for (const p of parts) {
    ctx.globalAlpha = Math.max(0, p.l / .6);
    ctx.fillStyle = p.col;
    ctx.fillRect(p.x, p.y, 4, 4);
  }
  ctx.globalAlpha = 1;

  // Basket
  const bx = bask.x - bask.w / 2, by = H - bask.h - 18;
  ctx.fillStyle = '#5ff0c8';
  ctx.beginPath();
  ctx.moveTo(bx, by); ctx.lineTo(bx + bask.w, by);
  ctx.lineTo(bx + bask.w - 12, by + bask.h); ctx.lineTo(bx + 12, by + bask.h);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#2bb89a';
  ctx.fillRect(bx - 4, by - 4, bask.w + 8, 8);
  ctx.strokeStyle = '#1b7f6a'; ctx.lineWidth = 2;
  for (let i = 1; i < 5; i++) {
    ctx.beginPath();
    ctx.moveTo(bx + i * bask.w / 5, by + 6);
    ctx.lineTo(bx + 12 + i * (bask.w - 24) / 5, by + bask.h);
    ctx.stroke();
  }

  // Lives (hearts)
  for (let i = 0; i < 3; i++) {
    ctx.fillStyle = i < lives ? '#ff7aa8' : '#ffffff33';
    ctx.font = '20px sans-serif';
    ctx.fillText('\u2665', 16 + i * 24, 76);
  }
  ctx.restore();
}

draw();