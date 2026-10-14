import {readdir,readFile,writeFile,mkdir,copyFile} from 'node:fs/promises';
import {features,prepareSequence,predict,sequenceDistance,mirrorSequence,LABELS} from '../public/recognizer.mjs';
const root=new URL('./data/',import.meta.url),out=new URL('../public/model/',import.meta.url);
await mkdir(out,{recursive:true});
const files=(await readdir(new URL('landmarks-python/',root))).filter(f=>f.endsWith('.json'));
const examples=[],excluded=[];
for(const f of files){
 const c=JSON.parse(await readFile(new URL('landmarks-python/'+f,root),'utf8'));
 const seq=prepareSequence(c.frames.map(frame=>features(frame,c.width/c.height)));
 if(!seq){excluded.push({file:c.file,label:c.label,reason:'Insufficient usable hand/body frames'});continue;}
 examples.push({label:c.label,signer:c.signer,file:c.file,split:c.split,sequence:seq.map(f=>f.map(v=>Math.round(v*1000)/1000))});
}
const train=examples.filter(c=>c.split==='train'),validation=examples.filter(c=>c.split==='validation'),test=examples.filter(c=>c.split==='test');
const model={version:1,method:'Body-relative hand landmarks + DTW nearest examples',margin:.10,thresholds:{},samples:train,trainingSigners:Array.from(new Set(train.map(s=>s.signer))),created:'2026-10-09'};
// Thresholds use validation signers only; no held-out test example enters fitting.
for(const label of LABELS){
 const positives=validation.filter(x=>x.label===label).map(v=>Math.min(...train.filter(t=>t.label===label).map(t=>Math.min(sequenceDistance(v.sequence,t.sequence),sequenceDistance(mirrorSequence(v.sequence),t.sequence)))));
 model.thresholds[label]=positives.length?Math.min(1.35,Math.max(.28,Math.max(...positives)*1.15)):.65;
}
function evaluate(clips){const rows=clips.map(c=>{const p=predict(c.sequence,model);return{file:c.file,signer:c.signer,expected:c.label,predicted:p.label,top:p.ranked[0]?.label,distance:p.distance,margin:p.margin,correct:p.label===c.label};});return{total:rows.length,top1Correct:rows.filter(r=>r.top===r.expected).length,accepted:rows.filter(r=>r.predicted).length,acceptedCorrect:rows.filter(r=>r.correct).length,rejected:rows.filter(r=>!r.predicted).length,rows};}
const evaluation={sourceFiles:files.length,training:train.length,validation:evaluate(validation),test:evaluate(test),excluded,note:'Signer-disjoint within ISL-DATA (train User001–010, validation User011–012, test User013–015). NAME has two dictionary variants and no independent signer test. This is isolated-clip evaluation, not live-camera or sentence accuracy.'};
model.summary=`${train.length} fitted example sequences. On ${test.length} held-out ISL-DATA clips: ${evaluation.test.acceptedCorrect} correctly accepted, ${evaluation.test.accepted-evaluation.test.acceptedCorrect} incorrectly accepted, ${evaluation.test.rejected} rejected. These are isolated dataset clips, not live-user accuracy. NAME has only two dictionary variants and no held-out signer evaluation. See MODEL-CARD.md for details.`;
await writeFile(new URL('isl-model.json',out),JSON.stringify(model));await writeFile(new URL('evaluation.json',out),JSON.stringify(evaluation,null,2));
console.log(JSON.stringify({training:train.length,classes:LABELS.map(l=>({label:l,train:train.filter(x=>x.label===l).length,threshold:model.thresholds[l]})),validation:{...evaluation.validation,rows:undefined},test:{...evaluation.test,rows:undefined},excluded},null,2));
