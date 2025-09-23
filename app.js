/* Asteroid — pezzaliAPP PWA (Canvas 2D) — MIT License */
(() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const scoreEl = document.getElementById('score');
  const livesEl = document.getElementById('lives');
  const fpsEl = document.getElementById('fps');
  const startScreen = document.getElementById('startScreen');
  const btnStart = document.getElementById('btnStart');
  const DPR = Math.max(1, Math.min(2, window.devicePixelRatio || 1)); // cap at 2 for performance

  // Best score (localStorage, non invasivo)
  function loadBest(){
    try { return parseInt(localStorage.getItem('asteroid-best')||'0',10) || 0; } catch(e){ return 0; }
  }
  function saveBest(v){
    try {
      const best = loadBest();
      if(v > best) localStorage.setItem('asteroid-best', String(v));
    } catch(e){}
  }

  let W = 0, H = 0;
  let running = false;
  let last = 0, frames = 0, fps = 60, fpsTimer = 0;

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
  constructor(x,y,ang,sp,life){
    this.x=x; this.y=y;
    this.vx=Math.cos(ang)*sp; this.vy=Math.sin(ang)*sp;
    this.life=life; this.r=2*(window.devicePixelRatio||1);
  }
  update(dt,W,H){
    const wrap=(v,max)=> (v<0? v+max : v%max);
    this.x = wrap(this.x + this.vx*dt*60, W);
    this.y = wrap(this.y + this.vy*dt*60, H);
    this.life -= dt;
  }
  draw(ctx){
    ctx.globalAlpha = Math.max(0, this.life*1.5);
    ctx.beginPath();
    ctx.arc(this.x,this.y,this.r,0,Math.PI*2);
    ctx.fill();
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
  let ship, asteroids, bullets, particles, score, lives, shootCooldown;
  function newGame(){
    ship = new Ship();
    asteroids = [];
    bullets = [];
    particles = [];
    score = 0;
    lives = 3;
    shootCooldown = 0;
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
    const a = Math.random()*Math.PI*2;
    const sp = (0.8 + Math.random()*3.5) * (window.devicePixelRatio||1);
    const life = 0.3 + Math.random()*0.7;
    particles.push(new Particle(x,y,a,sp,life));
  }
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
    spawnExplosion(ship.x, ship.y, 20);
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

  btnStart.addEventListener('click', ()=>{
    startScreen.style.display = 'none';
    running = true;
    last = performance.now();
  });

  // loop
  function loop(ts){
    if(!running){ requestAnimationFrame(loop); return; }
    const dt = Math.min(0.05, (ts - last)/1000); // cap
    last = ts;

    // fps
    frames++; fpsTimer += dt;
    if(fpsTimer >= 0.5){ fps = Math.round(frames / fpsTimer); frames = 0; fpsTimer = 0; }

    // update input bridge
    ship.rot = 0;
    ship.thrusting = false;
    const rotSpeed = 3.0; // rad/s
    if(keys.left || touchActive.left) ship.rot = -rotSpeed;
    if(keys.right || touchActive.right) ship.rot = rotSpeed;
    if(keys.thrust || touchActive.thrust) ship.thrusting = true;
    if(keys.fire || touchActive.fire){ fire(); }

    // cooldown timer
    shootCooldown = Math.max(0, shootCooldown - dt);

    // update
    ship.update(dt);
    bullets.forEach(b=>b.update(dt));
    bullets = bullets.filter(b=>b.life>0);
    asteroids.forEach(a=>a.update(dt));
    particles.forEach(p=>p.update(dt, W, H));
    particles = particles.filter(p=>p.life>0);

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
    // collisions ship-asteroids
    for(let i=0;i<asteroids.length;i++){
      const a = asteroids[i];
      if(dist2(a.x,a.y,ship.x,ship.y) < (a.r+ship.r*0.8)*(a.r+ship.r*0.8)){
        explodeShip();
        break;
      }
    }

    // next wave
    if(asteroids.length === 0){
      makeAsteroids(5);
      score += 100;
    }

    // draw
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
    particles.forEach(p=>p.draw(ctx));
    bullets.forEach(b=>b.draw());
    ctx.restore();

    // HUD
    scoreEl.textContent = String(score).padStart(5,'0');
    livesEl.textContent = '❤'.repeat(Math.max(0,lives));
    fpsEl.textContent = fps;
    const best = loadBest();
    const bestEl = document.getElementById('best');
    if(bestEl) bestEl.textContent = 'BEST ' + String(Math.max(best, score)).padStart(5,'0');

    // game over
    if(lives <= 0){
      running = false;
      saveBest(score);
      const bestNow = loadBest();
      startScreen.querySelector('p').innerHTML = `Punteggio: <b>${score}</b> — Record: <b>${bestNow}</b>`;
      startScreen.style.display = 'flex';
      btnStart.textContent = 'Ricomincia';
      newGame();
    }

    requestAnimationFrame(loop);
  }

  newGame();
  requestAnimationFrame(loop);
})();