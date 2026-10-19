const $ = id => document.getElementById(id);
const rnd = n => Math.random() * n | 0;
const pick = a => a[rnd(a.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---- Music settings ----
const STEPS = 16, ROWS = 8;
const MOODS = {
  sleepy:  { root: 60, notes: [0, 2, 4, 7, 9, 12, 14, 16], bpm: 64 }, // major pentatonic
  dreamy:  { root: 62, notes: [0, 2, 4, 6, 7, 9, 11, 12], bpm: 72 },  // lydian
  moonlit: { root: 57, notes: [0, 3, 5, 7, 10, 12, 15, 17], bpm: 56 } // minor pentatonic
};
let mood = MOODS.sleepy, bpm = 64, humOn = true;
const stepDur = () => 60 / bpm / 2;
const freq = r => 440 * Math.pow(2, (mood.root + mood.notes[r] - 69) / 12);
const blank = () => Array.from({ length: ROWS }, () => Array(STEPS).fill(false));
let pat = blank();

// ---- Audio ----
let ac, bus;

function initAudio() {
  if (ac) return;
  ac = new (window.AudioContext || window.webkitAudioContext)();
  const master = ac.createGain(); master.gain.value = .8;
  const comp = ac.createDynamicsCompressor();
  master.connect(comp); comp.connect(ac.destination);

  // Soft room reverb built from decaying noise
  const len = ac.sampleRate * 2.8 | 0, ir = ac.createBuffer(2, len, ac.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = ir.getChannelData(c);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.4);
  }
  const conv = ac.createConvolver(); conv.buffer = ir;
  const wet = ac.createGain(); wet.gain.value = .5;
  conv.connect(wet); wet.connect(master);

  bus = ac.createGain();
  bus.connect(master); bus.connect(conv);
}

// A music-box tine: a pure tone plus two quick, bright overtones
function tine(f, when, vel) {
  const decay = 1.9 * Math.pow(261 / f, .35);
  [[1, .26, 1], [2.76, .06, .38], [5.4, .02, .16]].forEach(([ratio, gain, dec]) => {
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = 'sine'; o.frequency.value = f * ratio;
    g.gain.setValueAtTime(0, when);
    g.gain.linearRampToValueAtTime(gain * vel, when + .004);
    g.gain.exponentialRampToValueAtTime(.0001, when + decay * dec);
    o.connect(g); g.connect(bus);
    o.start(when); o.stop(when + decay * dec + .05);
  });
}

// Pip's voice: a gentle "oo/ah" hum, a buzzing tone shaped by two vowel filters
function hum(f, when, dur) {
  const o = ac.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f;
  const lfo = ac.createOscillator(), lg = ac.createGain();
  lfo.frequency.value = 5.2; lg.gain.value = f * .011;
  lfo.connect(lg); lg.connect(o.frequency);

  const f1 = ac.createBiquadFilter(), f2 = ac.createBiquadFilter();
  f1.type = f2.type = 'bandpass'; f1.Q.value = f2.Q.value = 5;
  f1.frequency.setValueAtTime(330, when);
  f1.frequency.linearRampToValueAtTime(620, when + dur * .6);
  f2.frequency.setValueAtTime(820, when);
  f2.frequency.linearRampToValueAtTime(1100, when + dur * .6);
  const g2 = ac.createGain(); g2.gain.value = .55;

  const env = ac.createGain();
  env.gain.setValueAtTime(0, when);
  env.gain.linearRampToValueAtTime(.1, when + .12);
  env.gain.setValueAtTime(.1, when + Math.max(.13, dur - .25));
  env.gain.linearRampToValueAtTime(0, when + dur);

  const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2600;
  o.connect(f1); o.connect(f2);
  f1.connect(env); f2.connect(g2); g2.connect(env);
  env.connect(lp); lp.connect(bus);
  o.start(when); lfo.start(when);
  o.stop(when + dur + .05); lfo.stop(when + dur + .05);
}

// ---- Pip composes ----
const ADJ = ['Sleepy', 'Little', 'Silver', 'Quiet', 'Drowsy', 'Velvet', 'Tiny', 'Soft'];
const NOUN = ['Moon', 'Cloud', 'Lantern', 'Moth', 'Owl', 'Star', 'Blanket', 'Pond'];
let songNo = 0;

function compose() {
  const g = blank();
  const rhythms = [[1, 0, 1, 1], [1, 0, 0, 1], [1, 1, 0, 1], [1, 0, 1, 0], [1, 1, 1, 0]];
  const rA = pick(rhythms), rB = pick(rhythms);
  const s = pick([2, 3, 4]);

  // One bar = 4 steps. Walk mostly by small steps so it sounds like a tune.
  const bar = (b, rhythm, start) => {
    let r = clamp(start, 0, ROWS - 1), last = null;
    rhythm.forEach((on, i) => {
      if (!on) return;
      if (last) r = clamp(r + pick([-2, -1, -1, 0, 1, 1, 2]), 0, ROWS - 1);
      g[r][b * 4 + i] = true;
      last = { r, step: b * 4 + i };
    });
    return last;
  };

  bar(0, rA, s);
  bar(1, rA, s + pick([-1, 0, 1]));
  bar(2, rB, s + pick([1, 2, 3]));                    // a little higher, a little tension
  const end = bar(3, pick([[1, 0, 1, 0], [1, 0, 0, 0]]), s - pick([0, 1]));
  g[end.r][end.step] = false; g[0][end.step] = true;  // come home to the tonic

  // A soft bass note on the first beats
  if (Math.random() < .8) g[0][0] = true;
  if (Math.random() < .7) g[pick([0, 2, 3])][8] = true;

  pat = g;
  songNo++;
  $('song').textContent = pick(ADJ) + ' ' + pick(NOUN) + ' · No. ' + songNo;
}

// ---- Scheduler: plays the pattern on the audio clock ----
let playing = false, started = false, timer = null;
let absStep = 0, nextT = 0, events = [];

function anyOn(st) { for (let r = 0; r < ROWS; r++) if (pat[r][st]) return true; return false; }

function scheduler() {
  while (nextT < ac.currentTime + .3) {
    const st = absStep % STEPS, sd = stepDur();
    const rows = [];
    for (let r = 0; r < ROWS; r++) {
      if (pat[r][st]) { tine(freq(r), nextT, .6 + Math.random() * .15); rows.push(r); }
    }
    let humDur = 0;
    if (humOn && rows.length) {
      let k = 1;
      while (k < 8 && !anyOn((st + k) % STEPS)) k++;
      humDur = Math.min(k * sd * .92, 2.4);
      hum(freq(rows[rows.length - 1]), nextT, humDur);
    }
    if (rows.length) events.push({ t: nextT, rows, hum: humDur });
    nextT += sd; absStep++;
  }
}

function play() {
  initAudio();
  ac.resume();
  if (playing) return;
  if (!started) { started = true; nextT = ac.currentTime + .15; }
  playing = true;
  timer = setInterval(scheduler, 25);
  $('play').textContent = 'Pause';
}

function pause() {
  if (!playing) return;
  playing = false;
  clearInterval(timer);
  ac.suspend();
  $('play').textContent = 'Play';
}

function begin() {
  initAudio();
  compose();
  $('panel').classList.add('hide');
  windKey();
  play();
}

// ---- Controls ----
$('go').onclick = begin;
$('play').onclick = () => { if (!ac) begin(); else playing ? pause() : play(); };
$('new').onclick = () => {
  initAudio(); compose();
  $('panel').classList.add('hide');
  windKey();
  if (!playing) play();
};
$('hum').onchange = e => { humOn = e.target.checked; };
$('bpm').oninput = e => { bpm = +e.target.value; $('bpmv').textContent = bpm; };

document.querySelectorAll('.moods button').forEach(b => {
  b.onclick = () => {
    mood = MOODS[b.dataset.m];
    bpm = mood.bpm; $('bpm').value = bpm; $('bpmv').textContent = bpm;
    document.querySelectorAll('.moods button').forEach(x => x.setAttribute('aria-pressed', x === b));
  };
});

// Tapping the golden key winds the box, and pauses or restarts the music
$('key').onclick = () => { if (!ac) begin(); else { windKey(); playing ? pause() : play(); } };

addEventListener('keydown', e => {
  if (e.code === 'Space' && e.target === document.body) { e.preventDefault(); $('play').click(); }
});
document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });

