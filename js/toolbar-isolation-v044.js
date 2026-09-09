(() => {
  "use strict";
  const editor = document.querySelector(".editor");
  const toolbox = document.getElementById("toolbox");
  const quickFind = document.querySelector(".tool-quickfind");
  const viewport = document.getElementById("viewport");
  if (!editor || !toolbox || !viewport || editor.dataset.denxLayout044 === "1") return;

  editor.dataset.denxLayout044 = "1";
  editor.classList.add("denx-layout-isolated");

  const leftRegion = document.createElement("div");
  leftRegion.className = "denx-left-region";
  leftRegion.id = "denxLeftRegion";

  const editorRegion = document.createElement("div");
  editorRegion.className = "denx-editor-region";
  editorRegion.id = "denxEditorRegion";

  // Build the left toolbar's only scroll surface.
  let scroller = toolbox.querySelector(":scope > .denx-toolbox-scroller");
  if (!scroller) {
    scroller = document.createElement("div");
    scroller.className = "denx-toolbox-scroller";
    scroller.id = "denxToolboxScroller";
    [...toolbox.children]
      .filter(el => el.matches?.("[data-tool-section]"))
      .forEach(section => scroller.appendChild(section));
    toolbox.appendChild(scroller);
  }

  // Move UI into two true sibling regions. IDs and event listeners survive.
  leftRegion.appendChild(toolbox);
  if (quickFind) leftRegion.appendChild(quickFind);

  const rendererChildren = [
    document.getElementById("cameraProperties"),
    document.getElementById("figureActionsRail"),
    document.getElementById("textActionsRail"),
    viewport,
    editor.querySelector(".zoom-controls")
  ].filter(Boolean);

  rendererChildren.forEach(node => editorRegion.appendChild(node));

  editor.replaceChildren(leftRegion, editorRegion);

  // Old workspace-ui listens to #toolbox scroll. It no longer scrolls.
  toolbox.scrollTop = 0;
  toolbox.scrollLeft = 0;

  const links = [...document.querySelectorAll(".quickfind-link")];
  const sections = [...scroller.querySelectorAll("[data-tool-section]")];

  const sectionTop = section => {
    const sr = scroller.getBoundingClientRect();
    const tr = section.getBoundingClientRect();
    return scroller.scrollTop + (tr.top - sr.top);
  };

  const setQuick = name => {
    links.forEach(link => link.classList.toggle(
      "active",
      link.dataset.toolTarget === name
    ));
  };

  let raf = 0;
  const syncQuick = () => {
    raf = 0;
    const marker = scroller.scrollTop + 54;
    let active = sections[0] || null;
    for (const section of sections) {
      if (sectionTop(section) <= marker) active = section;
    }
    if (active) setQuick(active.dataset.toolSection);
  };

  scroller.addEventListener("scroll", () => {
    if (!raf) raf = requestAnimationFrame(syncQuick);
  }, { passive:true });

  // Own Quick Find before old workspace-ui's listener sees the click.
  document.addEventListener("click", event => {
    const link = event.target.closest?.(".quickfind-link");
    if (!link || !leftRegion.contains(link)) return;
    const target = scroller.querySelector(
      `[data-tool-section="${link.dataset.toolTarget}"]`
    );
    if (!target) return;

    event.preventDefault();
    event.stopImmediatePropagation();

    scroller.scrollTo({
      top: Math.max(0, sectionTop(target) - 6),
      behavior: "auto"
    });
    setQuick(link.dataset.toolTarget);
  }, true);

  // Pointer events inside the dedicated left region never fall through to
  // canvas Pan/Select gesture handlers.
  leftRegion.addEventListener("pointerdown", event => {
    event.stopPropagation();
  }, { passive:true });

  // Right rails must remain in the renderer region after every selection.
  const anchorRails = () => {
    ["figureActionsRail","textActionsRail"].forEach(id => {
      const rail = document.getElementById(id);
      if (!rail) return;
      if (rail.parentElement !== editorRegion) editorRegion.appendChild(rail);
      rail.style.left = "auto";
      rail.style.right = "0";
    });
  };
  window.addEventListener("denx:figureselectionchange", anchorRails);
  window.addEventListener("denx:textselectionchange", anchorRails);
  anchorRails();
  syncQuick();
})();