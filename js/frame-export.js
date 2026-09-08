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
    el.__timer = setTimeout(
      () => el.classList.remove("show"),
      1800
    );
  };

  exportBtn?.addEventListener("click", () => {
    if (dialog?.showModal) dialog.showModal();
    else dialog?.setAttribute("open", "");
  });

  closeBtn?.addEventListener(
    "click",
    () => dialog?.close?.()
  );

  function cleanSvgLayer(svg) {
    const clone = svg.cloneNode(true);

    clone.querySelectorAll([
      "[data-denx-node]",
      ".figure-node-visual",
      ".figure-node-touch-target",
      ".figure-selection-outline",
      ".figure-main-handle",
      ".text-hit-target",
      ".camera-frame",
      ".camera-frame-handle",
      ".camera-overlay",
      ".creator-node",
      ".creator-node-touch",
      ".bone-node",
      ".bone-node-touch",
      ".tool-preview",
      "[data-editor-only='true']"
    ].join(",")).forEach(node => node.remove());

    return clone;
  }

  function transformedSvgToImage(
    sourceSvg,
    stageWidth,
    stageHeight,
    outWidth,
    outHeight,
    matrix
  ) {
    return new Promise((resolve, reject) => {
      const clean = cleanSvgLayer(sourceSvg);
      const children = [...clean.childNodes]
        .map(node => new XMLSerializer().serializeToString(node))
        .join("");

      const { a, b, c, d, e, f } = matrix;

      const xml = `
        <svg xmlns="http://www.w3.org/2000/svg"
             width="${outWidth}" height="${outHeight}"
             viewBox="0 0 ${outWidth} ${outHeight}">
          <g transform="matrix(${a} ${b} ${c} ${d} ${e} ${f})">
            <svg x="0" y="0"
                 width="${stageWidth}" height="${stageHeight}"
                 viewBox="0 0 ${stageWidth} ${stageHeight}"
                 preserveAspectRatio="none"
                 overflow="visible">
              ${children}
            </svg>
          </g>
        </svg>`;

      const blob = new Blob(
        [xml],
        { type: "image/svg+xml;charset=utf-8" }
      );

      const url = URL.createObjectURL(blob);
      const image = new Image();

      image.onload = () => {
        URL.revokeObjectURL(url);
        resolve(image);
      };

      image.onerror = () => {
        URL.revokeObjectURL(url);
        reject(
          new Error("Could not render a vector export layer.")
        );
      };

      image.src = url;
    });
  }

  function cameraMatrix(
    stageWidth,
    stageHeight,
    camera,
    outWidth,
    outHeight
  ) {
    const cx =
      stageWidth / 2 + Number(camera.x || 0);
    const cy =
      stageHeight / 2 + Number(camera.y || 0);

    const radians =
      (-Number(camera.rotation || 0) * Math.PI) / 180;

    const cos = Math.cos(radians);
    const sin = Math.sin(radians);

    const sx =
      outWidth /
      Math.max(1, Number(camera.width || stageWidth));

    const sy =
      outHeight /
      Math.max(1, Number(camera.height || stageHeight));

    const a = sx * cos;
    const b = -sy * sin;
    const c = sx * sin;
    const d = sy * cos;
    const e = outWidth / 2 - a * cx - c * cy;
    const f = outHeight / 2 - b * cx - d * cy;

    return { a, b, c, d, e, f };
  }

  async function renderCameraFrame() {
    const drawing =
      document.getElementById("drawingCanvas");
    const figures =
      document.getElementById("figureLayer");
    const texts =
      document.getElementById("textLayer");

    if (!drawing || !figures || !texts) {
      throw new Error("Workspace renderer is not ready.");
    }

    const stageWidth = Number(drawing.width || 2048);
    const stageHeight = Number(drawing.height || 1152);

    const frameNumber =
      Number(window.denxCurrentFrame?.() || 1);

    window.denxSaveCameraFrameState?.(frameNumber);

    const camera =
      window.denxGetCameraFrameState?.(frameNumber) || {
        x: 0,
        y: 0,
        width: stageWidth,
        height: stageHeight,
        rotation: 0
      };

    const project = window.denxGetActiveProject?.();

    const outWidth =
      Math.max(
        1,
        Number(project?.width) ||
        Math.round(camera.width)
      );

    const outHeight =
      Math.max(
        1,
        Number(project?.height) ||
        Math.round(camera.height)
      );

    const output = document.createElement("canvas");
    output.width = outWidth;
    output.height = outHeight;

    const ctx =
      output.getContext("2d", {
        alpha: false,
        desynchronized: false
      });

    if (!ctx) {
      throw new Error("Could not create export canvas.");
    }

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";

    const background =
      document.getElementById(
        "backgroundColorControl"
      )?.value ||
      window.denxStageBackgroundColor ||
      "#ffffff";

    ctx.fillStyle = background;
    ctx.fillRect(0, 0, outWidth, outHeight);

    const matrix =
      cameraMatrix(
        stageWidth,
        stageHeight,
        camera,
        outWidth,
        outHeight
      );

    // Raster drawing layer: transform the original canvas once, directly
    // into the final output. No low-resolution intermediate camera crop.
    ctx.save();
    ctx.setTransform(
      matrix.a,
      matrix.b,
      matrix.c,
      matrix.d,
      matrix.e,
      matrix.f
    );
    ctx.drawImage(drawing, 0, 0);
    ctx.restore();

    // Vector layers: transform inside SVG and rasterize at FINAL output size.
    // This preserves the clean line quality visible in the DenX editor.
    const [figureImage, textImage] =
      await Promise.all([
        transformedSvgToImage(
          figures,
          stageWidth,
          stageHeight,
          outWidth,
          outHeight,
          matrix
        ),
        transformedSvgToImage(
          texts,
          stageWidth,
          stageHeight,
          outWidth,
          outHeight,
          matrix
        )
      ]);

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(
      figureImage,
      0,
      0,
      outWidth,
      outHeight
    );
    ctx.drawImage(
      textImage,
      0,
      0,
      outWidth,
      outHeight
    );

    return output;
  }

  async function exportCurrentPng() {
    const frame = await renderCameraFrame();

    const blob = await new Promise(
      (resolve, reject) =>
        frame.toBlob(
          result =>
            result
              ? resolve(result)
              : reject(
                  new Error("PNG encoding failed.")
                ),
          "image/png"
        )
    );

    const project = window.denxGetActiveProject?.();

    const safe =
      String(project?.name || "DenX-Frame")
        .replace(/[^a-z0-9_-]+/gi, "-")
        .replace(/^-+|-+$/g, "") ||
      "DenX-Frame";

    const current =
      Number(window.denxCurrentFrame?.() || 1);

    const anchor = document.createElement("a");
    anchor.href = URL.createObjectURL(blob);
    anchor.download = `${safe}-frame-${current}.png`;

    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();

    const href = anchor.href;
    setTimeout(
      () => URL.revokeObjectURL(href),
      1600
    );
  }

  window.denxRenderCurrentCameraFrame =
    renderCameraFrame;

  pngBtn?.addEventListener("click", async () => {
    pngBtn.disabled = true;

    try {
      toast("Rendering full-quality camera frame…");
      await exportCurrentPng();
      toast("PNG ready ✓");
      dialog?.close?.();
    } catch (error) {
      console.error(
        "DenX frame export failed:",
        error
      );
      toast(
        error?.message ||
        "Could not export this frame."
      );
    } finally {
      pngBtn.disabled = false;
    }
  });
})();
