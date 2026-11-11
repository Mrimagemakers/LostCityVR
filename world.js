import * as T from 'three';
import {buildings, sites} from './city.js';

const cube = new T.BoxGeometry(1,1,1);
const palette = [0x8e5446,0x75453d,0x9e6a51,0x6a4943,0x856255];
const gold = 0xffcc66;

export function signTexture(width,height) {
  const canvas = Object.assign(document.createElement('canvas'),{width,height});
  const ctx = canvas.getContext('2d');
  const texture = new T.CanvasTexture(canvas);
  texture.colorSpace = T.SRGBColorSpace;
  return {ctx,texture};
}


function facadeTexture(baseColor, mortarColor, seed=1) {
  const c=document.createElement('canvas'); c.width=512;c.height=512;
  const g=c.getContext('2d');
  let rnd=seed>>>0;
  const rand=()=>((rnd=(Math.imul(rnd,1664525)+1013904223)>>>0)/4294967296);
  g.fillStyle=mortarColor;g.fillRect(0,0,512,512);
  for(let row=0;row<32;row++) for(let col=-1;col<17;col++) {
    const x=col*32+(row%2)*16+2,y=row*16+2;
    const shade=(rand()-.5)*44;
    const hex=baseColor.map(v=>Math.max(0,Math.min(255,Math.round(v+shade))));
    g.fillStyle='rgb('+hex.join(',')+')';
    g.fillRect(x,y,30,13);
    g.fillStyle='rgba(255,236,208,'+(0.025+rand()*.075)+')';
    g.fillRect(x,y,30,1);
    if(rand()<.18) {
      g.fillStyle='rgba(20,16,16,.12)';
      g.fillRect(x+rand()*28,y+rand()*10,2+rand()*10,1);
    }
  }
  for(let n=0;n<3600;n++){
    const x=rand()*512,y=rand()*512;
    g.fillStyle=rand()<.5?'rgba(255,255,255,.035)':'rgba(0,0,0,.055)';
    g.fillRect(x,y,1+rand()*2,1+rand()*2);
  }
  const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;t.wrapS=t.wrapT=T.RepeatWrapping;t.anisotropy=4;
  return t;
}
function stoneTexture() {
  const c=document.createElement('canvas');c.width=c.height=256;
  const g=c.getContext('2d');g.fillStyle='#66615b';g.fillRect(0,0,256,256);
  let n=75839;const rand=()=>((n=(Math.imul(n,1664525)+1013904223)>>>0)/4294967296);
  for(let i=0;i<19000;i++){
    const v=Math.floor(rand()*170);
    g.fillStyle='rgba('+v+','+v+','+v+','+(rand()*.14)+')';
    g.fillRect(rand()*256,rand()*256,1+rand()*3,1+rand()*3);
  }
  const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;t.wrapS=t.wrapT=T.RepeatWrapping;t.anisotropy=4;
  return t;
}
function createDetailSurfaces(scene,buildings) {
  const brickColors=[[133,75,62],[119,70,61],[151,102,75],[103,75,68],[131,96,79]];
  const bricks=brickColors.map((c,i)=>facadeTexture(c,'#51463e',i*8127+71));
  const stone=stoneTexture();
  const facadeGeo=new T.PlaneGeometry(1,1);
  const detailMats=bricks.map(t=>new T.MeshStandardMaterial({map:t,roughness:.94,metalness:0,polygonOffset:true,polygonOffsetFactor:-1}));
  const curbMat=new T.MeshStandardMaterial({map:stone,roughness:1});
  const glassDark=new T.MeshStandardMaterial({color:0x273641,roughness:.22,metalness:.32});
  const glassLit=new T.MeshStandardMaterial({color:0xd8a875,emissive:0x9a542b,emissiveIntensity:.4,roughness:.29});
  const frameMat=new T.MeshStandardMaterial({color:0x403d39,roughness:.85});
  for(let i=0;i<buildings.length;i++){
    const b=buildings[i],{x,z,w,h,d,style}=b;
    const front=new T.Mesh(facadeGeo,detailMats[style%detailMats.length]);
    front.scale.set(w,h,1);front.position.set(x,h/2,z+d/2+.035);scene.add(front);
    const rear=front.clone();rear.rotation.y=Math.PI;rear.position.z=z-d/2-.035;scene.add(rear);
    for(const side of [-1,1]){
      const wall=front.clone();wall.scale.set(d,h,1);wall.rotation.y=side*Math.PI/2;
      wall.position.set(x+side*(w/2+.035),h/2,z);scene.add(wall);
    }
    for(let level=3.05;level<h-.5;level+=2.35){
      for(const k of [-1,0,1]){
        const pane=new T.Mesh(new T.PlaneGeometry(.92,.70),(i+k+Math.round(level))%4?glassDark:glassLit);
        pane.position.set(x+k*w*.28,level,z+d/2+.115);
        scene.add(pane);
        const sill=new T.Mesh(new T.BoxGeometry(1.22,.085,.25),frameMat);
        sill.position.set(pane.position.x,level-.42,z+d/2+.14);
        scene.add(sill);
      }
    }
    if(i%5===0){
      const steps=new T.Mesh(new T.BoxGeometry(2.5,.19,1.2),curbMat);
      steps.position.set(x,.12,z+d/2+.85);
      scene.add(steps);
    }
  }
  // A small number of detailed street trees keeps Quest draw calls predictable.
  const bark=new T.MeshStandardMaterial({color:0x594735,roughness:1});
  const leaf=new T.MeshStandardMaterial({color:0x344d34,roughness:1,flatShading:false});
  const trunkGeo=new T.CylinderGeometry(.13,.22,3.7,7);
  const crownGeo=new T.IcosahedronGeometry(1,1);
  for(let i=0;i<24;i++){
    const col=i%6,row=Math.floor(i/6);
    const x=-76+col*29,z=-77+row*48;
    const trunk=new T.Mesh(trunkGeo,bark);trunk.position.set(x,1.85,z);scene.add(trunk);
    for(let j=0;j<3;j++){
      const crown=new T.Mesh(crownGeo,leaf);
      crown.scale.set(1.35+j*.12,1.16,1.2);
      crown.position.set(x+(j-1)*.46,4.05+(j%2)*.55,z+.25*(j-1));
      scene.add(crown);
    }
  }
}


