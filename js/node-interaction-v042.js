(() => {
  "use strict";
  const layer = document.getElementById("figureLayer");
  if (!layer || typeof window.denxBonesCaptureProjectState !== "function") return;

  const STAGE_WIDTH = 2048, STAGE_HEIGHT = 1152, HIT_SCREEN_PX = 18;
  let redirecting = false, activeGuide = null, guideRaf = 0;

  const state = () => {
    try { return window.denxBonesCaptureProjectState?.() || null; }
    catch (_) { return null; }
  };

  function stagePoint(clientX, clientY) {
    const rect = layer.getBoundingClientRect();
    return {
      x: ((clientX - rect.left) / Math.max(1, rect.width)) * STAGE_WIDTH,
      y: ((clientY - rect.top) / Math.max(1, rect.height)) * STAGE_HEIGHT
    };
  }

  function stageHitRadius() {
    const rect = layer.getBoundingClientRect();
    return HIT_SCREEN_PX * Math.max(
      STAGE_WIDTH / Math.max(1, rect.width),
      STAGE_HEIGHT / Math.max(1, rect.height)
    );
  }

  function connectedRank(figure, nodeId, previousNodeId) {
    if (!previousNodeId || nodeId === previousNodeId) return 0;
    const node = figure.nodes?.find(n => String(n.id) === String(nodeId));
    const previous = figure.nodes?.find(n => String(n.id) === String(previousNodeId));
    if (!node || !previous) return 2;
    if (String(node.parentId || "") === String(previousNodeId)) return 0;
    if (String(previous.parentId || "") === String(nodeId)) return 0;
    if (node.parentId && previous.parentId && String(node.parentId) === String(previous.parentId)) return 1;
    return 2;
  }

  function nearestNode(clientX, clientY) {
    const snapshot = state();
    if (!snapshot) return null;
    const frame = Number(document.querySelector(".frame.active")?.dataset?.frame || 1);
    const poses = snapshot.framePoses?.[frame] || snapshot.framePoses?.[String(frame)] || {};
    const p = stagePoint(clientX, clientY), radius = stageHitRadius(), candidates = [];

    (snapshot.figures || []).forEach((figure, figureIndex) => {
      const pose = poses[figure.id];
      if (!pose || pose.visible === false) return;
      (figure.nodes || []).forEach(node => {
        const q = pose.nodes?.[node.id];
        if (!q) return;
        const distance = Math.hypot(q.x - p.x, q.y - p.y);
        if (distance > radius) return;
        const sameFigure = snapshot.selectedFigureId === figure.id ? 0 : 1;
        const chain = sameFigure === 0 ? connectedRank(figure, node.id, snapshot.selectedNodeId) : 3;
        candidates.push({ figure, node, distance, sameFigure, chain, figureIndex, snapshot });
      });
    });

    candidates.sort((a, b) =>
      a.sameFigure - b.sameFigure ||
      a.chain - b.chain ||
      a.distance - b.distance ||
      b.figureIndex - a.figureIndex
    );
    return candidates[0] || null;
  }

  function actualNodeTarget(figureId, nodeId) {
    return [...layer.querySelectorAll('[data-denx-node="1"]')].find(el =>
      el.getAttribute("data-figure-id") === String(figureId) &&
      el.getAttribute("data-node-id") === String(nodeId)
    ) || null;
  }

  function dispatchNodeDown(original, target) {
    target.dispatchEvent(new PointerEvent("pointerdown", {
      bubbles: true, cancelable: true, composed: true,
      pointerId: original.pointerId,
      width: original.width || 1, height: original.height || 1,
      pressure: original.pressure || 0.5,
      pointerType: original.pointerType || "touch",
      isPrimary: true,
      clientX: original.clientX, clientY: original.clientY,
      screenX: original.screenX, screenY: original.screenY,
      button: 0, buttons: 1
    }));
  }

  function guideEndpoints() {
    const snapshot = state();
    if (!snapshot?.selectedFigureId || !snapshot?.selectedNodeId) return null;
    const figure = snapshot.figures?.find(f => f.id === snapshot.selectedFigureId);
    const node = figure?.nodes?.find(n => String(n.id) === String(snapshot.selectedNodeId));
    if (!figure || !node) return null;

    let otherId = node.parentId;
    if (!otherId) otherId = figure.nodes?.find(n => String(n.parentId || "") === String(node.id))?.id || null;
    if (!otherId) return null;

    const group = [...layer.querySelectorAll(".denx-figure")].find(
      el => el.getAttribute("data-figure-id") === String(figure.id)
    );
    if (!group) return null;
    const selectedEl = [...group.querySelectorAll(".figure-node-visual")].find(
      el => el.getAttribute("data-node-id") === String(node.id)
    );
    const otherEl = [...group.querySelectorAll(".figure-node-visual")].find(
      el => el.getAttribute("data-node-id") === String(otherId)
    );
    if (!selectedEl || !otherEl) return null;

    const pointFor = el => el.tagName.toLowerCase() === "rect"
      ? { x: Number(el.getAttribute("x")) + Number(el.getAttribute("width")) / 2,
          y: Number(el.getAttribute("y")) + Number(el.getAttribute("height")) / 2 }
      : { x: Number(el.getAttribute("cx")), y: Number(el.getAttribute("cy")) };
    return { a: pointFor(selectedEl), b: pointFor(otherEl) };
  }

  function drawGuide() {
    guideRaf = 0;
    const points = guideEndpoints();
    if (!points) {
      activeGuide?.remove(); activeGuide = null; return;
    }
    if (!activeGuide || !activeGuide.isConnected) {
      activeGuide = document.createElementNS("http://www.w3.org/2000/svg", "line");
      activeGuide.setAttribute("class", "denx-active-chain-guide");
      activeGuide.setAttribute("pointer-events", "none");
      layer.appendChild(activeGuide);
    }
    activeGuide.setAttribute("x1", points.a.x);
    activeGuide.setAttribute("y1", points.a.y);
    activeGuide.setAttribute("x2", points.b.x);
    activeGuide.setAttribute("y2", points.b.y);
  }

  function scheduleGuide() {
    if (!guideRaf) guideRaf = requestAnimationFrame(drawGuide);
  }

  document.addEventListener("pointerdown", e => {
    if (redirecting || !e.isPrimary || window.denxIsPlaying?.()) return;
    if (!document.getElementById("workspace")) return;
    const hit = nearestNode(e.clientX, e.clientY);
    if (!hit) return;

    const existing = actualNodeTarget(hit.figure.id, hit.node.id);
    const direct = existing && e.target.closest?.('[data-denx-node="1"]') === existing &&
                   hit.snapshot.selectedFigureId === hit.figure.id;
    if (direct) { scheduleGuide(); return; }

    // Node acquisition outranks canvas Pan.
    e.preventDefault();
    e.stopImmediatePropagation();
    redirecting = true;
    try {
      // Interaction routing enters Select directly. Never synthesize a toolbar click.
      if (window.denxCurrentTool?.() !== "select") {
        window.denxSetTool?.("select");
      }

      const fresh = state();
      if (!fresh) return;
      fresh.selectedFigureId = hit.figure.id;
      fresh.selectedNodeId = hit.node.id;
      window.denxBonesRestoreProjectState(fresh);

      const target = actualNodeTarget(hit.figure.id, hit.node.id);
      if (target) dispatchNodeDown(e, target);
      scheduleGuide();
    } finally {
      redirecting = false;
    }
  }, true);

  document.addEventListener("pointermove", scheduleGuide, true);
  document.addEventListener("pointerup", scheduleGuide, true);
  document.addEventListener("pointercancel", scheduleGuide, true);
  window.addEventListener("denx:figureselectionchange", scheduleGuide);
  window.addEventListener("denx:toolchange", scheduleGuide);
  window.addEventListener("denx:camera-updated", scheduleGuide);
  window.addEventListener("denx:navigationend", scheduleGuide);

  new MutationObserver(scheduleGuide).observe(layer, { childList: true });
  scheduleGuide();
})();