// ---- Floating notes and sparkles ----
const fx = $('fx'), fctx = fx.getContext('2d'), stage = $('stage');
let dpr = 1, particles = [];
function sizeFx() {
  dpr = window.devicePixelRatio || 1;
  fx.width = stage.clientWidth * dpr; fx.height = stage.clientHeight * dpr;
  fctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
addEventListener('resize', sizeFx);
sizeFx();

const COLORS = ['#f08aa8', '#e0a030', '#a58bf0', '#6cc7ae'];
function burst(count) {
  if (calm || particles.length > 80) return;
  const s = stage.getBoundingClientRect(), r = $('boxImg').getBoundingClientRect();
  const ox = r.left - s.left + r.width * .5, oy = r.top - s.top + r.height * .27;
  for (let i = 0; i < count; i++) {
    particles.push({
      x: ox + (Math.random() - .5) * r.width * .18, y: oy,
      vx: (Math.random() - .5) * 46, vy: -(34 + Math.random() * 40),
      l: 2.2, size: 18 + Math.random() * 12, c: pick(COLORS),
      g: pick(['♪', '♫', '✦', '✧']), ph: Math.random() * 6
    });
  }
}

function drawParticles(dt, t) {
  fctx.clearRect(0, 0, stage.clientWidth, stage.clientHeight);
  fctx.textAlign = 'center';
  for (const p of particles) {
    p.l -= dt; p.y += p.vy * dt; p.x += p.vx * dt + Math.sin(t * 2 + p.ph) * .4;
    fctx.globalAlpha = clamp(p.l / 2.2, 0, 1);
    fctx.fillStyle = p.c;
    fctx.font = p.size + 'px Georgia, serif';
    fctx.fillText(p.g, p.x, p.y);
  }
  fctx.globalAlpha = 1;
  particles = particles.filter(p => p.l > 0);
}

// ---- The winding key ----
// It turns around its own shaft. Faster while the music plays, and it settles face-on when paused.
let keyAngle = 0, keyVel = 0;
function windKey() { keyVel += 300; }

function updateKey(dt, t) {
  const key = $('key');
  if (calm) {
    keyAngle = playing ? Math.sin(t * 2) * 14 : 0;
  } else if (playing) {
    keyVel += (bpm * 2 - keyVel) * (1 - Math.exp(-dt * 2.5));
    keyAngle += keyVel * dt;
  } else {
    keyVel *= Math.exp(-dt * 2.2);
    if (keyVel > 25) keyAngle += keyVel * dt;
    else keyAngle += (Math.round(keyAngle / 180) * 180 - keyAngle) * (1 - Math.exp(-dt * 5));
  }
  const edge = Math.abs(Math.cos(keyAngle * Math.PI / 180));        // 1 = facing us, 0 = edge-on
  key.style.transform = 'perspective(260px) rotateX(' + keyAngle.toFixed(2) + 'deg)';
  key.style.filter = 'brightness(' + (.82 + .18 * edge).toFixed(3) + ')';
}

// ---- Main loop ----
let t = 0, last = performance.now(), bounce = 0;
const box = $('box');

function frame(ms) {
  const dt = Math.min((ms - last) / 1000, .05);
  last = ms; t += dt;
  const now = ac ? ac.currentTime : 0;

  // react to each note as the audio clock reaches it
  while (events.length && events[0].t <= now) {
    const e = events.shift();
    burst(e.rows.length > 1 ? 2 : 1);
    bounce = 1;
  }
  bounce *= Math.exp(-dt * 6);

  updateKey(dt, t);

  // the music box gives a tiny hop on each note
  box.style.transform = calm ? '' : 'translateY(' + (-bounce * 3).toFixed(2) + 'px)';

  drawParticles(dt, t);
  requestAnimationFrame(frame);
}

// Pip's first lullaby is ready before anyone presses play
compose();
songNo = 0; $('song').textContent = "Pip's lullaby";
requestAnimationFrame(frame);