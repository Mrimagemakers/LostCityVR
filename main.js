import * as T from 'three';
import {buildings, sites, districts, districtAt, extent, distance, turfGoals, rivals, controlsTurf} from './city.js';
import {currentJob, nearby, restore, saveKey, step, targetSite} from './sim.js';
import {cityScene, markers, person, signTexture, updateMarker} from './world.js';

const $ = id => document.getElementById(id);
const canvas = $('world');
const coarse = matchMedia('(pointer:coarse)').matches;
document.body.classList.toggle('coarse',coarse);
const renderer = new T.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio,1.6));
renderer.xr.enabled = true;
renderer.xr.setReferenceSpaceType('local-floor');
renderer.xr.setFramebufferScaleFactor(.85);
const scene = cityScene();
const camera = new T.PerspectiveCamera(69,1,.07,225);
const rig = new T.Group();
rig.add(camera);
scene.add(rig);
const allMarkers = markers(scene);
const beacon = new T.Mesh(new T.OctahedronGeometry(.3),new T.MeshBasicMaterial({color:0xffc65e}));
scene.add(beacon);

const hud = new T.Group();
const {ctx:hudCtx,texture:hudTexture} = signTexture(1024,256);
const hudCard = new T.Mesh(new T.PlaneGeometry(.93,.2325),
  new T.MeshBasicMaterial({map:hudTexture,transparent:true,depthTest:false,depthWrite:false,toneMapped:false}));
hudCard.position.set(0,-.31,-1.14);
hudCard.renderOrder=20;
hud.add(hudCard);
hud.visible=false;
rig.add(hud);
const handButtons = new WeakMap();
const look = new T.Vector3();
const poseRotation = new T.Quaternion();
const up = new T.Vector3(0,1,0);

const hostileModels = [
  {Rook:person(0x8e4361), Blacktops:person(0x347876), 'Vice officer':person(0x364c88)},
  {Rook:person(0x8e4361), Blacktops:person(0x347876), 'Vice officer':person(0x364c88)},
];
for (const slot of hostileModels) for (const model of Object.values(slot)) {
  model.visible=false;
  scene.add(model);
}
const neighbors = [
  {x:-15,z:3,color:0x946e4e}, {x:9,z:-5,color:0x604d87},
  {x:39,z:18,color:0x9b644f}, {x:-32,z:-19,color:0x47776f},
  {x:70,z:-17,color:0x9a7a55}, {x:-70,z:15,color:0x595d8e},
].map(spec => {
  const model=person(spec.color);
  scene.add(model);
  return {...spec,model};
});

const state = restore({getItem:key=>localStorage.getItem(key)});
let running=false, entered=false, yaw=0, pitch=0, xrYaw=0, xrMode=false, turnHeld=false;
let last=0, saveTime=0, nextHUD=0, radioSeq=-1, lastSavedSeq=state.seq;
const keys=new Set();
const touch={x:0,y:0,sprint:false};
const buttons={interact:false,shove:false};
let movePointer, lookPointer, lookX, lookY;
const map = $('map').getContext('2d');
const wrap = (value,limit) => Math.max(-limit,Math.min(limit,value));

function resize() {
  camera.aspect=innerWidth/innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth,innerHeight,false);
}
addEventListener('resize',resize);
resize();

function save() {
  try {
    localStorage.setItem(saveKey,JSON.stringify(state));
    lastSavedSeq=state.seq;
    $('save').textContent='SAVED LOCALLY';
  } catch {
    $('save').textContent='SAVE UNAVAILABLE';
  }
}
addEventListener('pagehide',()=>{if(entered)save();});
document.addEventListener('visibilitychange',()=>{if(document.hidden && entered)save();});

