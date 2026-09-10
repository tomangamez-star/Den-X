(() => {
  "use strict";

  const rail = document.getElementById("figureActionsRail");
  if (!rail || !window.denxBonesCaptureProjectState || !window.denxBonesRestoreProjectState) return;

  const section = rail.querySelector(".figure-context-section");
  const editBtn = document.getElementById("figureEditBtn");
  if (!section || document.getElementById("figureCopyBtn")) return;

  const row = document.createElement("div");
  row.className = "denx-figure-copy-row";
  row.setAttribute("aria-label", "Figure clipboard");

  const copyBtn = document.createElement("button");
  copyBtn.id = "figureCopyBtn";
  copyBtn.type = "button";
  copyBtn.className = "tool-row tool-action";
  copyBtn.title = "Copy selected figure";
  copyBtn.innerHTML = '<span class="tool-icon"><img src="icons/ui/copy.svg" alt="Copy"></span>';

  const pasteBtn = document.createElement("button");
  pasteBtn.id = "figurePasteBtn";
  pasteBtn.type = "button";
  pasteBtn.className = "tool-row tool-action";
  pasteBtn.title = "Paste copied figure";
  pasteBtn.disabled = true;
  pasteBtn.innerHTML = '<span class="tool-icon"><img src="icons/ui/clipboard.svg" alt="Paste"></span>';

  row.append(copyBtn, pasteBtn);
  const figureName = document.getElementById("figureActionsName");

  function selectedFigureName(detail = null) {
    if (detail?.name) return detail.name;
    const state = window.denxBonesCaptureProjectState?.();
    const selected = state?.figures?.find(
      figure => String(figure.id) === String(state.selectedFigureId)
    );
    return selected?.name || "Figure";
  }

  function placeClipboardRow(detail = null) {
    if (!figureName || !section) return;

    // Keep the figure name as a real, independent row.
    const name = selectedFigureName(detail);
    if (name) figureName.textContent = name;

    // Physically place clipboard immediately after the name node.
    if (figureName.parentElement === section && figureName.nextElementSibling !== row) {
      section.insertBefore(row, figureName.nextSibling);
    }
  }

  placeClipboardRow();
  requestAnimationFrame(() => placeClipboardRow());

  let clipboard = null;

  const clone = value => JSON.parse(JSON.stringify(value));

  function toast(message) {
    window.denxShowToast?.(message);
  }

  function unique(prefix, used) {
    let n = 1;
    let candidate = "";
    do {
      candidate = `${prefix}-${Date.now().toString(36)}-${n++}`;
    } while (used.has(candidate));
    used.add(candidate);
    return candidate;
  }

  function copySelectedFigure() {
    const state = window.denxBonesCaptureProjectState();
    const figureId = state?.selectedFigureId;
    const figure = state?.figures?.find(item => item.id === figureId);
    if (!figure) {
      toast("Select a figure first.");
      return;
    }

    const poses = {};
    Object.entries(state.framePoses || {}).forEach(([frame, framePose]) => {
      if (framePose?.[figureId]) poses[frame] = clone(framePose[figureId]);
    });

    clipboard = {
      figure: clone(figure),
      poses
    };
    pasteBtn.disabled = false;
    toast(`${figure.name || "Figure"} copied ✓`);
  }

  function pasteFigure() {
    if (!clipboard) {
      toast("Copy a figure first.");
      return;
    }

    const state = window.denxBonesCaptureProjectState();
    if (!state) return;

    const usedFigures = new Set((state.figures || []).map(f => String(f.id)));
    const usedNodes = new Set(
      (state.figures || []).flatMap(f => (f.nodes || []).map(n => String(n.id)))
    );
    const usedSegments = new Set(
      (state.figures || []).flatMap(f => (f.segments || []).map(s => String(s.id)))
    );

    const source = clone(clipboard.figure);
    const newFigureId = unique("figure", usedFigures);
    const nodeMap = new Map();

    (source.nodes || []).forEach(node => {
      nodeMap.set(String(node.id), unique("node", usedNodes));
    });

    const pasted = clone(source);
    pasted.id = newFigureId;
    pasted.name = `${source.name || "Figure"} Copy`;
    pasted.rootNodeId = nodeMap.get(String(source.rootNodeId)) || source.rootNodeId;
    pasted.headNodeId = source.headNodeId
      ? (nodeMap.get(String(source.headNodeId)) || source.headNodeId)
      : null;

    pasted.nodes = (source.nodes || []).map(node => ({
      ...node,
      id: nodeMap.get(String(node.id)),
      parentId: node.parentId == null
        ? null
        : (nodeMap.get(String(node.parentId)) || node.parentId)
    }));

    pasted.segments = (source.segments || []).map(segment => ({
      ...segment,
      id: unique("segment", usedSegments),
      from: nodeMap.get(String(segment.from)) || segment.from,
      to: nodeMap.get(String(segment.to)) || segment.to
    }));

    pasted.polyfills = (source.polyfills || []).map(poly => ({
      ...poly,
      id: `${poly.id || "poly"}-${Date.now().toString(36)}`,
      nodeIds: (poly.nodeIds || []).map(id => nodeMap.get(String(id)) || id)
    }));

    state.figures = [...(state.figures || []), pasted];
    state.framePoses = state.framePoses || {};

    const frameKeys = new Set([
      ...Object.keys(state.framePoses),
      ...Object.keys(clipboard.poses || {})
    ]);

    for (const frame of frameKeys) {
      state.framePoses[frame] = state.framePoses[frame] || {};
      const sourcePose =
        clipboard.poses?.[frame] ||
        clipboard.poses?.[Object.keys(clipboard.poses || {})[0]];
      if (!sourcePose) continue;

      const nextPose = clone(sourcePose);
      const nextNodes = {};
      Object.entries(nextPose.nodes || {}).forEach(([oldId, point]) => {
        const mapped = nodeMap.get(String(oldId));
        if (!mapped || !point) return;
        // Small offset makes the duplicate obvious and independently draggable.
        nextNodes[mapped] = {
          x: Number(point.x || 0) + 42,
          y: Number(point.y || 0) + 42
        };
      });
      nextPose.nodes = nextNodes;
      nextPose.visible = sourcePose.visible !== false;
      state.framePoses[frame][newFigureId] = nextPose;
    }

    state.selectedFigureId = newFigureId;
    state.selectedNodeId = pasted.rootNodeId;

    window.denxBonesRestoreProjectState(state);
    window.denxRefreshOnionSkin?.();
    window.denxRefreshAllFrameThumbnails?.();
    window.denxMarkWorkspaceDirty?.();
    toast(`${pasted.name} pasted ✓`);
  }

  copyBtn.addEventListener("click", copySelectedFigure);
  pasteBtn.addEventListener("click", pasteFigure);

  window.addEventListener("denx:figureselectionchange", event => {
    placeClipboardRow(event.detail);
    copyBtn.disabled = !event.detail;
    pasteBtn.disabled = !clipboard;
  });
})();