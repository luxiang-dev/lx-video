// Local-only mock for exercising the browser without starting a GPU task.
const http = require('http');
const fs = require('fs');
let checks = 0;
const video = fs.readFileSync(__dirname + '/h3-test-result.mp4');
http.createServer((req,res)=>{
  if(req.method==='POST' && req.url==='/v1/videos'){
    const parts=[];req.on('data',x=>parts.push(x));req.on('end',()=>{
      try { const body=JSON.parse(Buffer.concat(parts)); if(body.task==='fl2va'){if(body.conditions.length!==2||body.conditions[0].role!=='keyframe'||body.conditions[0].frame_index!==0||body.conditions[1].role!=='keyframe'||body.conditions[1].frame_index!==-1||!body.conditions.every(x=>x.uri.startsWith('data:image/')))throw Error()}else if(body.task!=='ref2va'||!body.conditions?.[0]?.uri?.startsWith('data:image/'))throw Error(); }
      catch {res.writeHead(400,{'Content-Type':'application/json'});return res.end('{"detail":"Invalid reference payload"}')}
      res.writeHead(200,{'Content-Type':'application/json'});res.end('{"id":"mock-h3-job","status":"queued"}');
    });return;
  }
  if(req.url==='/v1/videos/mock-h3-job'){
    checks++;res.writeHead(200,{'Content-Type':'application/json'});return res.end(JSON.stringify({id:'mock-h3-job',status:checks>1?'completed':'queued'}));
  }
  if(req.url==='/v1/videos/mock-h3-job/content'){
    const match=(req.headers.range||'').match(/^bytes=(\d+)-(\d*)$/);
    if(match){const a=Number(match[1]),b=match[2]?Math.min(Number(match[2]),video.length-1):video.length-1;res.writeHead(206,{'Content-Type':'video/mp4','Accept-Ranges':'bytes','Content-Range':`bytes ${a}-${b}/${video.length}`,'Content-Length':b-a+1});return res.end(video.subarray(a,b+1));}
    res.writeHead(200,{'Content-Type':'video/mp4','Content-Length':video.length,'Accept-Ranges':'bytes'});return res.end(video);
  }
  res.writeHead(404,{'Content-Type':'application/json'}).end('{"detail":"not found"}');
}).listen(18321,'127.0.0.1',()=>console.log('mock ready'));
