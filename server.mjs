import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join, resolve, extname, sep } from 'node:path';
const root=fileURLToPath(new URL('.',import.meta.url));
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.md':'text/plain; charset=utf-8','.svg':'image/svg+xml'};
createServer(async(req,res)=>{
  try {
    const path=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    const file=resolve(join(root,path==='/'?'index.html':path.replace(/^\//,'')));
    if(!file.startsWith(root.endsWith(sep)?root:root+sep) || path.includes('..')) {res.writeHead(403);res.end('Forbidden');return;}
    if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end('Read only');return;}
    const content=await readFile(file);
    res.writeHead(200,{'Content-Type':mime[extname(file)]||'application/octet-stream','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'});
    res.end(req.method==='HEAD'?undefined:content);
  } catch {res.writeHead(404,{'Content-Type':'text/plain'});res.end('Not found');}
}).listen(Number(process.env.PORT||4179),'127.0.0.1',()=>console.log('Raintrace: http://127.0.0.1:'+(process.env.PORT||4179)));
