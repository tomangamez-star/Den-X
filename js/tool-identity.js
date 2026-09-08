
(() => {
  const ICON = "icons/tools/";

  const iconMap = {
    panTool: "pan.svg",
    selectTool: "select.svg",
    pencilTool: "pencil.svg",
    textTool: "text.svg",
    eraserTool: "eraser.svg",
    onionSkinBtn: "onion.svg",
    createFigureBtn: "create-figure.svg",
    importFigureBtn: "import-figure.svg",
    addFigureBtn: "add-figure.svg",
    cameraTool: "camera.svg"
  };

  function setButtonIcon(id, file) {
    const button = document.getElementById(id);
    if (!button) return;

    let host = button.querySelector(".tool-icon");
    if (!host) return;

    host.innerHTML = "";
    const image = document.createElement("img");
    image.className = "denx-tool-svg";
    image.alt = "";
    image.src = ICON + file;
    host.appendChild(image);
  }

  Object.entries(iconMap).forEach(([id, file]) =>
    setButtonIcon(id, file)
  );

  // Paired depth-state icons, if present in the contextual toolbar.
  setButtonIcon("figureMoveFrontBtn", "front.svg");
  setButtonIcon("figureMoveBackBtn", "back.svg");

  function replaceControlIcon(inputId, file) {
    const input = document.getElementById(inputId);
    const label = input?.closest?.(".tool-control");
    const host =
      label?.querySelector?.(".tool-control-icon");

    if (!host) return;

    host.innerHTML = "";
    const img = document.createElement("img");
    img.className = "denx-tool-svg";
    img.src = ICON + file;
    img.alt = "";
    host.appendChild(img);

    label.classList.add("denx-color-launcher");
  }

  replaceControlIcon(
    "backgroundColorControl",
    "background.svg"
  );
  replaceControlIcon(
    "drawColorControl",
    "color.svg"
  );
  replaceControlIcon(
    "figureMainColorInput",
    "color.svg"
  );

  // ----------------------------------------------------------
  // DENX COLOR STUDIO
  // ----------------------------------------------------------
  const recentKey = "denx.colors.recent.v1";
  const defaultSwatches = [
    "#000000","#FFFFFF","#00C8FF","#8A8F96",
    "#FF3B5C","#FFB020","#35E06F","#5F7DFF",
    "#B45CFF","#FF5BC7","#5DE2E7","#6C7A89"
  ];

  let targetInput = null;
  let originalColor = "#000000";
  let hue = 0;
  let saturation = 100;
  let brightness = 100;

  const clamp = (n, min, max) =>
    Math.min(max, Math.max(min, n));

  function normalizeHex(value) {
    let hex = String(value || "").trim();
    if (!hex.startsWith("#")) hex = "#" + hex;

    if (/^#[0-9a-f]{3}$/i.test(hex)) {
      hex = "#" +
        hex.slice(1).split("")
          .map(c => c + c).join("");
    }

    return /^#[0-9a-f]{6}$/i.test(hex)
      ? hex.toUpperCase()
      : null;
  }

  function rgbToHex(r, g, b) {
    const c = n =>
      clamp(Math.round(Number(n) || 0), 0, 255)
        .toString(16)
        .padStart(2, "0");
    return `#${c(r)}${c(g)}${c(b)}`.toUpperCase();
  }

  function hexToRgb(hex) {
    const clean = normalizeHex(hex);
    if (!clean) return { r:0, g:0, b:0 };
    const n = parseInt(clean.slice(1), 16);
    return {
      r:(n >> 16) & 255,
      g:(n >> 8) & 255,
      b:n & 255
    };
  }

  function rgbToHsv(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r,g,b);
    const min = Math.min(r,g,b);
    const d = max - min;
    let h = 0;

    if (d) {
      if (max === r) h = 60 * (((g-b)/d) % 6);
      else if (max === g) h = 60 * (((b-r)/d) + 2);
      else h = 60 * (((r-g)/d) + 4);
    }

    if (h < 0) h += 360;

    return {
      h,
      s:max === 0 ? 0 : (d/max) * 100,
      v:max * 100
    };
  }

  function hsvToRgb(h, s, v) {
    h = ((Number(h) % 360) + 360) % 360;
    s = clamp(Number(s) || 0, 0, 100) / 100;
    v = clamp(Number(v) || 0, 0, 100) / 100;

    const c = v * s;
    const x = c * (1 - Math.abs(((h/60)%2)-1));
    const m = v - c;
    let rp=0,gp=0,bp=0;

    if (h < 60) [rp,gp,bp] = [c,x,0];
    else if (h < 120) [rp,gp,bp] = [x,c,0];
    else if (h < 180) [rp,gp,bp] = [0,c,x];
    else if (h < 240) [rp,gp,bp] = [0,x,c];
    else if (h < 300) [rp,gp,bp] = [x,0,c];
    else [rp,gp,bp] = [c,0,x];

    return {
      r:(rp+m)*255,
      g:(gp+m)*255,
      b:(bp+m)*255
    };
  }

  function getRecent() {
    try {
      const values = JSON.parse(
        localStorage.getItem(recentKey) || "[]"
      );
      return Array.isArray(values)
        ? values.filter(normalizeHex).slice(0,12)
        : [];
    } catch (_) {
      return [];
    }
  }

  function saveRecent(hex) {
    const clean = normalizeHex(hex);
    if (!clean) return;
    const next = [
      clean,
      ...getRecent().filter(c => c !== clean)
    ].slice(0,12);
    localStorage.setItem(recentKey, JSON.stringify(next));
  }

  function ensureDialog() {
    let dialog =
      document.getElementById("denxColorDialog");

    if (dialog) return dialog;

    dialog = document.createElement("dialog");
    dialog.id = "denxColorDialog";
    dialog.className = "denx-color-dialog";

    dialog.innerHTML = `
      <div class="denx-color-shell">
        <header class="denx-color-head">
          <div class="denx-color-head-copy">
            <span class="denx-color-kicker">DENX COLOR STUDIO</span>
            <strong id="denxColorTitle">Color</strong>
          </div>
          <button id="denxColorClose" class="denx-color-close" type="button" aria-label="Close">×</button>
        </header>

        <div class="denx-color-body">
          <section class="denx-color-field-wrap">
            <div id="denxColorField" class="denx-color-field" aria-label="Color field">
              <span id="denxColorCursor" class="denx-color-cursor"></span>
            </div>

            <div class="denx-color-preview-row">
              <div class="denx-color-preview">
                <span id="denxPreviousChip" class="denx-color-chip"></span>
                <span><small>Previous</small><code id="denxPreviousHex">#000000</code></span>
              </div>
              <div class="denx-color-preview">
                <span id="denxCurrentChip" class="denx-color-chip"></span>
                <span><small>Current</small><code id="denxCurrentHex">#000000</code></span>
              </div>
            </div>
          </section>

          <section class="denx-color-values">
            <div class="denx-color-section-title">HSB</div>
            <div class="denx-color-grid">
              <label class="denx-color-value">H<input id="denxH" inputmode="decimal" type="number" min="0" max="359"></label>
              <label class="denx-color-value">S<input id="denxS" inputmode="decimal" type="number" min="0" max="100"></label>
              <label class="denx-color-value">B<input id="denxB" inputmode="decimal" type="number" min="0" max="100"></label>
            </div>

            <div class="denx-color-section-title">RGB</div>
            <div class="denx-color-grid">
              <label class="denx-color-value">R<input id="denxR" inputmode="numeric" type="number" min="0" max="255"></label>
              <label class="denx-color-value">G<input id="denxG" inputmode="numeric" type="number" min="0" max="255"></label>
              <label class="denx-color-value">B<input id="denxBlue" inputmode="numeric" type="number" min="0" max="255"></label>
            </div>

            <label class="denx-color-hex">
              <span>HEX</span>
              <input id="denxHex" maxlength="7" autocomplete="off" spellcheck="false">
            </label>

            <div class="denx-color-section-title">Recent / DenX</div>
            <div id="denxColorSwatches" class="denx-color-swatches"></div>
          </section>
        </div>

        <footer class="denx-color-actions">
          <button id="denxColorCancel" type="button">Cancel</button>
          <button id="denxColorApply" class="denx-color-apply" type="button">Apply Color</button>
        </footer>
      </div>`;

    document.body.appendChild(dialog);

    dialog
      .querySelector("#denxColorClose")
      ?.addEventListener("click", closeColorStudio);

    dialog
      .querySelector("#denxColorCancel")
      ?.addEventListener("click", closeColorStudio);

    dialog
      .querySelector("#denxColorApply")
      ?.addEventListener("click", applyAndClose);

    const field =
      dialog.querySelector("#denxColorField");

    let dragging = false;

    const updateField = event => {
      const rect = field.getBoundingClientRect();
      const x = clamp(event.clientX - rect.left, 0, rect.width);
      const y = clamp(event.clientY - rect.top, 0, rect.height);

      hue = (x / rect.width) * 360;
      brightness = 100 - (y / rect.height) * 100;
      updateUiFromHsv(true);
    };

    field.addEventListener("pointerdown", event => {
      dragging = true;
      try { field.setPointerCapture(event.pointerId); } catch (_) {}
      updateField(event);
      event.preventDefault();
    });

    field.addEventListener("pointermove", event => {
      if (!dragging) return;
      updateField(event);
      event.preventDefault();
    });

    const end = event => {
      dragging = false;
      try { field.releasePointerCapture(event.pointerId); } catch (_) {}
    };

    field.addEventListener("pointerup", end);
    field.addEventListener("pointercancel", end);

    ["denxH","denxS","denxB"].forEach(id => {
      dialog.querySelector("#"+id)?.addEventListener(
        "change",
        updateFromHsbInputs
      );
    });

    ["denxR","denxG","denxBlue"].forEach(id => {
      dialog.querySelector("#"+id)?.addEventListener(
        "change",
        updateFromRgbInputs
      );
    });

    dialog
      .querySelector("#denxHex")
      ?.addEventListener("change", updateFromHexInput);

    return dialog;
  }

  function currentHex() {
    const rgb = hsvToRgb(hue, saturation, brightness);
    return rgbToHex(rgb.r, rgb.g, rgb.b);
  }

  function updateUiFromHsv(liveApply = false) {
    const dialog = ensureDialog();
    const rgb = hsvToRgb(hue, saturation, brightness);
    const hex = rgbToHex(rgb.r, rgb.g, rgb.b);

    dialog.querySelector("#denxH").value =
      String(Math.round(hue) % 360);
    dialog.querySelector("#denxS").value =
      String(Math.round(saturation));
    dialog.querySelector("#denxB").value =
      String(Math.round(brightness));

    dialog.querySelector("#denxR").value =
      String(Math.round(rgb.r));
    dialog.querySelector("#denxG").value =
      String(Math.round(rgb.g));
    dialog.querySelector("#denxBlue").value =
      String(Math.round(rgb.b));

    dialog.querySelector("#denxHex").value = hex;
    dialog.querySelector("#denxCurrentHex").textContent = hex;
    dialog.querySelector("#denxCurrentChip").style.background = hex;

    const field = dialog.querySelector("#denxColorField");
    field.style.setProperty(
      "--denx-desaturate",
      String((100 - saturation) / 100)
    );

    const cursor = dialog.querySelector("#denxColorCursor");
    cursor.style.left = `${(hue / 360) * 100}%`;
    cursor.style.top = `${100 - brightness}%`;

    if (liveApply && targetInput) {
      targetInput.value = hex;
      targetInput.dispatchEvent(
        new Event("input", { bubbles:true })
      );
    }
  }

  function updateFromHsbInputs() {
    const dialog = ensureDialog();
    hue = clamp(
      Number(dialog.querySelector("#denxH").value) || 0,
      0, 359
    );
    saturation = clamp(
      Number(dialog.querySelector("#denxS").value) || 0,
      0, 100
    );
    brightness = clamp(
      Number(dialog.querySelector("#denxB").value) || 0,
      0, 100
    );
    updateUiFromHsv(true);
  }

  function updateFromRgbInputs() {
    const dialog = ensureDialog();
    const rgb = {
      r:clamp(Number(dialog.querySelector("#denxR").value)||0,0,255),
      g:clamp(Number(dialog.querySelector("#denxG").value)||0,0,255),
      b:clamp(Number(dialog.querySelector("#denxBlue").value)||0,0,255)
    };
    const hsv = rgbToHsv(rgb.r,rgb.g,rgb.b);
    hue = hsv.h;
    saturation = hsv.s;
    brightness = hsv.v;
    updateUiFromHsv(true);
  }

  function updateFromHexInput() {
    const dialog = ensureDialog();
    const clean = normalizeHex(
      dialog.querySelector("#denxHex").value
    );

    if (!clean) {
      dialog.querySelector("#denxHex").value =
        currentHex();
      return;
    }

    const rgb = hexToRgb(clean);
    const hsv = rgbToHsv(rgb.r,rgb.g,rgb.b);
    hue = hsv.h;
    saturation = hsv.s;
    brightness = hsv.v;
    updateUiFromHsv(true);
  }

  function renderSwatches() {
    const dialog = ensureDialog();
    const host =
      dialog.querySelector("#denxColorSwatches");

    host.innerHTML = "";

    const values = [
      ...getRecent(),
      ...defaultSwatches
    ].filter((value, index, array) =>
      array.indexOf(value) === index
    ).slice(0,18);

    values.forEach(hex => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "denx-swatch";
      button.style.setProperty("--swatch", hex);
      button.title = hex;
      button.setAttribute("aria-label", `Use ${hex}`);

      button.addEventListener("click", () => {
        const rgb = hexToRgb(hex);
        const hsv = rgbToHsv(rgb.r,rgb.g,rgb.b);
        hue = hsv.h;
        saturation = hsv.s;
        brightness = hsv.v;
        updateUiFromHsv(true);
      });

      host.appendChild(button);
    });
  }

  function openColorStudio(input, title) {
    if (!input) return;

    targetInput = input;
    originalColor =
      normalizeHex(input.value) || "#000000";

    const rgb = hexToRgb(originalColor);
    const hsv = rgbToHsv(rgb.r,rgb.g,rgb.b);
    hue = hsv.h;
    saturation = hsv.s;
    brightness = hsv.v;

    const dialog = ensureDialog();
    dialog.querySelector("#denxColorTitle").textContent =
      title || "Color";

    dialog.querySelector("#denxPreviousChip").style.background =
      originalColor;
    dialog.querySelector("#denxPreviousHex").textContent =
      originalColor;

    updateUiFromHsv(false);
    renderSwatches();

    try {
      if (!dialog.open) dialog.showModal();
    } catch (_) {
      dialog.setAttribute("open","");
    }
  }

  function closeColorStudio() {
    const dialog = ensureDialog();

    if (targetInput) {
      targetInput.value = originalColor;
      targetInput.dispatchEvent(
        new Event("input", { bubbles:true })
      );
    }

    targetInput = null;
    dialog.close?.();
  }

  function applyAndClose() {
    const dialog = ensureDialog();
    const hex = currentHex();

    if (targetInput) {
      targetInput.value = hex;
      targetInput.dispatchEvent(
        new Event("input", { bubbles:true })
      );
      targetInput.dispatchEvent(
        new Event("change", { bubbles:true })
      );

      window.denxMarkProjectDirty?.();
    }

    saveRecent(hex);
    targetInput = null;
    dialog.close?.();
  }

  function wireColorInput(id, title) {
    const input = document.getElementById(id);
    if (!input) return;

    const launcher =
      input.closest(".tool-control") || input.parentElement;

    const open = event => {
      event.preventDefault();
      event.stopPropagation();
      openColorStudio(input, title);
    };

    launcher?.addEventListener("pointerdown", open, true);

    input.addEventListener("click", event => {
      event.preventDefault();
      openColorStudio(input, title);
    });
  }

  wireColorInput(
    "backgroundColorControl",
    "Workspace Background"
  );
  wireColorInput(
    "drawColorControl",
    "Drawing Color"
  );
  wireColorInput(
    "figureMainColorInput",
    "Figure Color"
  );
})();
