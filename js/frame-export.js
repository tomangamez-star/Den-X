(() => {
  const exportBtn = document.getElementById("workspaceExportBtn");
  const dialog = document.getElementById("denxExportDialog");
  const closeBtn = document.getElementById("closeExportDialogBtn");
  const pngBtn = document.getElementById("exportCurrentPngBtn");

  const toast = message => {
    const el = document.getElementById("denxToast");
    if (!el) return;
    el.textContent = message;
    el.classList.add("show");
    clearTimeout(el.__timer);
    el.__timer = setTimeout(() => el.classList.remove("show"), 1800);
  };

  exportBtn?.addEventListener("click", () => {
    window.dispatchEvent(new CustomEvent("denx:exportdialogopen"));
    if (dialog?.showModal) dialog.showModal();
    else dialog?.setAttribute("open", "");
  });

  closeBtn?.addEventListener("click", () => dialog?.close?.());

  function cleanSvgLayer(svg) {
    const clone = svg.cloneNode(true);
    clone.querySelectorAll([
      "[data-denx-node]", ".figure-node-visual", ".figure-node-touch-target",
      ".figure-selection-outline", ".figure-main-handle", ".text-hit-target",
      ".camera-frame", ".camera-frame-handle", ".camera-overlay",
      ".creator-node", ".creator-node-touch", ".bone-node", ".bone-node-touch",
      ".tool-preview", "[data-editor-only='true']", ".denx-active-chain-guide"
    ].join(",")).forEach(node => node.remove());
    return clone;
  }

  function transformedSvgToImage(sourceSvg, stageWidth, stageHeight, outWidth, outHeight, matrix) {
    return new Promise((resolve, reject) => {
      const clean = cleanSvgLayer(sourceSvg);
      const children = [...clean.childNodes]
        .map(node => new XMLSerializer().serializeToString(node)).join("");
      const { a,b,c,d,e,f } = matrix;
      const xml = `<svg xmlns="http://www.w3.org/2000/svg" width="${outWidth}" height="${outHeight}" viewBox="0 0 ${outWidth} ${outHeight}">
        <g transform="matrix(${a} ${b} ${c} ${d} ${e} ${f})">
          <svg x="0" y="0" width="${stageWidth}" height="${stageHeight}" viewBox="0 0 ${stageWidth} ${stageHeight}" preserveAspectRatio="none" overflow="visible">${children}</svg>
        </g></svg>`;
      const blob = new Blob([xml], { type:"image/svg+xml;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const image = new Image();
      image.onload = () => { URL.revokeObjectURL(url); resolve(image); };
      image.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Could not render a vector export layer.")); };
      image.src = url;
    });
  }

  function cameraMatrix(stageWidth, stageHeight, camera, outWidth, outHeight) {
    const cx = stageWidth / 2 + Number(camera.x || 0);
    const cy = stageHeight / 2 + Number(camera.y || 0);
    const radians = (-Number(camera.rotation || 0) * Math.PI) / 180;
    const cos = Math.cos(radians), sin = Math.sin(radians);
    const sx = outWidth / Math.max(1, Number(camera.width || stageWidth));
    const sy = outHeight / Math.max(1, Number(camera.height || stageHeight));
    const a = sx*cos, b = -sy*sin, c = sx*sin, d = sy*cos;
    return {
      a,b,c,d,
      e: outWidth/2 - a*cx - c*cy,
      f: outHeight/2 - b*cx - d*cy
    };
  }

  function drawDenxWatermark(ctx, width, height) {
    const scale = Math.max(0.65, Math.min(1.7, width / 1280));
    const pad = Math.round(18 * scale);
    const fontSize = Math.max(12, Math.round(18 * scale));
    const label = "DENX ANIMATOR";

    ctx.save();
    ctx.font = `900 ${fontSize}px Arial, sans-serif`;
    ctx.textBaseline = "middle";
    const tw = ctx.measureText(label).width;
    const chipH = Math.round(fontSize * 1.85);
    const chipW = Math.round(tw + pad * 1.75);
    const x = width - chipW - pad;
    const y = height - chipH - pad;

    ctx.globalAlpha = 0.62;
    ctx.fillStyle = "#07090a";
    ctx.fillRect(x, y, chipW, chipH);

    ctx.globalAlpha = 0.92;
    ctx.fillStyle = "#00c8ff";
    ctx.fillRect(x, y, Math.max(3, Math.round(4 * scale)), chipH);

    ctx.fillStyle = "#ffffff";
    ctx.fillText(label, x + pad, y + chipH/2);
    ctx.restore();
  }

  async function renderCameraFrame(options = {}) {
    const drawing = document.getElementById("drawingCanvas");
    const figures = document.getElementById("figureLayer");
    const texts = document.getElementById("textLayer");
    if (!drawing || !figures || !texts) throw new Error("Workspace renderer is not ready.");

    const stageWidth = Number(drawing.width || 2048);
    const stageHeight = Number(drawing.height || 1152);
    const frameNumber = Number(window.denxCurrentFrame?.() || 1);
    window.denxSaveCameraFrameState?.(frameNumber);
    const camera = window.denxGetCameraFrameState?.(frameNumber) || {
      x:0,y:0,width:stageWidth,height:stageHeight,rotation:0
    };
    const project = window.denxGetActiveProject?.();

    let outWidth = Math.max(1, Number(project?.width) || Math.round(camera.width));
    let outHeight = Math.max(1, Number(project?.height) || Math.round(camera.height));

    if (Number(options.targetHeight) > 0) {
      const ratio = outWidth / Math.max(1, outHeight);
      outHeight = Math.round(Number(options.targetHeight));
      outWidth = Math.max(2, Math.round((outHeight * ratio) / 2) * 2);
      if (outHeight % 2) outHeight += 1;
    }

    const output = document.createElement("canvas");
    output.width = outWidth; output.height = outHeight;
    const ctx = output.getContext("2d", {alpha:false,desynchronized:false});
    if (!ctx) throw new Error("Could not create export canvas.");
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";

    const background = document.getElementById("backgroundColorControl")?.value ||
      window.denxStageBackgroundColor || "#ffffff";
    ctx.fillStyle = background;
    ctx.fillRect(0,0,outWidth,outHeight);

    const matrix = cameraMatrix(stageWidth, stageHeight, camera, outWidth, outHeight);
    ctx.save();
    ctx.setTransform(matrix.a,matrix.b,matrix.c,matrix.d,matrix.e,matrix.f);
    ctx.drawImage(drawing,0,0);
    ctx.restore();

    const [figureImage,textImage] = await Promise.all([
      transformedSvgToImage(figures,stageWidth,stageHeight,outWidth,outHeight,matrix),
      transformedSvgToImage(texts,stageWidth,stageHeight,outWidth,outHeight,matrix)
    ]);

    ctx.setTransform(1,0,0,1,0,0);
    ctx.drawImage(figureImage,0,0,outWidth,outHeight);
    ctx.drawImage(textImage,0,0,outWidth,outHeight);

    // v0.4.4 rule: every DenX export is branded.
    drawDenxWatermark(ctx,outWidth,outHeight);
    return output;
  }

  window.denxRenderCurrentCameraFrame = renderCameraFrame;
  window.denxDrawExportWatermark = drawDenxWatermark;

  const choice = dialog?.querySelector(".denx-export-choice");
  const note = dialog?.querySelector(".denx-export-note");
  const studio = document.createElement("div");
  studio.className = "denx-export-screen denx-png-studio";
  studio.hidden = true;
  studio.innerHTML = `
    <div class="denx-export-screen-head"><button class="denx-export-back" type="button">‹</button><div><strong>PNG Export Studio</strong><small>Choose which frames to save</small></div></div>
    <div class="denx-png-modes">
      <button type="button" data-mode="current"><strong>Current frame</strong><small>Only the frame on screen</small></button>
      <button type="button" data-mode="selected"><strong>Selected frames</strong><small>Tick individual frames below</small></button>
      <button type="button" data-mode="range"><strong>Frame range</strong><small>Choose a start and end</small></button>
      <button type="button" data-mode="all"><strong>All frames</strong><small>Complete PNG sequence ZIP</small></button>
    </div>
    <div class="denx-png-selection" hidden></div>
    <div class="denx-png-range" hidden><label>From <input type="number" min="1" value="1"></label><label>To <input type="number" min="1" value="1"></label></div>
    <button class="denx-export-start" type="button">EXPORT PNG</button>
    <button class="denx-export-cancel" type="button" hidden>CANCEL EXPORT</button>
    <div class="denx-video-export-status" hidden></div>`;
  choice?.after(studio);
  const modeButtons=[...studio.querySelectorAll("[data-mode]")], selection=studio.querySelector(".denx-png-selection"), range=studio.querySelector(".denx-png-range"), start=studio.querySelector(".denx-export-start"), cancel=studio.querySelector(".denx-export-cancel"), status=studio.querySelector(".denx-video-export-status");
  let mode="current", cancelled=false;
  const safeName=()=>String(window.denxGetActiveProject?.()?.name||"DenX-Animation").replace(/[^a-z0-9_-]+/gi,"-").replace(/^-+|-+$/g,"")||"DenX-Animation";
  const count=()=>Math.max(1,Number(window.denxFrameCount?.()||document.querySelectorAll(".frame[data-frame]").length));
  const nextPaint=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
  async function activateFrame(n){window.denxSelectFrame?.(n);await nextPaint();}
  const canvasBlob=canvas=>new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error("PNG encoding failed.")),"image/png"));
  function set32(view,at,value){view.setUint32(at,value,true);} function set16(view,at,value){view.setUint16(at,value,true);}
  const crcTable=(()=>{const table=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=(c&1)?0xedb88320^(c>>>1):c>>>1;table[n]=c>>>0;}return table;})();
  function crc32(bytes){let crc=0xffffffff;for(const b of bytes)crc=crcTable[(crc^b)&255]^(crc>>>8);return(crc^0xffffffff)>>>0;}
  async function makeZip(entries){const encoder=new TextEncoder(),parts=[],central=[];let offset=0;for(const entry of entries){const name=encoder.encode(entry.name),data=new Uint8Array(await entry.blob.arrayBuffer()),crc=crc32(data),local=new Uint8Array(30+name.length),v=new DataView(local.buffer);set32(v,0,0x04034b50);set16(v,4,20);set16(v,6,0x0800);set16(v,8,0);set32(v,14,crc);set32(v,18,data.length);set32(v,22,data.length);set16(v,26,name.length);local.set(name,30);parts.push(local,data);const c=new Uint8Array(46+name.length),cv=new DataView(c.buffer);set32(cv,0,0x02014b50);set16(cv,4,20);set16(cv,6,20);set16(cv,8,0x0800);set16(cv,10,0);set32(cv,16,crc);set32(cv,20,data.length);set32(cv,24,data.length);set16(cv,28,name.length);set32(cv,42,offset);c.set(name,46);central.push(c);offset+=local.length+data.length;}const centralSize=central.reduce((sum,p)=>sum+p.length,0),end=new Uint8Array(22),ev=new DataView(end.buffer);set32(ev,0,0x06054b50);set16(ev,8,entries.length);set16(ev,10,entries.length);set32(ev,12,centralSize);set32(ev,16,offset);return new Blob([...parts,...central,end],{type:"application/zip"});}
  async function saveBlob(blob,fileName,mime){if(window.denxSaveExportBlob)return window.denxSaveExportBlob(blob,fileName,mime);const url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=fileName;a.click();setTimeout(()=>URL.revokeObjectURL(url),3000);}
  function rebuildSelection(){selection.replaceChildren();for(let n=1;n<=count();n++){const label=document.createElement("label");label.innerHTML=`<input type="checkbox" value="${n}"><span>${n}</span>`;selection.appendChild(label);}const inputs=range.querySelectorAll("input");inputs[0].max=inputs[1].max=String(count());inputs[1].value=String(count());}
  function selectMode(next){mode=next;modeButtons.forEach(b=>b.classList.toggle("active",b.dataset.mode===mode));selection.hidden=mode!=="selected";range.hidden=mode!=="range";start.textContent=mode==="current"?"EXPORT PNG":"EXPORT PNG SEQUENCE";}
  function showMain(){cancelled=true;studio.hidden=true;if(choice)choice.hidden=false;if(note)note.hidden=false;status.hidden=true;cancel.hidden=true;start.disabled=false;}
  function showStudio(){cancelled=false;if(choice)choice.hidden=true;if(note)note.hidden=true;studio.hidden=false;rebuildSelection();selectMode("current");status.hidden=true;}
  modeButtons.forEach(button=>button.addEventListener("click",()=>selectMode(button.dataset.mode)));
  studio.querySelector(".denx-export-back")?.addEventListener("click",showMain);
  pngBtn?.addEventListener("click",event=>{event.preventDefault();showStudio();});
  cancel.addEventListener("click",()=>{cancelled=true;status.textContent="Cancelling…";});
  window.addEventListener("denx:exportdialogopen",showMain);
  dialog?.addEventListener("close",()=>{cancelled=true;showMain();});
  start.addEventListener("click",async()=>{const original=Number(window.denxCurrentFrame?.()||1);let frames=[];if(mode==="current")frames=[original];if(mode==="all")frames=Array.from({length:count()},(_,i)=>i+1);if(mode==="selected")frames=[...selection.querySelectorAll("input:checked")].map(x=>Number(x.value));if(mode==="range"){const [a,b]=[...range.querySelectorAll("input")].map(x=>Number(x.value));const lo=Math.max(1,Math.min(a,b)),hi=Math.min(count(),Math.max(a,b));frames=Array.from({length:hi-lo+1},(_,i)=>lo+i);}if(!frames.length){status.hidden=false;status.textContent="Choose at least one frame.";return;}start.disabled=true;cancel.hidden=false;status.hidden=false;cancelled=false;const entries=[];try{for(let i=0;i<frames.length;i++){if(cancelled)throw new DOMException("Export cancelled","AbortError");status.textContent=`Rendering frame ${i+1} / ${frames.length}`;await activateFrame(frames[i]);entries.push({name:`frame-${String(frames[i]).padStart(4,"0")}.png`,blob:await canvasBlob(await renderCameraFrame())});}if(cancelled)throw new DOMException("Export cancelled","AbortError");let blob,fileName,mime;if(entries.length===1){blob=entries[0].blob;fileName=`${safeName()}-${entries[0].name}`;mime="image/png";}else{status.textContent=`Packing ${entries.length} PNG files…`;blob=await makeZip(entries);fileName=`${safeName()}-PNG-frames.zip`;mime="application/zip";}status.textContent=`Choose where to save ${fileName}`;await saveBlob(blob,fileName,mime);toast(`Saved ${fileName} ✓`);dialog?.close?.();showMain();}catch(error){if(error?.name==="AbortError")status.textContent="Export cancelled.";else{console.error(error);status.textContent=error?.message||"PNG export failed.";}}finally{try{await activateFrame(original);}catch(_){}start.disabled=false;cancel.hidden=true;}});
})();
