(() => {
  "use strict";

  const toolbox = document.getElementById("toolbox");
  if (!toolbox || toolbox.dataset.denxToolbar043 === "1") return;

  toolbox.dataset.denxToolbar043 = "1";

  // Fixed shell + inner scroller.
  let scroller = toolbox.querySelector(":scope > .denx-toolbox-scroller");
  if (!scroller) {
    scroller = document.createElement("div");
    scroller.className = "denx-toolbox-scroller";
    scroller.id = "denxToolboxScroller";
    scroller.setAttribute("role", "group");
    scroller.setAttribute("aria-label", "DenX toolbox tools");

    const sections = [...toolbox.children].filter(
      el => el.matches?.("[data-tool-section]")
    );
    sections.forEach(section => scroller.appendChild(section));
    toolbox.appendChild(scroller);
  }

  // The old outer scroller must stay pinned forever.
  toolbox.scrollTop = 0;
  toolbox.scrollLeft = 0;

  const quickLinks = [...document.querySelectorAll(".quickfind-link")];
  const sections = [...scroller.querySelectorAll("[data-tool-section]")];

  function setActive(name) {
    quickLinks.forEach(link => {
      link.classList.toggle("active", link.dataset.toolTarget === name);
    });
  }

  function sectionTop(section) {
    const sr = scroller.getBoundingClientRect();
    const tr = section.getBoundingClientRect();
    return scroller.scrollTop + (tr.top - sr.top);
  }

  let scrollRaf = 0;
  function syncQuickFind() {
    scrollRaf = 0;
    const marker = scroller.scrollTop + 54;
    let active = sections[0] || null;

    for (const section of sections) {
      if (sectionTop(section) <= marker) active = section;
    }

    if (active) setActive(active.dataset.toolSection);
  }

  scroller.addEventListener("scroll", () => {
    if (!scrollRaf) scrollRaf = requestAnimationFrame(syncQuickFind);
  }, { passive: true });

  // Capture phase deliberately owns Quick Find navigation. This prevents the
  // old workspace-ui listener from trying to scroll #toolbox itself.
  document.addEventListener("click", event => {
    const link = event.target.closest?.(".quickfind-link");
    if (!link) return;

    const target = scroller.querySelector(
      `[data-tool-section="${link.dataset.toolTarget}"]`
    );
    if (!target) return;

    event.preventDefault();
    event.stopImmediatePropagation();

    const top = Math.max(0, sectionTop(target) - 6);
    scroller.scrollTo({ top, behavior: "auto" });
    setActive(link.dataset.toolTarget);
  }, true);

  // Do not allow wheel/touch scroll chaining to turn into canvas navigation.
  scroller.addEventListener("pointerdown", event => {
    event.stopPropagation();
  }, { passive: true });

  // Re-assert right rail ownership after any selection UI updates.
  function anchorRightRails() {
    const rails = [
      document.getElementById("figureActionsRail"),
      document.getElementById("textActionsRail")
    ].filter(Boolean);

    rails.forEach(rail => {
      rail.style.right = "0";
      rail.style.left = "auto";
    });
  }

  window.addEventListener("denx:figureselectionchange", anchorRightRails);
  window.addEventListener("denx:textselectionchange", anchorRightRails);
  anchorRightRails();
  syncQuickFind();
})();