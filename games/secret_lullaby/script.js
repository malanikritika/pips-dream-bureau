const $ = s => document.querySelector(s), wait = ms => new Promise(r => setTimeout(r, ms));
const rnd = (a, b) => a + Math.random() * (b - a);

// ================= Sound: a music-box lullaby made with the Web Audio API =================
let ac, out, muted = false, step = 0, seq;
const MEL = [659,784,880,784,659,587,523,587, 659,587,523,440,392,440,523,659, 784,880,1047,880,784,659,587,659, 784,659,587,523,440,523,587,392];
const BASS = [131,98,110,87];
function initAudio() { if (ac) return; ac = new (window.AudioContext || window.webkitAudioContext)(); out = ac.createGain(); out.gain.value = .5; out.connect(ac.destination); }
function tone(f, d = 1.4, v = .15, type = 'sine', t0 = 0) {
  if (!ac) return; const t = ac.currentTime + t0, o = ac.createOscillator(), g = ac.createGain();
  o.type = type; o.frequency.value = f; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + .01); g.gain.exponentialRampToValueAtTime(.0001, t + d);
  o.connect(g); g.connect(out); o.start(t); o.stop(t + d + .05);
}
const bell = f => { tone(f, 1.8, .14); tone(f * 2.005, .9, .05); tone(f * 3.01, .4, .02); };
function lullaby() { seq = setInterval(() => { bell(MEL[step % MEL.length]); if (step % 4 === 0) tone(BASS[(step / 4 | 0) % 4], 2.2, .1, 'triangle'); step++; }, 520); }
function sweep(f1, f2, d, v, type = 'sine') {
  if (!ac) return; const t = ac.currentTime, o = ac.createOscillator(), g = ac.createGain(); o.type = type;
  o.frequency.setValueAtTime(f1, t); o.frequency.exponentialRampToValueAtTime(f2, t + d); g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(.0001, t + d);
  o.connect(g); g.connect(out); o.start(t); o.stop(t + d);
}
function noise(d, v) {
  if (!ac) return; const b = ac.createBuffer(1, ac.sampleRate * d, ac.sampleRate), a = b.getChannelData(0);
  for (let i = 0; i < a.length; i++) a[i] = (Math.random() * 2 - 1) * (1 - i / a.length);
  const s = ac.createBufferSource(), g = ac.createGain(), f = ac.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 1500; g.gain.value = v;
  s.buffer = b; s.connect(f); f.connect(g); g.connect(out); s.start();
}
const sfx = {
  creak: () => sweep(70, 160, .9, .06, 'sawtooth'),
  thump: () => sweep(110, 35, .35, .6),
  crack: () => { noise(.18, .35); sweep(300, 80, .15, .2, 'square'); },
  pop: () => sweep(500, 1000, .1, .12),
  chime: () => [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 1.3, .1, 'sine', i * .09))
};
$('#mute').onclick = e => { muted = !muted; if (out) out.gain.value = muted ? 0 : .5; e.target.classList.toggle('off', muted); };

