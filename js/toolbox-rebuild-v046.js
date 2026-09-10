(() => {
  "use strict";

  const editor = document.querySelector(".editor");
  const toolbox = document.getElementById("toolbox");
  const quickFind = document.querySelector(".tool-quickfind");
  const viewport = document.getElementById("viewport");
  if (!editor || !toolbox || !quickFind || !viewport) return;
  if (editor.dataset.denxV046 === "1") return;

  editor.dataset.denxV046 = "1";
  editor.classList.remove("denx-v045-shell");
  editor.classList.add("denx-v046-shell");

  const left = document.createElement("div");
  left.className = "denx-v046-left";
  left.id = "denxV046Left";

  const stage = document.createElement("div");
  stage.className = "denx-v046-stage";
  stage.id = "denxV046Stage";

  left.appendChild(toolbox);

  [
    document.getElementById("cameraProperties"),
    document.getElementById("figureActionsRail"),
    document.getElementById("textActionsRail"),
    viewport,
    editor.querySelector(".zoom-controls")
  ].filter(Boolean).forEach(node => stage.appendChild(node));

  // Quick Find returns to the original floating canvas-edge location.
  editor.replaceChildren(left, stage, quickFind);

  toolbox.scrollTop = 0;
  toolbox.scrollLeft = 0;

  let host = toolbox.querySelector(":scope > .denx-toolbox-scroller");
  if (!host) {
    host = document.createElement("div");
    host.className = "denx-toolbox-scroller";
    host.id = "denxToolboxScroller";
    [...toolbox.children]
      .filter(el => el.matches?.("[data-tool-section]"))
      .forEach(section => host.appendChild(section));
    toolbox.appendChild(host);
  }

  const sections = [...host.querySelectorAll("[data-tool-section]")];
  const links = [...quickFind.querySelectorAll(".quickfind-link")];
  let activeIndex = Math.max(0, sections.findIndex(s => s.dataset.toolSection === "general"));

  function showIndex(nextIndex) {
    if (!sections.length) return;
    activeIndex = Math.max(0, Math.min(sections.length - 1, nextIndex));

    sections.forEach((section,index) => {
      const active = index === activeIndex;
      const buffered = Math.abs(index-activeIndex) === 1;
      section.classList.toggle("denx-v046-active", active);
      section.classList.toggle("denx-v046-buffer", buffered);
      section.setAttribute("aria-hidden", active ? "false" : "true");
    });

    const name = sections[activeIndex]?.dataset.toolSection;
    links.forEach(link => {
      const active = link.dataset.toolTarget === name;
      link.classList.toggle("active", active);
      link.setAttribute("aria-pressed", active ? "true" : "false");
    });

    toolbox.scrollTop = 0;
    host.scrollTop = 0;
  }

  function showName(name) {
    const index = sections.findIndex(s => s.dataset.toolSection === name);
    if (index >= 0) showIndex(index);
  }

  quickFind.addEventListener("click", event => {
    const link = event.target.closest(".quickfind-link");
    if (!link) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    showName(link.dataset.toolTarget);
  }, true);

  // Corruption-safe virtual vertical navigation: swipe changes section;
  // neither #toolbox nor a child ever becomes a native scroll layer.
  let startY = null;
  let startAt = 0;

  left.addEventListener("pointerdown", event => {
    if (event.pointerType === "touch") {
      startY = event.clientY;
      startAt = performance.now();
    }
    event.stopPropagation();
  }, { passive:true });

  left.addEventListener("pointerup", event => {
    if (startY == null || event.pointerType !== "touch") return;
    const dy = event.clientY - startY;
    const elapsed = performance.now() - startAt;
    startY = null;
    if (elapsed < 700 && Math.abs(dy) > 42) {
      showIndex(activeIndex + (dy < 0 ? 1 : -1));
    }
    event.stopPropagation();
  }, { passive:true });

  let wheelLocked = false;
  left.addEventListener("wheel", event => {
    event.preventDefault();
    if (wheelLocked || Math.abs(event.deltaY) < 8) return;
    wheelLocked = true;
    showIndex(activeIndex + (event.deltaY > 0 ? 1 : -1));
    setTimeout(() => { wheelLocked = false; }, 160);
  }, { passive:false });

  window.addEventListener("denx:toolchange", event => {
    const tool = String(event.detail?.tool || "");
    if (["pan","select"].includes(tool)) showName("general");
    else if (["pencil","eraser","text"].includes(tool)) showName("draw");
    else if (tool === "camera") showName("camera");
  });

  const anchorRails = () => {
    ["figureActionsRail","textActionsRail"].forEach(id => {
      const rail = document.getElementById(id);
      if (!rail) return;
      if (rail.parentElement !== stage) stage.insertBefore(rail, viewport);
      rail.style.right = "0";
      rail.style.left = "auto";
    });
  };
  window.addEventListener("denx:figureselectionchange", anchorRails);
  window.addEventListener("denx:textselectionchange", anchorRails);
  anchorRails();

  showIndex(activeIndex);
})();