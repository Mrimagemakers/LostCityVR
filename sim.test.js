import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildings, sites, walkable} from './city.js';
import {fresh, restore, step, targetSite} from './sim.js';

const site = id => sites.find(p=>p.id===id);
const command = (s,input={}) => step(s,input,.05);
function use(s,id) {
  const {x,z}=site(id);
  s.x=x;
  s.z=z;
  command(s,{interact:true});
}
function reach(s,x,z) {
  // Follow the streets with the same normalized inputs as the desktop client.
  for (let tick=0; tick<800; tick++) {
    const dx=x-s.x, dz=z-s.z;
    if (Math.hypot(dx,dz)<.5)return;
    command(s,{strafe:dx,forward:-dz,sprint:true});
  }
  assert.fail(`Could not reach ${x},${z} from ${s.x},${s.z}`);
}

test('night shift plays from spawn through pursuit and delivery using movement inputs',()=>{
  const s=fresh();
  assert.equal(targetSite(s).id,'mara');
  command(s,{interact:true});
  assert.equal(s.phase,0);
  reach(s,0,0);
  command(s,{interact:true});
  reach(s,36,0);
  command(s,{interact:true});
  assert.equal(s.foes.length,2);
  reach(s,36,-36);
  command(s,{interact:true});
  assert.equal(s.cash,160);
  assert.equal(s.rep,2);
  assert.equal(s.turf[2],1);
  assert.equal(s.foes.length,0);
  assert.equal(targetSite(s).id,'dani');
});

test('shoves repel a rival and defeat returns active cargo to pickup',()=>{
  const s=fresh();
  use(s,'mara');
  use(s,'parcel');
  Object.assign(s.foes[0],{x:s.x+1.8,z:s.z});
  command(s,{shove:true});
  assert.equal(s.foes[0].hp,1);
  for(let i=0;i<10;i++)command(s);
  command(s,{shove:true});
  assert.equal(s.foes.length,1);
  Object.assign(s.foes[0],{x:s.x+.9,z:s.z,hit:0});
  s.hp=12;
  s.cash=40;
  command(s);
  assert.equal(s.phase,1);
  assert.equal(s.hp,100);
  assert.equal(s.cash,15);
  assert.equal(s.z,9);
});

test('story progression, business gates, timed income, and save round trip',()=>{
  const s=fresh();
  use(s,'shop');
  assert.equal(s.owned.shop,undefined);
  for(const id of ['mara','parcel','ivo','dani','relay'])use(s,id);
  assert.deepEqual(s.foes.map(e=>e.kind),['Blacktops','Vice officer']);
  use(s,'mara');
  assert.equal(s.rep,5);
  use(s,'shop');
  assert.equal(s.cash,190);
  assert.equal(s.turf[2],2);
  s.time=s.owned.shop.next;
  command(s);
  use(s,'shop');
  assert.equal(s.cash,217);
  use(s,'safe');
  s.hp=16;
  use(s,'safe');
  assert.equal(s.hp,100);
  for(const id of ['ivo','parcel','dani','ivo','parcel','dani','ivo','parcel','dani'])use(s,id);
  use(s,'club');
  assert.ok(s.owned.club);
  assert.equal(targetSite(s).id,'ivo');
  assert.deepEqual(restore({getItem:()=>JSON.stringify(s)}),s);
  assert.deepEqual(restore({getItem:()=>'{broken'}),fresh());
});

test('buildings and map edge block movement',()=>{
  const s=fresh();
  const b=buildings.find(p=>p.x===12 && p.z===12);
  s.x=b.x-b.w/2-1;
  s.z=b.z;
  for(let i=0;i<40;i++)command(s,{strafe:1,sprint:true});
  assert.ok(walkable(s.x,s.z));
  assert.ok(s.x<b.x-b.w/2);
  s.x=87;
  s.z=0;
  for(let i=0;i<40;i++)command(s,{strafe:1,sprint:true});
  assert.ok(s.x<88 && s.x>=87);
});
