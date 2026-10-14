import pathlib,sys,json,subprocess,cv2
root=pathlib.Path(__file__).resolve().parent;sys.path.insert(0,str(root/'python-tools'));import imageio_ffmpeg
ffmpeg=imageio_ffmpeg.get_ffmpeg_exe();dest=root.parent/'public'/'references';dest.mkdir(exist_ok=True)
labels=['hello','goodmorning','i','you','name','what','fine','student','teacher','thankyou'];references={}
for label in labels:
 filename=f'{label}-User002.mp4' if label!='name' else 'name-dictionary-1.mp4'
 source=root/'data'/'videos-small'/filename
 target=dest/f'{label}.mp4'
 # Keep the complete source movement; only resize/re-encode. No invented sign animation.
 target.write_bytes(source.read_bytes())
 capture=cv2.VideoCapture(str(source));duration=capture.get(cv2.CAP_PROP_FRAME_COUNT)/capture.get(cv2.CAP_PROP_FPS)
 capture.set(cv2.CAP_PROP_POS_MSEC,duration*500);ok,frame=capture.read();capture.release()
 if ok:cv2.imwrite(str(dest/f'{label}.jpg'),frame)
 references[label]={'video':f'./references/{label}.mp4','poster':f'./references/{label}.jpg','file':filename,'credit':('Indian Sign Language Research and Training Centre (ISLRTC), DEPwD, Ministry of Social Justice and Empowerment, Government of India. Dictionary re-encode; non-profiteering use with acknowledgement.' if label=='name' else 'ISL500 / ISL-DATA · User002 · research and academic use only.'),'source':('https://huggingface.co/datasets/Vignesh3816/Indian_Sign_Language_Data.gov_Rencoded/resolve/main/N/Name.mp4' if label=='name' else 'https://huggingface.co/datasets/ISL500/ISL-DATA')}
(root.parent/'public'/'model').mkdir(exist_ok=True)
(root.parent/'public'/'model'/'references.json').write_text(json.dumps(references,indent=2),encoding='utf8')
print('Prepared',len(references),'local reference videos')
