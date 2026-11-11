// Turf Wars: lightweight 2D duel layer. Original artwork can replace drawn sprites later.
export const fighters = [
  ['King Dee','#c59247','The Street King'],['Starlinda','#c54b88','The Spotlight'],
  ['Queen Tara','#7953bb','The Queen'],['Rude Boy','#b84e3d','The Wild Card'],
  ['Reed Rock','#556f82','The Heavy'],['Yellow Jacket','#d8b326','The Sting'],
  ['Big Smoke','#4b6970','Uptown Enforcer'],['Diamond Lex','#b45682','Hill Hustler'],
  ['Ace Malone','#48835d','The Champion'],['Red Phoenix','#b62f40','Eastside Avenger'],
  ['Uncle Vex','#6e637a','Old School'],['Black Caesar','#24252f','The Crown']
].map(([name,color,title],id)=>({id,name,color,title,speed:id===5||id===1?1.16:id===4||id===6?.82:1,power:id===4||id===6||id===11?1.2:1}));

export function createTurfWars({onFinish}){
  const root=document.createElement('section');
  root.id='turfBattle';root.setAttribute('role','dialog');root.setAttribute('aria-label','Turf Wars combat');
  root.hidden=true;
  root.innerHTML=`<canvas width="960" height="540" aria-label="Two-dimensional fighting arena"></canvas>
    <div class="turfControls"><button data-action="left">◀</button><button data-action="right">▶</button>
    <button data-action="block">BLOCK</button><button data-action="light">HIT</button><button data-action="heavy">HEAVY</button>
    <button data-action="special">SPECIAL</button></div>
    <button class="turfExit" aria-label="Leave fight">EXIT</button>`;
  document.body.append(root);
  const c=root.querySelector('canvas'),ctx=c.getContext('2d');
  const pressed=new Set();let game=null,frame=0,raf=0;
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const commands={ArrowLeft:'left',KeyA:'left',ArrowRight:'right',KeyD:'right',KeyJ:'light',KeyK:'heavy',KeyL:'block',KeyI:'special'};
  function keyDown(e){if(!game)return;const cmd=commands[e.code];if(!cmd)return;e.preventDefault();pressed.add(cmd)}
  function keyUp(e){const cmd=commands[e.code];if(cmd)pressed.delete(cmd)}
  addEventListener('keydown',keyDown);addEventListener('keyup',keyUp);
  for(const b of root.querySelectorAll('[data-action]')){
    const action=b.dataset.action;
    const press=e=>{e.preventDefault();pressed.add(action);b.setPointerCapture?.(e.pointerId)};
    const release=e=>{e.preventDefault();pressed.delete(action)};
    b.addEventListener('pointerdown',press);
    for(const type of ['pointerup','pointercancel','lostpointercapture'])b.addEventListener(type,release);
  }
  const exit=()=>finish(false,true);
  root.querySelector('.turfExit').onclick=exit;
  function start(opponentId=3){
    if(game)return;
    const rival=fighters[opponentId%fighters.length],player=fighters[0];
    game={player,rival,p:{x:230,hp:100,super:0,lock:0,block:false,flash:0},
      r:{x:720,hp:100,super:0,lock:0,block:false,flash:0},
      time:70,last:performance.now(),ended:false,ai:0,notice:'ROUND 1 · FIGHT!',noticeUntil:performance.now()+1600};
    root.hidden=false;document.body.classList.add('turfFighting');
    pressed.clear();frame=0;raf=requestAnimationFrame(loop);
  }
  function finish(win,forfeit=false){
    if(!game)return;
    cancelAnimationFrame(raf);
    const r={win,forfeit,opponent:game.rival.name,remaining:Math.max(0,Math.round(game.p.hp))};
    game=null;pressed.clear();root.hidden=true;document.body.classList.remove('turfFighting');
    onFinish?.(r);
  }
  function strike(a,b,damage,type){
    if(a.lock>0)return;
    const dist=Math.abs(a.x-b.x),range=type==='heavy'?135:112;
    a.lock=type==='special'?.8:type==='heavy'?.56:.29;
    if(dist>range)return;
    const hit=b.block?Math.ceil(damage*.18):damage;
    b.hp=clamp(b.hp-hit,0,100);b.flash=.16;
    b.x+=a.x<b.x?15:-15;
    a.super=clamp(a.super+13,0,100);
  }
  function ai(dt){
    const g=game;if(!g)return;const a=g.r,b=g.p;
    const d=Math.abs(a.x-b.x);
    if(a.lock<=0){
      if(d>105)a.x+=Math.sign(b.x-a.x)*dt*125*g.rival.speed;
      else if(g.ai<=0){
        g.ai=.4+Math.random()*.7;
        a.block=Math.random()<.28;
        if(!a.block)strike(a,b,Math.round((Math.random()<.22?17:9)*g.rival.power),Math.random()<.3?'heavy':'light');
      }
    }
    g.ai-=dt;
  }
  function tick(dt){
    const g=game;if(!g||g.ended)return;g.time=Math.max(0,g.time-dt);
    for(const p of [g.p,g.r]){p.lock=Math.max(0,p.lock-dt);p.flash=Math.max(0,p.flash-dt)}
    g.p.block=pressed.has('block');
    if(g.p.lock<=0){
      const dir=Number(pressed.has('right'))-Number(pressed.has('left'));
      if(!g.p.block)g.p.x=clamp(g.p.x+dir*dt*195*g.player.speed,65,895);
      if(pressed.has('special')&&g.p.super>=100){g.p.super=0;strike(g.p,g.r,34,'special');pressed.delete('special')}
      else if(pressed.has('heavy')){strike(g.p,g.r,17*g.player.power,'heavy');pressed.delete('heavy')}
      else if(pressed.has('light')){strike(g.p,g.r,9*g.player.power,'light');pressed.delete('light')}
    }
    g.r.x=clamp(g.r.x,65,895);
    ai(dt);
    if(g.p.hp<=0||g.r.hp<=0||g.time<=0){
      g.ended=true;
      const win=g.r.hp<g.p.hp;
      g.notice=win?'YOU WIN — RESPECT EARNED':'YOU LOSE — REGROUP';
      g.noticeUntil=performance.now()+1800;
      setTimeout(()=>{if(game===g)finish(win)},1800);
    }
  }
  function figure(p,color,flip){
    const x=p.x,y=419;
    ctx.save();ctx.translate(x,y);
    if(flip)ctx.scale(-1,1);
    ctx.fillStyle='rgba(0,0,0,.5)';ctx.beginPath();ctx.ellipse(0,10,48,12,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle=p.flash>0?'#ffffff':'#1e2129';
    ctx.fillRect(-23,-85,19,90);ctx.fillRect(5,-85,19,90);
    ctx.fillStyle=color;ctx.fillRect(-30,-180,60,101);
    ctx.fillStyle='#8d614e';ctx.fillRect(-18,-222,36,41);
    ctx.fillStyle='#24242b';ctx.fillRect(-20,-230,40,14);
    ctx.fillStyle=p.block?'#e5c278':'#ad806a';
    ctx.fillRect(25,-170,18,67);ctx.fillRect(-43,-170,18,67);
    ctx.fillStyle='#191a21';ctx.fillRect(23,-113,25,21);ctx.fillRect(-45,-113,25,21);
    ctx.restore();
  }
  function meter(x,y,w,v,color,reverse=false){
    ctx.fillStyle='#17171de8';ctx.fillRect(x,y,w,20);
    ctx.fillStyle=color;const width=w*clamp(v/100,0,1);
    ctx.fillRect(reverse?x+w-width:x,y,width,20);
    ctx.strokeStyle='#e8d7ad';ctx.lineWidth=2;ctx.strokeRect(x,y,w,20);
  }
  function paint(){
    const g=game;if(!g)return;
    const grad=ctx.createLinearGradient(0,0,0,540);
    grad.addColorStop(0,'#141c2b');grad.addColorStop(.62,'#493a40');grad.addColorStop(1,'#242327');
    ctx.fillStyle=grad;ctx.fillRect(0,0,960,540);
    // 1995 Pittsburgh skyline beyond a brick-wall lot.
    ctx.fillStyle='#202331';
    for(let i=0;i<20;i++){const x=i*52,w=28+(i*7)%30,h=110+(i*41)%140;ctx.fillRect(x,322-h,w,h)}
    ctx.fillStyle='#bda074';
    for(let i=0;i<65;i++){const x=(i*137)%960,y=115+(i*41)%140;ctx.fillRect(x,y,3,5)}
    ctx.fillStyle='#5b4440';ctx.fillRect(0,315,960,108);
    for(let r=0;r<6;r++)for(let i=0;i<30;i++){ctx.strokeStyle='#483332';ctx.strokeRect(i*35+(r%2)*17,r*18+316,35,17)}
    ctx.fillStyle='#44403e';ctx.fillRect(0,419,960,121);
    ctx.strokeStyle='#6a6256';for(let i=0;i<12;i++){ctx.beginPath();ctx.moveTo(i*94,420);ctx.lineTo((i-2)*120,540);ctx.stroke()}
    figure(g.p,g.player.color,false);figure(g.r,g.rival.color,true);
    ctx.fillStyle='#11111bcf';ctx.fillRect(0,0,960,96);
    ctx.font='bold 26px system-ui';ctx.textAlign='left';ctx.fillStyle='#f3e2c6';ctx.fillText(g.player.name.toUpperCase(),32,33);
    ctx.textAlign='right';ctx.fillText(g.rival.name.toUpperCase(),928,33);
    meter(30,47,365,g.p.hp,'#d6a74e');meter(565,47,365,g.r.hp,'#a94a4b',true);
    ctx.font='bold 40px monospace';ctx.textAlign='center';ctx.fillStyle='#faf2db';ctx.fillText(String(Math.ceil(g.time)),480,69);
    meter(30,80,240,g.p.super,'#54a5c2');
    ctx.font='bold 13px monospace';ctx.textAlign='left';ctx.fillStyle='#fff';ctx.fillText('SUPER',282,94);
    if(performance.now()<g.noticeUntil){ctx.textAlign='center';ctx.font='bold 39px system-ui';ctx.strokeStyle='#19161b';ctx.lineWidth=7;ctx.strokeText(g.notice,480,257);ctx.fillStyle='#ffe0a0';ctx.fillText(g.notice,480,257)}
    ctx.textAlign='center';ctx.font='16px monospace';ctx.fillStyle='#e8d2b7';ctx.fillText('A/D MOVE   J LIGHT   K HEAVY   L BLOCK   I SPECIAL',480,500);
  }
  function loop(time){
    if(!game)return;
    const dt=Math.min(.05,(time-game.last)/1000||0);
    game.last=time;tick(dt);paint();
    if(game)raf=requestAnimationFrame(loop);
  }
  return {start,get active(){return !!game},fighters};
}
