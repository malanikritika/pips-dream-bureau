const $=id=>document.getElementById(id), fx=$('fx'), c=fx.getContext('2d');
let W,H,P=[],wandOn=false,starMode=false,musicOn=true,ac,master;
function rs(){W=fx.width=innerWidth;H=fx.height=innerHeight}addEventListener('resize',rs);rs();
const COLORS=['pink','mint','sky','peach','lilac','starry'];
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

/* ---------- cute voices (browser speech, high pitch) ---------- */
function say(who,text){
  return new Promise(res=>{
    const el=$(who==='fairy'?'fairy':'pip'),u=new SpeechSynthesisUtterance(text);
    const v=speechSynthesis.getVoices().filter(x=>/en/i.test(x.lang));
    const pick=v.find(x=>/female|samantha|zira|google uk english female|google us/i.test(x.name))||v[0];
    if(pick)u.voice=pick;
    u.pitch=who==='fairy'?2:1.7; u.rate=who==='fairy'?1:.9; u.volume=1;
    el.classList.add('talk');
    const end=()=>{el.classList.remove('talk');res()};
    u.onend=end;u.onerror=end;
    setTimeout(end,text.length*110+1500);
    speechSynthesis.cancel();speechSynthesis.speak(u);
  });
}

/* ---------- music box lullaby (Web Audio) ---------- */
function music(){
  ac=new (window.AudioContext||window.webkitAudioContext)();
  master=ac.createGain();master.gain.value=.16;master.connect(ac.destination);
  const notes=[523,659,784,659,880,784,659,587,523,659,784,1047,880,784,659,587];
  let i=0;
  const tick=()=>{
    if(musicOn){
      const o=ac.createOscillator(),g=ac.createGain(),f=notes[i%notes.length];
      o.type='sine';o.frequency.value=f;
      g.gain.setValueAtTime(0,ac.currentTime);g.gain.linearRampToValueAtTime(.9,ac.currentTime+.02);
      g.gain.exponentialRampToValueAtTime(.001,ac.currentTime+1.4);
      o.connect(g);g.connect(master);o.start();o.stop(ac.currentTime+1.5);
      if(i%4==0){const b=ac.createOscillator(),bg=ac.createGain();b.frequency.value=f/4;bg.gain.value=.25;
        bg.gain.exponentialRampToValueAtTime(.001,ac.currentTime+2);b.connect(bg);bg.connect(master);b.start();b.stop(ac.currentTime+2)}
    }
    i++;
  };
  setInterval(tick,520);
}
function chime(f=1200){if(!ac||!musicOn)return;const o=ac.createOscillator(),g=ac.createGain();o.frequency.value=f;
  g.gain.setValueAtTime(.5,ac.currentTime);g.gain.exponentialRampToValueAtTime(.001,ac.currentTime+.6);
  o.connect(g);g.connect(master);o.start();o.stop(ac.currentTime+.7)}

/* ---------- sparkles: wand showers stars & bubbles ---------- */
function burst(x,y,n=3){
  for(let k=0;k<n;k++)P.push({x,y,vx:(Math.random()-.5)*90,vy:Math.random()*60+20,l:1.8,
    bub:Math.random()<.4,r:Math.random()*8+5,h:[48,320,190,280][k%4]});
}
function loop(){
  c.clearRect(0,0,W,H);
  if(wandOn){const r=$('fairy').getBoundingClientRect();burst(r.right-r.width*.1,r.top+r.height*.1,2)}
  for(const p of P){
    p.x+=p.vx*.016;p.y+=p.vy*.016;p.l-=.016;c.globalAlpha=Math.max(0,p.l/1.8);
    if(p.bub){c.strokeStyle=`hsla(${p.h},100%,85%,.9)`;c.lineWidth=2;c.beginPath();c.arc(p.x,p.y,p.r,0,7);c.stroke();
      c.fillStyle=`hsla(${p.h},100%,90%,.2)`;c.fill()}
    else{c.fillStyle=`hsl(${p.h},100%,80%)`;c.beginPath();
      for(let i=0;i<10;i++){const a=i*Math.PI/5,r=i%2?p.r*.45:p.r;c.lineTo(p.x+Math.sin(a)*r,p.y-Math.cos(a)*r)}c.fill()}
  }
  P=P.filter(p=>p.l>0);c.globalAlpha=1;
  requestAnimationFrame(loop);
}
loop();
/* twinkling cloud puffs drawn as DOM-free canvas clouds */
const clouds=[...Array(7)].map((_,i)=>({x:Math.random()*1,y:.1+Math.random()*.5,s:.6+Math.random()}));

