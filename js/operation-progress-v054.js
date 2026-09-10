(() => {
  "use strict";

  function createOverlay() {
    let overlay = document.getElementById("denxOperationOverlay");
    if (overlay) return overlay;

    overlay = document.createElement("div");
    overlay.id = "denxOperationOverlay";
    overlay.hidden = true;
    overlay.innerHTML = `
      <div class="denx-op-card">
        <div class="denx-op-mark">DENX</div>
        <div class="denx-op-title" id="denxOpTitle">Working</div>
        <div class="denx-op-status" id="denxOpStatus">Preparing…</div>
        <div class="denx-op-track"><i id="denxOpProgress"></i></div>
      </div>
    `;
    document.body.appendChild(overlay);
    return overlay;
  }

  const overlay = createOverlay();
  const title = overlay.querySelector("#denxOpTitle");
  const status = overlay.querySelector("#denxOpStatus");
  const bar = overlay.querySelector("#denxOpProgress");

  function show(name = "Working", message = "Preparing…", progress = 6) {
    title.textContent = name;
    status.textContent = message;
    bar.style.width = `${progress}%`;
    overlay.hidden = false;
    overlay.classList.remove("denx-op-done");
  }

  function update(message, progress = null) {
    status.textContent = message;
    if (Number.isFinite(progress)) {
      bar.style.width = `${Math.max(0,Math.min(100,progress))}%`;
    }
  }

  function hide(successMessage = null) {
    if (successMessage) {
      update(successMessage,100);
    }
    setTimeout(() => {
      overlay.classList.add("denx-op-done");
      setTimeout(() => {
        overlay.hidden = true;
        overlay.classList.remove("denx-op-done");
        bar.style.width = "0%";
      },180);
    }, successMessage ? 260 : 0);
  }

  window.denxOperationOverlay = { show, update, hide };

  // Attach after all normal workspace scripts (including video-export.js).
  window.addEventListener("load", () => {
    const startBtn = document.getElementById("denxStartMp4Export");
    const exportStatus = document.getElementById("denxVideoExportStatus");
    if (!startBtn || !exportStatus) return;

    let active = false;

    startBtn.addEventListener("click", () => {
      active = true;
      show("Exporting MP4","Preparing animation frames…",5);
    }, true);

    const readProgress = text => {
      let m = text.match(/Rendering .*?·\s*(\d+)\s*\/\s*(\d+)/i);
      if (m) {
        const current=Number(m[1]), total=Math.max(1,Number(m[2]));
        return 8 + (current/total)*56;
      }

      m = text.match(/Encoding .*?·.*?·\s*(\d+)\s*\/\s*(\d+)/i);
      if (m) {
        const current=Number(m[1]), total=Math.max(1,Number(m[2]));
        return 66 + (current/total)*30;
      }

      if (/MP4 ready/i.test(text)) return 100;
      if (/Preparing/i.test(text)) return 5;
      return null;
    };

    new MutationObserver(() => {
      if (!active) return;
      const text = String(exportStatus.textContent || "").trim();
      if (!text) return;

      const progress = readProgress(text);
      update(text,progress);

      if (/MP4 ready/i.test(text)) {
        active=false;
        hide("MP4 ready ✓");
      } else if (/failed|could not|unavailable|error/i.test(text)) {
        active=false;
        hide();
      }
    }).observe(exportStatus,{subtree:true,childList:true,characterData:true});
  });
})();