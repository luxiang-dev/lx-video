// H3 jobs are submitted only by an explicit user action. An uncertain submission
// is never automatically retried, because the GPU task may already exist.
const h3OriginalNodeHTML = nodeHTML;
const h3OriginalBindCanvas = bindCanvas;
const h3Timers = new Map();
nodeHTML = function(n) {
  if(n.type !== 'generateVideo') return h3OriginalNodeHTML(n);
  const job=n.h3Job;
  if(job?.status==='unknown' && !job.id && /task is required for MiniMax H3/i.test(job.error||'')){job.status='failed';save();}
  const labels={submitting:'提交中',unknown:'提交结果待确认',queued:'排队中',in_progress:'生成中',processing:'生成中',completed:'已完成',failed:'生成失败'};
  const label=labels[job?.status] || job?.status || '等待创建任务';
  const result=job?.status==='completed' && job.id ? `<video controls preload="metadata" style="width:100%;border-radius:7px" src="/api/h3/videos/${encodeURIComponent(job.id)}/content"></video><a href="/api/h3/videos/${encodeURIComponent(job.id)}/content" download="${esc(job.id)}.mp4">下载视频</a><div class="frame-actions"><button class="small-btn" data-frame="first" data-frame-node="${n.id}">提取首帧</button><button class="small-btn" data-frame="last" data-frame-node="${n.id}">提取尾帧</button></div>` : `<div class="node-placeholder">▷ MiniMax-H3<br>${esc(label)}</div>`;
  return `<div class="node ${selected===n.id?'selected':''}" data-node="${n.id}" style="left:${n.x}px;top:${n.y}px"><div class="node-head"><span>▷</span><strong title="双击重命名">${esc(n.title)}</strong><button data-node-delete="${n.id}" title="删除节点">×</button></div><div class="node-body">${result}<p id="h3status-${n.id}" style="line-height:1.5">${esc(label)}${job?.id?' · '+esc(job.id):''}</p><button class="small-btn" data-h3="${n.id}">${job?'查看任务':'配置并生成'}</button></div><div class="ports"><button class="port" data-in="${n.id}" title="点击以连接输入"><i class="dot"></i>图片输入</button><button class="port ${connectFrom===n.id?'pending':''}" data-out="${n.id}" title="点击以连接输出">视频输出<i class="dot"></i></button></div></div>`;
};
bindCanvas = function(){
  h3OriginalBindCanvas();
  document.querySelectorAll('[data-h3]').forEach(el=>el.onclick=()=>h3Dialog(el.dataset.h3));
  document.querySelectorAll('[data-frame-node]').forEach(el=>el.onclick=()=>extractH3Frame(current,el.dataset.frameNode,el.dataset.frame,el));
  for(const n of current.nodes) if(n.h3Job?.id && !['completed','failed'].includes(n.h3Job.status)) h3Poll(current,n);
};
function h3Dialog(id){
  const p=current,n=p.nodes.find(x=>x.id===id);if(!n)return;
  const j=n.h3Job;
  if(j){
    openH3TaskDialog(p,n);return;
  }
  const images=p.nodes.filter(x=>x.type==='image' && x.src);
  const linked=new Set(p.edges.filter(e=>e.to===id).map(e=>e.from));
  const linkedImages=p.edges.filter(e=>e.to===id).map(e=>images.find(x=>x.id===e.from)).filter(Boolean);
  const frameOptions=(selectedId)=>`<option value="">不指定</option>${images.map(x=>`<option value="${esc(x.id)}" ${x.id===selectedId?'selected':''}>${esc(x.title)}${linked.has(x.id)?'（已连接）':''}</option>`).join('')}`;
  modal('生成 H3 视频',`<label>生成模式</label><select id="h3Mode" style="width:100%;padding:10px;border:1px solid #dce4eb;border-radius:8px"><option value="reference">参考图生成</option><option value="hybrid">首尾帧 + 参考图（当前服务，实验）</option><option value="keyframes">首尾帧生成（FL2VA 服务）</option></select><div id="h3ReferenceFields"><label>参考图片（必选）</label><select id="h3Image" style="width:100%;padding:10px;border:1px solid #dce4eb;border-radius:8px"><option value="">请选择画布中的图片节点</option>${images.map(x=>`<option value="${esc(x.id)}" ${linked.has(x.id)?'selected':''}>${esc(x.title)}${linked.has(x.id)?'（已连接）':''}</option>`).join('')}</select></div><div id="h3FrameFields" hidden><label>首帧（开始画面）</label><select id="h3FirstFrame" style="width:100%;padding:10px;border:1px solid #dce4eb;border-radius:8px">${frameOptions(linkedImages[0]?.id)}</select><label>尾帧（结束画面）</label><select id="h3LastFrame" style="width:100%;padding:10px;border:1px solid #dce4eb;border-radius:8px">${frameOptions(linkedImages[1]?.id)}</select><p>至少选择一张图片；连接到此节点的前两张图片默认依次作为首帧和尾帧，可在此调整。</p></div><label>视频描述</label><textarea id="h3Prompt" style="width:100%;height:90px;border:1px solid #dce4eb;border-radius:8px;padding:10px" placeholder="描述人物动作、镜头和声音，可用 &lt;Picture 1&gt; 指代参考图"></textarea><label>时长与推理步数</label><div style="display:flex;gap:10px"><select id="h3Seconds" style="padding:9px;flex:1">${[5,4,6,7,8,9,10,11,12,13,14,15].map(x=>`<option value="${x}">${x} 秒</option>`).join('')}</select><select id="h3Steps" style="padding:9px;flex:1"><option value="50">50 步（默认）</option><option value="30">30 步</option><option value="20">20 步</option><option value="8">8 步</option></select></div><label>画面比例与短边分辨率</label><div style="display:flex;gap:10px"><select id="h3Ratio" style="padding:9px;flex:1"><option value="16:9">16:9 横屏</option><option value="9:16">9:16 竖屏</option><option value="1:1">1:1 方形</option></select><select id="h3Resolution" style="padding:9px;flex:1"><option value="768">768p</option><option value="480">480p</option></select></div><p>通过局域网 H3 网关生成，运行期间占用 GPU。提交后不能从此客户端取消；请勿重复提交未知状态的任务。当前服务仅加载 ref2va：可尝试实验性的首尾帧 + 参考图模式，能否生效取决于服务端版本；FL2VA 模式需要另行部署对应模型分支。</p>`,async()=>{
    const mode=$('#h3Mode').value,image=p.nodes.find(x=>x.id===$('#h3Image').value),first=p.nodes.find(x=>x.id===$('#h3FirstFrame').value),last=p.nodes.find(x=>x.id===$('#h3LastFrame').value),prompt=$('#h3Prompt').value.trim();if(!prompt)return toast('请填写视频描述');if(mode==='reference'&&!image)return toast('请选择参考图片');if(mode!=='reference'&&!first&&!last)return toast('请至少选择首帧或尾帧');
    const seconds=Number($('#h3Seconds').value),steps=Number($('#h3Steps').value),ratio=$('#h3Ratio').value,resolution=Number($('#h3Resolution').value);
    n.h3Job={status:'submitting',prompt,seconds,steps,ratio,resolution,mode,firstFrameId:first?.id,lastFrameId:last?.id,imageId:image?.id,created:Date.now()};if(!save()){delete n.h3Job;return}closeModal();render();
    try{
      const body=buildH3Payload({prompt,seconds,steps,ratio,resolution,mode,imageUri:image?.src,firstFrameUri:first?.src,lastFrameUri:last?.src});
      const response=await fetch('/api/h3/videos',{method:'POST',headers:{'X-Toonflow-Client':'1','Content-Type':'application/json'},body:JSON.stringify(body)});
      const result=await response.json().catch(()=>({}));
      if(!response.ok || !result.id){let error=new Error(typeof result.detail==='string'?result.detail:result.error?.message || '未取得任务 ID');error.rejected=response.status>=400&&response.status<500;throw error;}
      n.h3Job.id=String(result.id);n.h3Job.status=result.status||'queued';save();if(current===p)render();h3Poll(p,n);
    }catch(e){n.h3Job.status=e.rejected?'failed':'unknown';n.h3Job.error=String(e.message||e);save();if(current===p)render();toast(e.rejected?'提交被拒绝，请查看任务详情':'提交结果待确认，请先查看网关任务中心');}
  },'提交生成');
  const updateH3Mode=()=>{const frames=$('#h3Mode').value!=='reference';$('#h3ReferenceFields').hidden=frames;$('#h3FrameFields').hidden=!frames};$('#h3Mode').onchange=updateH3Mode;
  if(n.h3Draft){const d=n.h3Draft;if(d.mode)$('#h3Mode').value=d.mode;if(d.imageId)$('#h3Image').value=d.imageId;if(d.firstFrameId)$('#h3FirstFrame').value=d.firstFrameId;if(d.lastFrameId)$('#h3LastFrame').value=d.lastFrameId;updateH3Mode();$('#h3Prompt').value=d.prompt||'';if(d.seconds)$('#h3Seconds').value=String(d.seconds);if(d.steps)$('#h3Steps').value=String(d.steps);if(d.ratio)$('#h3Ratio').value=d.ratio;if(d.resolution)$('#h3Resolution').value=String(d.resolution);}
}
function openH3TaskDialog(p,n){
  const j=n.h3Job;
  const labels={submitting:'提交中',unknown:'提交结果待确认',queued:'排队中',in_progress:'生成中',processing:'生成中',completed:'已完成',failed:'生成失败',cancelled:'已取消'};
  const desc=j.status==='unknown'||j.status==='submitting'?'提交结果不明确，请先在网关任务中心核对；不要重复提交。':j.status==='failed'?'任务失败，可以调整参数后重新配置。':j.status==='completed'?'视频已生成，可在这里播放或下载。':'任务 ID 已保存；此窗口打开时自动查询状态。';
  const video=j.status==='completed'&&j.id?`<video controls preload="metadata" class="h3-result-video" src="/api/h3/videos/${encodeURIComponent(j.id)}/content"></video><p><a href="/api/h3/videos/${encodeURIComponent(j.id)}/content" download="${esc(j.id)}.mp4">下载视频</a></p><div class="frame-actions"><button class="small-btn" id="h3First">提取首帧</button><button class="small-btn" id="h3Last">提取尾帧</button></div>`:'';
  $('#modal').innerHTML=`<div class="overlay"><div class="dialog h3-task-dialog" data-h3-task-dialog="${esc(n.id)}"><h2>H3 视频任务</h2><p>${esc(desc)}</p><div class="h3-task-meta"><strong>${esc(labels[j.status]||j.status)}</strong><span>任务 ID：${esc(j.id||'尚未取得')}</span>${j.error?`<span class="lookup-error">${esc(j.error)}</span>`:''}</div>${video}<p><a href="http://192.168.111.20:30011/" target="_blank" rel="noreferrer">打开 AI 聚合网关 ↗</a></p><div class="dialog-actions"><button class="small-btn" id="h3TaskClose">关闭</button>${j.status==='failed'?'<button class="small-btn primary" id="h3Retry">重新配置</button>':j.id?'<button class="small-btn" id="h3Refresh">刷新状态</button>':''}</div></div></div>`;
  $('#h3TaskClose').onclick=closeModal;
  $('.overlay').onclick=e=>{if(e.target.classList.contains('overlay'))closeModal()};
  if($('#h3Refresh'))$('#h3Refresh').onclick=()=>h3Check(p,n,true);
  if($('#h3First'))$('#h3First').onclick=e=>extractH3Frame(p,n.id,'first',e.currentTarget);
  if($('#h3Last'))$('#h3Last').onclick=e=>extractH3Frame(p,n.id,'last',e.currentTarget);
  if($('#h3Retry'))$('#h3Retry').onclick=()=>{n.h3Draft={prompt:j.prompt,seconds:j.seconds,steps:j.steps,ratio:j.ratio,resolution:j.resolution,mode:j.mode,imageId:j.imageId,firstFrameId:j.firstFrameId,lastFrameId:j.lastFrameId};delete n.h3Job;save();closeModal();render();h3Dialog(n.id)};
  if(j.id&&!['completed','failed','cancelled'].includes(j.status))h3Poll(p,n);
}
async function h3Check(p,n,manual=false){
  if(!n.h3Job?.id)return;
  try{let r=await fetch('/api/h3/videos/'+encodeURIComponent(n.h3Job.id));let j=await r.json();if(!r.ok)throw Error('查询失败');let old=n.h3Job.status;n.h3Job.status=j.status||old;n.h3Job.error=typeof j.error==='string'?j.error:j.error?.message||'';save();if(current===p && view==='canvas'){const status=$('#h3status-'+n.id);if(status)status.textContent=n.h3Job.status+' · '+n.h3Job.id;if(old!==n.h3Job.status&&['completed','failed','cancelled'].includes(n.h3Job.status)){const node=document.querySelector(`[data-node="${n.id}"]`);if(node){node.outerHTML=nodeHTML(n);bindCanvas()}}}if((old!==n.h3Job.status||manual)&&document.querySelector(`[data-h3-task-dialog="${n.id}"]`))openH3TaskDialog(p,n);if(['completed','failed','cancelled'].includes(n.h3Job.status)){clearInterval(h3Timers.get(n.id));h3Timers.delete(n.id)}}catch(e){if(current===p){const status=$('#h3status-'+n.id);if(status)status.textContent='查询暂时失败，任务 ID 已保存：'+n.h3Job.id;if(manual)toast('查询暂时失败，请检查网关连接');}}
}
function h3Poll(p,n){if(!n.h3Job?.id||h3Timers.has(n.id)||['completed','failed','cancelled'].includes(n.h3Job.status))return;let started=Date.now();h3Timers.set(n.id,setInterval(()=>{if(Date.now()-started>60*60*1000){clearInterval(h3Timers.get(n.id));h3Timers.delete(n.id);return}h3Check(p,n)},5000));h3Check(p,n);}
async function extractH3Frame(p,nodeId,which,button){
  const source=p.nodes.find(n=>n.id===nodeId),job=source?.h3Job;if(!job?.id||job.status!=='completed')return toast('视频完成后才能提取画面');
  if(button)button.disabled=true;
  const video=document.createElement('video');video.preload='auto';video.muted=true;
  const wait=(event)=>new Promise((resolve,reject)=>{let timer=setTimeout(()=>{cleanup();reject(Error('视频读取超时'))},20000);function cleanup(){clearTimeout(timer);video.removeEventListener(event,ok);video.removeEventListener('error',bad)}function ok(){cleanup();resolve()}function bad(){cleanup();reject(Error('无法读取视频'))}video.addEventListener(event,ok,{once:true});video.addEventListener('error',bad,{once:true})});
  try{
    const ready=wait('loadeddata');video.src='/api/h3/videos/'+encodeURIComponent(job.id)+'/content';video.load();await ready;
    if(!Number.isFinite(video.duration)||video.duration<=0||!video.videoWidth||!video.videoHeight)throw Error('视频时长或尺寸不可用');
    if(which==='last'){const seek=wait('seeked');video.currentTime=Math.max(0,video.duration-Math.min(.02,video.duration/2));await seek;}
    const canvas=document.createElement('canvas');canvas.width=video.videoWidth;canvas.height=video.videoHeight;const ctx=canvas.getContext('2d');if(!ctx)throw Error('无法创建画面');ctx.drawImage(video,0,0);const src=canvas.toDataURL('image/jpeg',0.9);
    if(!p.nodes.includes(source))throw Error('来源视频节点已被移除');
    const siblings=p.edges.filter(e=>e.from===source.id&&p.nodes.some(x=>x.id===e.to&&x.type==='image')).length,spacing=Math.max(380,Math.ceil(222*video.videoHeight/video.videoWidth)+170);
    const n={id:uid(),type:'image',title:(source.title||'视频')+(which==='first'?' · 首帧':' · 尾帧'),x:source.x+320,y:source.y+siblings*spacing,text:'',src};const edge={from:source.id,to:n.id};p.nodes.push(n);p.edges.push(edge);
    if(!save()){p.nodes.pop();p.edges.pop();return}if(current===p){selected=n.id;view='canvas';render();if($('#h3TaskClose'))closeModal()}toast((which==='first'?'首帧':'尾帧')+'已添加为图片节点');
  }catch(e){toast('提取失败：'+(e.message||'无法读取视频'))}finally{video.removeAttribute('src');video.load();if(button)button.disabled=false}
}
render();