/* ---------- the story ---------- */
async function story(){
  const f=$('fairy');
  f.classList.add('bob');wandOn=true;
  f.style.left='30vw';await sleep(6000);
  await say('fairy','Wheee! I am flying through the soft night clouds. Look at all the sleepy little houses below!');
  f.style.left='55vw';f.style.top='30vh';await sleep(3500);
  await say('fairy','Ooh! One house is sparkling so brightly. I must go closer!');
  f.style.left='62vw';f.style.top='42vh';f.style.height='20vh';await sleep(3500);
  $('pip').classList.add('on');await sleep(1600);
  await say('fairy','Hello, little Pip! Your house is so shiny. Tell me, what is your sweetest dream?');
  await say('pip','Hi, fairy Pip! I dream of seeing a whole collection of nightlight lanterns!');
  await say('fairy','What a lovely dream. Let me wave my wand and make it come true!');
  chime(1500);for(let i=0;i<8;i++)burst(innerWidth*.6,innerHeight*.3,10);
  await sleep(1200);
  lanterns();
  say('fairy','Tap a lantern to make it glow. The dark blue one is full of stars!');
}
function lanterns(){
  const s=$('shelf');s.classList.add('on');
  COLORS.forEach(n=>{
    const i=new Image();i.src=`assets/lantern_${n}.png`;i.alt=n+' lantern';
    i.onclick=()=>{chime(600+Math.random()*900);const r=i.getBoundingClientRect();
      for(let k=0;k<20;k++)burst(r.left+r.width/2,r.top+r.height/2,1);
      if(n==='starry'){say('pip','Wow! So many twinkly stars!');starScene()}
      else{i.style.filter='drop-shadow(0 0 40px #fff) brightness(1.25)';say(Math.random()<.5?'pip':'fairy',['So pretty!','It glows so softly!','Sweet dreams, little light!'][Math.random()*3|0])}};
    s.appendChild(i);
  });
}
/* star lantern: night-sky scenery */
function starScene(){
  const st=$('stars');st.classList.add('on');
  const cv=document.createElement('canvas');cv.width=W;cv.height=H;cv.style.cssText='position:absolute;inset:0';st.appendChild(cv);
  const x=cv.getContext('2d'),S=[...Array(220)].map(()=>({x:Math.random()*W,y:Math.random()*H*.8,r:Math.random()*1.8+.3,p:Math.random()*9}));
  let shoot=[],t=0;
  (function d(){
    if(!st.contains(cv))return;t+=.03;x.clearRect(0,0,W,H);
    const m=x.createRadialGradient(W*.8,H*.2,0,W*.8,H*.2,70);m.addColorStop(0,'#fff6c8');m.addColorStop(1,'#fff6c800');
    x.fillStyle=m;x.beginPath();x.arc(W*.8,H*.2,70,0,7);x.fill();
    for(const s of S){x.fillStyle=`rgba(255,255,255,${.5+.5*Math.sin(t+s.p)})`;x.beginPath();x.arc(s.x,s.y,s.r,0,7);x.fill()}
    if(Math.random()<.02)shoot.push({x:Math.random()*W,y:Math.random()*H*.4,l:1});
    for(const s of shoot){s.x+=9;s.y+=4;s.l-=.02;x.strokeStyle=`rgba(255,240,180,${s.l})`;x.lineWidth=3;x.beginPath();x.moveTo(s.x,s.y);x.lineTo(s.x-60,s.y-27);x.stroke()}
    shoot=shoot.filter(s=>s.l>0);
    x.fillStyle='#0d0a2c';x.beginPath();x.moveTo(0,H);for(let i=0;i<=W;i+=20)x.lineTo(i,H*.88-Math.sin(i*.01)*H*.05);x.lineTo(W,H);x.fill();
    requestAnimationFrame(d);
  })();
  st.onclick=e=>{burst(e.clientX,e.clientY,12);chime(900+Math.random()*700)};
  setTimeout(()=>{const b=document.createElement('img');b.src='assets/fairy_pip.png';
    b.style.cssText='position:absolute;height:22vh;left:8vw;bottom:14vh;filter:drop-shadow(0 0 14px #ffe38a)';st.appendChild(b);
    const p=document.createElement('img');p.src='assets/pip.png';p.style.cssText='position:absolute;height:18vh;right:10vw;bottom:10vh';st.appendChild(p);
    say('fairy','Look, Pip! The whole night sky is yours.').then(()=>say('pip','Thank you, fairy Pip! This is my best dream ever!'));},1500);
}
$('go').onclick=()=>{
  $('go').remove();$('mute').style.display='block';music();speechSynthesis.getVoices();story();
};
$('mute').onclick=()=>{musicOn=!musicOn;$('mute').style.opacity=musicOn?1:.5};
