import sys,json,subprocess,pathlib,concurrent.futures
root=pathlib.Path(__file__).resolve().parent
sys.path.insert(0,str(root/'python-tools'))
import imageio_ffmpeg
ffmpeg=imageio_ffmpeg.get_ffmpeg_exe()
dest=root/'data'/'videos-small';dest.mkdir(exist_ok=True)
files=list((root/'data'/'videos').glob('*.mp4'))
def convert(p):
 out=dest/p.name
 if not out.exists():
  subprocess.run([ffmpeg,'-nostdin','-y','-loglevel','error','-threads','2','-i',str(p),'-vf','scale=640:-2,fps=10','-an','-c:v','libx264','-threads','2','-preset','veryfast','-crf','24','-movflags','+faststart',str(out)],check=True)
 return p.name
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
 for i,name in enumerate(pool.map(convert,files)):
  if i%10==0:print(i+1,len(files),name,flush=True)
print('Transcode complete',len(files),flush=True)
