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

  exportBtn?.addEventListener("click", () => dialog?.showModal ? dialog.showModal() : dialog?.setAttribute("open", ""));
  closeBtn?.addEventListener("click", () => dialog?.close?.());

  function stripEditorArtifacts(svg, width, height) {
    const clone = svg.cloneNode(true);
    clone.setAttribute("width", width);
    clone.setAttribute("height", height);
    clone.setAttribute("viewBox", `0 0 ${width} ${height}`);
    clone.setAttribute("preserveAspectRatio", "none");
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    clone.querySelectorAll([
      "[data-denx-node]", ".figure-node-visual", ".figure-node-touch-target",
      ".figure-selection-outline", ".figure-main-handle", ".text-hit-target",
      ".camera-frame", ".camera-frame-handle", ".camera-overlay",
      ".creator-node", ".creator-node-touch", ".bone-node", ".bone-node-touch",
      ".tool-preview", "[data-editor-only='true']"
    ].join(",")).forEach(n => n.remove());
    return clone;
  }

  function svgToImage(svg, width, height) {
    return new Promise((resolve, reject) => {
      const xml = new XMLSerializer().serializeToString(stripEditorArtifacts(svg, width, height));
      const blob = new Blob([xml], {type: "image/svg+xml;charset=utf-8"});
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Could not render SVG export layer.")); };
      img.src = url;
    });
  }

  async function renderStage() {
    const drawing = document.getElementById("drawingCanvas");
    const figures = document.getElementById("figureLayer");
    const texts = document.getElementById("textLayer");
    if (!drawing || !figures || !texts) throw new Error("Workspace renderer is not ready.");
    const width = Number(drawing.width || 2048);
    const height = Number(drawing.height || 1152);
    const stage = document.createElement("canvas");
    stage.width = width;
    stage.height = height;
    const ctx = stage.getContext("2d", {alpha:false});
    const background = document.getElementById("backgroundColorControl")?.value || "#ffffff";
    ctx.fillStyle = background;
    ctx.fillRect(0,0,width,height);
    ctx.drawImage(drawing,0,0,width,height);
    const [figImg, textImg] = await Promise.all([svgToImage(figures,width,height), svgToImage(texts,width,height)]);
    ctx.drawImage(figImg,0,0,width,height);
    ctx.drawImage(textImg,0,0,width,height);
    return {canvas:stage,width,height,background};
  }

  async function renderCameraFrame() {
    window.denxSaveCameraFrameState?.(Number(window.currentFrame || 1));
    const stage = await renderStage();
    const frameNumber = Number(window.currentFrame || 1);
    const camera = window.denxGetCameraFrameState?.(frameNumber) || {x:0,y:0,width:stage.width,height:stage.height,rotation:0};
    const project = window.denxGetActiveProject?.();
    const outWidth = Math.max(1, Number(project?.width) || Math.round(camera.width));
    const outHeight = Math.max(1, Number(project?.height) || Math.round(camera.height));
    const out = document.createElement("canvas");
    out.width = outWidth;
    out.height = outHeight;
    const ctx = out.getContext("2d", {alpha:false});
    ctx.fillStyle = stage.background;
    ctx.fillRect(0,0,outWidth,outHeight);

    const cx = stage.width/2 + Number(camera.x||0);
    const cy = stage.height/2 + Number(camera.y||0);
    const radians = (-Number(camera.rotation||0)*Math.PI)/180;
    const cos = Math.cos(radians), sin = Math.sin(radians);
    const sx = outWidth / Math.max(1, Number(camera.width||stage.width));
    const sy = outHeight / Math.max(1, Number(camera.height||stage.height));
    const a = sx*cos, b = -sy*sin, c = sx*sin, d = sy*cos;
    const e = outWidth/2 - a*cx - c*cy;
    const f = outHeight/2 - b*cx - d*cy;
    ctx.setTransform(a,b,c,d,e,f);
    ctx.drawImage(stage.canvas,0,0);
    ctx.resetTransform();
    return out;
  }

  async function exportCurrentPng() {
    const frame = await renderCameraFrame();
    const blob = await new Promise((resolve,reject) => frame.toBlob(b => b ? resolve(b) : reject(new Error("PNG encoding failed.")), "image/png"));
    const project = window.denxGetActiveProject?.();
    const safe = String(project?.name || "DenX-Frame").replace(/[^a-z0-9_-]+/gi, "-").replace(/^-+|-+$/g, "") || "DenX-Frame";
    const current = Number(window.currentFrame || 1);
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${safe}-frame-${current}.png`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1600);
  }

  window.denxRenderCurrentCameraFrame = renderCameraFrame;

  pngBtn?.addEventListener("click", async () => {
    pngBtn.disabled = true;
    try {
      toast("Rendering camera frame…");
      await exportCurrentPng();
      toast("PNG ready ✓");
      dialog?.close?.();
    } catch (error) {
      console.error("DenX frame export failed:", error);
      toast(error?.message || "Could not export this frame.");
    } finally {
      pngBtn.disabled = false;
    }
  });
})();
