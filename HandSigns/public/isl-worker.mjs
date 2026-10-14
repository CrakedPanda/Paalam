let hand,pose,body=[],frameNumber=0;
self.onmessage=async({data})=>{
 try{
  if(data.type==='init'){
   const {FilesetResolver,HandLandmarker,PoseLandmarker}=await import('./vendor/vision_bundle.mjs');
   const files=await FilesetResolver.forVisionTasks(new URL('./vendor/wasm/',self.location.href).href);
   hand=await HandLandmarker.createFromOptions(files,{baseOptions:{delegate:'CPU',modelAssetPath:new URL('./vendor/hand_landmarker.task',self.location.href).href},runningMode:'VIDEO',numHands:2,minHandDetectionConfidence:.5,minHandPresenceConfidence:.5,minTrackingConfidence:.5});
   pose=await PoseLandmarker.createFromOptions(files,{baseOptions:{delegate:'CPU',modelAssetPath:new URL('./vendor/pose_landmarker_lite.task',self.location.href).href},runningMode:'VIDEO',numPoses:1,minPoseDetectionConfidence:.5,minPosePresenceConfidence:.5,minTrackingConfidence:.5});
   self.postMessage({type:'ready'});
  }else if(data.type==='frame'){
   try{
    const h=hand.detectForVideo(data.bitmap,data.timestamp);
    const saved=structuredClone({h:h.landmarks,w:h.worldLandmarks,side:h.handedness.map(x=>x[0].categoryName)});
    // Body anchors move more slowly than fingers. Refresh once per four frames
    // so the hand tracker can sample short signs on modest CPUs.
    if(frameNumber++%4===0)body=pose.detectForVideo(data.bitmap,data.timestamp).landmarks[0]||[];
    self.postMessage({type:'result',frame:{...saved,p:body},timestamp:data.timestamp});
   }finally{data.bitmap.close();}
  }
 }catch(error){self.postMessage({type:'error',message:error.message});}
};