function addStreetLife(scene) {
  const shared={
    metal:new T.MeshStandardMaterial({color:0x454947,metalness:.54,roughness:.58}),
    wood:new T.MeshStandardMaterial({color:0x5f483a,roughness:1}),
    dark:new T.MeshStandardMaterial({color:0x24272a,roughness:.8}),
    lamp:new T.MeshBasicMaterial({color:0xffd6a1}),
    foliage:new T.MeshStandardMaterial({color:0x2f4938,roughness:1})
  };
  const unit=new T.BoxGeometry(1,1,1);
  const addBox=(parent,material,x,y,z,w,h,d)=>{
    const m=new T.Mesh(unit,material);m.position.set(x,y,z);m.scale.set(w,h,d);parent.add(m);return m;
  };
  // Period-appropriate streetlight fixtures and corner trash cans.
  for(const [i,x] of [-72,-36,0,36,72].entries()) for(const z of [-72,-36,0,36,72]) {
    const post=new T.Group();post.position.set(x+8.2,0,z+8.2);
    addBox(post,shared.metal,0,2.05,0,.11,4.1,.11);
    addBox(post,shared.metal,-.49,4.02,0,1.07,.085,.1);
    addBox(post,shared.lamp,-.94,3.97,0,.24,.06,.32);
    if((i+Math.abs(z/36))%2===0){
      addBox(post,shared.dark,.64,.38,0,.65,.75,.56);
      addBox(post,shared.metal,.64,.77,0,.76,.08,.69);
    }
    scene.add(post);
  }
  // Park benches, utility boxes and payphones ground the 1995 setting.
  for(const [x,z] of [[-25,11],[-55,13],[19,-24],[47,20]]){
    const g=new T.Group();g.position.set(x,0,z);
    addBox(g,shared.wood,0,.52,0,2.2,.17,.62);
    addBox(g,shared.wood,0,1.04,.29,2.2,.85,.14);
    for(const dx of [-.84,.84]){
      addBox(g,shared.metal,dx,.27,0,.13,.52,.12);
      addBox(g,shared.metal,dx,.52,.32,.13,1.08,.12);
    }
    scene.add(g);
  }
  for(const [x,z] of [[-10,-10],[40,-45],[-48,36]]){
    const g=new T.Group();g.position.set(x,0,z);
    addBox(g,shared.metal,0,1,0,.8,2,.5);
    const front=new T.MeshBasicMaterial({color:0xb5b4ac});
    addBox(g,front,0,1.38,.265,.55,.55,.025);
    addBox(g,shared.dark,0,.82,.28,.33,.43,.03);
    addBox(g,shared.wood,0,.25,0,.8,.12,.55);
    scene.add(g);
  }
  // Skyline street haze: warm pools of light without dozens of costly point lights.
  const haloTexture=(()=>{
    const c=document.createElement('canvas');c.width=c.height=64;
    const ctx=c.getContext('2d');
    const glow=ctx.createRadialGradient(32,32,0,32,32,31);
    glow.addColorStop(0,'rgba(255,218,150,.48)');
    glow.addColorStop(.25,'rgba(255,200,130,.18)');
    glow.addColorStop(1,'rgba(255,200,130,0)');
    ctx.fillStyle=glow;ctx.fillRect(0,0,64,64);
    return new T.CanvasTexture(c);
  })();
  const haloMat=new T.SpriteMaterial({map:haloTexture,transparent:true,depthWrite:false,color:0xffe2c2});
  for(const x of [-72,-36,0,36,72])for(const z of [-72,-36,0,36,72]){
    const halo=new T.Sprite(haloMat);
    halo.position.set(x+7.25,3.97,z+8.2);
    halo.scale.set(2.1,2.1,1);scene.add(halo);
  }
}

