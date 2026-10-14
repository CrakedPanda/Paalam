import {LABELS,TITLES,features,active,prepareSequence,predict,compose} from './recognizer.mjs';
const $=id=>document.getElementById(id),video=$('video'),canvas=$('overlay'),ctx=canvas.getContext('2d');
const synth=window.speechSynthesis,storageKey='paalam.isl.examples.v1';
let model=null,references={},tokens=[],history=[],personal=[],voices=[],stream=null,worker=null,running=false,starting=false,busy=false,generation=0,raf=0,lastTime=-1,lastFrame=0,watchdog=0,capture=null,captureTimer=0;
const connections=[[0,1],[1,2],[2,3],[3,4],[0,5],[5,6],[6,7],[7,8],[5,9],[9,10],[10,11],[11,12],[9,13],[13,14],[14,15],[15,16],[13,17],[0,17],[17,18],[18,19],[19,20]];
function status(text,error=false){$('status').textContent=text;$('status').classList.toggle('error',error);}
function controls(){for(const id of ['capture','teach'])$(id).disabled=!running||!model||!!capture;$('duration').disabled=!!capture;$('teach-label').disabled=!!capture;}
function personalInfo(){const labels=new Set(personal.map(x=>x.label));$('personal-status').textContent=personal.length?`${personal.length} personal examples across ${labels.size} words, stored only in this browser.`:'No personal examples saved.';}
try{const saved=JSON.parse(localStorage.getItem(storageKey)||'[]');if(Array.isArray(saved))personal=saved.filter(s=>LABELS.includes(s.label)&&Array.isArray(s.sequence)&&s.sequence.length===24&&s.sequence.every(f=>Array.isArray(f)&&f.length===134&&f.every(Number.isFinite))).slice(-50);}catch{}
personalInfo();
function savePersonal(){try{localStorage.setItem(storageKey,JSON.stringify(personal));personalInfo();}catch{$('personal-status').textContent='Browser storage is unavailable or full. Examples will work only until reload.';}}
function loadVoices(){const before=$('voice').value;voices=synth?.getVoices()||[];$('voice').replaceChildren(new Option('Browser default',''));for(const v of voices)$('voice').add(new Option(`${v.name} · ${v.lang} · ${v.localService?'local':'online'}`,v.voiceURI));const preferred=voices.find(v=>v.voiceURI===before)||voices.find(v=>v.localService&&v.lang==='en-IN')||voices.find(v=>v.localService&&v.lang.startsWith('en'));$('voice').value=preferred?.voiceURI||'';}
function cancelSpeech(){synth?.cancel();$('speech-status').textContent=synth?'Ready to speak':'Speech is not supported in this browser.';}
function speak(text){if(!synth||!text)return;cancelSpeech();const u=new SpeechSynthesisUtterance(text),v=voices.find(v=>v.voiceURI===$('voice').value);if(v)u.voice=v;u.lang=v?.lang||'en-IN';u.rate=.95;u.onstart=()=>{$('speech-status').textContent='Speaking…';};u.onend=()=>{$('speech-status').textContent='Ready to speak';};u.onerror=e=>{if(!['canceled','interrupted'].includes(e.error))$('speech-status').textContent=`Speech failed (${e.error}). Try another voice.`;};synth.speak(u);}
loadVoices();synth?.addEventListener('voiceschanged',loadVoices);
if(!synth){for(const id of ['auto-speak','voice','test-voice'])$(id).disabled=true;$('finish').textContent='Finish sentence';cancelSpeech();}
function renderSentence(){
 $('tokens').replaceChildren();for(const t of tokens){const span=document.createElement('span');span.className='token';span.textContent=TITLES[t];$('tokens').append(span);}
 if(!tokens.length){const span=document.createElement('span');span.className='empty-hint';span.textContent='Your signs will collect here.';$('tokens').append(span);}
 $('word-count').textContent=`${tokens.length} word${tokens.length===1?'':'s'}`;$('sentence').value=compose(tokens,$('name').value);
 for(const id of ['finish','undo','clear'])$(id).disabled=!tokens.length;
}
function renderHistory(){
 $('history').replaceChildren();for(const text of history){const li=document.createElement('li'),replay=document.createElement('button');li.append(document.createTextNode(text));replay.className='text-button';replay.textContent='Speak again';replay.disabled=!synth;replay.onclick=()=>speak(text);li.append(replay);$('history').append(li);}
 if(!history.length){const li=document.createElement('li');li.className='empty-hint';li.textContent='Finished sentences will appear here.';$('history').append(li);}
 $('copy').disabled=$('clear-history').disabled=!history.length;
}
function accept(label){tokens.push(label);if(tokens.length>30)tokens.shift();$('recognized').textContent=TITLES[label];$('recognized-pose').textContent='Accepted from your captured movement';renderSentence();if($('auto-speak').checked)speak(TITLES[label]);}
function showReference(label){
 const r=references[label];if(!r)return;cancelCapture();$('reference-title').textContent=TITLES[label];$('reference-video').src=r.video;const rate=label==='i'?.45:.65;$('reference-video').playbackRate=rate;$('reference-credit').textContent=r.credit+` Playback is slowed to ${rate}× for practice.`;$('reference').showModal();$('reference-video').play().catch(()=>{});
}
function makeGuide(){
 for(const label of LABELS){const r=references[label],article=document.createElement('article');article.className='gesture';article.id=`gesture-${label}`;
  const button=document.createElement('button');button.type='button';button.setAttribute('aria-label',`Watch ${TITLES[label]} in ISL`);const img=document.createElement('img');img.src=r.poster;img.alt=`Recorded ISL example: ${TITLES[label]}`;img.loading='lazy';button.append(img);
  const body=document.createElement('div');body.className='gesture-body';const h=document.createElement('h3');h.textContent=TITLES[label];const hint=document.createElement('p');hint.className='mapping';hint.textContent='▶ Watch the sign';const source=document.createElement('span');source.className='source-chip';source.textContent=label==='name'?'ISLRTC dictionary':'ISL-DATA example';body.append(h,hint,source);button.append(body);button.onclick=()=>showReference(label);article.append(button);$('gesture-grid').append(article);$('teach-label').add(new Option(TITLES[label],label));
 }
}
async function load(){try{const responses=await Promise.all([fetch('./model/isl-model.json'),fetch('./model/references.json')]);if(responses.some(r=>!r.ok))throw Error('Missing model/reference files');[model,references]=await Promise.all(responses.map(r=>r.json()));if(model.version!==1||!Array.isArray(model.samples)||!model.samples.length)throw Error('Invalid model file');makeGuide();$('model-summary').textContent=model.summary;status('Ready. Watch a reference, start camera, then capture one complete sign.');controls();}catch(e){model=null;status(`ISL vocabulary could not load: ${e.message}. Restore the model folder and reload.`,true);}}
load();
function draw(frame){ctx.clearRect(0,0,canvas.width,canvas.height);const p=frame.p||[];if(p.length){ctx.strokeStyle='#ffffff65';ctx.lineWidth=2;for(const[a,b]of [[11,12],[11,13],[13,15],[12,14],[14,16]]){ctx.beginPath();ctx.moveTo(p[a].x*canvas.width,p[a].y*canvas.height);ctx.lineTo(p[b].x*canvas.width,p[b].y*canvas.height);ctx.stroke();}}
 for(const h of frame.h||[]){ctx.strokeStyle='#c8f6b4';ctx.lineWidth=2;for(const[a,b]of connections){ctx.beginPath();ctx.moveTo(h[a].x*canvas.width,h[a].y*canvas.height);ctx.lineTo(h[b].x*canvas.width,h[b].y*canvas.height);ctx.stroke();}ctx.fillStyle='#f4ffd1';for(const p of h){ctx.beginPath();ctx.arc(p.x*canvas.width,p.y*canvas.height,3,0,Math.PI*2);ctx.fill();}}
}
function cancelCapture(){clearInterval(captureTimer);capture=null;$('countdown').classList.remove('show');$('hold').value=0;$('hold-label').textContent='A short countdown gives you time to get ready';controls();}
function startCapture(teaching=false){
 if(!running||!model||capture||$('reference').open)return;
 const now=performance.now();capture={start:now+1200,end:now+1200+Number($('duration').value),frames:[],observations:0,gaps:0,last:null,teaching,label:$('teach-label').value};
 controls();cancelSpeech();$('candidate').textContent=teaching?`Learning ${TITLES[capture.label]}`:'Waiting for your sign';$('countdown').classList.add('show');$('countdown').textContent='Get ready';
 captureTimer=setInterval(()=>{
  if(!capture)return;const t=performance.now();
  if(t<capture.start){$('hold-label').textContent='Get ready. Start the movement when you see “Sign now”.';return;}
  $('countdown').textContent=t<capture.start+350?'Sign now':'';if(t>=capture.start+350)$('countdown').classList.remove('show');$('hold').value=Math.min(1,(t-capture.start)/(capture.end-capture.start));$('hold-label').textContent=`Capturing · ${Math.max(0,(capture.end-t)/1000).toFixed(1)} seconds left`;
  if(t>=capture.end+250)finishCapture();
 },50);
}
function finishCapture(){
 const c=capture;if(!c)return;cancelCapture();
 const seq=prepareSequence(c.frames);
 if(!seq||c.observations<8||c.frames.filter(active).length<5||c.gaps>1){$('candidate').textContent='No complete sign';status('Not enough clear hand/body frames. Keep face, shoulders and hands visible; choose a longer capture and sign slowly.',true);return;}
 if(c.teaching){
  const same=personal.filter(s=>s.label===c.label);if(same.length>=5){const index=personal.findIndex(s=>s.label===c.label);personal.splice(index,1);}
  personal.push({label:c.label,sequence:seq.map(f=>f.map(v=>Math.round(v*1000)/1000))});savePersonal();status(`Saved your ${TITLES[c.label]} example. Add 2–3 repetitions, then try Capture sign.`);$('candidate').textContent='Example saved';return;
 }
 const result=predict(seq,model,personal);
 if(result.label){accept(result.label);$('candidate').textContent=TITLES[result.label];status(`Added “${TITLES[result.label]}”. Capture another word or finish your sentence.`);}
 else{$('candidate').textContent='Uncertain — try again';const names=result.ranked.slice(0,2).map(r=>TITLES[r.label]).join(' / ');status(`No word added. ${result.reason}.${names?' Closest examples: '+names+'.':''} Watch the reference or add personal examples.`,true);}
}
function processFrame(frame,timestamp){
 draw(frame);const f=features(frame,video.videoWidth/video.videoHeight);$('tracking').textContent=!f?'Bring face & shoulders into view':active(f)?`${frame.h.length} hand${frame.h.length===1?'':'s'} tracked`:'Raise your hands to sign';
 if(capture&&timestamp>=capture.start&&timestamp<=capture.end){capture.observations++;if(capture.last!==null&&timestamp-capture.last>500)capture.gaps++;capture.last=timestamp;if(f)capture.frames.push(f);}
}
async function loop(now){if(!running)return;raf=requestAnimationFrame(loop);if(busy||now-lastFrame<90||video.readyState<2||video.currentTime===lastTime)return;if(canvas.width!==video.videoWidth||canvas.height!==video.videoHeight){canvas.width=video.videoWidth;canvas.height=video.videoHeight;$('stage').style.aspectRatio=`${video.videoWidth}/${video.videoHeight}`;}busy=true;lastFrame=now;lastTime=video.currentTime;const session=generation;
 try{const bitmap=await createImageBitmap(video);if(session!==generation||!running){bitmap.close();return;}worker.postMessage({type:'frame',bitmap,timestamp:now},[bitmap]);watchdog=setTimeout(()=>{if(session===generation){stop();status('Tracking timed out. Restart the camera.',true);}},12000);}catch(e){if(session===generation){stop();status(`Camera frame error: ${e.message}`,true);}}
}
async function cameras(){const devices=(await navigator.mediaDevices.enumerateDevices()).filter(d=>d.kind==='videoinput');const current=stream?.getVideoTracks()[0]?.getSettings().deviceId||$('camera').value;$('camera').replaceChildren(new Option('Default camera',''));devices.forEach((d,i)=>$('camera').add(new Option(d.label||`Camera ${i+1}`,d.deviceId)));if(devices.some(d=>d.deviceId===current))$('camera').value=current;}
function stop(){generation++;running=false;starting=false;cancelAnimationFrame(raf);clearTimeout(watchdog);cancelCapture();worker?.terminate();worker=null;stream?.getTracks().forEach(t=>t.stop());stream=null;video.srcObject=null;busy=false;draw({});$('stage').classList.remove('live');$('camera-state').textContent='Camera off';$('camera-state').classList.remove('active');$('start').disabled=false;$('start').textContent='Start camera';$('stop').disabled=true;$('camera').disabled=false;$('tracking').textContent='Waiting for camera';cancelSpeech();controls();status('Camera stopped. Your sentence is kept until you clear or reload it.');}
async function start(){if(running||starting)return;if(!navigator.mediaDevices?.getUserMedia){status('Open this app on localhost in Chrome or Edge to use the camera.',true);return;}
 starting=true;const session=++generation;$('start').disabled=true;$('stop').disabled=false;$('camera').disabled=true;$('start').textContent='Starting…';status('Allow camera access. Loading hand and body trackers…');
 try{const deviceId=$('camera').value;const acquired=await navigator.mediaDevices.getUserMedia({audio:false,video:{width:{ideal:640},height:{ideal:480},frameRate:{ideal:24,max:30},...(deviceId?{deviceId:{exact:deviceId}}:{facingMode:'user'})}});if(session!==generation){acquired.getTracks().forEach(t=>t.stop());return;}stream=acquired;video.srcObject=stream;await video.play();if(session!==generation)return;canvas.width=video.videoWidth;canvas.height=video.videoHeight;$('stage').style.aspectRatio=`${video.videoWidth}/${video.videoHeight}`;$('stage').classList.add('live');$('camera-state').textContent='Loading trackers';await cameras().catch(()=>{});if(session!==generation)return;
  worker=new Worker(new URL('./isl-worker.mjs',import.meta.url));watchdog=setTimeout(()=>{if(session===generation){stop();status('Trackers took too long to load. Check local model files and try again.',true);}},60000);
  worker.onerror=e=>{if(session===generation){stop();status(`Tracker failed to load: ${e.message||'Check the model files.'}`,true);}};
  worker.onmessage=({data})=>{if(session!==generation)return;clearTimeout(watchdog);if(data.type==='ready'){running=true;starting=false;lastTime=-1;lastFrame=0;$('camera-state').textContent='Camera live';$('camera-state').classList.add('active');$('start').textContent='Camera running';controls();status('Ready. Press Capture sign or Space, wait for the countdown, then sign the full word.');stream.getVideoTracks()[0].addEventListener('ended',()=>{if(session===generation){stop();status('Camera disconnected. Reconnect it and try again.',true);}});raf=requestAnimationFrame(loop);}else if(data.type==='result'){busy=false;processFrame(data.frame,data.timestamp);}else if(data.type==='error'){stop();status(`Tracker error: ${data.message}`,true);}};worker.postMessage({type:'init'});
 }catch(e){if(session!==generation)return;stop();const messages={NotAllowedError:'Camera permission was denied. Allow it in browser site settings and try again.',NotFoundError:'No camera found. Connect a webcam.',NotReadableError:'Camera is busy. Close other camera apps and try again.',OverconstrainedError:'That camera is unavailable. Choose Default camera.'};status(messages[e.name]||e.message,true);}
}
$('start').onclick=start;$('stop').onclick=stop;$('capture').onclick=()=>startCapture();$('teach').onclick=()=>startCapture(true);
$('forget').onclick=()=>{personal=[];savePersonal();};$('name').oninput=renderSentence;$('undo').onclick=()=>{tokens.pop();renderSentence();};$('clear').onclick=()=>{tokens=[];renderSentence();cancelSpeech();$('recognized').textContent='…';$('recognized-pose').textContent='Your next sign starts the conversation.';};
$('finish').onclick=()=>{const text=compose(tokens,$('name').value);if(!text)return;if(text.includes('…')){status('Type your name before finishing this introduction.',true);$('name').focus();return;}history.push(text);if(history.length>50)history.shift();renderHistory();speak(text);tokens=[];renderSentence();status('Sentence completed. Start another introduction whenever you are ready.');};
$('clear-history').onclick=()=>{history=[];renderHistory();cancelSpeech();};$('copy').onclick=async()=>{try{await navigator.clipboard.writeText(history.join('\n'));$('speech-status').textContent='Conversation copied';}catch{$('speech-status').textContent='Clipboard unavailable. Select and copy the sentences manually.';}};
$('test-voice').onclick=()=>speak('Hello. Paalam is ready.');$('auto-speak').onchange=()=>{if(!$('auto-speak').checked)cancelSpeech();};
$('close-reference').onclick=()=>$('reference').close();$('reference').addEventListener('close',()=>{$('reference-video').pause();$('reference-video').removeAttribute('src');$('reference-video').load();});
for(const button of document.querySelectorAll('[data-phrase]'))button.onclick=()=>{const ids=button.dataset.phrase.split(',');for(const b of document.querySelectorAll('[data-phrase]'))b.classList.toggle('selected',b===button);for(const l of LABELS)$(`gesture-${l}`)?.classList.toggle('practice',ids.includes(l));$('practice-status').textContent=`Practice: ${ids.map(id=>TITLES[id]).join(' → ')}. Watch each highlighted sign, then capture one word at a time.`;};
document.addEventListener('keydown',e=>{if(e.code==='Space'&&!e.repeat&&!['INPUT','TEXTAREA','SELECT','BUTTON'].includes(e.target.tagName)&&!$('reference').open){e.preventDefault();startCapture();}});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&(running||starting)){stop();status('Camera paused while the page was hidden. Start it again when ready.');}});window.addEventListener('pagehide',stop);
navigator.mediaDevices?.addEventListener('devicechange',()=>{if(!running&&!starting)cameras().catch(()=>{});});
