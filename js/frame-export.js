(() => {
  const exportBtn = document.getElementById("workspaceExportBtn");
  const dialog = document.getElementById("denxExportDialog");
  const closeBtn = document.getElementById("closeExportDialogBtn");
  const pngBtn = document.getElementById("exportCurrentPngBtn");

  const showToast = message => {
    const el = document.getElementById("denxToast");
    if (!el) return;
    el.textContent = message;
    el.classList.add("show");
    clearTimeout(el.__denxTimer);
    el.__denxTimer = setTimeout(() => el.classList.remove("show"), 1800);
  };

  exportBtn?.addEventListener("click", () => {
    if (typeof dialog?.showModal === "function") dialog.showModal();
    else dialog?.setAttribute("open", "");
  });
  closeBtn?.addEventListener("click", () => dialog?.close?.());

  function cleanSvgClone(svg, width, height) {
    const clone = svg.cloneNode(true);
    clone.setAttribute("width", width);
    clone.setAttribute("height", height);
    clone.setAttribute("viewBox", `0 0 ${width} ${height}`);
    clone.setAttribute("preserveAspectRatio", "none");
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");

    // DenX artwork and DenX editor controls deliberately live in the same SVG.
    // Strip every known editor-only target before rasterising an export frame.
    clone.querySelectorAll([
      "[data-denx-node]",
      ".figure-node-visual",
      ".figure-node-touch-target",
      ".figure-root-node",
      ".figure-root-touch-target",
      ".figure-normal-node",
      ".figure-normal-touch-target",
      ".creator-node",
      ".creator-node-touch",
      ".bone-node",
      ".bone-node-touch",
      ".bone-handle",
      ".figure-hit-target",
      ".segment-hit-target",
      ".figure-selection-outline",
      ".figure-main-handle",
      ".text-hit-target",
      "[data-editor-only='true']"
    ].join(",")).forEach(node => node.remove());
    return clone;
  }

  function svgToImage(svg, width, height) {
    return new Promise((resolve, reject) => {
      const clone = cleanSvgClone(svg, width, height);
      const xml = new XMLSerializer().serializeToString(clone);
      const blob = new Blob([xml], { type: "image/svg+xml;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const image = new Image();
      image.onload = () => { URL.revokeObjectURL(url); resolve(image); };
      image.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Could not render an SVG layer.")); };
      image.src = url;
    });
  }

  async function renderCleanStage() {
    const drawing = document.getElementById("drawingCanvas");
    const figures = document.getElementById("figureLayer");
    const texts = document.getElementById("textLayer");
    if (!drawing || !figures || !texts) throw new Error("Workspace renderer is not ready.");

    const width = Number(drawing.width || 2048);
    const height = Number(drawing.height || 1152);
    const stage = document.createElement("canvas");
    stage.width = width;
    stage.height = height;
    const ctx = stage.getContext("2d", { alpha: false });
    const background = document.getElementById("backgroundColorControl")?.value || "#ffffff";
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(drawing, 0, 0, width, height);

    const [figureImage, textImage] = await Promise.all([
      svgToImage(figures, width, height),
      svgToImage(texts, width, height)
    ]);
    ctx.drawImage(figureImage, 0, 0, width, height);
    ctx.drawImage(textImage, 0, 0, width, height);
    return { canvas: stage, width, height, background };
  }

  async function renderCameraFrame() {
    window.denxSaveCameraFrameState?.(Number(window.currentFrame || 1));
    const stage = await renderCleanStage();
    const frameNumber = Number(window.currentFrame || 1);
    const cameraState = window.denxGetCameraFrameState?.(frameNumber) || {
      x: 0, y: 0, width: stage.width, height: stage.height, rotation: 0
    };
    const project = window.denxGetActiveProject?.();
    const outWidth = Math.max(1, Number(project?.width) || Math.round(cameraState.width));
    const outHeight = Math.max(1, Number(project?.height) || Math.round(cameraState.height));
    const out = document.createElement("canvas");
    out.width = outWidth;
    out.height = outHeight;
    const ctx = out.getContext("2d", { alpha: false });
    ctx.fillStyle = stage.background;
    ctx.fillRect(0, 0, outWidth, outHeight);

    const cx = stage.width / 2 + Number(cameraState.x || 0);
    const cy = stage.height / 2 + Number(cameraState.y || 0);
    const radians = (-Number(cameraState.rotation || 0) * Math.PI) / 180;
    const cos = Math.cos(radians);
    const sin = Math.sin(radians);
    const sx = outWidth / Math.max(1, Number(cameraState.width || stage.width));
    const sy = outHeight / Math.max(1, Number(cameraState.height || stage.height));

    // Same camera math as DenX's playback monitor, but rendered at project resolution.
    const a = sx * cos;
    const b = -sy * sin;
    const c = sx * sin;
    const d = sy * cos;
    const e = outWidth / 2 - a * cx - c * cy;
    const f = outHeight / 2 - b * cx - d * cy;
    ctx.setTransform(a, b, c, d, e, f);
    ctx.drawImage(stage.canvas, 0, 0);
    ctx.resetTransform();
    return out;
  }

  async function exportCurrentFramePng() {
    const out = await renderCameraFrame();
    const blob = await new Promise((resolve, reject) => {
      out.toBlob(value => value ? resolve(value) : reject(new Error("PNG encoding failed.")), "image/png");
    });
    const project = window.denxGetActiveProject?.();
    const safe = String(project?.name || "DenX-Frame").replace(/[^a-z0-9_-]+/gi, "-").replace(/^-+|-+$/g, "") || "DenX-Frame";
    const frame = Number(window.currentFrame || 1);
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${safe}-frame-${frame}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1500);
  }

  window.denxRenderCurrentCameraFrame = renderCameraFrame;

  pngBtn?.addEventListener("click", async () => {
    pngBtn.disabled = true;
    try {
      showToast("Rendering camera frame…");
      await exportCurrentFramePng();
      showToast("PNG ready ✓");
      dialog?.close?.();
    } catch (error) {
      console.error("DenX frame export failed:", error);
      showToast(error?.message || "Could not export this frame.");
    } finally {
      pngBtn.disabled = false;
    }
  });
})();