export function cityScene() {
  const scene = new T.Scene();
  scene.background = new T.Color(0x827984);
  scene.fog = new T.FogExp2(0x827984,.0048);
  scene.add(new T.HemisphereLight(0xf5d0de,0x716787,2.25));
  const light = new T.DirectionalLight(0xffc19a,2);
  light.position.set(-30,19,-28);
  scene.add(light);

  const opaque = [], glow = [];
  const box = (x,y,z,w,h,d,color,lit=false) => (lit?glow:opaque).push([x,y,z,w,h,d,color]);
  box(0,-.17,0,178,.3,178,0x373644);
  for (let i=-2;i<=2;i++) {
    const c = i*36;
    box(c,.005,0,13,.02,176,0x2a2936);
    box(0,.006,c,176,.02,13,0x2a2936);
    for (let j=-84;j<=84;j+=4) {
      if (Math.abs(j-Math.round(j/36)*36)>7) {
        box(c,.024,j,.08,.015,1.65,0xb48259);
        box(j,.024,c,1.65,.015,.08,0xb48259);
      }
    }
  }
  for (let x=-54;x<=54;x+=36) for(let z=-54;z<=54;z+=36) {
    box(x,.04,z,23,.1,23,0x66565e);
    for (const side of [-1,1]) {
      box(x+side*11.25,.095,z,.42,.12,23,0x8a7875);
      box(x,.095,z+side*11.25,23,.12,.42,0x8a7875);
    }
    for (const dx of [-12,12]) for (const dz of [-12,12]) {
      box(x+dx,1.75,z+dz,.12,3.5,.12,0x332d3d);
      box(x+dx,3.52,z+dz,.55,.14,.38,0xffb270,true);
      box(x+dx,.024,z+dz,1.9,.018,1.9,0x72564d);
    }
    for(let line=-2;line<=2;line++) {
      box(x-18+line*.75,.026,z+12,.32,.016,2,0x9a8184);
      box(x+12,.026,z-18+line*.75,2,.016,.32,0x9a8184);
    }
  }
  for (const [i,b] of buildings.entries()) {
    const {x,z,w,h,d,style}=b;
    const front=z+d/2;
    box(x,h/2,z,w,h,d,palette[style]);
    box(x,.29,z,w+.06,.58,d+.06,0x655655);
    box(x,h-.2,z,w+.24,.25,d+.24,0x342d40);
    box(x+.7,h+.32,z-.5,w*.35,.7,d*.31,0x4b414e);
    box(x,1.02,z+d/2+.04,1.38,2.02,.12,0x231e2e);
    box(x,2.25,z+d/2+.24,2.3,.12,.57,i%4?0xa38368:0xc96447);
    box(x,.13,z+d/2+.24,1.85,.26,.5,0x84716b);
    if (i%4===0) {
      box(x,2.61,z+d/2+.1,w*.81,.52,.17,0x42666a);
      box(x-w*.26,1.35,z+d/2+.04,w*.23,1.45,.09,0xedb786,true);
      box(x+w*.26,1.35,z+d/2+.04,w*.23,1.45,.09,0xedb786,true);
      const {ctx,texture}=signTexture(512,64);
      ctx.fillStyle='#e9d6b0';
      ctx.textAlign='center';
      ctx.textBaseline='middle';
      ctx.font='bold 37px sans-serif';
      const shops=['UPTOWN GROCERY','HILL BARBER SHOP','FIFTH AVE RECORDS','CORNER MARKET'];
      ctx.fillText(shops[(i/4)%shops.length],256,32,480);
      texture.needsUpdate=true;
      const sign=new T.Mesh(new T.PlaneGeometry(w*.78,.46),new T.MeshBasicMaterial({map:texture,transparent:true,depthWrite:false}));
      sign.position.set(x,2.61,front+.19);
      scene.add(sign);
      for (let stripe=-4;stripe<=4;stripe++) {
        box(x+stripe*w*.09,2.28,front+.43,w*.09,.13,.75,stripe%2?0xb2a08c:0x893f39);
      }
    }
    for(let y=3.05;y<h-.5;y+=2.35) {
      box(x,y-.69,z,w+.04,.11,d+.04,0x493c4d);
      for(let k=-1;k<=1;k++) {
        const color = (i+k+Math.round(y))%4 ? 0x39324b : 0xe6a27c;
        box(x+k*w*.28,y,z+d/2,1,.75,.06,color,color===0xe6a27c);
        box(x+k*w*.28,y,z-d/2,1,.75,.06,color,color===0xe6a27c);
        box(x-w/2,y,z+k*d*.28,.06,.75,1,color,color===0xe6a27c);
        box(x+w/2,y,z+k*d*.28,.06,.75,1,color,color===0xe6a27c);
        box(x+k*w*.28,y+.43,front+.045,1.25,.12,.13,0xb19b8a);
        box(x+k*w*.28,y-.43,front+.045,1.25,.12,.13,0x9f8e85);
        box(x+k*w*.28,y,front+.04,.055,.75,.06,0x504348);
      }
    }
  }
  createDetailSurfaces(scene,buildings);
  // Downtown sits below the neighborhood and frames the northbound streets.
  const towers = [
    [-70,-120,17,37],[-52,-133,19,49],[-36,-115,14,36],
    [-24,-142,20,63],[-9,-121,14,48],[4,-138,16,75],
    [19,-118,11,46],[33,-142,21,56],[50,-123,14,39],
    [65,-137,19,51],[83,-117,18,31],
  ];
  for (const [i,[x,z,w,h]] of towers.entries()) {
    box(x,h/2-8,z,w,h,15,i%2?0x474b63:0x56475b);
    box(x,h-6,z,w*.63,4,11,0x494254);
    for (let floor=9;floor<h-10;floor+=4) {
      for (let column=-1;column<=1;column++) {
        if ((floor+column+i)%5!==0) {
          box(x+column*w*.29,floor,z+7.53,w*.12,.65,.1,0xd7a47e,true);
        }
      }
    }
  }
  box(4,72,-138,.28,7,.28,0xb0959b,true);
  box(-24,59,-142,4,5,4,0x494254);
  const moon = new T.Mesh(new T.SphereGeometry(7,24,12),new T.MeshBasicMaterial({color:0xffb79b,fog:false}));
  moon.position.set(39,29,-119);
  scene.add(moon);
  const dummy = new T.Object3D();
  const tint = new T.Color();
  for(const [batch,mat] of [[opaque,new T.MeshLambertMaterial()],[glow,new T.MeshBasicMaterial()]]) {
    const mesh = new T.InstancedMesh(cube,mat,batch.length);
    batch.forEach(([x,y,z,w,h,d,color],i)=>{
      dummy.position.set(x,y,z);
      dummy.scale.set(w,h,d);
      dummy.updateMatrix();
      mesh.setMatrixAt(i,dummy.matrix);
      mesh.setColorAt(i,tint.set(color));
    });
    scene.add(mesh);
  }
  addStreetLife(scene);
  return scene;
}

