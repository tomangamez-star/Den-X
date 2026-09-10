(() => {
  "use strict";

  if (document.getElementById("denxWorkspaceBoot")) return;

  const boot = document.createElement("div");
  boot.id = "denxWorkspaceBoot";
  boot.innerHTML = `
    <div class="denx-boot-card">
      <div class="denx-boot-mark">DENX</div>
      <div class="denx-boot-title">Preparing workspace</div>
      <div class="denx-boot-status" id="denxBootStatus">Loading project data…</div>
      <div class="denx-boot-track"><i id="denxBootProgress"></i></div>
    </div>
  `;

  document.body.appendChild(boot);

  const status = boot.querySelector("#denxBootStatus");
  const bar = boot.querySelector("#denxBootProgress");
  const started = performance.now();

  function step(percent, text) {
    bar.style.width = `${Math.max(0, Math.min(100, percent))}%`;
    status.textContent = text;
  }

  async function waitFrame() {
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  }

  async function ready() {
    step(18, "Loading project data…");
    await waitFrame();

    step(42, "Preparing frames…");
    await waitFrame();

    step(68, "Preparing renderer…");
    const until = performance.now() + 800;
    while (
      !window.denxRendererBackend &&
      performance.now() < until
    ) {
      await new Promise(resolve => setTimeout(resolve, 30));
    }

    const renderer =
      window.denxRendererBackend === "webgl2"
        ? "WebGL2 ready"
        : window.denxRendererBackend === "svg"
          ? "SVG renderer ready"
          : "Renderer ready";

    step(88, renderer);
    await waitFrame();

    window.denxWebGLRenderer?.requestRender?.();
    window.denxRefreshOnionSkin?.();

    step(100, "Ready ✓");

    // No fake long splash. Only enforce a tiny minimum so it doesn't flash.
    const elapsed = performance.now() - started;
    if (elapsed < 320) {
      await new Promise(resolve => setTimeout(resolve, 320 - elapsed));
    }

    boot.classList.add("denx-boot-done");
    setTimeout(() => boot.remove(), 220);
  }

  ready().catch(error => {
    console.warn("DenX boot screen:", error);
    step(100, "Ready");
    boot.classList.add("denx-boot-done");
    setTimeout(() => boot.remove(), 220);
  });
})();