// ================= Sparkle shower: stars, bubbles, hearts, confetti =================
const cv = $('#fx'), g = cv.getContext('2d'), COL = ['#ff7eb6', '#ffc83d', '#6fd3ff', '#b392ff', '#6fe3a8', '#ff9d6e'];
const KINDS = ['star', 'star', 'bubble', 'bubble', 'heart', 'dot', 'conf'];
let P = [], rainT;
const fit = () => { cv.width = innerWidth; cv.height = innerHeight; }; addEventListener('resize', fit); fit();
function add(x, y, k, b) {
  const up = k === 'bubble';
  P.push({ x, y: !b && up ? cv.height + 20 : y, k, c: COL[Math.random() * COL.length | 0], s: rnd(10, 26), rot: rnd(0, 6), vr: rnd(-3, 3), w: rnd(0, 6), b,
    vx: b ? rnd(-320, 320) : rnd(-20, 20), vy: b ? rnd(-460, -80) : up ? -rnd(50, 120) : rnd(70, 170), l: b ? rnd(1.6, 2.8) : 9 });
}
const burst = (x, y, n = 40) => { for (let i = 0; i < n; i++) add(x, y, KINDS[Math.random() * KINDS.length | 0], true); };
function shower(on) { clearInterval(rainT); if (on) rainT = setInterval(() => { for (let i = 0; i < 3; i++) add(rnd(0, cv.width), -20, KINDS[Math.random() * KINDS.length | 0], false); }, 130); }
function drawP(p) {
  g.save(); g.translate(p.x, p.y); g.rotate(p.rot); g.globalAlpha = Math.min(1, p.l); const s = p.s;
  if (p.k === 'star') { g.beginPath(); for (let i = 0; i < 10; i++) { const r = i % 2 ? s * .22 : s * .55, a = i * Math.PI / 5; g.lineTo(Math.sin(a) * r, -Math.cos(a) * r); } g.closePath(); g.fillStyle = p.c; g.fill(); g.strokeStyle = '#fff'; g.lineWidth = 1.5; g.stroke(); }
  else if (p.k === 'bubble') { g.beginPath(); g.arc(0, 0, s * .6, 0, 7); g.fillStyle = 'rgba(255,255,255,.2)'; g.fill(); g.strokeStyle = p.c; g.lineWidth = 2; g.stroke(); g.beginPath(); g.arc(-s * .2, -s * .2, s * .15, 0, 7); g.fillStyle = '#fff'; g.fill(); }
  else if (p.k === 'heart') { g.beginPath(); g.moveTo(0, s * .3); g.bezierCurveTo(-s * .8, -s * .2, -s * .3, -s * .7, 0, -s * .25); g.bezierCurveTo(s * .3, -s * .7, s * .8, -s * .2, 0, s * .3); g.fillStyle = p.c; g.fill(); }
  else if (p.k === 'dot') { g.beginPath(); g.arc(0, 0, s * .25, 0, 7); g.fillStyle = p.c; g.fill(); }
  else { g.fillStyle = p.c; g.fillRect(-s / 2, -s / 5, s, s / 2.5); }
  g.restore();
}
let lt = 0;
(function loop(t) {
  const dt = Math.min((t - lt) / 1000, .05); lt = t; g.clearRect(0, 0, cv.width, cv.height);
  for (const p of P) { p.w += dt * 2; p.x += p.vx * dt + Math.sin(p.w) * .6; p.y += p.vy * dt; p.rot += p.vr * dt; p.l -= dt; if (p.b) { p.vy += (p.k === 'bubble' ? -60 : 520) * dt; p.vx *= .985; } drawP(p); }
  P = P.filter(p => p.l > 0 && p.y < cv.height + 40 && p.y > -60); requestAnimationFrame(loop);
})(0);

// ================= Fairytale details =================
for (let i = 0; i < 22; i++) { const f = document.createElement('i'); f.className = 'ff';
  f.style.cssText = `left:${rnd(2, 98)}%;top:${rnd(25, 95)}%;--x:${rnd(-60, 60)}px;--y:${rnd(-80, 40)}px;--d:${rnd(3, 7)}s`; document.body.append(f); }
setTimeout(() => $('#hint').classList.add('show'), 7000);

const stage = $('#stage'), doorsEl = $('#doors'), cap = $('#caption'), egg = $('#eggBox');
const say = t => { cap.classList.remove('show'); setTimeout(() => { cap.textContent = t; cap.classList.add('show'); }, 300); };
const flash = () => { const f = $('#flash'); f.classList.remove('go'); void f.offsetWidth; f.classList.add('go'); };
const center = el => { const r = el.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; };

