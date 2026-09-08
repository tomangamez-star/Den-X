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

  function svgToImage(svg, width, height) {
    return new Promise((resolve, reject) => {
      const clone = svg.cloneNode(true);
      clone.setAttribute("width", width);
      clone.setAttribute("height", height);
      clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");

      clone.querySelectorAll([
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

      const xml = new XMLSerializer().serializeToString(clone);
      const blob = new Blob([xml], { type: "image/svg+xml;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const image = new Image();
      image.onload = () => {
        URL.revokeObjectURL(url);
        resolve(image);
      };
      image.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("Could not render an SVG layer."));
      };
      image.src = url;
    });
  }

  async function exportCurrentFramePng() {
    const drawing = document.getElementById("drawingCanvas");
    const figures = document.getElementById("figureLayer");
    const texts = document.getElementById("textLayer");
    if (!drawing || !figures || !texts) throw new Error("Workspace renderer is not ready.");

    window.denxClearFigureSelection?.();
    window.denxSelectTextObject?.(null);
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));

    const width = Number(drawing.width || 2048);
    const height = Number(drawing.height || 1152);
    const out = document.createElement("canvas");
    out.width = width;
    out.height = height;
    const ctx = out.getContext("2d", { alpha: false });

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

  pngBtn?.addEventListener("click", async () => {
    pngBtn.disabled = true;
    try {
      showToast("Rendering clean PNG…");
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
