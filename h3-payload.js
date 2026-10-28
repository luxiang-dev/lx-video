function buildH3Payload({prompt, seconds, steps, ratio, resolution, imageUri, mode='reference', firstFrameUri, lastFrameUri}) {
  if(!['reference','keyframes','hybrid'].includes(mode)) throw Error('不支持的生成模式');
  if(mode === 'reference' && !imageUri) throw Error('请选择参考图片');
  if(mode !== 'reference' && !firstFrameUri && !lastFrameUri) throw Error('请至少选择首帧或尾帧');
  const conditions=mode === 'reference'
    ? [{type:'image', role:'reference', uri:imageUri}]
    : [firstFrameUri && {type:'image', role:'keyframe', frame_index:0, uri:firstFrameUri}, lastFrameUri && {type:'image', role:'keyframe', frame_index:-1, uri:lastFrameUri}, mode==='hybrid' && {type:'image', role:'reference', uri:firstFrameUri||lastFrameUri}].filter(Boolean);
  return {
    prompt, task:mode === 'keyframes' ? 'fl2va' : 'ref2va', num_inference_steps:steps, flow_shift:12,
    audio_flow_shift:3, num_outputs_per_prompt:1,
    target:{short_edge:resolution, aspect_ratio:ratio, duration_seconds:seconds},
    conditions
  };
}
if (typeof module !== 'undefined') module.exports = {buildH3Payload};
