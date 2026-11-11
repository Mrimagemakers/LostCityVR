import {sites, distance, walkable, districtAt, controlsTurf} from './city.js';

export const saveKey = 'lost-city.v1';
export const jobs = [
  {title:'Night Shift', giver:'mara', pickup:'parcel', delivery:'ivo', cash:160, rep:2,
   offer:'Mara: Pick up a crate of radio parts in Market Ward and get it to Ivo at the docks.',
   pickupText:'The Rooks want the crate. Run to Ivo or shove them back.',
   done:'Ivo: Radios are back online. Dani has work for you in Westline.'},
  {title:'On the Record', giver:'dani', pickup:'relay', delivery:'mara', cash:260, rep:3,
   offer:'Dani: I do outreach with sex workers near Blue Hour. The vice unit has been shaking people down. Get the recorded statements from the relay to Mara.',
   pickupText:'The Blacktops and a corrupt vice officer are closing in. Get the recording to Mara.',
   done:'Mara: The statements are backed up. The neighborhood knows who showed up.'},
  {title:'Open Frequency', giver:'ivo', pickup:'parcel', delivery:'dani', cash:110, rep:1,
   offer:'Ivo: Westline needs another radio kit. Deliver it to Dani. I can keep these coming.',
   pickupText:'A Rook lookout spotted the kit. Keep moving.',
   done:'Dani: We have signal. Check in with Ivo for another run.'},
];

export const fresh = () => ({v:1,x:0,z:9,hp:100,cash:0,rep:0,job:0,phase:0,owned:{},turf:[0,0,0],time:0,foes:[],cooldown:0,notice:'Meet Mara at the dispatch beacon.',seq:0});
export const currentJob = s => jobs[s.job];
export const targetSite = s => {
  const job = currentJob(s);
  return sites.find(p => p.id === [job.giver,job.pickup,job.delivery][s.phase]);
};
export const nearby = s => sites.find(p => distance(s,p) < 3.2);
export const say = (s,line) => { s.notice = line; s.seq++; };

export function restore(storage) {
  try {
    const s = JSON.parse(storage.getItem(saveKey));
    if (s?.v === 1 && jobs[s.job] && [0,1,2].includes(s.phase) &&
        [s.x,s.z,s.hp,s.cash,s.rep,s.time,s.cooldown,s.seq].every(Number.isFinite) &&
        walkable(s.x,s.z) && s.owned && Array.isArray(s.turf) && Array.isArray(s.foes)) return s;
  } catch { /* Storage may be unavailable. */ }
  return fresh();
}

function move(actor,dx,dz) {
  if (walkable(actor.x+dx,actor.z)) actor.x+=dx;
  if (walkable(actor.x,actor.z+dz)) actor.z+=dz;
}

function interact(s) {
  const site = nearby(s);
  if (!site) return;
  if (site.price) {
    if (!s.owned[site.id]) {
      if (s.cash < site.price || s.rep < site.rep)
        return say(s,`${site.name} costs $${site.price} and requires ${site.rep} reputation.`);
      s.cash -= site.price;
      s.owned[site.id] = {next:s.time+45,bank:0};
      s.turf[districtAt(site.x)]++;
      return say(s,`You bought ${site.name}. Your district influence increased.`);
    }
    const holding = s.owned[site.id];
    if (!site.income) {
      s.hp = 100;
      return say(s,'You rested at Rail House. Health restored.');
    }
    const bank = holding.bank;
    holding.bank = 0;
    s.cash += bank;
    return say(s, bank ? `Collected $${bank} from ${site.name}.` : 'The next business payout is still accruing.');
  }
  const job = currentJob(s);
  if (site.id !== targetSite(s).id) {
    const greeting = {
      mara:'Mara: I keep the neighborhood radio running.',
      ivo:'Ivo: Westline and the docks look out for each other.',
      dani:'Dani: Check the mission beacon if you need directions.',
    };
    return say(s,greeting[site.id] ?? 'Follow the yellow mission beacon.');
  }
  if (s.phase === 0) {
    s.phase = 1;
    return say(s,job.offer);
  }
  if (s.phase === 1) {
    s.phase = 2;
    const types = s.job === 1 ? ['Blacktops','Vice officer'] : s.job === 0 ? ['Rook','Rook'] : ['Rook'];
    s.foes = types.map((kind,i) => ({kind,x:site.x+(i? 0:6),z:site.z+(i? 7:0),hp:2,hit:0,stun:0}));
    return say(s,job.pickupText);
  }
  s.cash += job.cash;
  s.rep += job.rep;
  s.turf[districtAt(site.x)]++;
  s.foes = [];
  s.job = Math.min(s.job+1,jobs.length-1);
  s.phase = 0;
  say(s,`${job.done} +$${job.cash} · +${job.rep} REP`);
}

