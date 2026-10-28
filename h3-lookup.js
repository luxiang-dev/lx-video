const h3RenderWithLookup = render;
render = function() {
  h3RenderWithLookup();
  const head = $('.section-head');
  if(head){const button=document.createElement('button');button.className='small-btn';button.textContent='◷  查询视频任务';button.onclick=()=>openH3Lookup();head.insertBefore(button,$('#import'));}
  const toolbar=$('.toolbar');
  if(toolbar){const button=document.createElement('button');button.title='查询 H3 视频任务';button.textContent='◷ 查询任务';button.onclick=()=>openH3Lookup();toolbar.insertBefore(button,$('#exportCurrent'));}
  if(view==='docs'){const bar=$('.bar-group');if(bar){const button=document.createElement('button');button.title='查询 H3 视频任务';button.textContent='◷';button.onclick=()=>openH3Lookup();bar.appendChild(button);}}
};
function openH3Lookup(initialId=''){
  let timer=null, sequence=0, lastId='';
  $('#modal').innerHTML=`<div class="overlay"><div class="dialog lookup-dialog"><h2>查询视频任务</h2><label for="lookupId">H3 任务 ID</label><div class="lookup-row"><input id="lookupId" placeholder="输入完整的任务 ID" value="${esc(initialId)}"><button class="small-btn primary" id="lookupSearch">查询</button></div><p>查询任务状态；任务完成后可预览或下载视频。</p><div id="lookupResult" aria-live="polite"></div><div class="dialog-actions"><button class="small-btn" id="lookupClose">关闭</button></div></div></div>`;
  const close=()=>{clearTimeout(timer);sequence++;closeModal()};
  $('#lookupClose').onclick=close;
  $('.overlay').onclick=e=>{if(e.target.classList.contains('overlay'))close()};
  $('#lookupId').onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();run(true)}};
  $('#lookupSearch').onclick=()=>run(true);
  async function run(manual){
    clearTimeout(timer);
    const id=$('#lookupId')?.value.trim();
    if(!id||!/^[A-Za-z0-9_-]+$/.test(id)){if(manual)toast('请输入有效的任务 ID');return}
    const seq=++sequence;lastId=id;
    if(manual)$('#lookupResult').innerHTML='<div class="lookup-state">正在查询…</div>';
    try{
      const response=await fetch('/api/h3/videos/'+encodeURIComponent(id),{cache:'no-store'});
      const job=await response.json().catch(()=>({}));
      if(seq!==sequence||!$('#lookupResult'))return;
      if(!response.ok)throw Error(typeof job.detail==='string'?job.detail:job.error?.message||`查询失败（HTTP ${response.status}）`);
      const state=job.status||'unknown';
      const labels={queued:'排队中',in_progress:'生成中',processing:'生成中',completed:'已完成',failed:'生成失败',cancelled:'已取消'};
      const error=typeof job.error==='string'?job.error:job.error?.message||'';
      const result=state==='completed'?`<video controls preload="metadata" class="lookup-video" src="/api/h3/videos/${encodeURIComponent(id)}/content"></video><div class="lookup-actions"><a class="small-btn" href="/api/h3/videos/${encodeURIComponent(id)}/content" download="${esc(id)}.mp4">下载视频</a>${current?'<button class="small-btn" id="lookupAdd">添加到画布</button>':''}</div>`:'';
      $('#lookupResult').innerHTML=`<div class="lookup-state"><strong>${esc(labels[state]||state)}</strong><span>任务 ID：${esc(id)}</span>${error?`<span class="lookup-error">${esc(error)}</span>`:''}${!['completed','failed','cancelled'].includes(state)?'<span>每 5 秒自动刷新；也可以手动查询。</span>':''}</div>${result}`;
      if($('#lookupAdd'))$('#lookupAdd').onclick=()=>{const n={id:uid(),type:'generateVideo',title:'H3 视频结果',x:(150-camera.x)/camera.scale+current.nodes.length*24,y:(150-camera.y)/camera.scale+current.nodes.length*24,h3Job:{id,status:'completed'}};current.nodes.push(n);selected=n.id;save();view='canvas';close();render();toast('视频结果已添加到画布')};
      if(!['completed','failed','cancelled'].includes(state))timer=setTimeout(()=>{if($('#lookupId')?.value.trim()===lastId)run(false)},5000);
    }catch(e){if(seq===sequence&&$('#lookupResult'))$('#lookupResult').innerHTML=`<div class="lookup-state lookup-error">${esc(e.message||'查询失败，请检查服务连接。')}</div>`;}
  }
  if(initialId)run(true);else $('#lookupId').focus();
}
render();
