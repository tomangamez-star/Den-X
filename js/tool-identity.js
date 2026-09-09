
(() => {
  const ICON = "icons/tools/";

  // ----------------------------------------------------------
  // ICON SYSTEM
  // Inline the toolbar SVGs instead of keeping them as <img>.
  // Some Android/Chromium GPU stacks corrupt external SVG <img>
  // layers inside a scrolling toolbar during repaints.
  // ----------------------------------------------------------
  const svgCache = new Map();

  async function fetchSvg(file) {
    if (svgCache.has(file)) return svgCache.get(file);

    const promise = fetch(ICON + file, { cache: "force-cache" })
      .then(response => {
        if (!response.ok) throw new Error(`Icon ${file} failed`);
        return response.text();
      })
      .then(text => text.replace(
        /<svg\b/,
        '<svg class="denx-tool-svg" aria-hidden="true" focusable="false"'
      ));

    svgCache.set(file, promise);
    return promise;
  }

  async function setButtonIcon(id, file) {
    const button = document.getElementById(id);
    const host = button?.querySelector(".tool-icon");
    if (!host) return;

    try {
      host.innerHTML = await fetchSvg(file);
    } catch (_) {
      // Keep the existing glyph if an icon asset cannot be read.
    }
  }

  async function replaceControlIcon(inputId, file) {
    const input = document.getElementById(inputId);
    const label = input?.closest(".tool-control");
    const host = label?.querySelector(".tool-control-icon");
    if (!host) return;

    try {
      host.innerHTML = await fetchSvg(file);
    } catch (_) {}

    label.classList.add("denx-color-launcher");
  }

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
    cameraTool: "camera.svg",
    figureMoveFrontBtn: "front.svg",
    figureMoveBackBtn: "back.svg"
  };

  Object.entries(iconMap).forEach(([id, file]) => {
    setButtonIcon(id, file);
  });

  replaceControlIcon("backgroundColorControl", "background.svg");
  replaceControlIcon("drawColorControl", "color.svg");
  replaceControlIcon("figureMainColorInput", "color.svg");
  replaceControlIcon("textColorInput", "color.svg");

  function installNativeBackIcons() {
    document.querySelectorAll(".denx-back-link").forEach(button => {
      if (button.querySelector(".denx-nav-back-icon")) return;

      const label =
        button.textContent.replace(/^←\s*/, "").trim() || "Back";

      button.textContent = "";

      const icon = document.createElement("img");
      icon.className = "denx-nav-back-icon";
      icon.src = ICON + "nav-back.svg";
      icon.alt = "";

      const text = document.createElement("span");
      text.className = "denx-back-text";
      text.textContent = label;

      button.append(icon, text);
    });
  }

  installNativeBackIcons();

  // ----------------------------------------------------------
  // DENX COLOR STUDIO v2
  //
  // Main field:
  //   X = Hue
  //   Y = Saturation
  //
  // Separate vertical slider:
  //   Brightness / darkness
  //
  // This prevents the previous mismatch where the visible picker,
  // HSB numbers and the actually-applied color disagreed.
  // ----------------------------------------------------------
  const recentKey = "denx.colors.recent.v2";

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

  const clamp = (value, min, max) =>
    Math.min(max, Math.max(min, value));

  function normalizeHex(value) {
    let hex = String(value || "").trim();
    if (!hex.startsWith("#")) hex = "#" + hex;

    if (/^#[0-9a-f]{3}$/i.test(hex)) {
      hex =
        "#" +
        hex.slice(1).split("").map(c => c + c).join("");
    }

    return /^#[0-9a-f]{6}$/i.test(hex)
      ? hex.toUpperCase()
      : null;
  }

  function rgbToHex(r, g, b) {
    const part = value =>
      clamp(Math.round(Number(value) || 0), 0, 255)
        .toString(16)
        .padStart(2, "0");

    return `#${part(r)}${part(g)}${part(b)}`.toUpperCase();
  }

  function hexToRgb(hex) {
    const clean = normalizeHex(hex) || "#000000";
    const n = parseInt(clean.slice(1), 16);

    return {
      r: (n >> 16) & 255,
      g: (n >> 8) & 255,
      b: n & 255
    };
  }

  function rgbToHsv(r, g, b) {
    r /= 255;
    g /= 255;
    b /= 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const delta = max - min;

    let h = 0;

    if (delta !== 0) {
      if (max === r) {
        h = 60 * (((g - b) / delta) % 6);
      } else if (max === g) {
        h = 60 * (((b - r) / delta) + 2);
      } else {
        h = 60 * (((r - g) / delta) + 4);
      }
    }

    if (h < 0) h += 360;

    return {
      h,
      s: max === 0 ? 0 : (delta / max) * 100,
      v: max * 100
    };
  }

  function hsvToRgb(h, s, v) {
    h = ((Number(h) % 360) + 360) % 360;
    s = clamp(Number(s) || 0, 0, 100) / 100;
    v = clamp(Number(v) || 0, 0, 100) / 100;

    const c = v * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = v - c;

    let rp = 0;
    let gp = 0;
    let bp = 0;

    if (h < 60) [rp, gp, bp] = [c, x, 0];
    else if (h < 120) [rp, gp, bp] = [x, c, 0];
    else if (h < 180) [rp, gp, bp] = [0, c, x];
    else if (h < 240) [rp, gp, bp] = [0, x, c];
    else if (h < 300) [rp, gp, bp] = [x, 0, c];
    else [rp, gp, bp] = [c, 0, x];

    return {
      r: (rp + m) * 255,
      g: (gp + m) * 255,
      b: (bp + m) * 255
    };
  }

  function currentHex() {
    const rgb = hsvToRgb(hue, saturation, brightness);
    return rgbToHex(rgb.r, rgb.g, rgb.b);
  }

  function pureHueHex() {
    const rgb = hsvToRgb(hue, saturation, 100);
    return rgbToHex(rgb.r, rgb.g, rgb.b);
  }

  function getRecent() {
    try {
      const value =
        JSON.parse(localStorage.getItem(recentKey) || "[]");

      return Array.isArray(value)
        ? value.map(normalizeHex).filter(Boolean).slice(0, 12)
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
      ...getRecent().filter(value => value !== clean)
    ].slice(0, 12);

    localStorage.setItem(recentKey, JSON.stringify(next));
  }

  function ensureDialog() {
    let dialog = document.getElementById("denxColorDialog");
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
          <button id="denxColorClose" class="denx-color-close"
                  type="button" aria-label="Close">×</button>
        </header>

        <div class="denx-color-body">
          <section class="denx-color-picker-column">
            <div class="denx-color-picker-row">
              <div id="denxColorField"
                   class="denx-color-field"
                   aria-label="Hue and saturation field">
                <span id="denxColorCursor"
                      class="denx-color-cursor"></span>
              </div>

              <div class="denx-brightness-wrap">
                <input id="denxBrightnessSlider"
                       class="denx-brightness-slider"
                       type="range"
                       min="0"
                       max="100"
                       step="1"
                       aria-label="Brightness">
                <span class="denx-brightness-label">B</span>
              </div>
            </div>

            <div class="denx-color-preview-row">
              <div class="denx-color-preview">
                <span id="denxPreviousChip"
                      class="denx-color-chip"></span>
                <span>
                  <small>Previous</small>
                  <code id="denxPreviousHex">#000000</code>
                </span>
              </div>

              <div class="denx-color-preview">
                <span id="denxCurrentChip"
                      class="denx-color-chip"></span>
                <span>
                  <small>Current</small>
                  <code id="denxCurrentHex">#000000</code>
                </span>
              </div>
            </div>
          </section>

          <section class="denx-color-values">
            <div class="denx-color-section-title">HSB</div>
            <div class="denx-color-grid">
              <label class="denx-color-value">
                H
                <input id="denxH" type="number" min="0" max="359">
              </label>
              <label class="denx-color-value">
                S
                <input id="denxS" type="number" min="0" max="100">
              </label>
              <label class="denx-color-value">
                B
                <input id="denxB" type="number" min="0" max="100">
              </label>
            </div>

            <div class="denx-color-section-title">RGB</div>
            <div class="denx-color-grid">
              <label class="denx-color-value">
                R
                <input id="denxR" type="number" min="0" max="255">
              </label>
              <label class="denx-color-value">
                G
                <input id="denxG" type="number" min="0" max="255">
              </label>
              <label class="denx-color-value">
                B
                <input id="denxBlue" type="number" min="0" max="255">
              </label>
            </div>

            <label class="denx-color-hex">
              <span>HEX</span>
              <input id="denxHex" maxlength="7"
                     autocomplete="off" spellcheck="false">
            </label>

            <div class="denx-color-section-title">Recent / DenX</div>
            <div id="denxColorSwatches"
                 class="denx-color-swatches"></div>
          </section>
        </div>

        <footer class="denx-color-actions">
          <button id="denxColorCancel" type="button">Cancel</button>
          <button id="denxColorApply"
                  class="denx-color-apply"
                  type="button">Apply Color</button>
        </footer>
      </div>
    `;

    document.body.appendChild(dialog);

    const field =
      dialog.querySelector("#denxColorField");

    const brightnessSlider =
      dialog.querySelector("#denxBrightnessSlider");

    let fieldDragging = false;

    function updateFieldFromPointer(event) {
      const rect = field.getBoundingClientRect();

      const x =
        clamp(event.clientX - rect.left, 0, rect.width);

      const y =
        clamp(event.clientY - rect.top, 0, rect.height);

      hue = (x / rect.width) * 360;
      saturation = 100 - (y / rect.height) * 100;

      updateUi(true);
    }

    field.addEventListener("pointerdown", event => {
      fieldDragging = true;
      try {
        field.setPointerCapture(event.pointerId);
      } catch (_) {}

      updateFieldFromPointer(event);
      event.preventDefault();
    });

    field.addEventListener("pointermove", event => {
      if (!fieldDragging) return;
      updateFieldFromPointer(event);
      event.preventDefault();
    });

    const endField = event => {
      fieldDragging = false;
      try {
        field.releasePointerCapture(event.pointerId);
      } catch (_) {}
    };

    field.addEventListener("pointerup", endField);
    field.addEventListener("pointercancel", endField);

    brightnessSlider.addEventListener("input", () => {
      brightness =
        clamp(Number(brightnessSlider.value) || 0, 0, 100);
      updateUi(true);
    });

    ["denxH", "denxS", "denxB"].forEach(id => {
      dialog.querySelector("#" + id)
        ?.addEventListener("change", updateFromHsbInputs);
    });

    ["denxR", "denxG", "denxBlue"].forEach(id => {
      dialog.querySelector("#" + id)
        ?.addEventListener("change", updateFromRgbInputs);
    });

    dialog.querySelector("#denxHex")
      ?.addEventListener("change", updateFromHexInput);

    dialog.querySelector("#denxColorClose")
      ?.addEventListener("click", cancelAndClose);

    dialog.querySelector("#denxColorCancel")
      ?.addEventListener("click", cancelAndClose);

    dialog.querySelector("#denxColorApply")
      ?.addEventListener("click", applyAndClose);

    return dialog;
  }

  function updateUi(livePreview = false) {
    const dialog = ensureDialog();

    const rgb =
      hsvToRgb(hue, saturation, brightness);

    const hex =
      rgbToHex(rgb.r, rgb.g, rgb.b);

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

    const cursor =
      dialog.querySelector("#denxColorCursor");

    cursor.style.left =
      `${(hue / 360) * 100}%`;

    cursor.style.top =
      `${100 - saturation}%`;

    const brightnessSlider =
      dialog.querySelector("#denxBrightnessSlider");

    brightnessSlider.value =
      String(Math.round(brightness));

    brightnessSlider.style.setProperty(
      "--denx-bright-top",
      pureHueHex()
    );

    if (livePreview && targetInput) {
      targetInput.value = hex;
      targetInput.dispatchEvent(
        new Event("input", { bubbles: true })
      );
    }
  }

  function updateFromHsbInputs() {
    const dialog = ensureDialog();

    hue =
      clamp(
        Number(dialog.querySelector("#denxH").value) || 0,
        0,
        359
      );

    saturation =
      clamp(
        Number(dialog.querySelector("#denxS").value) || 0,
        0,
        100
      );

    brightness =
      clamp(
        Number(dialog.querySelector("#denxB").value) || 0,
        0,
        100
      );

    updateUi(true);
  }

  function updateFromRgbInputs() {
    const dialog = ensureDialog();

    const r =
      clamp(
        Number(dialog.querySelector("#denxR").value) || 0,
        0,
        255
      );

    const g =
      clamp(
        Number(dialog.querySelector("#denxG").value) || 0,
        0,
        255
      );

    const b =
      clamp(
        Number(dialog.querySelector("#denxBlue").value) || 0,
        0,
        255
      );

    const hsv = rgbToHsv(r, g, b);

    hue = hsv.h;
    saturation = hsv.s;
    brightness = hsv.v;

    updateUi(true);
  }

  function updateFromHexInput() {
    const dialog = ensureDialog();

    const clean =
      normalizeHex(dialog.querySelector("#denxHex").value);

    if (!clean) {
      dialog.querySelector("#denxHex").value = currentHex();
      return;
    }

    const rgb = hexToRgb(clean);
    const hsv = rgbToHsv(rgb.r, rgb.g, rgb.b);

    hue = hsv.h;
    saturation = hsv.s;
    brightness = hsv.v;

    updateUi(true);
  }

  function renderSwatches() {
    const dialog = ensureDialog();
    const host =
      dialog.querySelector("#denxColorSwatches");

    host.innerHTML = "";

    const values =
      [...getRecent(), ...defaultSwatches]
        .filter((value, index, array) =>
          array.indexOf(value) === index
        )
        .slice(0, 18);

    values.forEach(hex => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "denx-swatch";
      button.style.setProperty("--swatch", hex);
      button.title = hex;
      button.setAttribute("aria-label", `Use ${hex}`);

      button.addEventListener("click", () => {
        const rgb = hexToRgb(hex);
        const hsv = rgbToHsv(rgb.r, rgb.g, rgb.b);

        hue = hsv.h;
        saturation = hsv.s;
        brightness = hsv.v;

        updateUi(true);
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
    const hsv = rgbToHsv(rgb.r, rgb.g, rgb.b);

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

    updateUi(false);
    renderSwatches();

    try {
      if (!dialog.open) dialog.showModal();
    } catch (_) {
      dialog.setAttribute("open", "");
    }
  }

  function cancelAndClose() {
    const dialog = ensureDialog();

    if (targetInput) {
      targetInput.value = originalColor;
      targetInput.dispatchEvent(
        new Event("input", { bubbles: true })
      );
    }

    targetInput = null;

    if (dialog.open) dialog.close();
    else dialog.removeAttribute("open");
  }

  function applyAndClose() {
    const dialog = ensureDialog();
    const hex = currentHex();

    if (targetInput) {
      targetInput.value = hex;

      targetInput.dispatchEvent(
        new Event("input", { bubbles: true })
      );

      targetInput.dispatchEvent(
        new Event("change", { bubbles: true })
      );

      window.denxMarkProjectDirty?.();
    }

    saveRecent(hex);
    targetInput = null;

    if (dialog.open) dialog.close();
    else dialog.removeAttribute("open");
  }

  function wireColorInput(id, title) {
    const input = document.getElementById(id);
    if (!input) return;

    const launcher =
      input.closest(".tool-control") ||
      input.closest(".creator-control") ||
      input.parentElement;

    launcher?.classList.add("denx-color-launcher");

    // Do not let the browser's native color picker open.
    const open = event => {
      event.preventDefault();
      event.stopPropagation();
      openColorStudio(input, title);
    };

    launcher?.addEventListener("click", open);

    input.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();
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

  wireColorInput(
    "textColorInput",
    "Text Color"
  );

  wireColorInput(
    "segmentColorInput",
    "Segment Color"
  );

  wireColorInput(
    "polyfillColorInput",
    "Polyfill Color"
  );
})();
