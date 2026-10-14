import test from 'node:test';
import assert from 'node:assert/strict';
import {compose,prepareSequence,mirrorSequence,sequenceDistance,predict,features,LABELS} from '../public/recognizer.mjs';
test('greeting and introduction sentence patterns',()=>{
 assert.equal(compose(['hello','i','student']),'Hello. I am a student.');
 assert.equal(compose(['i','teacher']),'I am a teacher.');
 assert.equal(compose(['i','fine']),'I am fine.');
 assert.equal(compose(['you','name','what']),'What is your name?');
 assert.equal(compose(['i','name'],'Asha'),'My name is Asha.');
 assert.equal(compose(['i','name']),'My name is …');
 assert.equal(compose(['what','student']),'what student');
 assert.equal(compose(['goodmorning','thankyou']),'Good morning. Thank you.');
});
test('typed names are trimmed and bounded, not fabricated from signs',()=>{
 assert.equal(compose(['i','name'],'   Meera  '),'My name is Meera.');
 assert.equal(compose(['i','name'],'x'.repeat(100)).length,72);
 assert.equal(compose([],'Asha'),'');
});
test('empty, too-short and missing-body samples are rejected',()=>{
 assert.equal(features({h:[],p:[]}),null);
 assert.equal(prepareSequence([]),null);
 assert.equal(prepareSequence(Array.from({length:20},()=>Array(134).fill(0))),null);
 assert.equal(prepareSequence([[1,2,3]]),null);
});
test('resampling trims neutral lead-in and mirror transform is reversible',()=>{
 const zero=Array(134).fill(0),a=zero.slice();a[0]=1;a[1]=.3;a[2]=.2;a[4]=.7;
 const seq=prepareSequence([zero,zero,...Array.from({length:12},()=>a),zero]);
 assert.equal(seq.length,24);assert.equal(seq[0][0],1);assert.equal(sequenceDistance(seq,seq),0);
 const twice=mirrorSequence(mirrorSequence(seq));assert.equal(sequenceDistance(seq,twice),0);
});
test('temporal match accepts exact examples and rejects ambiguous classes',()=>{
 const frame=Array(134).fill(0);frame[0]=1;const seq=Array.from({length:24},()=>frame.slice());
 const other=seq.map(f=>{f=f.slice();f[1]=2;return f;});
 const model={samples:[{label:'i',sequence:seq},{label:'you',sequence:other}],thresholds:{i:.5,you:.5},margin:.1};
 assert.equal(predict(seq,model).label,'i');
 assert.equal(predict(null,model).label,null);
 assert.equal(predict(seq,{...model,samples:[{label:'i',sequence:seq},{label:'you',sequence:seq}]}).label,null);
});
test('supported vocabulary has ten words and no prototype mappings',()=>{
 assert.equal(LABELS.length,10);assert.ok(LABELS.includes('name'));assert.ok(!LABELS.includes('pinky'));
});
