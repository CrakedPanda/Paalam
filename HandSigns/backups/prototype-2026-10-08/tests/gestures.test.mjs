import test from 'node:test';
import assert from 'node:assert/strict';
import {classify,StableGesture,GESTURES} from '../public/gestures.mjs';
function fixture(mask,thumb,rotation=0,mirror=1,scale=1){
  const w=Array.from({length:21},()=>({x:0,y:0,z:0}));
  w[0]={x:0,y:.08,z:0};
  const t=thumb?[[-.04,.04],[-.065,.015],[-.08,-.005],[-.095,-.025]]:[[-.04,.04],[-.04,.015],[-.02,.015],[0,.018]];
  t.forEach(([x,y],j)=>w[j+1]={x,y,z:0});
  [5,9,13,17].forEach((i,j)=>{
    const x=[-.03,-.01,.012,.032][j];
    w[i]={x,y:0,z:0};w[i+1]={x,y:-.025,z:0};
    w[i+2]={x,y:mask[j]?-.045:.01,z:mask[j]?0:.012};
    w[i+3]={x,y:mask[j]?-.065:.04,z:mask[j]?0:.015};
  });
  const c=Math.cos(rotation),s=Math.sin(rotation);
  const world=w.map(p=>({x:mirror*(p.x*c-p.y*s)*scale,y:(p.x*s+p.y*c)*scale,z:p.z*scale}));
  return {world,image:world.map(p=>({x:.5+p.x*3/ (4/3),y:.5+p.y*3,z:p.z*3}))};
}
export {fixture};
const definitions=[['open',[1,1,1,1],1],['fist',[0,0,0,0],0],['one',[1,0,0,0],0],['two',[1,1,0,0],0],['three',[1,1,1,0],0],['four',[1,1,1,1],0],['pinky',[0,0,0,1],0],['call',[0,0,0,1],1],['up',[0,0,0,0],1,Math.atan2(.03,.04)],['down',[0,0,0,0],1,Math.PI+Math.atan2(.03,.04)]];
test('exactly ten unique documented mappings',()=>assert.equal(new Set(GESTURES.map(g=>g.id)).size,10));
for(const [id,mask,thumb,rotation=0] of definitions){
  test(`${id}: recognizes synthetic left/right landmarks and hand sizes`,()=>{
    for(const mirror of [-1,1])for(const scale of [.8,1,1.2]){
      const {world,image}=fixture(mask,thumb,rotation,mirror,scale);assert.equal(classify(world,image),id);
    }
  });
}
test('rejects unsupported combinations, clipped hands, invalid geometry and sideways thumb',()=>{
  let f=fixture([1,0,1,0],0);assert.equal(classify(f.world,f.image),null);
  f=fixture([1,1,1,1],1);f.image[8].x=1;assert.equal(classify(f.world,f.image),null);
  assert.equal(classify([],[]),null);f.world[2].x=NaN;assert.equal(classify(f.world,f.image),null);
  f=fixture([0,0,0,0],1,-Math.atan2(.04,.03));assert.equal(classify(f.world,f.image),null);
});
test('stable hold emits once, rejects flicker, and permits neutral release or a different gesture',()=>{
  const f=new StableGesture();const emissions=[];
  for(let t=0;t<=1800;t+=100){const r=f.update('open',t);if(r.emit)emissions.push(r.emit);}
  assert.deepEqual(emissions,['open']);
  f.update(null,1900);f.update('open',2000);for(let t=2100;t<=2800;t+=100)assert.equal(f.update('open',t).emit,null);
  for(let t=2900;t<=3400;t+=100)f.update(null,t);
  let emitted;for(let t=3500;t<=4300;t+=100)emitted=f.update('open',t).emit||emitted;assert.equal(emitted,'open');
  let next;for(let t=4400;t<=5200;t+=100)next=f.update('two',t).emit||next;assert.equal(next,'two');
  f.reset();for(let t=0;t<3000;t+=100)assert.equal(f.update(t%200?'one':'two',t).emit,null);
});
test('paused frames and isolated samples cannot satisfy a hold',()=>{
  const f=new StableGesture();f.update('one',0);assert.equal(f.update('one',2000).emit,null);
  for(let t=2100;t<=2500;t+=100)assert.equal(f.update('one',t).emit,null);
  assert.equal(f.update('one',2600).emit,null);assert.equal(f.update('one',2700).emit,'one');
});
test('unknown frames reset candidates and backwards timestamps reset holds',()=>{
  const f=new StableGesture();for(let t=0;t<=600;t+=100)f.update('one',t);
  f.update(null,650);assert.equal(f.update('one',700).progress,0);
  assert.equal(f.update('one',100).progress,0);
});
