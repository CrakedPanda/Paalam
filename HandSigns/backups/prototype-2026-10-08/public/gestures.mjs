export const GESTURES = [
  { id: 'open', name: 'Open palm', text: 'Hello', icon: '✋', pose: 'Extend and spread all five fingers. Palm toward camera.' },
  { id: 'fist', name: 'Closed fist', text: 'Stop', icon: '✊', pose: 'Curl all four fingers; fold your thumb across them.' },
  { id: 'one', name: 'Index finger', text: 'One', icon: '☝', pose: 'Extend only your index finger. Tuck your thumb.' },
  { id: 'two', name: 'Two fingers', text: 'Two', icon: '✌', pose: 'Extend index and middle fingers. Fold the others and thumb.' },
  { id: 'three', name: 'Three fingers', text: 'Three', icon: '3', pose: 'Extend index, middle and ring fingers. Fold pinky and thumb.' },
  { id: 'four', name: 'Four fingers', text: 'Four', icon: '4', pose: 'Extend all four fingers. Fold your thumb across your palm.' },
  { id: 'up', name: 'Thumb up', text: 'Yes', icon: '👍', pose: 'Close four fingers. Extend thumb toward the top of the screen.' },
  { id: 'down', name: 'Thumb down', text: 'No', icon: '👎', pose: 'Close four fingers. Extend thumb toward the bottom of the screen.' },
  { id: 'pinky', name: 'Pinky finger', text: 'Help', icon: '☞', pose: 'Extend only your pinky. Fold the other fingers and thumb.' },
  { id: 'call', name: 'Thumb + pinky', text: 'Call me', icon: '🤙', pose: 'Extend thumb and pinky away from your palm. Fold the middle three.' }
];
const distance = (a,b) => Math.hypot(a.x-b.x, a.y-b.y, (a.z||0)-(b.z||0));
function angle(a,b,c) {
  const u = [a.x-b.x,a.y-b.y,(a.z||0)-(b.z||0)];
  const v = [c.x-b.x,c.y-b.y,(c.z||0)-(b.z||0)];
  const denominator = Math.hypot(...u)*Math.hypot(...v);
  return denominator ? Math.acos(Math.max(-1,Math.min(1,u.reduce((s,x,i)=>s+x*v[i],0)/denominator)))*180/Math.PI : 0;
}
export function classify(world, image, aspect = 4/3) {
  if (!world || world.length !== 21 || !image || image.length !== 21 || world.some(p=> ![p.x,p.y,p.z].every(Number.isFinite)) || image.some(p=>![p.x,p.y].every(Number.isFinite))) return null;
  const width = distance(world[5],world[17]);
  if (width < 0.015 || width > 0.2) return null;
  // Do not classify clipped hands or tiny/edge-on palms.
  if (image.some(p=>p.x<0.025||p.x>0.975||p.y<0.025||p.y>0.975)) return null;
  if (Math.hypot((image[5].x-image[17].x)*aspect,image[5].y-image[17].y)<0.055) return null;
  const fingers = [5,9,13,17].map(i=> {
    const bend = angle(world[i],world[i+1],world[i+3]);
    const reach = distance(world[i+3],world[0])/distance(world[i+1],world[0]);
    if (bend > 155 && reach > 1.08) return 1;
    if (bend < 130 || reach < 0.96) return 0;
    return -1;
  });
  if (fingers.includes(-1)) return null;
  const thumbAngle = angle(world[1],world[2],world[4]);
  const spread = distance(world[4],world[17])/width;
  const separation = distance(world[4],world[5])/width;
  let thumb = -1;
  if (thumbAngle > 145 && spread > 1.12 && separation > 0.45) thumb=1;
  else if (thumbAngle < 135 || (spread < 1.1 && separation < 0.8)) thumb=0;
  if (thumb < 0) return null;
  const mask = fingers.join('');
  let id = null;
  if (mask === '1111') id = thumb ? 'open' : 'four';
  if (!thumb) id = ({'0000':'fist','1000':'one','1100':'two','1110':'three','0001':'pinky'})[mask] || id;
  if (thumb && mask === '0001') id='call';
  if (thumb && mask === '0000') {
    const dx=(image[4].x-image[2].x)*aspect, dy=image[4].y-image[2].y;
    if (Math.abs(dy)>Math.abs(dx)*1.2 && Math.abs(dy)>0.035) id=dy<0?'up':'down';
  }
  return id;
}

// Every sample must agree for the hold interval. Unknown frames cancel a hold.
// Repeating the same phrase requires an uninterrupted neutral interval.
export class StableGesture {
  constructor({holdMs=700,releaseMs=450,maxGapMs=300,minSamples=5}={}) {
    Object.assign(this,{holdMs,releaseMs,maxGapMs,minSamples}); this.reset();
  }
  reset() { this.candidate=null; this.since=0; this.samples=0; this.last=null; this.neutralSince=null; this.previousTime=null; }
  update(id, now) {
    if (this.previousTime!==null && (now-this.previousTime>this.maxGapMs || now<this.previousTime)) { this.candidate=null; this.samples=0; this.neutralSince=null; }
    this.previousTime=now;
    if (!id) {
      this.candidate=null; this.samples=0;
      this.neutralSince ??= now;
      if(now-this.neutralSince>=this.releaseMs) this.last=null;
      return {emit:null,progress:0};
    }
    this.neutralSince=null;
    if (id!==this.candidate) { this.candidate=id; this.since=now; this.samples=0; }
    this.samples++;
    const progress=Math.min(1,(now-this.since)/this.holdMs);
    if(progress===1 && this.samples>=this.minSamples && id!==this.last) { this.last=id; return {emit:id,progress}; }
    return {emit:null,progress};
  }
}
