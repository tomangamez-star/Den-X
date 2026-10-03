(() => {
  "use strict";

  if (window.denxAndroidPolishV055) return;
  window.denxAndroidPolishV055 = true;

  const isNative = window.Capacitor?.isNativePlatform?.() === true;
  if (isNative) document.body.classList.add("denx-native-app");

  function syncViewportHeight() {
    const height = window.visualViewport?.height || window.innerHeight;
    if (height > 0) {
      document.documentElement.style.setProperty("--denx-safe-height", `${Math.round(height)}px`);
    }
  }

  syncViewportHeight();
  window.addEventListener("resize", syncViewportHeight, { passive: true });
  window.visualViewport?.addEventListener("resize", syncViewportHeight, { passive: true });

  let sheet = null;
  let activeSelect = null;

  function closeSheet() {
    if (!sheet) return;
    sheet.hidden = true;
    activeSelect = null;
  }

  function ensureSheet() {
    if (sheet) return sheet;
    sheet = document.createElement("div");
    sheet.className = "denx-select-sheet";
    sheet.hidden = true;
    sheet.innerHTML = `
      <section class="denx-select-card" role="dialog" aria-modal="true">
        <header class="denx-select-head">
          <strong>Choose option</strong>
          <button class="denx-select-close" type="button" aria-label="Close">×</button>
        </header>
        <div class="denx-select-options" role="listbox"></div>
      </section>`;
    document.body.appendChild(sheet);
    sheet.querySelector(".denx-select-close")?.addEventListener("click", closeSheet);
    sheet.addEventListener("click", event => {
      if (event.target === sheet) closeSheet();
    });
    return sheet;
  }

  function selectTitle(select) {
    return select.getAttribute("aria-label") ||
      select.closest("label")?.querySelector("span")?.textContent?.trim() ||
      "Choose option";
  }

  function openSelect(select) {
    activeSelect = select;
    const host = ensureSheet();
    host.querySelector(".denx-select-head strong").textContent = selectTitle(select);
    const optionsHost = host.querySelector(".denx-select-options");
    optionsHost.replaceChildren();
    const isFont = select.id === "textFontSelect";

    [...select.options].forEach(option => {
      if (option.disabled) return;
      const button = document.createElement("button");
      button.type = "button";
      button.className = "denx-select-option";
      button.textContent = option.textContent;
      button.classList.toggle("active", option.value === select.value);
      if (isFont) button.style.fontFamily = option.value || "system-ui, sans-serif";
      button.addEventListener("click", () => {
        select.value = option.value;
        select.dispatchEvent(new Event("change", { bubbles: true }));
        select.dispatchEvent(new Event("input", { bubbles: true }));
        select.__denxTriggerLabel.textContent = option.textContent;
        closeSheet();
      });
      optionsHost.appendChild(button);
    });

    host.hidden = false;
    requestAnimationFrame(() => {
      optionsHost.querySelector(".active")?.scrollIntoView({ block: "center" });
    });
  }

  function enhanceSelect(select) {
    if (!(select instanceof HTMLSelectElement) || select.dataset.denxSelect === "1") return;
    select.dataset.denxSelect = "1";
    select.classList.add("denx-native-select-source");
    const trigger = document.createElement("button");
    trigger.type = "button";
    trigger.className = "denx-select-trigger";
    trigger.textContent = select.selectedOptions[0]?.textContent || "Choose";
    trigger.disabled = select.disabled;
    select.__denxTriggerLabel = trigger;
    select.insertAdjacentElement("afterend", trigger);
    trigger.addEventListener("click", () => openSelect(select));
    select.addEventListener("change", () => {
      trigger.textContent = select.selectedOptions[0]?.textContent || "Choose";
      trigger.disabled = select.disabled;
    });
  }

  function enhanceAll(root = document) {
    root.querySelectorAll?.("select").forEach(enhanceSelect);
  }

  if (isNative) {
    enhanceAll();
    new MutationObserver(records => {
      records.forEach(record => record.addedNodes.forEach(node => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          if (node.matches?.("select")) enhanceSelect(node);
          enhanceAll(node);
        }
      }));
    }).observe(document.documentElement, { childList: true, subtree: true });
  }

  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && sheet && !sheet.hidden) closeSheet();
  });

  let saverProxy = null;
  const nativeSaver = () => {
    if (!isNative) return null;
    if (saverProxy) return saverProxy;
    saverProxy = window.Capacitor?.registerPlugin?.("DenXFileSaver") ||
      window.Capacitor?.Plugins?.DenXFileSaver || null;
    return saverProxy;
  };

  function sliceToBase64(slice) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || "").split(",")[1] || "");
      reader.onerror = () => reject(reader.error || new Error("Could not read export data."));
      reader.readAsDataURL(slice);
    });
  }

  function browserSave(blob, fileName) {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 3000);
    return Promise.resolve({ native: false, fileName });
  }

  async function nativeSave(blob, fileName, mimeType = blob.type || "application/octet-stream") {
    const saver = nativeSaver();
    if (!isNative || !saver) return browserSave(blob, fileName);

    const begin = await saver.beginSave({ fileName, mimeType });
    const sessionId = begin?.sessionId;
    if (!sessionId) throw new Error("Android did not start the save operation.");

    const chunkSize = 384 * 1024;
    try {
      for (let offset = 0; offset < blob.size; offset += chunkSize) {
        const base64Chunk = await sliceToBase64(blob.slice(offset, offset + chunkSize));
        await saver.appendChunk({ sessionId, base64Chunk });
        window.dispatchEvent(new CustomEvent("denx:nativesaveprogress", {
          detail: { written: Math.min(blob.size, offset + chunkSize), total: blob.size }
        }));
      }
      const result = await saver.finishSave({ sessionId });
      return { native: true, fileName, uri: result?.uri || "" };
    } catch (error) {
      try { await saver.cancelSave({ sessionId }); } catch (_) {}
      throw error;
    }
  }

  window.denxSaveExportBlob = nativeSave;
  window.denxNativeVideoEncoder = isNative ? {
    available: true,
    async begin(options) {
      const saver = nativeSaver();
      if (!saver) throw new Error("Android video encoder is unavailable.");
      return saver.beginVideo(options);
    },
    async append(sessionId, canvas) {
      const saver = nativeSaver();
      const blob = await new Promise((resolve, reject) =>
        canvas.toBlob(value => value ? resolve(value) : reject(new Error("Could not prepare a video frame.")), "image/jpeg", 0.94)
      );
      const base64Frame = await sliceToBase64(blob);
      return saver.appendVideoFrame({ sessionId, base64Frame });
    },
    async finish(sessionId) {
      return nativeSaver().finishVideo({ sessionId });
    },
    async cancel(sessionId) {
      return nativeSaver().cancelVideo({ sessionId: sessionId || "" });
    }
  } : null;
  window.denxShareLastExport = async () => {
    const saver = nativeSaver();
    if (!isNative || !saver) return false;
    await saver.shareLastFile();
    return true;
  };
})();
