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

  async function exportCurrentPng() {
    const frame = await renderCameraFrame();
    const blob = await new Promise((resolve,reject) =>
      frame.toBlob(result => result ? resolve(result) : reject(new Error("PNG encoding failed.")), "image/png")
    );
    const project = window.denxGetActiveProject?.();
    const safe = String(project?.name || "DenX-Frame")
      .replace(/[^a-z0-9_-]+/gi,"-").replace(/^-+|-+$/g,"") || "DenX-Frame";
    const current = Number(window.denxCurrentFrame?.() || 1);
    const anchor = document.createElement("a");
    anchor.href = URL.createObjectURL(blob);
    anchor.download = `${safe}-frame-${current}.png`;
    document.body.appendChild(anchor);
    anchor.click();
    const href = anchor.href;
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(href),1600);
  }

  window.denxRenderCurrentCameraFrame = renderCameraFrame;
  window.denxDrawExportWatermark = drawDenxWatermark;

  pngBtn?.addEventListener("click", async () => {
    pngBtn.disabled = true;
    try {
      toast("Rendering full-quality watermarked frame…");
      await exportCurrentPng();
      toast("PNG ready ✓");
      dialog?.close?.();
    } catch (error) {
      console.error("DenX frame export failed:",error);
      toast(error?.message || "Could not export this frame.");
    } finally {
      pngBtn.disabled = false;
    }
  });
})();