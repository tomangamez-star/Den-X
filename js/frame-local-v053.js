(() => {
  "use strict";

  if (window.denxFrameLocalEngine?.version === "0.5.3") return;

  const clone = value => JSON.parse(JSON.stringify(value));

  function currentFrame() {
    return Math.max(
      1,
      Number(document.querySelector(".frame.active")?.dataset?.frame) ||
      Number(window.currentFrame) ||
      1
    );
  }

  function markChanged() {
    window.denxMarkWorkspaceDirty?.();
    window.denxRefreshOnionSkin?.();
    window.denxRefreshFrameThumbnail?.(currentFrame());
    window.denxWebGLRenderer?.requestRender?.();
  }

  // ==========================================================
  // FIGURES — scale / rotate / flip are CURRENT FRAME ONLY.
  // ==========================================================

  function getFigureState(figureId) {
    const snapshot = window.denxBonesCaptureProjectState?.();
    if (!snapshot) return null;

    const frame = currentFrame();
    const figure = (snapshot.figures || []).find(
      f => String(f.id) === String(figureId)
    );

    const framePose =
      snapshot.framePoses?.[frame] ||
      snapshot.framePoses?.[String(frame)];

    const pose =
      framePose?.[figureId] ||
      framePose?.[String(figureId)];

    if (!figure || !pose?.nodes) return null;

    return { snapshot, figure, pose, frame };
  }

  function commitFigure(snapshot) {
    window.denxBonesRestoreProjectState?.(snapshot);
    markChanged();
    return true;
  }

  function scaleCurrentFrame(figureId, factor) {
    factor = Number(factor);
    if (!Number.isFinite(factor) || factor <= 0) return false;

    const state = getFigureState(figureId);
    if (!state) return false;

    const { snapshot, figure, pose } = state;
    const root = pose.nodes?.[figure.rootNodeId];
    if (!root) return false;

    Object.entries(pose.nodes || {}).forEach(([nodeId, point]) => {
      if (!point || String(nodeId) === String(figure.rootNodeId)) return;
      pose.nodes[nodeId] = {
        x: root.x + (point.x - root.x) * factor,
        y: root.y + (point.y - root.y) * factor
      };
    });

    return commitFigure(snapshot);
  }

  function rotateCurrentFrame(figureId, degrees) {
    degrees = Number(degrees);
    if (!Number.isFinite(degrees) || Math.abs(degrees) < 0.0001) return false;

    const state = getFigureState(figureId);
    if (!state) return false;

    const { snapshot, figure, pose } = state;
    const root = pose.nodes?.[figure.rootNodeId];
    if (!root) return false;

    const radians = degrees * Math.PI / 180;
    const cos = Math.cos(radians);
    const sin = Math.sin(radians);

    Object.entries(pose.nodes || {}).forEach(([nodeId, point]) => {
      if (!point || String(nodeId) === String(figure.rootNodeId)) return;
      const dx = point.x - root.x;
      const dy = point.y - root.y;
      pose.nodes[nodeId] = {
        x: root.x + dx * cos - dy * sin,
        y: root.y + dx * sin + dy * cos
      };
    });

    return commitFigure(snapshot);
  }

  function flipCurrentFrame(figureId, axis) {
    axis = String(axis || "").toLowerCase();
    if (!["x", "y", "z"].includes(axis)) return false;

    const state = getFigureState(figureId);
    if (!state) return false;

    const { snapshot, figure, pose } = state;
    const root = pose.nodes?.[figure.rootNodeId];
    if (!root) return false;

    Object.entries(pose.nodes || {}).forEach(([nodeId, point]) => {
      if (!point || String(nodeId) === String(figure.rootNodeId)) return;
      const dx = point.x - root.x;
      const dy = point.y - root.y;

      if (axis === "x") {
        pose.nodes[nodeId] = { x: root.x - dx, y: point.y };
      } else if (axis === "y") {
        pose.nodes[nodeId] = { x: point.x, y: root.y - dy };
      } else {
        pose.nodes[nodeId] = { x: root.x - dx, y: root.y - dy };
      }
    });

    return commitFigure(snapshot);
  }

  // Replace the public transform API used by the right toolbar.
  window.denxScaleFigure = scaleCurrentFrame;
  window.denxScaleFigureLive = scaleCurrentFrame;
  window.denxRotateFigure = rotateCurrentFrame;
  window.denxRotateFigureLive = rotateCurrentFrame;
  window.denxFlipFigure = flipCurrentFrame;

  // The existing transform transaction hooks are retained for compatibility.
  // Frame-local changes are already committed atomically through bone snapshots.

  // Keep each frame's constraint lengths coherent after a frame-local scale.
  // bones.js stores segment length on structure, so when the active frame
  // changes we derive the current working lengths from THAT frame's pose.
  function syncWorkingSegmentLengths() {
    const snapshot = window.denxBonesCaptureProjectState?.();
    if (!snapshot) return;

    const frame = currentFrame();
    const fp = snapshot.framePoses?.[frame] || snapshot.framePoses?.[String(frame)];
    if (!fp) return;

    let changed = false;

    for (const figure of snapshot.figures || []) {
      const pose = fp[figure.id] || fp[String(figure.id)];
      if (!pose?.nodes) continue;

      for (const segment of figure.segments || []) {
        const a = pose.nodes[segment.from] || pose.nodes[String(segment.from)];
        const b = pose.nodes[segment.to] || pose.nodes[String(segment.to)];
        if (!a || !b) continue;

        const length = Math.max(1, Math.hypot(b.x - a.x, b.y - a.y));
        if (Math.abs(Number(segment.length || 0) - length) > 0.01) {
          segment.length = length;
          changed = true;
        }
      }
    }

    if (changed) {
      window.denxBonesRestoreProjectState?.(snapshot);
      window.denxWebGLRenderer?.requestRender?.();
    }
  }

  // ==========================================================
  // TEXT — creation and edits become frame-aware.
  // ==========================================================

  const textLayer = document.getElementById("textLayer");
  const frameContainer = document.getElementById("frameContainer");
  let textApplying = false;
  let trackedFrame = currentFrame();
  let textSyncQueued = false;

  const textFields = [
    "text", "x", "y", "scale", "rotation",
    "font", "fontSize", "weight", "color"
  ];

  function textStateFromObject(item) {
    const state = {};
    textFields.forEach(key => {
      if (item[key] !== undefined) state[key] = clone(item[key]);
    });
    return state;
  }

  function applyTextState(item, state) {
    if (!state) return;
    textFields.forEach(key => {
      if (state[key] !== undefined) item[key] = clone(state[key]);
    });
  }

  function nearestTextState(item, frame) {
    const states = item.denxFrameStates || {};
    const frames = Object.keys(states)
      .map(Number)
      .filter(n => Number.isFinite(n) && n <= frame)
      .sort((a,b) => b-a);

    return frames.length ? states[frames[0]] : null;
  }

  function normalizeLegacyText() {
    const objects = window.denxTextObjects;
    if (!Array.isArray(objects)) return;

    for (const item of objects) {
      if (!Number.isFinite(Number(item.denxCreatedFrame))) {
        // Old project text keeps its historical behaviour from frame 1.
        item.denxCreatedFrame = 1;
      }
      item.denxFrameStates = item.denxFrameStates || {};
      if (!item.denxFrameStates[item.denxCreatedFrame]) {
        item.denxFrameStates[item.denxCreatedFrame] = textStateFromObject(item);
      }
    }
  }

  function captureCurrentTextFrame(frame = trackedFrame) {
    if (textApplying) return;
    const objects = window.denxTextObjects;
    if (!Array.isArray(objects)) return;

    for (const item of objects) {
      // New object: creation begins on the frame where it first appeared.
      if (!Number.isFinite(Number(item.denxCreatedFrame))) {
        item.denxCreatedFrame = frame;
      }

      if (frame < Number(item.denxCreatedFrame)) continue;
      if (Number.isFinite(Number(item.denxDeletedFrame)) &&
          frame >= Number(item.denxDeletedFrame)) continue;

      item.denxFrameStates = item.denxFrameStates || {};
      item.denxFrameStates[frame] = textStateFromObject(item);
    }
  }

  function isTextVisible(item, frame) {
    const created = Number(item.denxCreatedFrame || 1);
    const deleted = Number(item.denxDeletedFrame);
    return frame >= created && (!Number.isFinite(deleted) || frame < deleted);
  }

  function enforceTextVisibility(frame = currentFrame()) {
    if (!textLayer) return;
    const objects = window.denxTextObjects;
    if (!Array.isArray(objects)) return;

    const byId = new Map(objects.map(item => [String(item.id), item]));
    textLayer.querySelectorAll(".denx-text-object").forEach(group => {
      const item = byId.get(String(group.dataset.textId));
      group.style.display = item && isTextVisible(item, frame) ? "" : "none";
    });
  }

  function renderTextFrame(frame) {
    const objects = window.denxTextObjects;
    if (!Array.isArray(objects) || typeof window.denxRestoreTextObjects !== "function") return;

    textApplying = true;
    try {
      for (const item of objects) {
        if (!Number.isFinite(Number(item.denxCreatedFrame))) {
          // Anything newly inserted by the text tool belongs to NOW.
          item.denxCreatedFrame = trackedFrame;
          item.denxFrameStates = item.denxFrameStates || {};
          item.denxFrameStates[trackedFrame] = textStateFromObject(item);
        }

        if (!isTextVisible(item, frame)) continue;

        const state = nearestTextState(item, frame);
        if (state) applyTextState(item, state);
      }

      // Restore clones the array and forces text-objects.js to rebuild.
      window.denxRestoreTextObjects(clone(objects));
    } finally {
      textApplying = false;
    }

    requestAnimationFrame(() => enforceTextVisibility(frame));
  }

  function onFrameChanged() {
    const next = currentFrame();
    if (next === trackedFrame) {
      enforceTextVisibility(next);
      return;
    }

    captureCurrentTextFrame(trackedFrame);
    trackedFrame = next;

    syncWorkingSegmentLengths();
    renderTextFrame(next);
  }

  normalizeLegacyText();

  // Observe active frame class changes — works for taps, playback and scrub.
  if (frameContainer) {
    const frameObserver = new MutationObserver(() => {
      queueMicrotask(onFrameChanged);
    });
    frameObserver.observe(frameContainer, {
      subtree: true,
      attributes: true,
      attributeFilter: ["class"],
      childList: true
    });
  }

  // Save text edits for the active frame after text-objects.js updates its SVG.
  if (textLayer) {
    const textObserver = new MutationObserver(() => {
      if (textApplying || textSyncQueued) return;
      textSyncQueued = true;

      queueMicrotask(() => {
        textSyncQueued = false;
        if (textApplying) return;

        const objects = window.denxTextObjects;
        if (!Array.isArray(objects)) return;

        // Detect newly created text and stamp its actual creation frame.
        for (const item of objects) {
          if (!Number.isFinite(Number(item.denxCreatedFrame))) {
            item.denxCreatedFrame = currentFrame();
            item.denxFrameStates = item.denxFrameStates || {};
            item.denxFrameStates[item.denxCreatedFrame] = textStateFromObject(item);
          }
        }

        captureCurrentTextFrame(currentFrame());
        enforceTextVisibility(currentFrame());
        window.denxMarkWorkspaceDirty?.();
      });
    });

    textObserver.observe(textLayer, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["transform", "fill", "font-family", "font-size"]
    });
  }

  // Frame-local delete: hide the text from this frame onward rather than
  // physically erasing it from earlier frames.
  const originalDeleteText = window.denxDeleteSelectedText;
  window.denxDeleteSelectedText = () => {
    const selected = window.denxGetSelectedTextObject?.();
    const objects = window.denxTextObjects;
    if (!selected?.id || !Array.isArray(objects)) {
      return originalDeleteText?.() || false;
    }

    const item = objects.find(x => String(x.id) === String(selected.id));
    if (!item) return false;

    captureCurrentTextFrame(currentFrame());
    item.denxDeletedFrame = currentFrame();

    textApplying = true;
    try {
      window.denxRestoreTextObjects?.(clone(objects));
    } finally {
      textApplying = false;
    }

    requestAnimationFrame(() => enforceTextVisibility(currentFrame()));
    window.denxMarkWorkspaceDirty?.();
    window.denxRefreshFrameThumbnail?.(currentFrame());
    return true;
  };

  // Initial sync after all workspace systems have settled.
  requestAnimationFrame(() => {
    normalizeLegacyText();
    syncWorkingSegmentLengths();
    renderTextFrame(currentFrame());
  });

  window.denxFrameLocalEngine = {
    version: "0.5.3",
    currentFrame,
    syncFigureLengths: syncWorkingSegmentLengths,
    captureTextFrame: captureCurrentTextFrame,
    renderTextFrame
  };
})();