let landmarker;
self.onmessage = async ({data}) => {
  try {
    if(data.type==='init') {
      // MediaPipe loads its WASM glue via importScripts, requiring a classic worker.
      const { FilesetResolver, HandLandmarker } = await import('./vendor/vision_bundle.mjs');
      const files=await FilesetResolver.forVisionTasks(new URL('./vendor/wasm/', self.location.href).href);
      landmarker=await HandLandmarker.createFromOptions(files, {
        baseOptions:{modelAssetPath:new URL('./vendor/hand_landmarker.task',self.location.href).href,delegate:'CPU'},
        runningMode:'VIDEO',numHands:2,minHandDetectionConfidence:0.65,minHandPresenceConfidence:0.65,minTrackingConfidence:0.65
      });
      self.postMessage({type:'ready'});
    }
    if(data.type==='frame') {
      try { const result=landmarker.detectForVideo(data.bitmap,data.timestamp); self.postMessage({type:'result',result,timestamp:data.timestamp}); }
      finally { data.bitmap.close(); }
    }
  } catch(error) { self.postMessage({type:'error',message:error.message}); }
};
