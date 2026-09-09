(() => {
  if (!document.getElementById("workspace")) return;

  const exportDialog = document.getElementById("denxExportDialog");
  if (!exportDialog) return;

  const choice = exportDialog.querySelector(".denx-export-choice");
  if (!choice) return;

  let mp4Button = document.getElementById("exportMp4Btn");
  if (!mp4Button) {
    const candidates = [...choice.querySelectorAll("button")];
    mp4Button = candidates.find(button => /GIF\s*\/\s*MP4/i.test(button.textContent));
    if (mp4Button) {
      mp4Button.id = "exportMp4Btn";
      mp4Button.disabled = false;
    }
  }
  if (!mp4Button) return;

  mp4Button.innerHTML = `
    <strong>Animation · MP4</strong>
    <small>Pre-render clean frames, then encode at the project FPS.</small>
  `;

  const status = document.createElement("div");
  status.className = "denx-video-export-status";
  status.hidden = true;
  mp4Button.after(status);

  const mimeCandidates = [
    "video/mp4;codecs=avc1.42E01E",
    "video/mp4;codecs=avc1",
    "video/mp4"
  ];

  function supportedMp4Mime() {
    if (!window.MediaRecorder || typeof MediaRecorder.isTypeSupported !== "function") return "";
    return mimeCandidates.find(type => MediaRecorder.isTypeSupported(type)) || "";
  }

  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

  function nextPaint() {
    return new Promise(resolve => {
      requestAnimationFrame(() => requestAnimationFrame(resolve));
    });
  }

  async function activateFrame(frameNumber) {
    const button = document.querySelector(`.frame[data-frame="${frameNumber}"]`);
    if (!button) throw new Error(`Frame ${frameNumber} is unavailable.`);
    if (!button.classList.contains("active")) button.click();
    await nextPaint();
    await sleep(12);
  }

  function safeProjectName() {
    const project = window.denxGetActiveProject?.();
    return (
      String(project?.name || "DenX-Animation")
        .replace(/[^a-z0-9_-]+/gi, "-")
        .replace(/^-+|-+$/g, "") || "DenX-Animation"
    );
  }

  async function preRenderFrames(frameCount, originalFrame) {
    const renderedFrames = [];
    try {
      for (let index = 1; index <= frameCount; index++) {
        status.textContent = `Pre-rendering clean frames · ${index} / ${frameCount}`;
        await activateFrame(index);
        const frame = await window.denxRenderCurrentCameraFrame();

        // Snapshot each clean render into its own canvas. This is the key v0.4 fix:
        // expensive DenX rendering happens BEFORE the recorder clock starts.
        const snapshot = document.createElement("canvas");
        snapshot.width = frame.width;
        snapshot.height = frame.height;
        const sctx = snapshot.getContext("2d", { alpha: false });
        if (!sctx) throw new Error("Could not prepare an animation frame.");
        sctx.drawImage(frame, 0, 0);
        renderedFrames.push(snapshot);

        // Yield so Android Chromium does not lock the UI during a long export.
        await sleep(0);
      }
    } finally {
      try { await activateFrame(originalFrame); } catch (_) {}
    }
    return renderedFrames;
  }

  async function encodeFrames(renderedFrames, fps, mimeType) {
    const first = renderedFrames[0];
    const exportCanvas = document.createElement("canvas");
    exportCanvas.width = first.width;
    exportCanvas.height = first.height;

    const ctx = exportCanvas.getContext("2d", { alpha: false, desynchronized: false });
    if (!ctx) throw new Error("Could not create video renderer.");

    const stream = exportCanvas.captureStream ? exportCanvas.captureStream(0) : null;
    if (!stream) throw new Error("Canvas video capture is unavailable in this browser.");

    const videoTrack = stream.getVideoTracks()[0];
    const chunks = [];
    const recorder = new MediaRecorder(stream, {
      mimeType,
      videoBitsPerSecond:
        exportCanvas.width * exportCanvas.height >= 1920 * 1080 ? 12_000_000 : 7_000_000
    });

    const finished = new Promise((resolve, reject) => {
      recorder.addEventListener("dataavailable", event => {
        if (event.data?.size) chunks.push(event.data);
      });
      recorder.addEventListener("stop", resolve);
      recorder.addEventListener("error", event => reject(event.error || new Error("MP4 recorder failed.")));
    });

    // The recorder clock starts only after every clean frame is ready.
    recorder.start();

    const frameDuration = 1000 / fps;
    const startedAt = performance.now();

    try {
      for (let i = 0; i < renderedFrames.length; i++) {
        status.textContent = `Encoding ${fps} FPS MP4 · ${i + 1} / ${renderedFrames.length}`;

        ctx.clearRect(0, 0, exportCanvas.width, exportCanvas.height);
        ctx.drawImage(renderedFrames[i], 0, 0, exportCanvas.width, exportCanvas.height);

        if (videoTrack && typeof videoTrack.requestFrame === "function") {
          videoTrack.requestFrame();
        }

        // Deadline scheduling prevents accumulated setTimeout drift.
        const deadline = startedAt + ((i + 1) * frameDuration);
        const remaining = deadline - performance.now();
        if (remaining > 0) await sleep(remaining);
      }

      // Keep the last frame alive until its exact final deadline.
      const finalDeadline = startedAt + (renderedFrames.length * frameDuration);
      const remaining = finalDeadline - performance.now();
      if (remaining > 0) await sleep(remaining);

      recorder.stop();
      await finished;
    } finally {
      stream.getTracks().forEach(track => track.stop());
    }

    return new Blob(chunks, { type: mimeType });
  }

  async function exportMp4() {
    const mimeType = supportedMp4Mime();
    if (!mimeType) throw new Error("This browser cannot encode MP4 yet. Try the latest Chrome/Android build.");
    if (typeof window.denxRenderCurrentCameraFrame !== "function") {
      throw new Error("DenX clean frame renderer is not ready.");
    }

    window.denxStopPlayback?.();

    const frameButtons = [...document.querySelectorAll(".frame[data-frame]")];
    const frameCount = frameButtons.length;
    if (frameCount < 1) throw new Error("There are no animation frames to export.");

    const originalFrame = Number(document.querySelector(".frame.active")?.dataset?.frame || 1);
    const fps = Math.max(1, Math.min(60, Number(document.getElementById("animationFpsInput")?.value) || 12));

    status.hidden = false;
    status.textContent = `Preparing ${frameCount} frames at ${fps} FPS`;

    const renderedFrames = await preRenderFrames(frameCount, originalFrame);
    if (!renderedFrames.length) throw new Error("No clean frames were rendered.");

    const blob = await encodeFrames(renderedFrames, fps, mimeType);
    renderedFrames.length = 0;

    if (!blob.size) throw new Error("MP4 encoding produced no data.");

    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${safeProjectName()}.mp4`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 3000);

    const duration = frameCount / fps;
    status.textContent =
      `MP4 ready · ${fps} FPS · ${duration.toFixed(2)}s · ${(blob.size / 1024 / 1024).toFixed(1)} MB`;

    setTimeout(() => {
      status.hidden = true;
      exportDialog.close?.();
    }, 1100);
  }

  const mime = supportedMp4Mime();
  if (!mime) {
    const small = mp4Button.querySelector("small");
    if (small) small.textContent = "MP4 needs browser H.264 MediaRecorder support.";
  }

  mp4Button.addEventListener("click", async () => {
    if (mp4Button.disabled) return;
    mp4Button.disabled = true;
    try {
      await exportMp4();
    } catch (error) {
      console.error("DenX MP4 export failed:", error);
      status.hidden = false;
      status.textContent = error?.message || "Could not export MP4.";
    } finally {
      mp4Button.disabled = false;
    }
  });
})();