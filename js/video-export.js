(() => {
  if (!document.getElementById("workspace")) return;

  const exportDialog = document.getElementById("denxExportDialog");
  const choice = exportDialog?.querySelector(".denx-export-choice");
  if (!exportDialog || !choice) return;

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
    <small>Choose quality, then render a watermarked DenX video.</small>
  `;

  const note = exportDialog.querySelector(".denx-export-note");

  const studio = document.createElement("div");
  studio.className = "denx-export-screen";
  studio.id = "denxMp4ExportStudio";
  studio.hidden = true;
  studio.innerHTML = `
    <div class="denx-export-screen-head">
      <button class="denx-export-back" type="button" aria-label="Back">‹</button>
      <div><strong>MP4 Export Studio</strong><small>Choose output quality</small></div>
    </div>
    <div class="denx-quality-grid">
      <button class="denx-quality-option" data-height="360" type="button">
        <strong>SD · 360p</strong><small>Fastest · smallest file</small>
      </button>
      <button class="denx-quality-option" data-height="480" type="button">
        <strong>SD+ · 480p</strong><small>Balanced mobile export</small>
      </button>
      <button class="denx-quality-option active" data-height="720" type="button">
        <strong>HD · 720p</strong><small>Recommended</small>
      </button>
      <button class="denx-quality-option" data-height="1080" type="button">
        <strong>FHD · 1080p</strong><small>Highest quality for now</small>
      </button>
    </div>
    <div class="denx-export-meta-card">
      <div class="denx-export-meta-row"><span>Frame rate</span><b id="denxExportFpsMeta">12 FPS</b></div>
      <div class="denx-export-meta-row"><span>Output</span><b id="denxExportSizeMeta">HD · 720p</b></div>
      <div class="denx-export-meta-row"><span>Branding</span><b class="denx-watermark-lock">DENX watermark · ON</b></div>
    </div>
    <button id="denxStartMp4Export" class="denx-export-start" type="button">EXPORT MP4</button>
    <div id="denxVideoExportStatus" class="denx-video-export-status" hidden></div>
  `;
  choice.after(studio);

  const backBtn = studio.querySelector(".denx-export-back");
  const startBtn = studio.querySelector("#denxStartMp4Export");
  const status = studio.querySelector("#denxVideoExportStatus");
  const fpsMeta = studio.querySelector("#denxExportFpsMeta");
  const sizeMeta = studio.querySelector("#denxExportSizeMeta");
  const qualityButtons = [...studio.querySelectorAll(".denx-quality-option")];

  let selectedHeight = 720;

  const labels = {
    360:"SD · 360p",
    480:"SD+ · 480p",
    720:"HD · 720p",
    1080:"FHD · 1080p"
  };

  function projectFps() {
    return Math.max(1, Math.min(60,
      Number(document.getElementById("animationFpsInput")?.value) || 12
    ));
  }

  function showMain() {
    studio.hidden = true;
    choice.hidden = false;
    if (note) note.hidden = false;
  }

  function showStudio() {
    choice.hidden = true;
    if (note) note.hidden = true;
    studio.hidden = false;
    fpsMeta.textContent = `${projectFps()} FPS`;
    sizeMeta.textContent = labels[selectedHeight];
    status.hidden = true;
  }

  window.addEventListener("denx:exportdialogopen", showMain);
  mp4Button.addEventListener("click", event => {
    event.preventDefault();
    if (mp4Button.disabled) return;
    showStudio();
  });

  backBtn.addEventListener("click", showMain);

  qualityButtons.forEach(button => {
    button.addEventListener("click", () => {
      selectedHeight = Number(button.dataset.height) || 720;
      qualityButtons.forEach(item => item.classList.toggle("active", item === button));
      sizeMeta.textContent = labels[selectedHeight];
    });
  });

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
  const nextPaint = () => new Promise(resolve =>
    requestAnimationFrame(() => requestAnimationFrame(resolve))
  );

  async function activateFrame(frameNumber) {
    const button = document.querySelector(`.frame[data-frame="${frameNumber}"]`);
    if (!button) throw new Error(`Frame ${frameNumber} is unavailable.`);
    if (!button.classList.contains("active")) button.click();
    await nextPaint();
    await sleep(12);
  }

  function safeProjectName() {
    const project = window.denxGetActiveProject?.();
    return String(project?.name || "DenX-Animation")
      .replace(/[^a-z0-9_-]+/gi,"-").replace(/^-+|-+$/g,"") || "DenX-Animation";
  }

  async function preRenderFrames(frameCount, originalFrame, targetHeight) {
    const renderedFrames = [];
    try {
      for (let index=1; index<=frameCount; index++) {
        status.textContent = `Rendering ${labels[targetHeight]} · ${index} / ${frameCount}`;
        await activateFrame(index);
        const frame = await window.denxRenderCurrentCameraFrame({ targetHeight });
        const snapshot = document.createElement("canvas");
        snapshot.width = frame.width;
        snapshot.height = frame.height;
        const sctx = snapshot.getContext("2d",{alpha:false});
        if (!sctx) throw new Error("Could not prepare an animation frame.");
        sctx.drawImage(frame,0,0);
        renderedFrames.push(snapshot);
        await sleep(0);
      }
    } finally {
      try { await activateFrame(originalFrame); } catch (_) {}
    }
    return renderedFrames;
  }

  function bitrateFor(width,height) {
    const pixels = width*height;
    if (pixels >= 1920*1080) return 12_000_000;
    if (pixels >= 1280*720) return 7_000_000;
    if (pixels >= 854*480) return 4_000_000;
    return 2_500_000;
  }

  async function encodeFrames(renderedFrames,fps,mimeType) {
    const first = renderedFrames[0];
    const exportCanvas = document.createElement("canvas");
    exportCanvas.width = first.width;
    exportCanvas.height = first.height;
    const ctx = exportCanvas.getContext("2d",{alpha:false,desynchronized:false});
    if (!ctx) throw new Error("Could not create video renderer.");

    const stream = exportCanvas.captureStream ? exportCanvas.captureStream(0) : null;
    if (!stream) throw new Error("Canvas video capture is unavailable in this browser.");

    const videoTrack = stream.getVideoTracks()[0];
    const chunks = [];
    const recorder = new MediaRecorder(stream,{
      mimeType,
      videoBitsPerSecond: bitrateFor(exportCanvas.width,exportCanvas.height)
    });

    const finished = new Promise((resolve,reject) => {
      recorder.addEventListener("dataavailable",e => { if (e.data?.size) chunks.push(e.data); });
      recorder.addEventListener("stop",resolve);
      recorder.addEventListener("error",e => reject(e.error || new Error("MP4 recorder failed.")));
    });

    recorder.start();
    const frameDuration = 1000/fps;
    const startedAt = performance.now();

    try {
      for (let i=0;i<renderedFrames.length;i++) {
        status.textContent = `Encoding ${labels[selectedHeight]} · ${fps} FPS · ${i+1} / ${renderedFrames.length}`;
        ctx.clearRect(0,0,exportCanvas.width,exportCanvas.height);
        ctx.drawImage(renderedFrames[i],0,0,exportCanvas.width,exportCanvas.height);
        if (videoTrack && typeof videoTrack.requestFrame === "function") videoTrack.requestFrame();

        const deadline = startedAt + ((i+1)*frameDuration);
        const remaining = deadline - performance.now();
        if (remaining > 0) await sleep(remaining);
      }

      const finalDeadline = startedAt + (renderedFrames.length*frameDuration);
      const remaining = finalDeadline - performance.now();
      if (remaining > 0) await sleep(remaining);
      recorder.stop();
      await finished;
    } finally {
      stream.getTracks().forEach(track => track.stop());
    }

    return new Blob(chunks,{type:mimeType});
  }

  async function exportMp4() {
    const mimeType = supportedMp4Mime();
    if (!mimeType) throw new Error("This browser cannot encode MP4 yet.");
    if (typeof window.denxRenderCurrentCameraFrame !== "function") {
      throw new Error("DenX clean frame renderer is not ready.");
    }

    window.denxStopPlayback?.();

    const frameButtons = [...document.querySelectorAll(".frame[data-frame]")];
    const frameCount = frameButtons.length;
    if (!frameCount) throw new Error("There are no animation frames to export.");

    const originalFrame = Number(document.querySelector(".frame.active")?.dataset?.frame || 1);
    const fps = projectFps();

    status.hidden = false;
    status.textContent = `Preparing ${frameCount} frames · ${labels[selectedHeight]}`;

    const renderedFrames = await preRenderFrames(frameCount,originalFrame,selectedHeight);
    if (!renderedFrames.length) throw new Error("No clean frames were rendered.");

    const blob = await encodeFrames(renderedFrames,fps,mimeType);
    const outW = renderedFrames[0]?.width || 0;
    const outH = renderedFrames[0]?.height || selectedHeight;
    renderedFrames.length = 0;

    if (!blob.size) throw new Error("MP4 encoding produced no data.");

    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${safeProjectName()}-${outH}p.mp4`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url),3000);

    const duration = frameCount/fps;
    status.textContent =
      `MP4 ready · ${outW}×${outH} · ${fps} FPS · ${duration.toFixed(2)}s · ${(blob.size/1024/1024).toFixed(1)} MB`;
  }

  const mime = supportedMp4Mime();
  if (!mime) {
    const small = mp4Button.querySelector("small");
    if (small) small.textContent = "MP4 needs browser H.264 MediaRecorder support.";
  }

  startBtn.addEventListener("click", async () => {
    startBtn.disabled = true;
    qualityButtons.forEach(button => button.disabled = true);
    try {
      await exportMp4();
    } catch (error) {
      console.error("DenX MP4 export failed:",error);
      status.hidden = false;
      status.textContent = error?.message || "Could not export MP4.";
    } finally {
      startBtn.disabled = false;
      qualityButtons.forEach(button => button.disabled = false);
    }
  });
})();