function play(lock=true) {
  entered=running=true;
  $('gate').hidden=true;
  document.body.classList.add('playing');
  if(lock && !coarse && document.pointerLockElement!==canvas) {
    try { canvas.requestPointerLock?.()?.catch(()=>{}); } catch { /* Drag-look remains available. */ }
  }
}
function pause() {
  running=false;
  keys.clear();
  touch.x=touch.y=0;
  movePointer=lookPointer=undefined;
  $('stick').firstElementChild.style.transform='';
  buttons.interact=buttons.shove=false;
  $('gate').hidden=false;
  $('enter').textContent='RESUME';
  document.body.classList.remove('playing');
  document.exitPointerLock?.();
  save();
}
$('enter').onclick=()=>play();
$('help').onclick=()=>{if(running)pause();};
if(coarse) $('controls').textContent='Left stick to move · drag the view to look · Use to interact · Run to toggle sprint';
addEventListener('blur',()=>keys.clear());
addEventListener('keydown',e=>{
  if(e.code==='Escape' && running && !xrMode)pause();
  if(!running || xrMode)return;
  if(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code))
    e.preventDefault();
  keys.add(e.code);
  if(!e.repeat && e.code==='KeyE')buttons.interact=true;
  if(!e.repeat && (e.code==='KeyF'||e.code==='Space'))buttons.shove=true;
});
addEventListener('keyup',e=>keys.delete(e.code));
function aim(dx,dy) {
  yaw-=dx*.003;
  pitch=wrap(pitch-dy*.003,1.48);
}
document.addEventListener('mousemove',e=>{
  if(running && !xrMode && document.pointerLockElement===canvas)aim(e.movementX,e.movementY);
});
canvas.addEventListener('pointerdown',e=>{
  if(!running || lookPointer!==undefined || document.pointerLockElement===canvas)return;
  lookPointer=e.pointerId;
  lookX=e.clientX;
  lookY=e.clientY;
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove',e=>{
  if(e.pointerId!==lookPointer)return;
  aim(e.clientX-lookX,e.clientY-lookY);
  lookX=e.clientX;
  lookY=e.clientY;
});
for(const event of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(event,e=>{
  if(e.pointerId===lookPointer)lookPointer=undefined;
});
const stick=$('stick');
function steer(e) {
  const rect=stick.getBoundingClientRect();
  touch.x=wrap((e.clientX-rect.left-rect.width/2)/32,1);
  touch.y=wrap((rect.top+rect.height/2-e.clientY)/32,1);
  stick.firstElementChild.style.transform=`translate(${touch.x*24}px,${-touch.y*24}px)`;
}
stick.addEventListener('pointerdown',e=>{
  if(movePointer!==undefined)return;
  movePointer=e.pointerId;
  stick.setPointerCapture(e.pointerId);
  steer(e);
});
stick.addEventListener('pointermove',e=>{if(e.pointerId===movePointer)steer(e);});
for(const event of ['pointerup','pointercancel','lostpointercapture'])stick.addEventListener(event,e=>{
  if(e.pointerId!==movePointer)return;
  movePointer=undefined;
  touch.x=touch.y=0;
  stick.firstElementChild.style.transform='';
});
$('use').onclick=()=>buttons.interact=true;
$('shove').onclick=()=>buttons.shove=true;
$('run').onclick=()=> {
  touch.sprint=!touch.sprint;
  $('run').setAttribute('aria-pressed',String(touch.sprint));
};

async function setupVR() {
  if (!navigator.xr || !await navigator.xr.isSessionSupported('immersive-vr')) return;
  const button=document.createElement('button');
  button.textContent='ENTER VR';
  $('vr').append(button);
  button.onclick=async()=>{
    button.disabled=true;
    let session;
    try {
      session=await navigator.xr.requestSession('immersive-vr',{requiredFeatures:['local-floor']});
      await renderer.xr.setSession(session);
      document.exitPointerLock?.();
      keys.clear();
      buttons.interact=buttons.shove=false;
      xrYaw=yaw;
      xrMode=true;
      turnHeld=false;
      hud.visible=true;
      camera.position.set(0,0,0);
      camera.rotation.set(0,0,0);
      play(false);
      session.addEventListener('end',()=>{
        xrMode=false;
        hud.visible=false;
        yaw=xrYaw;
        pitch=0;
        button.disabled=false;
        pause();
      },{once:true});
    } catch(error) {
      await session?.end().catch(()=>{});
      button.disabled=false;
      $('load-error').textContent='VR could not start. Reopen the game in Quest Browser over HTTPS.';
      console.warn(error);
      if(running)pause();
    }
  };
}
setupVR().catch(console.warn);

const held = (...codes)=>Number(codes.some(code=>keys.has(code)));
const axis = n => Math.abs(n??0)>.2 ? n : 0;
function readInput(frame) {
  const input = {
    strafe:held('KeyD','ArrowRight')-held('KeyA','ArrowLeft')+touch.x,
    forward:held('KeyW','ArrowUp')-held('KeyS','ArrowDown')+touch.y,
    yaw,sprint:touch.sprint||!!held('ShiftLeft','ShiftRight'),
    ...buttons,
  };
  buttons.interact=buttons.shove=false;
  if(!xrMode || !frame)return input;
  input.strafe=input.forward=0;
  input.sprint=false;
  let turn=0;
  for(const source of frame.session.inputSources) {
    const gamepad=source.gamepad;
    if(!gamepad)continue;
    const [, ,x,y]=gamepad.axes;
    const trigger=gamepad.buttons[0]?.pressed;
    const previous=handButtons.get(source);
    handButtons.set(source,trigger);
    if(source.handedness==='left') {
      input.strafe=axis(x);
      input.forward=-axis(y);
      input.sprint=!!(gamepad.buttons[1]?.pressed || gamepad.buttons[3]?.pressed);
      input.shove ||= trigger && !previous;
    } else if(source.handedness==='right') {
      turn=axis(x);
      input.interact ||= trigger && !previous;
    }
  }
  if(Math.abs(turn)>.65 && !turnHeld) {
    xrYaw-=Math.sign(turn)*Math.PI/6;
    turnHeld=true;
  }
  if(Math.abs(turn)<.3)turnHeld=false;
  const ref=renderer.xr.getReferenceSpace();
  const pose=ref && frame.getViewerPose(ref);
  if(pose) {
    const {position,orientation}=pose.transform;
    poseRotation.set(orientation.x,orientation.y,orientation.z,orientation.w);
    hud.position.set(position.x,position.y,position.z);
    hud.quaternion.copy(poseRotation);
    look.set(0,0,-1).applyQuaternion(poseRotation).applyAxisAngle(up,xrYaw);
    input.yaw=Math.atan2(-look.x,-look.z);
  } else input.yaw=xrYaw;
  return input;
}

function drawMap(target,heading) {
  const p = n => (n+extent)*160/(extent*2);
  map.fillStyle='#171725';
  map.fillRect(0,0,160,160);
  map.fillStyle='#533849';
  map.fillRect(0,0,p(-18),160);
  map.fillStyle='#284049';
  map.fillRect(p(18),0,160-p(18),160);
  map.fillStyle='#8d6e76';
  for(const b of buildings)map.fillRect(p(b.x-b.w/2),p(b.z-b.d/2),p(b.w)-80,p(b.d)-80);
  for(const site of sites) {
    map.fillStyle=site===target?'#ffcc66':site.price?'#68e2c9':'#deb0b7';
    map.beginPath();
    map.arc(p(site.x),p(site.z),site===target?4:2,0,Math.PI*2);
    map.fill();
  }
  map.save();
  map.translate(p(state.x),p(state.z));
  map.rotate(-heading);
  map.fillStyle='#fff';
  map.beginPath();
  map.moveTo(0,-6);
  map.lineTo(4,4);
  map.lineTo(-4,4);
  map.fill();
  map.restore();
}

function paintHUD(target,heading) {
  const job=currentJob(state);
  const district=districtAt(state.x);
  const gap=Math.round(distance(state,target));
  const local=nearby(state);
  const verb=local?.price ? state.owned[local.id] ? local.income ? 'Collect income' : 'Rest' : `Buy · $${local.price}` : 'Interact';
  $('district').textContent=districts[district];
  $('cash').textContent=`$${state.cash}`;
  $('rep').textContent=state.rep;
  $('health').textContent=state.hp;
  $('job').textContent=job.title;
  $('goal').textContent=target.name;
  $('range').textContent=`${gap} m`;
  const turf = controlsTurf(state.turf,district) ? 'TURF CONTROLLED' : `${rivals[district].toUpperCase()} ${state.turf[district]}/${turfGoals[district]}`;
  $('turf').textContent=turf;
  $('prompt').textContent=local ? `${coarse?'USE':'E'} · ${verb} · ${local.name}` : '';
  if(radioSeq!==state.seq) {
    $('notice').textContent=state.notice;
    radioSeq=state.seq;
  }
  for(const marker of allMarkers) {
    const {site}=marker;
    marker.sprite.visible=distance(state,site)>3.2;
    updateMarker(marker,site===target?'MISSION':site.price?state.owned[site.id]?'OWNED':`$${site.price} · REP ${site.rep}`:'');
  }
  drawMap(target,heading);
  if(!xrMode)return;
  hudCtx.clearRect(0,0,1024,256);
  hudCtx.fillStyle='#191729e8';
  hudCtx.fillRect(0,0,1024,256);
  hudCtx.fillStyle='#ffcc66';
  hudCtx.font='bold 42px sans-serif';
  hudCtx.fillText(`$${state.cash}    REP ${state.rep}    HP ${state.hp}     ${districts[district]}`,25,55,974);
  hudCtx.fillStyle='#fdf2e5';
  hudCtx.font='34px sans-serif';
  const bearing=Math.atan2(state.x-target.x,state.z-target.z)-heading;
  const direction=['↑','↖','←','↙','↓','↘','→','↗'][(Math.round(bearing*4/Math.PI)%8+8)%8];
  hudCtx.fillText(`${direction}  ${job.title}  /  ${target.name}  ·  ${gap} m`,25,105,974);
  hudCtx.fillText(local?`Right trigger · ${verb} · ${local.name}`:`${turf}  /  Left trigger · shove  /  Left grip · run`,25,151,974);
  hudCtx.font='24px sans-serif';
  const words=state.notice.split(' ');
  let line='', y=194;
  for(const word of words) {
    if(hudCtx.measureText(line+' '+word).width>974) {
      hudCtx.fillText(line,25,y);
      line='';
      y+=29;
    }
    line+=(line?' ':'')+word;
  }
  hudCtx.fillText(line,25,y);
  hudTexture.needsUpdate=true;
}

$('enter').disabled=false;
$('enter').textContent=state.seq?'CONTINUE':'ENTER THE CITY';
renderer.setAnimationLoop((time,frame)=>{
  const dt=last?(time-last)/1000:0;
  last=time;
  const input=readInput(frame);
  if(running) {
    step(state,input,dt);
    if(saveTime<time || state.seq!==lastSavedSeq) {
      save();
      saveTime=time+2500;
      lastSavedSeq=state.seq;
    }
  }
  rig.position.set(state.x,0,state.z);
  rig.rotation.y=xrMode?xrYaw:0;
  if(!xrMode) {
    camera.position.set(0,1.65,0);
    camera.rotation.set(pitch,yaw,0,'YXZ');
  }
  const target=targetSite(state);
  beacon.position.set(target.x,3.25+Math.sin(time/390)*.24,target.z);
  beacon.rotation.y=time/700;
  hostileModels.forEach((slot,i)=>{
    const foe=state.foes[i];
    for(const [kind,model] of Object.entries(slot)) {
      model.visible=foe?.kind===kind;
      if(!model.visible)continue;
      model.position.set(foe.x,0,foe.z);
      model.rotation.y=Math.atan2(state.x-foe.x,state.z-foe.z);
      model.userData.limbs.forEach((limb,j)=>limb.rotation.x=foe.stun>0?0:Math.sin(time/85)*.4*(j<2?1:-1));
    }
  });
  neighbors.forEach(({x,z,model},i)=>{
    const stride=Math.sin(state.time*.17+i)*4;
    model.position.set(x+(i<2?stride:0),0,z+(i<2?0:stride));
    const direction=Math.cos(state.time*.17+i)>0?1:-1;
    model.rotation.y=i<2?direction*Math.PI/2:direction===1?0:Math.PI;
    model.userData.limbs.forEach((limb,j)=>limb.rotation.x=Math.sin(state.time*7+i)*.28*(j<2?1:-1));
  });
  if(time>=nextHUD || radioSeq!==state.seq) {
    paintHUD(target,input.yaw);
    nextHUD=time+100;
  }
  renderer.render(scene,camera);
});
