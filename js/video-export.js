// DenX v0.6 MP4 export — Android MediaCodec first, browser fallback second.
(() => {
  "use strict";
  if(!document.getElementById("workspace"))return;
  const dialog=document.getElementById("denxExportDialog"),choice=dialog?.querySelector(".denx-export-choice"),note=dialog?.querySelector(".denx-export-note");
  if(!dialog||!choice)return;
  let launch=document.getElementById("exportMp4Btn")||[...choice.querySelectorAll("button")].find(b=>/GIF\s*\/\s*MP4|Animation\s*·\s*MP4/i.test(b.textContent));
  if(!launch)return;launch.id="exportMp4Btn";launch.disabled=false;launch.innerHTML="<strong>Animation · MP4</strong><small>Native H.264 video with progress and cancellation.</small>";
  const studio=document.createElement("div");studio.className="denx-export-screen";studio.hidden=true;studio.innerHTML=`
    <div class="denx-export-screen-head"><button class="denx-export-back" type="button">‹</button><div><strong>MP4 Export Studio</strong><small>Choose output quality</small></div></div>
    <div class="denx-quality-grid">
      <button class="denx-quality-option" data-height="360"><strong>SD · 360p</strong><small>Fastest · smallest file</small></button>
      <button class="denx-quality-option" data-height="480"><strong>SD+ · 480p</strong><small>Balanced mobile export</small></button>
      <button class="denx-quality-option active" data-height="720"><strong>HD · 720p</strong><small>Recommended</small></button>
      <button class="denx-quality-option" data-height="1080"><strong>FHD · 1080p</strong><small>Highest quality</small></button>
    </div>
    <div class="denx-export-meta-card"><div class="denx-export-meta-row"><span>Frame rate</span><b class="fps">24 FPS</b></div><div class="denx-export-meta-row"><span>Output</span><b class="size">HD · 720p</b></div><div class="denx-export-meta-row"><span>Encoder</span><b class="encoder">Android H.264</b></div><div class="denx-export-meta-row"><span>Branding</span><b class="denx-watermark-lock">DENX watermark · ON</b></div></div>
    <button class="denx-export-start" type="button">EXPORT MP4</button>
    <button class="denx-export-cancel" type="button" hidden>CANCEL EXPORT</button>
    <button class="denx-export-share" type="button" hidden>SHARE LAST EXPORT</button>
    <div class="denx-video-export-status" hidden></div>`;
  choice.after(studio);
  const back=studio.querySelector(".denx-export-back"),start=studio.querySelector(".denx-export-start"),cancel=studio.querySelector(".denx-export-cancel"),share=studio.querySelector(".denx-export-share"),status=studio.querySelector(".denx-video-export-status"),quality=[...studio.querySelectorAll(".denx-quality-option")],fpsEl=studio.querySelector(".fps"),sizeEl=studio.querySelector(".size"),encoderEl=studio.querySelector(".encoder");
  const labels={360:"SD · 360p",480:"SD+ · 480p",720:"HD · 720p",1080:"FHD · 1080p"};
  let height=720,operation=null;
  const fps=()=>Math.max(1,Math.min(60,Number(document.getElementById("animationFpsInput")?.value)||24));
  const frameCount=()=>Math.max(1,Number(window.denxFrameCount?.()||document.querySelectorAll(".frame[data-frame]").length));
  const nextPaint=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
  const safeName=()=>String(window.denxGetActiveProject?.()?.name||"DenX-Animation").replace(/[^a-z0-9_-]+/gi,"-").replace(/^-+|-+$/g,"")||"DenX-Animation";
  const bitrate=(w,h)=>w*h>=1920*1080?12_000_000:w*h>=1280*720?7_000_000:w*h>=854*480?4_000_000:2_500_000;
  async function activateFrame(n){window.denxSelectFrame?.(n);await nextPaint();await new Promise(r=>setTimeout(r,8));}
  function dimensions(){const p=window.denxGetActiveProject?.()||{},ratio=(Number(p.width)||16)/(Number(p.height)||9);let h=height,w=Math.max(2,Math.round(h*ratio/2)*2);if(h%2)h++;return{width:w,height:h};}
  function reset(){operation=null;start.disabled=false;cancel.hidden=true;quality.forEach(b=>b.disabled=false);}
  function showMain(){if(operation){operation.cancelled=true;window.denxNativeVideoEncoder?.cancel(operation.sessionId).catch(()=>{});}studio.hidden=true;choice.hidden=false;if(note)note.hidden=false;status.hidden=true;share.hidden=true;reset();}
  function showStudio(){choice.hidden=true;if(note)note.hidden=true;studio.hidden=false;fpsEl.textContent=`${fps()} FPS`;sizeEl.textContent=labels[height];encoderEl.textContent=window.denxNativeVideoEncoder?.available?"Android H.264":"Browser H.264";status.hidden=true;share.hidden=true;reset();}
  window.addEventListener("denx:exportdialogopen",showMain);launch.addEventListener("click",event=>{event.preventDefault();showStudio();});back.addEventListener("click",showMain);
  dialog.addEventListener("close",showMain);
  quality.forEach(button=>button.addEventListener("click",()=>{height=Number(button.dataset.height)||720;quality.forEach(x=>x.classList.toggle("active",x===button));sizeEl.textContent=labels[height];}));

  async function exportNative(op){const total=frameCount(),original=Number(window.denxCurrentFrame?.()||1),dims=dimensions(),fileName=`${safeName()}-${height}p.mp4`;status.textContent=`Choose where to save ${fileName}`;const begun=await window.denxNativeVideoEncoder.begin({fileName,width:dims.width,height:dims.height,fps:fps(),bitrate:bitrate(dims.width,dims.height)});op.sessionId=begun?.sessionId;if(!op.sessionId)throw new Error("Android did not open an MP4 session.");try{for(let n=1;n<=total;n++){if(op.cancelled)throw new DOMException("Export cancelled","AbortError");status.textContent=`Rendering and encoding frame ${n} / ${total}`;await activateFrame(n);const canvas=await window.denxRenderCurrentCameraFrame({targetHeight:height});await window.denxNativeVideoEncoder.append(op.sessionId,canvas);}if(op.cancelled)throw new DOMException("Export cancelled","AbortError");status.textContent="Finalizing MP4…";const result=await window.denxNativeVideoEncoder.finish(op.sessionId);op.sessionId=null;status.textContent=`Saved ${fileName} · ${dims.width}×${dims.height} · ${fps()} FPS`;share.hidden=false;return result;}finally{try{await activateFrame(original);}catch(_){}}}

  const candidates=["video/mp4;codecs=avc1.42E01E","video/mp4;codecs=avc1","video/mp4"];
  function browserMime(){return window.MediaRecorder?.isTypeSupported?candidates.find(x=>MediaRecorder.isTypeSupported(x))||"":"";}
  async function exportBrowser(op){const mime=browserMime();if(!mime)throw new Error("MP4 export is available in the DenX Android app on this device.");const total=frameCount(),original=Number(window.denxCurrentFrame?.()||1),first=await window.denxRenderCurrentCameraFrame({targetHeight:height}),out=document.createElement("canvas");out.width=first.width;out.height=first.height;const ctx=out.getContext("2d",{alpha:false}),stream=out.captureStream(0),track=stream.getVideoTracks()[0],chunks=[],rec=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:bitrate(out.width,out.height)});const done=new Promise((resolve,reject)=>{rec.ondataavailable=e=>{if(e.data?.size)chunks.push(e.data);};rec.onstop=resolve;rec.onerror=e=>reject(e.error||new Error("Browser MP4 encoder failed."));});rec.start();try{for(let n=1;n<=total;n++){if(op.cancelled)throw new DOMException("Export cancelled","AbortError");status.textContent=`Encoding frame ${n} / ${total}`;await activateFrame(n);ctx.drawImage(await window.denxRenderCurrentCameraFrame({targetHeight:height}),0,0);track?.requestFrame?.();await new Promise(r=>setTimeout(r,1000/fps()));}rec.stop();await done;if(!chunks.some(x=>x.size))throw new Error("The browser encoder produced no video. Use the DenX Android app.");const blob=new Blob(chunks,{type:mime}),fileName=`${safeName()}-${height}p.mp4`;await window.denxSaveExportBlob(blob,fileName,"video/mp4");status.textContent=`Saved ${fileName}`;}finally{stream.getTracks().forEach(x=>x.stop());try{await activateFrame(original);}catch(_){}}}

  cancel.addEventListener("click",async()=>{if(!operation)return;operation.cancelled=true;cancel.disabled=true;status.textContent="Cancelling export…";try{if(operation.sessionId)await window.denxNativeVideoEncoder?.cancel(operation.sessionId);}catch(_){}finally{operation.sessionId=null;cancel.disabled=false;}});
  share.addEventListener("click",async()=>{share.disabled=true;try{await window.denxShareLastExport?.();}catch(error){status.textContent=error?.message||"Could not share this video.";}finally{share.disabled=false;}});
  start.addEventListener("click",async()=>{if(typeof window.denxRenderCurrentCameraFrame!=="function"){status.hidden=false;status.textContent="Clean frame renderer is not ready.";return;}window.denxStopPlayback?.();operation={cancelled:false,sessionId:null};start.disabled=true;cancel.hidden=false;share.hidden=true;quality.forEach(b=>b.disabled=true);status.hidden=false;try{if(window.denxNativeVideoEncoder?.available)await exportNative(operation);else await exportBrowser(operation);}catch(error){if(error?.name==="AbortError"||operation?.cancelled)status.textContent="Export cancelled.";else{console.error("DenX MP4 export failed",error);status.textContent=error?.message||"MP4 export failed.";}}finally{reset();}});
})();
