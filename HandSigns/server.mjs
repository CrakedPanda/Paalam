import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createReadStream } from 'node:fs';
const root = path.resolve(fileURLToPath(new URL('./public/', import.meta.url)));
const port = Number(process.env.PORT || 5173);
if(!Number.isInteger(port)||port<1||port>65535)throw new Error('PORT must be between 1 and 65535.');
const address=`http://127.0.0.1:${port}`;
function openBrowser(){if(process.argv.includes('--open')&&process.platform==='win32')spawn('explorer.exe',[address],{detached:true,stdio:'ignore'}).unref();}
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.mjs': 'text/javascript', '.js': 'text/javascript', '.json': 'application/json', '.wasm': 'application/wasm', '.task': 'application/octet-stream', '.svg': 'image/svg+xml', '.mp4':'video/mp4', '.jpg':'image/jpeg' };
const server = http.createServer(async (req, res) => {
  try {
    if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405); return res.end(); }
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname === '/health') { res.setHeader('Content-Type', 'application/json'); return res.end(JSON.stringify({ app: 'paalam-handsigns', version: '2.0.0' })); }
    const decoded = decodeURIComponent(url.pathname);
    const filename = path.resolve(root, '.' + (decoded === '/' ? '/index.html' : decoded));
    if (!filename.startsWith(root + path.sep) && filename !== path.join(root, 'index.html')) { res.writeHead(403); return res.end('Forbidden'); }
    const info = await stat(filename);
    if (!info.isFile()) throw new Error('Not a file');
    const headers={ 'Content-Type': types[path.extname(filename)] || 'text/plain', 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff', 'Permissions-Policy': 'camera=(self), microphone=()', 'Accept-Ranges':'bytes' };
    if(req.headers.range){
      const range=req.headers.range.match(/^bytes=(\d+)-(\d*)$/);
      const start=range?Number(range[1]):-1,end=range?Math.min(range[2]?Number(range[2]):info.size-1,info.size-1):-1;
      if(start<0||start>=info.size||end<start){res.writeHead(416,{'Content-Range':`bytes */${info.size}`});return res.end();}
      res.writeHead(206,{...headers,'Content-Length':end-start+1,'Content-Range':`bytes ${start}-${end}/${info.size}`});
      if(req.method==='HEAD')return res.end();createReadStream(filename,{start,end}).pipe(res);
    }else{
      res.writeHead(200,{...headers,'Content-Length':info.size});
      if(req.method==='HEAD')return res.end();createReadStream(filename).pipe(res);
    }
  } catch { res.writeHead(404); res.end('Not found'); }
});
server.on('error', async error => {
  if(error.code==='EADDRINUSE'){
    try{const response=await fetch(address+'/health',{signal:AbortSignal.timeout(2000)});if((await response.json()).app==='paalam-handsigns'){console.log(`Paalam is already running at ${address}`);openBrowser();return;}}catch{}
  }
  console.error(error.code === 'EADDRINUSE' ? `Port ${port} is busy. Close the other server or set PORT to another port.` : error); process.exitCode = 1;
});
server.listen(port, '127.0.0.1', () => {console.log(`Paalam is running at ${address}`);openBrowser();});
