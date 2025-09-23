/* Asteroid — pezzaliAPP PWA (Canvas 2D) — MIT License */
(() => {
  document.addEventListener('DOMContentLoaded', ()=>{
    // no-op; ensures DOM ready before binding
  });
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const scoreEl = document.getElementById('score');
  const livesEl = document.getElementById('lives');
  const fpsEl = document.getElementById('fps');
  const startScreen = document.getElementById('startScreen');
  const btnStart = document.getElementById('btnStart');
  const btnScores = document.getElementById('btnScores');
  const scoresModal = document.getElementById('scoresModal');
  const scoresList = document.getElementById('scoresList');
  const btnCloseScores = document.getElementById('btnCloseScores');
  const DPR = Math.max(1, Math.min(2, window.devicePixelRatio || 1)); // cap at 2 for performance

  // --- Audio ---
  const Audio = {
    ctx: null,
    gain: null,
    enabled: true,
    init(){
      if(this.ctx) return;
      try{
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.gain = this.ctx.createGain();
        this.gain.gain.value = 0.08;
        this.gain.connect(this.ctx.destination);
      }catch(e){ this.enabled = false; }
    },
    tone(freq=440, dur=0.08, type='square'){
      if(!this.enabled || !this.ctx) return;
      const t = this.ctx.currentTime;
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = type; o.frequency.setValueAtTime(freq, t);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(1.0, t+0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t+dur);
      o.connect(g); g.connect(this.gain);
      o.start(t);
      o.stop(t+dur);
    },
    shoot(){ this.tone(880, 0.05, 'square'); },
    thrust(){ this.tone(140, 0.08, 'sawtooth'); },
    explode(){ this.tone(90, 0.2, 'triangle'); },
    ufo(){ this.tone(520, 0.12, 'square'); }
  };

  let W = 0, H = 0;
  let running = false;
  let lastPerf = 0, frames = 0, fps = 60, fpsTimer = 0;
  const FIXED_DT = 1/60; // 60 Hz
  let accumulator = 0;

  const keys = { left:false, right:false, thrust:false, fire:false };
  const touchActive = { left:false, right:false, thrust:false, fire:false };

  const rand = (min, max) => Math.random()*(max-min)+min;
  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
  const wrap = (v, max) => (v < 0 ? v + max : v % max);
  const dist2 = (x1,y1,x2,y2)=>{
    const dx = x2 - x1, dy = y2 - y1;
    return dx*dx + dy*dy;
  }

  function resize(){
    W = Math.floor(window.innerWidth * DPR);
    H = Math.floor(window.innerHeight * DPR);
    canvas.width = W; canvas.height = H;
    canvas.style.width = (W / DPR) + 'px';
    canvas.style.height = (H / DPR) + 'px';
  }
  window.addEventListener('resize', resize);
  resize();

  // Game objects

  class Particle{
    constructor(x,y,ang,sp,life,color="#e6e6e6"){
      this.x=x; this.y=y;
      this.vx=Math.cos(ang)*sp; this.vy=Math.sin(ang)*sp;
      this.life=life; this.r=2*DPR; this.color=color;
    }
    update(dt){
      this.x = wrap(this.x + this.vx*dt*60, W);
      this.y = wrap(this.y + this.vy*dt*60, H);
      this.life -= dt;
    }
    draw(){
      ctx.globalAlpha = Math.max(0,this.life*1.5);
      ctx.beginPath(); ctx.fillStyle=this.color;
      ctx.arc(this.x,this.y,this.r,0,Math.PI*2); ctx.fill();
      ctx.globalAlpha = 1;
    }
  }
  class Ship{
    constructor(){
      this.x = W/2; this.y = H/2;
      this.r = 14 * DPR;
      this.a = -Math.PI/2; // up
      this.rot = 0;
      this.thrusting = false;
      this.vel = {x:0,y:0};
      this.thrust = 0.07 * DPR;
      this.friction = 0.99;
      this.dead = false;
      this.inv = 0; // invincibility timer
    }
    update(dt){
      this.a += this.rot * dt;
      if(this.thrusting){
        this.vel.x += Math.cos(this.a) * this.thrust * dt * 60;
        this.vel.y += Math.sin(this.a) * this.thrust * dt * 60;
      }
      this.x = wrap(this.x + this.vel.x, W);
      this.y = wrap(this.y + this.vel.y, H);
      this.vel.x *= this.friction;
      this.vel.y *= this.friction;
      if(this.inv > 0) this.inv -= dt;
    }
    draw(){
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(this.a);
      ctx.lineWidth = 2 * DPR;
      ctx.strokeStyle = "#e6e6e6";
      ctx.beginPath();
      ctx.moveTo( 1.2*this.r, 0);
      ctx.lineTo(-this.r, 0.8*this.r);
      ctx.lineTo(-this.r,-0.8*this.r);
      ctx.closePath();
      ctx.stroke();
      if(this.thrusting){
        ctx.beginPath();
        ctx.moveTo(-this.r*1.05, 0);
        ctx.lineTo(-this.r*1.8, 0.4*this.r);
        ctx.lineTo(-this.r*1.8, -0.4*this.r);
        ctx.closePath();
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  class Asteroid{
    constructor(x,y,r){
      this.x = x; this.y = y;
      this.r = r;
      const sp = rand(0.3, 1.2) * DPR;
      const ang = rand(0, Math.PI*2);
      this.vx = Math.cos(ang)*sp;
      this.vy = Math.sin(ang)*sp;
      this.verts = [];
      const n = Math.floor(rand(7, 12));
      for(let i=0;i<n;i++){
        const ang2 = i/n * Math.PI*2;
        const off = rand(0.7, 1.3);
        this.verts.push([Math.cos(ang2)*this.r*off, Math.sin(ang2)*this.r*off]);
      }
    }
    update(dt){
      this.x = wrap(this.x + this.vx*dt*60, W);
      this.y = wrap(this.y + this.vy*dt*60, H);
    }
    draw(){
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.lineWidth = 2 * DPR;
      ctx.strokeStyle = "#e6e6e6";
      ctx.beginPath();
      const v = this.verts;
      ctx.moveTo(v[0][0], v[0][1]);
      for(let i=1;i<v.length;i++) ctx.lineTo(v[i][0], v[i][1]);
      ctx.closePath();
      ctx.stroke();
      ctx.restore();
    }
  }

  class Bullet{
    constructor(x,y,a, speed=7.0 * DPR, life=0.9){
      this.x = x; this.y = y;
      this.vx = Math.cos(a)*speed; this.vy = Math.sin(a)*speed;
      this.life = life;
      this.r = 2 * DPR;
      this.enemy = false; // true for enemy bullets
    }
    update(dt){
      this.x = wrap(this.x + this.vx*dt*60, W);
      this.y = wrap(this.y + this.vy*dt*60, H);
      this.life -= dt;
    }
    draw(){
      ctx.beginPath();
      ctx.fillStyle = this.enemy ? "#f55" : "#e6e6e6";
      ctx.arc(this.x, this.y, this.r, 0, Math.PI*2);
      ctx.fill();
    }
  }

  class UFO{
    constructor(){
      this.r = 16*DPR;
      this.y = Math.random() < 0.5 ? 0.2*H : 0.8*H;
      this.x = Math.random() < 0.5 ? -40*DPR : W + 40*DPR;
      this.vx = this.x < 0 ? 2.0*DPR : -2.0*DPR;
      this.cool = 1.0;
      this.alive = true;
      this.shootRate = 1.2; // seconds
      this.hp = 3;
    }
    update(dt){
      this.x += this.vx*dt*60;
      if(this.x < -60*DPR || this.x > W+60*DPR){ this.alive=false; }
      this.cool -= dt;
      if(this.cool<=0){
        this.cool = this.shootRate;
        // aim roughly at ship
        const a = Math.atan2(ship.y - this.y, ship.x - this.x) + (Math.random()-0.5)*0.25;
        const b = new Bullet(this.x, this.y, a, 6.0*DPR, 1.6);
        b.enemy = true;
        bullets.push(b);
        Audio.ufo();
      }
    }
    hit(){
      this.hp-=1;
      if(this.hp<=0){ this.alive=false; spawnExplosion(this.x,this.y,18); }
    }
    draw(){
      ctx.save();
      ctx.translate(this.x,this.y);
      ctx.strokeStyle="#7cf";
      ctx.lineWidth=2*DPR;
      ctx.beginPath();
      ctx.rect(-this.r, -this.r*0.4, this.r*2, this.r*0.8);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, -this.r*0.6, this.r*0.6, Math.PI, 0);
      ctx.stroke();
      ctx.restore();
    }
  }
    constructor(x,y,a){
      const sp = 7.0 * DPR;
      this.x = x; this.y = y;
      this.vx = Math.cos(a)*sp; this.vy = Math.sin(a)*sp;
      this.life = 0.9;
      this.r = 2 * DPR;
    }
    update(dt){
      this.x = wrap(this.x + this.vx*dt*60, W);
      this.y = wrap(this.y + this.vy*dt*60, H);
      this.life -= dt;
    }
    draw(){
      ctx.beginPath();
      ctx.fillStyle = "#e6e6e6";
      ctx.arc(this.x, this.y, this.r, 0, Math.PI*2);
      ctx.fill();
    }
  }

  // Game state
  let ship, asteroids, bullets, particles, score, lives, shootCooldown, ufo, ufoTimer;
  function newGame(){
    ship = new Ship();
    asteroids = [];
    bullets = [];
    particles = [];
    score = 0;
    lives = 3;
    shootCooldown = 0;
    ufo = null; ufoTimer = 5.0; // spawn after 5s
    makeAsteroids(4);
  }

  function makeAsteroids(n){
    for(let i=0;i<n;i++){
      let x,y;
      // spawn away from ship
      do{
        x = rand(0, W); y = rand(0, H);
      } while(dist2(x,y,ship.x,ship.y) < (200*DPR)*(200*DPR));
      asteroids.push(new Asteroid(x,y, rand(28*DPR, 44*DPR)));
    }
  }

  function spawnExplosion(x,y,count=14){
    for(let i=0;i<count;i++){
      const a = rand(0, Math.PI*2);
      const sp = rand(1.0*DPR, 5.0*DPR);
      particles.push(new Particle(x,y,a,sp, rand(0.3,0.9)));
    }
    Audio.explode();
  }

  function splitAsteroid(ast, idx){
    const r = ast.r;
    if(r > 22*DPR){
      const count = 2;
      for(let i=0;i<count;i++){
        const a = new Asteroid(ast.x, ast.y, r*0.55);
        a.vx += rand(-1,1); a.vy += rand(-1,1);
        asteroids.push(a);
      }
    }
    asteroids.splice(idx,1);
  }

  function explodeShip(){
    if(ship.inv > 0) return;
    lives--;
    spawnExplosion(ship.x, ship.y, 22);
    ship = new Ship();
    ship.inv = 2.0; // invincibility on respawn
  }

  function fire(){
    if(shootCooldown > 0) return;
    bullets.push(new Bullet(
      ship.x + Math.cos(ship.a)*ship.r*1.2,
      ship.y + Math.sin(ship.a)*ship.r*1.2,
      ship.a
    ));
    shootCooldown = 0.18;
    Audio.shoot();
  }

  // input
  window.addEventListener('keydown', e=>{
    if(e.code === 'ArrowLeft') keys.left = true;
    if(e.code === 'ArrowRight') keys.right = true;
    if(e.code === 'ArrowUp') keys.thrust = true;
    if(e.code === 'Space'){ keys.fire = true; e.preventDefault(); }
  }, {passive:false});
  window.addEventListener('keyup', e=>{
    if(e.code === 'ArrowLeft') keys.left = false;
    if(e.code === 'ArrowRight') keys.right = false;
    if(e.code === 'ArrowUp') keys.thrust = false;
    if(e.code === 'Space') keys.fire = false;
  });

  // Touch
  function setTouch(action, on){
    touchActive[action] = on;
    if(on && action==='fire') fire();
  }

  // Pointer events for on-screen pads (work on mouse + touch)
  document.querySelectorAll('.pad').forEach(el=>{
    const action = el.getAttribute('data-action');
    const down = (ev)=>{ ev.preventDefault(); setTouch(action,true); if(el.setPointerCapture && ev.pointerId!==undefined) el.setPointerCapture(ev.pointerId); };
    const up   = (ev)=>{ ev.preventDefault(); setTouch(action,false); };
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('pointerleave', up);
  });

  document.querySelectorAll('.pad').forEach(el=>{
    const action = el.getAttribute('data-action');
    const start = (ev)=>{ ev.preventDefault(); setTouch(action,true); };
    const end   = (ev)=>{ ev.preventDefault(); setTouch(action,false); };
    el.addEventListener('touchstart', start, {passive:false});
    el.addEventListener('touchend', end, {passive:false});
    el.addEventListener('touchcancel', end, {passive:false});
    el.addEventListener('mousedown', start);
    el.addEventListener('mouseup', end);
    el.addEventListener('mouseleave', end);
  });

  function loadScores(){
    try{ return JSON.parse(localStorage.getItem('asteroid-scores')||'[]'); }catch(e){ return []; }
  }
  function saveScore(v){
    const arr = loadScores(); arr.push({v, t: Date.now()});
    arr.sort((a,b)=>b.v-a.v);
    localStorage.setItem('asteroid-scores', JSON.stringify(arr.slice(0,10)));
  }
  function renderScores(){
    const arr = loadScores();
    scoresList.innerHTML = arr.length? arr.map((s,i)=>`<li><b>${String(i+1).padStart(2,'0')}</b> — ${s.v}</li>`).join('') : '<li>Nessun punteggio salvato</li>';
  }

  btnStart.addEventListener('click', ()=>{
    Audio.init();
    startScreen.style.display = 'none';
    running = true;
    lastPerf = performance.now();
  });

  btnScores?.addEventListener('click', ()=>{
    renderScores();
    scoresModal.style.display='flex';
  });
  btnCloseScores?.addEventListener('click', ()=>{
    scoresModal.style.display='none';
  });
    startScreen.style.display = 'none';
    running = true;
    last = performance.now();
  });

  // loop
  function loop(ts){
    if(!running){ requestAnimationFrame(loop); return; }
    let dtRaw = (ts - lastPerf)/1000; if(dtRaw > 0.25) dtRaw = 0.25; // handle tab switch
    lastPerf = ts;
    accumulator += dtRaw;

    // fps (using raw dt)
    frames++; fpsTimer += dtRaw;
    if(fpsTimer >= 0.5){ fps = Math.round(frames / fpsTimer); frames = 0; fpsTimer = 0; }

    // fixed update steps
    while(accumulator >= FIXED_DT){
      step(FIXED_DT);
      accumulator -= FIXED_DT;
    }

    draw();
    requestAnimationFrame(loop);
  }

  function step(dt){
    // cooldown timer
    shootCooldown = Math.max(0, shootCooldown - dt);

    // update input bridge
    ship.rot = 0;
    ship.thrusting = false;
    const rotSpeed = 3.0; // rad/s
    if(keys.left || touchActive.left) ship.rot = -rotSpeed;
    if(keys.right || touchActive.right) ship.rot = rotSpeed;
    if(keys.thrust || touchActive.thrust){ ship.thrusting = true; Audio.thrust(); }
    if(keys.fire || touchActive.fire){ fire(); }

    // cooldown timer
    shootCooldown = Math.max(0, shootCooldown - dt);

    // update
    ship.update(dt);
    bullets.forEach(b=>b.update(dt));
    bullets = bullets.filter(b=>b.life>0);
    asteroids.forEach(a=>a.update(dt));
    particles.forEach(p=>p.update(dt));
    particles = particles.filter(p=>p.life>0);

    // UFO spawn + update
    ufoTimer -= dt;
    if(ufoTimer <= 0 && (!ufo || !ufo.alive)){
      ufo = new UFO();
      ufoTimer = 12 + Math.random()*8; // next spawn
    }
    if(ufo && ufo.alive){ ufo.update(dt); }

    // collisions bullets-asteroids
    for(let i=asteroids.length-1;i>=0;i--){
      const a = asteroids[i];
      for(let j=bullets.length-1;j>=0;j--){
        const b = bullets[j];
        if(dist2(a.x, a.y, b.x, b.y) < (a.r+b.r)*(a.r+b.r)){
          bullets.splice(j,1);
          splitAsteroid(a, i);
          spawnExplosion(a.x,a.y,12);
          score += 10;
          break;
        }
      }
    }
    // collisions bullets-ufo
    if(ufo && ufo.alive){
      for(let j=bullets.length-1;j>=0;j--){
        const b = bullets[j]; if(b.enemy) continue;
        if(dist2(ufo.x,ufo.y,b.x,b.y) < (ufo.r+b.r)*(ufo.r+b.r)){
          bullets.splice(j,1);
          ufo.hit();
          if(!ufo.alive){ score += 100; Audio.explode(); }
          break;
        }
      }
    }

    // collisions ship-asteroids
    for(let i=0;i<asteroids.length;i++){
      const a = asteroids[i];
      if(dist2(a.x,a.y,ship.x,ship.y) < (a.r+ship.r*0.8)*(a.r+ship.r*0.8)){
        explodeShip();
        break;
      }
    }
    // ship with UFO
    if(ufo && ufo.alive && dist2(ufo.x,ufo.y,ship.x,ship.y) < (ufo.r+ship.r)*(ufo.r+ship.r)){
      explodeShip();
    }
    // enemy bullets with ship
    for(let j=0;j<bullets.length;j++){
      const b = bullets[j];
      if(b.enemy && dist2(b.x,b.y,ship.x,ship.y) < (b.r+ship.r*0.6)*(b.r+ship.r*0.6)){
        bullets.splice(j,1); j--;
        explodeShip();
        break;
      }
    }

    // next wave
    if(asteroids.length === 0){
      makeAsteroids(5);
      score += 100;
      ufoTimer = Math.min(ufoTimer, 3.0); // accelerate UFO next spawn
    }

}

  function draw(){
    ctx.clearRect(0,0,W,H);
    ctx.save();
    ctx.strokeStyle = "#e6e6e6";
    ctx.lineWidth = 2 * DPR;

    // stars background (simple)
    for(let i=0;i<40;i++){
      const x = (i*97 % W);
      const y = (i*57 % H);
      ctx.fillStyle = "#555";
      ctx.fillRect(x, y, 2*DPR, 2*DPR);
    }

    asteroids.forEach(a=>a.draw());
    ship.draw();
    bullets.forEach(b=>b.draw());
    particles.forEach(p=>p.draw());
    if(ufo && ufo.alive) ufo.draw();

    ctx.restore();

    // HUD
    scoreEl.textContent = String(score).padStart(5,'0');
    livesEl.textContent = '❤'.repeat(Math.max(0,lives));
    fpsEl.textContent = fps;

    // game over overlay handled in step()
  }

  newGame();
  requestAnimationFrame(loop);
})();