import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const records=JSON.parse((await readFile(new URL('./source-manifest.json',import.meta.url),'utf8')).replace(/^\uFEFF/,''));
const dir=new URL('./data/videos/',import.meta.url);await mkdir(dir,{recursive:true});
const sha=data=>createHash('sha256').update(data).digest('hex');
for(const r of records){
 if(!/^[a-z0-9_-]+\.mp4$/i.test(r.file))throw Error('Unsafe filename in manifest');
 const dest=new URL(r.file,dir);let cached;try{cached=await readFile(dest);}catch{}
 if(cached&&sha(cached)===r.sha256){console.log('Cached',r.file);continue;}
 const response=await fetch(r.url,{signal:AbortSignal.timeout(120000)});if(!response.ok)throw Error(`${response.status} ${r.url}`);
 const bytes=Buffer.from(await response.arrayBuffer());if(sha(bytes)!==r.sha256)throw Error('Source content changed: '+r.file);
 await writeFile(dest,bytes);console.log('Downloaded',r.file);
}