export function person(color) {
  const group = new T.Group();
  const limbs = [];
  function part(x,y,z,w,h,d,tint) {
    const mesh = new T.Mesh(cube,new T.MeshLambertMaterial({color:tint}));
    mesh.position.set(x,y,z);
    mesh.scale.set(w,h,d);
    group.add(mesh);
    return mesh;
  }
  part(0,1.19,0,.49,.58,.31,color);
  part(0,1.66,0,.29,.31,.27,0xa87666);
  part(0,1.83,.01,.34,.09,.31,0x282431);
  for(const side of [-1,1]) {
    limbs.push(part(side*.13,.39,0,.19,.7,.23,0x303145));
    limbs.push(part(side*.32,1.15,0,.14,.55,.17,color));
  }
  group.userData.limbs = limbs;
  return group;
}

export function markers(scene) {
  return sites.map((site,i)=>{
    const group = new T.Group();
    group.position.set(site.x,0,site.z);
    const color = site.price?0x72e2ce:0xf1abaf;
    const ring = new T.Mesh(new T.RingGeometry(1.43,1.52,32),new T.MeshBasicMaterial({color,side:T.DoubleSide}));
    ring.rotation.x=-Math.PI/2;
    ring.position.y=.045;
    group.add(ring);
    const actor = site.price || site.id==='parcel' || site.id==='relay' ? new T.Mesh(cube,new T.MeshLambertMaterial({color})) : person([0x845783,0x426b72,0x778d81,0x8f4f55][i]);
    if (!actor.isGroup) {
      actor.scale.set(.62,.48,.48);
      actor.position.y=.24;
    }
    group.add(actor);
    const {ctx,texture} = signTexture(512,128);
    const sprite = new T.Sprite(new T.SpriteMaterial({map:texture,depthWrite:false}));
    sprite.position.y=2.45;
    sprite.scale.set(4.1,1.025,1);
    group.add(sprite);
    scene.add(group);
    return {site,ring,sprite,ctx,texture,color,status:null};
  });
}

export function updateMarker(marker,status) {
  if(marker.status===status)return;
  marker.status=status;
  const {ctx,texture,ring,site,color}=marker;
  ring.material.color.set(status==='MISSION'?gold:color);
  ctx.clearRect(0,0,512,128);
  ctx.fillStyle='#1b1728';
  ctx.fillRect(6,10,500,104);
  ctx.fillStyle=status==='MISSION'?'#ffcc66':site.price?'#72e2ce':'#f1abaf';
  ctx.fillRect(6,10,500,5);
  ctx.textAlign='center';
  ctx.font='bold 35px sans-serif';
  ctx.fillText(site.name,256,60,476);
  ctx.font='bold 22px monospace';
  ctx.fillText(status,256,92,476);
  texture.needsUpdate=true;
}
