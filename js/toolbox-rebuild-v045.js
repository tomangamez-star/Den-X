(() => {
  "use strict";

  const editor = document.querySelector(".editor");
  const toolbox = document.getElementById("toolbox");
  const quickFind = document.querySelector(".tool-quickfind");
  const viewport = document.getElementById("viewport");

  if (!editor || !toolbox || !quickFind || !viewport) return;
  if (editor.dataset.denxV045 === "1") return;

  editor.dataset.denxV045 = "1";
  editor.classList.add("denx-v045-shell");

  // Undo v0.4.4 runtime wrappers, then construct a fresh shallow shell.
  const oldLeft = document.getElementById("denxLeftRegion");
  const oldStage = document.getElementById("denxEditorRegion");

  const left = document.createElement("div");
  left.className = "denx-v045-left";
  left.id = "denxV045Left";

  const stage = document.createElement("div");
  stage.className = "denx-v045-stage";
  stage.id = "denxV045Stage";

  // Preserve the existing nodes and all listeners/IDs, but move them into
  // a brand-new shallow layout. The left tool surface has zero scrolling.
  left.appendChild(toolbox);
  left.appendChild(quickFind);

  const rendererNodes = [
    document.getElementById("cameraProperties"),
    document.getElementById("figureActionsRail"),
    document.getElementById("textActionsRail"),
    viewport,
    editor.querySelector(".zoom-controls")
  ].filter(Boolean);

  rendererNodes.forEach(node => stage.appendChild(node));

  // Replace every previous editor wrapper in one operation.
  editor.replaceChildren(left, stage);

  toolbox.scrollTop = 0;
  toolbox.scrollLeft = 0;

  // If an old inner scroller exists, keep it only as a non-scrolling host.
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

  function activatePage(name) {
    const target = sections.find(section => section.dataset.toolSection === name)
      || sections[0];
    if (!target) return;

    sections.forEach(section => {
      const active = section === target;
      section.classList.toggle("denx-v045-active-page", active);
      section.setAttribute("aria-hidden", active ? "false" : "true");
    });

    links.forEach(link => {
      const active = link.dataset.toolTarget === target.dataset.toolSection;
      link.classList.toggle("active", active);
      link.setAttribute("aria-pressed", active ? "true" : "false");
    });

    toolbox.scrollTop = 0;
    host.scrollTop = 0;
  }

  // Capture phase prevents old workspace-ui scroll navigation from running.
  quickFind.addEventListener("click", event => {
    const link = event.target.closest(".quickfind-link");
    if (!link) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    activatePage(link.dataset.toolTarget);
  }, true);

  // Toolbox never participates in stage gestures.
  left.addEventListener("pointerdown", event => event.stopPropagation(), { passive:true });
  left.addEventListener("touchmove", event => event.stopPropagation(), { passive:true });

  // Native wheel/trackpad movement cannot create hidden scroll offsets.
  left.addEventListener("wheel", event => {
    event.preventDefault();
  }, { passive:false });

  // Open the page containing a tool when that tool is activated by another UI.
  window.addEventListener("denx:toolchange", event => {
    const tool = String(event.detail?.tool || "");
    if (["pan","select"].includes(tool)) activatePage("general");
    else if (["pencil","eraser","text"].includes(tool)) activatePage("draw");
    else if (tool === "camera") activatePage("camera");
  });

  // Re-anchor contextual rails after selection, without reparent churn.
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

  // Start where DenX starts: General / Pan.
  activatePage("general");
})();