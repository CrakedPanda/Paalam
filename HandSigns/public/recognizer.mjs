// A small, inspectable temporal nearest-example model. Scores are distances,
// not calibrated probabilities. Body-relative position and hand shape matter.
export const LABELS=['hello','goodmorning','i','you','name','what','fine','student','teacher','thankyou'];
export const TITLES={hello:'Hello',goodmorning:'Good morning',i:'I / me',you:'You',name:'Name',what:'What',fine:'Fine',student:'Student',teacher:'Teacher',thankyou:'Thank you'};
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y,(a.z||0)-(b.z||0));
const clip=x=>Math.max(-4,Math.min(4,x));
export function features(frame,aspect=4/3){
 const p=frame.p;if(!p||p.length<17||[0,11,12].some(i=>(p[i].visibility??1)<.5))return null;
 const shoulder=Math.hypot((p[11].x-p[12].x)*aspect,p[11].y-p[12].y);
 if(shoulder<.08)return null;
 const midY=(p[11].y+p[12].y)/2;
 const result=Array(134).fill(0);
 for(let n=0;n<(frame.h||[]).length;n++){
   const h=frame.h[n],w=frame.w?.[n];if(h.length!==21||!w||w.length!==21)continue;
   // Ignore resting hands well below the signing area.
   if(h[0].y>midY+shoulder*.9)continue;
   const scale=dist(w[0],w[9]);if(scale<.015)continue;
   const offset=frame.side?.[n]==='Left'?0:67;
   result[offset]=1;result[offset+1]=clip((h[0].x-p[0].x)*aspect/shoulder);result[offset+2]=clip((h[0].y-p[0].y)/shoulder);
   result[offset+3]=clip(Math.hypot((h[5].x-h[17].x)*aspect,h[5].y-h[17].y)/shoulder);
   for(let j=0;j<21;j++)for(let a=0;a<3;a++)result[offset+4+j*3+a]=clip((w[j][['x','y','z'][a]]-w[0][['x','y','z'][a]])/scale);
 }
 return result.every(Number.isFinite)?result:null;
}
export const active=f=>!!f&&(f[0]===1||f[67]===1);
export function prepareSequence(frames,count=24){
 const all=frames.filter(f=>Array.isArray(f)&&f.length===134&&f.every(Number.isFinite));
 const first=all.findIndex(active);let last=all.length-1;while(last>=0&&!active(all[last]))last--;
 if(first<0||last-first<4)return null;
 const trimmed=all.slice(first,last+1);
 if(trimmed.filter(active).length/trimmed.length<.55)return null;
 const seq=[];
 for(let i=0;i<count;i++)seq.push(trimmed[Math.round(i*(trimmed.length-1)/(count-1))].slice());
 return seq;
}
export function mirrorSequence(sequence){return sequence.map(f=>{
 const out=f.slice(67).concat(f.slice(0,67));
 for(const o of [0,67]){out[o+1]*=-1;for(let j=0;j<21;j++)out[o+4+j*3]*=-1;}
 return out;
});}
export function frameDistance(a,b){
 let total=0;
 for(const o of [0,67]){
   if(a[o]!==b[o]){total+=1.25;continue;}if(!a[o])continue;
   const location=(a[o+1]-b[o+1])**2+(a[o+2]-b[o+2])**2;
   let shape=0;for(let j=4;j<67;j++)shape+=(a[o+j]-b[o+j])**2;
   total+=.7*location+.65*shape/21+.1*(a[o+3]-b[o+3])**2;
 }
 return total;
}
export function sequenceDistance(a,b){
 const n=a.length,m=b.length,band=Math.max(6,Math.abs(n-m));
 let previous=new Float64Array(m+1).fill(Infinity);previous[0]=0;
 for(let i=1;i<=n;i++){
   const current=new Float64Array(m+1).fill(Infinity);
   for(let j=Math.max(1,i-band);j<=Math.min(m,i+band);j++)current[j]=frameDistance(a[i-1],b[j-1])+Math.min(previous[j],current[j-1],previous[j-1]);
   previous=current;
 }
 return previous[m]/Math.max(n,m);
}
export function predict(sequence,model,personal=[]){
 if(!sequence)return{label:null,reason:'No complete sign captured',ranked:[]};
 const reflected=mirrorSequence(sequence),scores=new Map();
 for(const sample of [...model.samples,...personal]){
   const d=Math.min(sequenceDistance(sequence,sample.sequence),sequenceDistance(reflected,sample.sequence));
   if(!scores.has(sample.label)||d<scores.get(sample.label))scores.set(sample.label,d);
 }
 const ranked=[...scores].map(([label,distance])=>({label,distance})).sort((a,b)=>a.distance-b.distance);
 const best=ranked[0],next=ranked[1];if(!best)return{label:null,reason:'No examples loaded',ranked};
 const limit=model.thresholds?.[best.label]??.7;
 const margin=next?(next.distance<1e-6?0:1-best.distance/next.distance):1;
 const accepted=best.distance<=limit&&margin>=(model.margin??.12);
 return{label:accepted?best.label:null,reason:accepted?'Matched':best.distance>limit?'Outside learned examples':'Similar to more than one sign',distance:best.distance,margin,ranked:ranked.slice(0,3)};
}
export function compose(tokens,name=''){
 const ids=tokens.map(t=>typeof t==='string'?t:t.label);const chunks=[];let i=0;
 const cleanName=name.trim().replace(/[\r\n]+/g,' ').slice(0,60);
 while(i<ids.length){
   const rest=ids.slice(i).join(' ');
   const patterns=[
     ['you name what','What is your name?'],['you what name','What is your name?'],['what you name','What is your name?'],
     ['i name',cleanName?`My name is ${cleanName}.`:'My name is …'],
     ['i student','I am a student.'],['i teacher','I am a teacher.'],['i fine','I am fine.'],
     ['you student','You are a student.'],['you teacher','You are a teacher.'],['you fine','You are fine.']
   ];
   const match=patterns.find(([p])=>rest===p||rest.startsWith(p+' '));
   if(match){chunks.push(match[1]);i+=match[0].split(' ').length;continue;}
   const singles={hello:'Hello.',goodmorning:'Good morning.',thankyou:'Thank you.'};
   if(singles[ids[i]])chunks.push(singles[ids[i]]);
   else chunks.push(({i:'I',you:'you',name:'name',what:'what',fine:'fine',student:'student',teacher:'teacher'})[ids[i]]||'');
   i++;
 }
 return chunks.filter(Boolean).join(' ');
}
