
(() => {
  if (!document.getElementById("workspace")) return;

  const exportDialog =
    document.getElementById("denxExportDialog");

  if (!exportDialog) return;

  const choice =
    exportDialog.querySelector(".denx-export-choice");

  if (!choice) return;

  let mp4Button =
    document.getElementById("exportMp4Btn");

  if (!mp4Button) {
    const candidates =
      [...choice.querySelectorAll("button")];

    mp4Button =
      candidates.find(button =>
        /GIF\s*\/\s*MP4/i.test(button.textContent)
      );

    if (mp4Button) {
      mp4Button.id = "exportMp4Btn";
      mp4Button.disabled = false;
      mp4Button.innerHTML = `
        <strong>Animation · MP4</strong>
        <small>Render every frame through the clean DenX camera.</small>
      `;
    }
  }

  if (!mp4Button) return;

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
    if (
      !window.MediaRecorder ||
      typeof MediaRecorder.isTypeSupported !== "function"
    ) {
      return "";
    }

    return mimeCandidates.find(type =>
      MediaRecorder.isTypeSupported(type)
    ) || "";
  }

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  function nextPaint() {
    return new Promise(resolve => {
      requestAnimationFrame(() => {
        requestAnimationFrame(resolve);
      });
    });
  }

  async function activateFrame(frameNumber) {
    const button =
      document.querySelector(
        `.frame[data-frame="${frameNumber}"]`
      );

    if (!button) {
      throw new Error(`Frame ${frameNumber} is unavailable.`);
    }

    if (!button.classList.contains("active")) {
      button.click();
    }

    // Frame selection restores raster + figures + text asynchronously.
    await nextPaint();
    await sleep(18);
  }

  function safeProjectName() {
    const project = window.denxGetActiveProject?.();

    return (
      String(project?.name || "DenX-Animation")
        .replace(/[^a-z0-9_-]+/gi, "-")
        .replace(/^-+|-+$/g, "") ||
      "DenX-Animation"
    );
  }

  async function exportMp4() {
    const mimeType = supportedMp4Mime();

    if (!mimeType) {
      throw new Error(
        "This browser cannot encode MP4 yet. Try the latest Chrome/Android build."
      );
    }

    if (typeof window.denxRenderCurrentCameraFrame !== "function") {
      throw new Error("DenX clean frame renderer is not ready.");
    }

    window.denxStopPlayback?.();

    const frameButtons =
      [...document.querySelectorAll(".frame[data-frame]")];

    const frameCount = frameButtons.length;

    if (frameCount < 1) {
      throw new Error("There are no animation frames to export.");
    }

    const originalFrame =
      Number(
        document.querySelector(".frame.active")?.dataset?.frame ||
        1
      );

    const fps =
      Math.max(
        1,
        Math.min(
          60,
          Number(
            document.getElementById("animationFpsInput")?.value
          ) || 12
        )
      );

    status.hidden = false;
    status.textContent = `Preparing MP4 · ${frameCount} frames`;

    await activateFrame(1);

    const firstFrame =
      await window.denxRenderCurrentCameraFrame();

    const exportCanvas =
      document.createElement("canvas");

    exportCanvas.width = firstFrame.width;
    exportCanvas.height = firstFrame.height;

    const ctx =
      exportCanvas.getContext("2d", {
        alpha: false,
        desynchronized: false
      });

    if (!ctx) {
      throw new Error("Could not create video renderer.");
    }

    const stream =
      exportCanvas.captureStream
        ? exportCanvas.captureStream(0)
        : null;

    if (!stream) {
      throw new Error(
        "Canvas video capture is unavailable in this browser."
      );
    }

    const videoTrack =
      stream.getVideoTracks()[0];

    const chunks = [];

    const recorder =
      new MediaRecorder(stream, {
        mimeType,
        videoBitsPerSecond:
          exportCanvas.width * exportCanvas.height >= 1920 * 1080
            ? 12_000_000
            : 7_000_000
      });

    const finished =
      new Promise((resolve, reject) => {
        recorder.addEventListener("dataavailable", event => {
          if (event.data?.size) chunks.push(event.data);
        });

        recorder.addEventListener("stop", resolve);
        recorder.addEventListener("error", event => {
          reject(
            event.error ||
            new Error("MP4 recorder failed.")
          );
        });
      });

    recorder.start();

    const frameDuration =
      Math.max(16, Math.round(1000 / fps));

    try {
      for (let index = 1; index <= frameCount; index++) {
        status.textContent =
          `Rendering MP4 · ${index} / ${frameCount}`;

        await activateFrame(index);

        const rendered =
          index === 1
            ? firstFrame
            : await window.denxRenderCurrentCameraFrame();

        ctx.clearRect(
          0,
          0,
          exportCanvas.width,
          exportCanvas.height
        );

        ctx.drawImage(
          rendered,
          0,
          0,
          exportCanvas.width,
          exportCanvas.height
        );

        if (
          videoTrack &&
          typeof videoTrack.requestFrame === "function"
        ) {
          videoTrack.requestFrame();
        }

        await sleep(frameDuration);
      }

      // Hold the final animation frame for one full frame interval.
      if (
        videoTrack &&
        typeof videoTrack.requestFrame === "function"
      ) {
        videoTrack.requestFrame();
      }

      await sleep(frameDuration);

      recorder.stop();
      await finished;
    } finally {
      stream.getTracks().forEach(track => track.stop());

      try {
        await activateFrame(originalFrame);
      } catch (_) {}
    }

    if (!chunks.length) {
      throw new Error("MP4 encoder returned an empty file.");
    }

    const blob =
      new Blob(chunks, { type: mimeType });

    if (!blob.size) {
      throw new Error("MP4 encoding produced no data.");
    }

    const url =
      URL.createObjectURL(blob);

    const anchor =
      document.createElement("a");

    anchor.href = url;
    anchor.download = `${safeProjectName()}.mp4`;

    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();

    setTimeout(
      () => URL.revokeObjectURL(url),
      3000
    );

    status.textContent =
      `MP4 ready · ${(blob.size / 1024 / 1024).toFixed(1)} MB`;

    setTimeout(() => {
      status.hidden = true;
      exportDialog.close?.();
    }, 950);
  }

  const mime = supportedMp4Mime();

  if (!mime) {
    mp4Button.querySelector("small").textContent =
      "MP4 needs browser H.264 MediaRecorder support.";
  }

  mp4Button.addEventListener("click", async () => {
    if (mp4Button.disabled) return;

    mp4Button.disabled = true;

    try {
      await exportMp4();
    } catch (error) {
      console.error("DenX MP4 export failed:", error);
      status.hidden = false;
      status.textContent =
        error?.message || "Could not export MP4.";
    } finally {
      mp4Button.disabled = false;
    }
  });
})();
