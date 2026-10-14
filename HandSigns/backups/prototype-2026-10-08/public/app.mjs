import {GESTURES, classify, StableGesture} from './gestures.mjs';
const $=id=>document.getElementById(id);
const video=$('video'), canvas=$('overlay'), context=canvas.getContext('2d');
const filter=new StableGesture();
let stream=null,worker=null,running=false,starting=false,busy=false,generation=0,raf=0,lastVideoTime=-1,lastFrame=0,watchdog=0;
let phrases=[],voices=[];
const synth=window.speechSynthesis;
const connections=[[0,1],[1,2],[2,3],[3,4],[0,5],[5,6],[6,7],[7,8],[5,9],[9,10],[10,11],[11,12],[9,13],[13,14],[14,15],[15,16],[13,17],[0,17],[17,18],[18,19],[19,20]];
function status(text,error=false){$('status').textContent=text;$('status').classList.toggle('error',error);}
for(const [index,g] of GESTURES.entries()){
  const card=document.createElement('article');card.className='gesture';card.id=`gesture-${g.id}`;
  card.innerHTML=`<div class="gesture-top"><span class="gesture-icon" aria-hidden="true">${g.icon}</span><span class="gesture-num">${String(index+1).padStart(2,'0')}</span></div><h3>${g.name}</h3><p class="mapping">Says “${g.text}”</p><p>${g.pose}</p>`;
  $('gesture-grid').append(card);
}
function loadVoices(){
  const previous=$('voice').value;voices=synth?.getVoices()||[];
  $('voice').replaceChildren(new Option('Browser default',''));
  for(const v of voices)$('voice').add(new Option(`${v.name} · ${v.lang}${v.localService?' · local':' · online'}`,v.voiceURI));
  const preferred=voices.find(v=>v.voiceURI===previous)||voices.find(v=>v.localService&&v.lang==='en-IN')||voices.find(v=>v.localService&&v.lang.startsWith('en'));
  $('voice').value=preferred?.voiceURI||'';
}
function speak(text){
  if(!synth||!text)return;
  synth.cancel();
  const utterance=new SpeechSynthesisUtterance(text);
  const voice=voices.find(v=>v.voiceURI===$('voice').value);
  if(voice)utterance.voice=voice;
  utterance.lang=voice?.lang||'en-IN';utterance.rate=.95;
  utterance.onstart=()=>{$('speech-status').textContent='Speaking…';};
  utterance.onend=()=>{$('speech-status').textContent='Ready to speak';};
  utterance.onerror=e=>{if(!['canceled','interrupted'].includes(e.error))$('speech-status').textContent=`Speech unavailable (${e.error}). Try another voice.`;};
  synth.speak(utterance);
}
loadVoices();if(synth)synth.addEventListener('voiceschanged',loadVoices);
else{$('auto-speak').checked=false;for(const id of ['auto-speak','voice','test-voice'])$(id).disabled=true;$('speech-status').textContent='Speech is unsupported in this browser.';}
function syncTranscript(){
  $('transcript').value=phrases.join('. ');$('transcript').scrollTop=$('transcript').scrollHeight;
  $('word-count').textContent=`${phrases.length} phrase${phrases.length===1?'':'s'}`;
  for(const id of ['copy','clear'])$(id).disabled=!phrases.length;
  $('speak').disabled=!phrases.length||!synth;
}
function accept(id){
  const g=GESTURES.find(g=>g.id===id);if(!g)return;
  phrases.push(g.text);if(phrases.length>200)phrases.shift();syncTranscript();
  $('recognized').textContent=g.text;$('recognized-pose').textContent=g.name;
  if($('auto-speak').checked)speak(g.text);
}
function draw(hands){
  context.clearRect(0,0,canvas.width,canvas.height);
  for(const hand of hands){
    context.strokeStyle='#c3f2b1';context.lineWidth=2;
    for(const [a,b]of connections){context.beginPath();context.moveTo(hand[a].x*canvas.width,hand[a].y*canvas.height);context.lineTo(hand[b].x*canvas.width,hand[b].y*canvas.height);context.stroke();}
    context.fillStyle='#f3ffc5';for(const p of hand){context.beginPath();context.arc(p.x*canvas.width,p.y*canvas.height,3,0,Math.PI*2);context.fill();}
  }
}
function processResult(result,timestamp){
  const hands=result.landmarks||[];draw(hands);
  const id=hands.length===1?classify(result.worldLandmarks?.[0],hands[0],video.videoWidth/video.videoHeight):null;
  $('tracking').textContent=hands.length>1?'Use just one hand':hands.length===1?'Hand detected':'No hand detected';
  const stable=filter.update(id,timestamp);
  $('hold').value=stable.progress;
  $('candidate').textContent=id?GESTURES.find(g=>g.id===id).name: 'No matching pose';
  $('hold-label').textContent=id&&filter.last===id?'Accepted · relax to repeat':'Hold a gesture for 0.7 seconds';
  for(const g of GESTURES)$(`gesture-${g.id}`).classList.toggle('matched',id===g.id);
  if(stable.emit)accept(stable.emit);
}
async function loop(now){
  if(!running)return;
  raf=requestAnimationFrame(loop);
  if(busy||now-lastFrame<66||video.readyState<2||video.currentTime===lastVideoTime)return;
  busy=true;lastFrame=now;lastVideoTime=video.currentTime;const session=generation;
  try{
    const bitmap=await createImageBitmap(video);
    if(session!==generation||!running){bitmap.close();return;}
    worker.postMessage({type:'frame',bitmap,timestamp:now},[bitmap]);
    watchdog=setTimeout(()=>{stop();status('Recognition timed out. Restart the camera to try again.',true);},12000);
  }catch(error){if(session===generation){stop();status(`Unable to read camera frames: ${error.message}`,true);}}
}
async function cameras(){
  const devices=(await navigator.mediaDevices.enumerateDevices()).filter(d=>d.kind==='videoinput');
  const current=stream?.getVideoTracks()[0]?.getSettings().deviceId||$('camera').value;
  $('camera').replaceChildren(new Option('Default camera',''));
  devices.forEach((d,i)=>$('camera').add(new Option(d.label||`Camera ${i+1}`,d.deviceId)));
  if(devices.some(d=>d.deviceId===current))$('camera').value=current;
}
function stop(){
  generation++;running=false;starting=false;cancelAnimationFrame(raf);clearTimeout(watchdog);
  worker?.terminate();worker=null;stream?.getTracks().forEach(t=>t.stop());stream=null;video.srcObject=null;
  busy=false;filter.reset();draw([]);$('stage').classList.remove('live');$('camera-state').textContent='Camera off';$('camera-state').classList.remove('active');
  $('start').disabled=false;$('start').textContent='●  Start camera';$('stop').disabled=true;$('camera').disabled=false;
  $('tracking').textContent='Waiting for camera';$('hold').value=0;$('candidate').textContent='No gesture';$('hold-label').textContent='Hold a gesture for 0.7 seconds';
  for(const g of GESTURES)$(`gesture-${g.id}`).classList.remove('matched');
  synth?.cancel();status('Camera stopped. Your conversation is kept until you clear or reload it.');
}
async function start(){
  if(starting||running)return;
  if(!navigator.mediaDevices?.getUserMedia){status('Camera access needs localhost in Chrome or Edge. Open http://127.0.0.1:5173.',true);return;}
  starting=true;const session=++generation;$('start').disabled=true;$('camera').disabled=true;$('stop').disabled=false;$('start').textContent='Starting…';
  status('Allow camera access, then wait for the local hand tracker to load.');
  try{
    const deviceId=$('camera').value;
    const acquired=await navigator.mediaDevices.getUserMedia({audio:false,video:{width:{ideal:640},height:{ideal:480},frameRate:{ideal:24,max:30},...(deviceId?{deviceId:{exact:deviceId}}:{facingMode:'user'})}});
    if(session!==generation){acquired.getTracks().forEach(t=>t.stop());return;}
    stream=acquired;video.srcObject=stream;await video.play();
    if(session!==generation)return;
    canvas.width=video.videoWidth;canvas.height=video.videoHeight;
    $('stage').style.aspectRatio=`${video.videoWidth}/${video.videoHeight}`;
    $('stage').classList.add('live');$('camera-state').textContent='Loading tracker';await cameras().catch(()=>{});
    if(session!==generation)return;
    worker=new Worker(new URL('./vision-worker.mjs',import.meta.url));
    watchdog=setTimeout(()=>{if(session===generation){stop();status('Tracker did not load. Run node setup.mjs and try again.',true);}},60000);
    worker.onerror=event=>{if(session===generation){stop();status(`Tracker could not start. Check local model files and use a current Chrome or Edge browser. ${event.message||''}`,true);}};
    worker.onmessage=({data})=>{
      if(session!==generation)return;
      clearTimeout(watchdog);
      if(data.type==='ready'){
        running=true;starting=false;lastVideoTime=-1;lastFrame=0;$('start').textContent='Camera running';$('camera-state').textContent='Camera live';$('camera-state').classList.add('active');
        status('Show one gesture from the guide. Keep the whole hand visible and hold steady.');
        stream.getVideoTracks()[0].addEventListener('ended',()=>{if(session===generation){stop();status('Camera disconnected. Reconnect it and start again.',true);}});
        raf=requestAnimationFrame(loop);
      }else if(data.type==='result'){busy=false;processResult(data.result,data.timestamp);}
      else if(data.type==='error'){stop();status(`Hand tracker failed: ${data.message}. Run node setup.mjs to restore model files.`,true);}
    };
    worker.postMessage({type:'init'});
  }catch(error){
    if(session!==generation)return;stop();
    const messages={NotAllowedError:'Camera permission was denied. Allow the camera in browser site settings and try again.',NotFoundError:'No camera found. Connect a webcam and try again.',NotReadableError:'Camera is busy or unavailable. Close other camera apps and try again.',OverconstrainedError:'Selected camera is unavailable. Select Default camera and try again.'};
    status(messages[error.name]||`Could not start the camera: ${error.message}`,true);
  }
}
$('start').addEventListener('click',start);$('stop').addEventListener('click',stop);
$('test-voice').addEventListener('click',()=>speak('Hello. Paalam is ready.'));
$('speak').addEventListener('click',()=>speak(phrases.join('. ')));
$('auto-speak').addEventListener('change',()=>{if(!$('auto-speak').checked)synth?.cancel();});
$('clear').addEventListener('click',()=>{phrases=[];syncTranscript();synth?.cancel();$('recognized').textContent='…';$('recognized-pose').textContent='Your next gesture becomes a word.';});
$('copy').addEventListener('click',async()=>{try{await navigator.clipboard.writeText($('transcript').value);$('speech-status').textContent='Conversation copied';}catch{$('transcript').focus();$('transcript').select();$('speech-status').textContent='Text selected. Press Ctrl+C to copy.';}});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&(running||starting)){stop();status('Camera paused because the page was hidden. Start again when ready.');}});
window.addEventListener('pagehide',stop);
if(navigator.mediaDevices)navigator.mediaDevices.addEventListener('devicechange',()=>{if(!running&&!starting)cameras().catch(()=>{});});
if(location.protocol==='file:')status('Open this app with Start HandSigns.cmd, not by opening the HTML file directly.',true);
