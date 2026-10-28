const http = require('http');
const fs = require('fs');
const path = require('path');
const root = __dirname;
const h3 = new URL(process.env.TOONFLOW_H3_URL || 'http://192.168.111.20:30011');
const types = {'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8'};
http.createServer((req, res) => {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  if (pathname.startsWith('/api/gateway/')) {
    const sub=pathname.slice('/api/gateway'.length);
    const allowed=(req.method==='POST' && (sub==='/auth/login'||sub==='/upscales')) ||
      (req.method==='GET' && (sub==='/auth/me'||/^\/upscales\/[A-Za-z0-9_-]+(?:\/content)?$/.test(sub)));
    if(!allowed || (req.method==='POST' && req.headers['x-toonflow-client']!=='1')) {res.writeHead(403);return res.end('Forbidden')}
    if(Number(req.headers['content-length']||0)>16384){res.writeHead(413);return res.end('Request too large')}
    const headers={'content-type':req.headers['content-type']||'application/json',...(req.headers.cookie?{cookie:req.headers.cookie}:{}),...(req.headers['x-csrf-token']?{'x-csrf-token':req.headers['x-csrf-token']}:{}),...(req.headers.range?{range:req.headers.range}:{})};
    const upstream=http.request(new URL('/api'+sub,h3),{method:req.method,headers},response=>{
      const out={'Content-Type':response.headers['content-type']||'application/json','Cache-Control':'no-store'};
      for(const k of ['content-length','content-range','accept-ranges','set-cookie'])if(response.headers[k])out[k]=response.headers[k];
      res.writeHead(response.statusCode,out);response.pipe(res);
    });
    upstream.setTimeout(30000,()=>upstream.destroy(Error('网关连接超时')));
    upstream.on('error',()=>{if(!res.headersSent)res.writeHead(502,{'Content-Type':'application/json'});res.end(JSON.stringify({detail:'无法连接超分网关；提交状态可能不明确，请先检查网关任务列表。'}))});
    req.pipe(upstream);return;
  }
  if (pathname.startsWith('/api/h3/')) {
    const match = pathname.match(/^\/api\/h3\/(models|videos(?:\/[A-Za-z0-9_-]+(?:\/content)?)?)$/);
    const allowed = match && ((req.method === 'GET') || (req.method === 'POST' && match[1] === 'videos'));
    if (!allowed || (req.method === 'POST' && req.headers['x-toonflow-client'] !== '1')) { res.writeHead(403); return res.end('Forbidden'); }
    if (Number(req.headers['content-length'] || 0) > 25 * 1024 * 1024) { res.writeHead(413); return res.end('Reference image too large'); }
    const upstream = http.request(new URL('/v1/' + match[1], h3), {method:req.method, headers: {'content-type':req.headers['content-type'] || 'application/octet-stream', ...(req.headers['content-length'] ? {'content-length':req.headers['content-length']} : {}), ...(req.method === 'GET' && req.headers.range ? {range:req.headers.range} : {})}}, response => {
      const headers = {'Content-Type':response.headers['content-type'] || 'application/json', 'Cache-Control':'no-store'};
      for (const key of ['content-length','content-range','accept-ranges']) if (response.headers[key]) headers[key]=response.headers[key];
      res.writeHead(response.statusCode, headers);
      response.pipe(res);
    });
    upstream.setTimeout(30000, () => upstream.destroy(new Error('H3 service timeout')));
    upstream.on('error', () => { if (!res.headersSent) res.writeHead(502, {'Content-Type':'application/json'}); res.end(JSON.stringify({error:'无法连接 H3 服务；提交结果可能不明确，请先在网关检查任务列表。'})); });
    req.pipe(upstream);
    return;
  }
  let name;
  try { name = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); } catch { res.writeHead(400); return res.end(); }
  const file = path.resolve(root, '.' + (name === '/' ? '/index.html' : name));
  if (!file.startsWith(root + path.sep)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, data) => { if (err) { res.writeHead(404); return res.end('Not found'); } res.writeHead(200, {'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control':'no-store'}); res.end(data); });
}).listen(Number(process.env.TOONFLOW_PORT || 7790), '127.0.0.1', () => console.log('Toonflow Studio ready'));
