import sys,pathlib,json,time,cv2
root=pathlib.Path(__file__).resolve().parent
sys.path.insert(0,str(root/'python-tools'))
import mediapipe as mp
data=root/'data';out=data/'landmarks-python';out.mkdir(exist_ok=True)
records=json.loads((root/'source-manifest.json').read_text(encoding='utf-8-sig'))

if '--reverse' in sys.argv:records.reverse()
def points(landmarks):return [{'x':float(p.x),'y':float(p.y),'z':float(p.z),'visibility':float(getattr(p,'visibility',1) or 0)} for p in landmarks]
base=mp.tasks.BaseOptions
v=mp.tasks.vision
hand=v.HandLandmarker.create_from_options(v.HandLandmarkerOptions(base_options=base(model_asset_path=str(root.parent/'public/vendor/hand_landmarker.task')),running_mode=v.RunningMode.VIDEO,num_hands=2,min_hand_detection_confidence=.5,min_hand_presence_confidence=.5,min_tracking_confidence=.5))
pose=v.PoseLandmarker.create_from_options(v.PoseLandmarkerOptions(base_options=base(model_asset_path=str(root.parent/'public/vendor/pose_landmarker_lite.task')),running_mode=v.RunningMode.VIDEO,num_poses=1,min_pose_detection_confidence=.5,min_pose_presence_confidence=.5,min_tracking_confidence=.5))
stamp=0;started=time.time()
for index,r in enumerate(records):
 dest=out/(r['file']+'.json')
 if dest.exists():continue
 capture=cv2.VideoCapture(str(data/'videos-small'/r['file']));fps=capture.get(cv2.CAP_PROP_FPS);width=capture.get(cv2.CAP_PROP_FRAME_WIDTH);height=capture.get(cv2.CAP_PROP_FRAME_HEIGHT)
 frames=[];i=0
 while True:
  ok,frame=capture.read()
  if not ok:break
  rgb=cv2.cvtColor(frame,cv2.COLOR_BGR2RGB);image=mp.Image(image_format=mp.ImageFormat.SRGB,data=rgb);stamp+=100
  h=hand.detect_for_video(image,stamp);p=pose.detect_for_video(image,stamp)
  frames.append({'t':i/fps,'h':[points(x) for x in h.hand_landmarks],'w':[points(x) for x in h.hand_world_landmarks],'side':[x[0].category_name for x in h.handedness],'p':points(p.pose_landmarks[0]) if p.pose_landmarks else []});i+=1
 capture.release();dest.write_text(json.dumps({**r,'width':width,'height':height,'duration':i/fps,'frames':frames,'extraction':'MediaPipe Python 0.10.32, same float16/v1 models as browser'}))
 print(index+1,r['label'],r['signer'],len(frames),sum(bool(f['h']) and bool(f['p']) for f in frames),'elapsed',round(time.time()-started),flush=True)
hand.close();pose.close();print('DONE',len(records),flush=True)