// The host owns this state. Clients can send input commands and render snapshots.
export function step(s,input,dt) {
  dt = Math.max(0,Math.min(dt,.05));
  s.time += dt;
  s.cooldown = Math.max(0,s.cooldown-dt);
  const {strafe=0,forward=0,yaw=0,sprint=false} = input;
  const speed = (sprint?8.5:5.1)*dt/Math.max(1,Math.hypot(strafe,forward));
  move(s,(strafe*Math.cos(yaw)-forward*Math.sin(yaw))*speed,
    (-forward*Math.cos(yaw)-strafe*Math.sin(yaw))*speed);
  if (input.interact) interact(s);
  if (input.shove && s.cooldown === 0) {
    s.cooldown = .48;
    const enemy = s.foes.filter(e => distance(e,s)<2.5).sort((a,b)=>distance(a,s)-distance(b,s))[0];
    if (enemy) {
      enemy.hp--;
      enemy.stun = .65;
      if (!enemy.hp) {
        s.foes = s.foes.filter(e=>e!==enemy);
        say(s,`${enemy.kind} backed off.`);
      } else say(s,`${enemy.kind} staggered.`);
    }
  }
  for (const enemy of s.foes) {
    enemy.hit -= dt;
    enemy.stun -= dt;
    if (enemy.stun>0) continue;
    const gap = distance(s,enemy);
    if (gap > 1.25) {
      const dx = s.x-enemy.x;
      const dz = s.z-enemy.z;
      const speed = (enemy.kind==='Vice officer'?5.9:5.5)*dt;
      const px = enemy.x, pz = enemy.z;
      move(enemy,dx/gap*speed,dz/gap*speed);
      if (Math.hypot(enemy.x-px,enemy.z-pz)<speed*.25) {
        // Return to the closest street center when a corner blocks pursuit.
        const tx = Math.round(px/36)*36;
        const tz = Math.round(pz/36)*36;
        if (Math.abs(tx-px)<Math.abs(tz-pz)) move(enemy,Math.sign(tx-px)*speed,0);
        else move(enemy,0,Math.sign(tz-pz)*speed);
      }
    } else if (enemy.hit <= 0) {
      enemy.hit = .75;
      s.hp -= 12;
    }
  }
  if (s.hp <= 0) {
    const home = sites.find(p=>p.id==='safe');
    s.x = 0;
    s.z = s.owned.safe ? home.z+2 : 9;
    s.hp = 100;
    s.cash = Math.max(0,s.cash-25);
    s.foes = [];
    if (s.phase===2) s.phase=1;
    say(s,'You got away. Lost up to $25. Any undelivered cargo went back to pickup.');
  }
  for (const p of sites) {
    const holding = s.owned[p.id];
    if (p.income && holding && s.time >= holding.next) {
      holding.next += 45;
      const controlled = controlsTurf(s.turf,districtAt(p.x));
      holding.bank += controlled ? Math.floor(p.income*1.5) : p.income;
    }
  }
}
