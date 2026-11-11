export const extent = 88;
export const districts = ['Westline', 'Market Ward', 'East Docks'];
export const districtAt = x => x < -18 ? 0 : x > 18 ? 2 : 1;
export const turfGoals = [2,1,2];
export const rivals = ['Blacktops','Independent','Rooks'];
export const controlsTurf = (influence,index) => influence[index]>=turfGoals[index];
export const sites = [
  { id:'mara', name:'Mara • Dispatch', x:0, z:0 },
  { id:'parcel', name:'Market pickup', x:36, z:0 },
  { id:'ivo', name:'Ivo • Dock foreman', x:36, z:-36 },
  { id:'dani', name:'Dani • Street outreach', x:-36, z:0 },
  { id:'relay', name:'Westline relay', x:-72, z:-36 },
  { id:'safe', name:'Rail House', x:0, z:36, price:120, income:0, rep:0 },
  { id:'shop', name:'Night Owl Garage', x:36, z:36, price:230, income:18, rep:2 },
  { id:'club', name:'Blue Hour Café', x:-36, z:-36, price:340, income:28, rep:4 },
];

export const buildings = [];
for (let i = -2; i < 2; i++) {
  for (let j = -2; j < 2; j++) {
    const seed = (i + 3) * 53 + (j + 3) * 97;
    for (const [dx,dz] of [[-6,-6],[6,-6],[-6,6],[6,6]]) {
      const n = seed + dx * 7 + dz * 5;
      buildings.push({x:i*36+18+dx,z:j*36+18+dz,w:8+n%3,d:8+n%4,h:5+n%6,style:n%5});
    }
  }
}

export const distance = (a,b) => Math.hypot(a.x-b.x,a.z-b.z);
export function walkable(x,z,r=.38) {
  return Math.abs(x) < extent-r && Math.abs(z) < extent-r && !buildings.some(
    b => Math.abs(x-b.x)<b.w/2+r && Math.abs(z-b.z)<b.d/2+r
  );
}