// ================= Three doors, each with a surprise =================
const DOORS = [
  { img: 'door-pink.svg', cls: 'b-light', html: '<i class="note n1">♪</i><i class="note n2">♫</i><i class="note n3">♪</i>', hint: 'A tiny pink door… the music is coming from behind it. Tap to knock.' },
  { img: 'door-lavender.svg', cls: 'b-eyes', html: '<div class="eyes"><b></b><b></b></div>', hint: 'Another door. It is humming along with the lullaby… Tap it.' },
  { img: 'door-mint.svg', cls: 'b-egg', html: '<img class="peek" src="egg.svg" alt="">', hint: 'The last door. The music has gone very quiet… Tap it.' }
];
function showRoom(i) {
  const d = DOORS[i], r = document.createElement('div');
  r.className = 'room'; r.tabIndex = 0; r.setAttribute('role', 'button'); r.setAttribute('aria-label', 'Open door ' + (i + 1));
  r.innerHTML = `<div class="frame"><div class="behind ${d.cls}">${d.html}</div></div><img class="door" src="${d.img}" alt="">`;
  doorsEl.append(r); say(d.hint);
  const go = () => openRoom(r, i);
  r.addEventListener('click', go, { once: true }); r.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') go(); }, { once: true });
}
async function openRoom(r, i) {
  r.classList.add('open'); sfx.creak(); await wait(800);
  const [cx, cy] = center(r), b = r.querySelector('.behind');
  if (i === 0) { sfx.chime(); burst(cx, cy, 45); say('Shhh… golden notes are floating out. Something is waking up.'); await wait(3200); }
  if (i === 1) {
    sfx.thump(); stage.classList.add('shake'); flash(); say('WAIT— something just blinked at you!!');
    await wait(2200); b.classList.add('happy'); sfx.pop(); burst(cx, cy, 35); say('…hehe. It was only shy. One door left.'); await wait(3000);
  }
  if (i === 2) { sfx.thump(); await wait(700); sfx.thump(); say('A little egg… and it is breathing. Shhh.'); await wait(3000); }
  r.classList.add('out'); await wait(1000); r.remove();
  i < 2 ? showRoom(i + 1) : showEgg();
}

// ================= The egg =================
let taps = 0;
function showEgg() { egg.classList.add('show'); say('Tap the egg gently… three times ♡'); egg.addEventListener('click', tapEgg); egg.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') tapEgg(); }); }
async function tapEgg() {
  taps++; const [cx, cy] = center(egg);
  if (taps === 1) { egg.classList.add('wob1', 'k1'); sfx.crack(); burst(cx, cy, 14); say('Crack! Something inside is wiggling…'); }
  else if (taps === 2) { egg.classList.replace('wob1', 'wob2'); egg.classList.add('k2'); sfx.crack(); burst(cx, cy, 24); say('One more tap — it wants out!'); }
  else if (taps === 3) {
    egg.classList.remove('wob2'); egg.classList.add('k3'); sfx.crack(); await wait(500);
    flash(); sfx.chime(); egg.classList.add('hatched'); document.body.classList.add('dawn'); burst(cx, cy, 140); hatchPip();
  }
}

// ================= Pip walks out and the world celebrates =================
function hatchPip() {
  const pip = $('#pip'), pace = pip.querySelector('.pace'); pip.classList.add('walkin'); shower(true);
  say('…a tiny waddle. Is that—?');
  setTimeout(() => say('Hi! I\'m Pip ♡ You found my secret lullaby!'), 3200);
  pip.addEventListener('animationend', () => { pace.classList.add('slow'); sfx.chime(); burst(innerWidth / 2, innerHeight * .6, 90); setTimeout(() => $('#replay').hidden = false, 4000); }, { once: true });
  pace.querySelector('img').addEventListener('click', e => { burst(e.clientX, e.clientY, 30); bell([784, 880, 1047, 1319][Math.random() * 4 | 0]); });
}
$('#replay').onclick = () => location.reload();

// ================= Entrance: the blinking star (or type "pip") =================
let started = false;
async function begin() {
  if (started) return; started = true; initAudio(); ac.resume(); lullaby(); sfx.chime();
  const [sx, sy] = center($('#secretStar')); burst(sx, sy, 30);
  $('#secretStar').classList.add('gone'); $('#hint').classList.remove('show');
  say('♪ …do you hear that? A music box is playing somewhere in the dark…');
  await wait(3200); showRoom(0);
}
$('#secretStar').onclick = begin;
let typed = ''; addEventListener('keydown', e => { typed = (typed + e.key).slice(-3).toLowerCase(); if (typed === 'pip') begin(); });