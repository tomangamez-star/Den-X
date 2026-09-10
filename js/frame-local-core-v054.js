(() => {
  "use strict";

  if (window.denxFrameLocalCoreV054) return;
  window.denxFrameLocalCoreV054 = { status: "waiting" };

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

  function install() {
    if (
      typeof window.denxBonesCaptureProjectState !== "function" ||
      typeof window.denxBonesRestoreProjectState !== "function" ||
      typeof window.denxScaleFigure !== "function" ||
      typeof window.denxRotateFigure !== "function" ||
      typeof window.denxFlipFigure !== "function"
    ) {
      return false;
    }

    if (window.denxFrameLocalCoreV054.status === "active") return true;

    const original = {
      begin: window.denxBeginFigureTransform,
      end: window.denxEndFigureTransform
    };

    let transaction = null;

    function stateFor(figureId) {
      const snapshot = window.denxBonesCaptureProjectState();
      const frame = currentFrame();
      const figure = (snapshot.figures || []).find(
        item => String(item.id) === String(figureId)
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

    function ensurePoseLengths(figure, pose) {
      pose.denxSegmentLengths = pose.denxSegmentLengths || {};
      for (const segment of figure.segments || []) {
        const a = pose.nodes?.[segment.from];
        const b = pose.nodes?.[segment.to];
        if (!a || !b) continue;

        const length = Math.max(1, Math.hypot(b.x-a.x, b.y-a.y));
        pose.denxSegmentLengths[segment.id] = length;
      }
    }

    function applyWorkingLengths(snapshot, figure, pose) {
      ensurePoseLengths(figure, pose);
      for (const segment of figure.segments || []) {
        const length = Number(pose.denxSegmentLengths?.[segment.id]);
        if (Number.isFinite(length) && length > 0) {
          // segment.length becomes only a WORKING constraint cache.
          // Each frame restores its own value when activated.
          segment.length = length;
        }
      }
    }

    function commit(snapshot, figure, pose, record = true) {
      applyWorkingLengths(snapshot, figure, pose);

      window.denxBonesRestoreProjectState(snapshot);
      markChanged();

      if (transaction) transaction.changed = true;
      return true;
    }

    function scaleCurrent(figureId, factor, options = {}) {
      factor = Number(factor);
      if (!Number.isFinite(factor) || factor <= 0) return false;

      const state = stateFor(figureId);
      if (!state) return false;

      const { snapshot, figure, pose } = state;
      const root = pose.nodes?.[figure.rootNodeId];
      if (!root) return false;

      Object.entries(pose.nodes || {}).forEach(([nodeId, point]) => {
        if (!point || String(nodeId) === String(figure.rootNodeId)) return;
        pose.nodes[nodeId] = {
          x: root.x + (point.x-root.x) * factor,
          y: root.y + (point.y-root.y) * factor
        };
      });

      ensurePoseLengths(figure, pose);
      return commit(snapshot, figure, pose, options.record !== false);
    }

    function rotateCurrent(figureId, degrees, options = {}) {
      degrees = Number(degrees);
      if (!Number.isFinite(degrees) || Math.abs(degrees) < 0.0001) return false;

      const state = stateFor(figureId);
      if (!state) return false;

      const { snapshot, figure, pose } = state;
      const root = pose.nodes?.[figure.rootNodeId];
      if (!root) return false;

      const radians = degrees * Math.PI / 180;
      const cos = Math.cos(radians);
      const sin = Math.sin(radians);

      Object.entries(pose.nodes || {}).forEach(([nodeId, point]) => {
        if (!point || String(nodeId) === String(figure.rootNodeId)) return;
        const dx = point.x-root.x;
        const dy = point.y-root.y;
        pose.nodes[nodeId] = {
          x: root.x + dx*cos - dy*sin,
          y: root.y + dx*sin + dy*cos
        };
      });

      return commit(snapshot, figure, pose, options.record !== false);
    }

    function flipCurrent(figureId, axis) {
      axis = String(axis || "").toLowerCase();
      if (!["x","y","z"].includes(axis)) return false;

      const state = stateFor(figureId);
      if (!state) return false;

      const { snapshot, figure, pose } = state;
      const root = pose.nodes?.[figure.rootNodeId];
      if (!root) return false;

      Object.entries(pose.nodes || {}).forEach(([nodeId, point]) => {
        if (!point || String(nodeId) === String(figure.rootNodeId)) return;
        const dx = point.x-root.x;
        const dy = point.y-root.y;

        if (axis === "x") {
          pose.nodes[nodeId] = { x: root.x-dx, y: point.y };
        } else if (axis === "y") {
          pose.nodes[nodeId] = { x: point.x, y: root.y-dy };
        } else {
          pose.nodes[nodeId] = { x: root.x-dx, y: root.y-dy };
        }
      });

      return commit(snapshot, figure, pose, true);
    }

    function syncActiveFrameConstraints() {
      const snapshot = window.denxBonesCaptureProjectState?.();
      if (!snapshot) return;

      const frame = currentFrame();
      const framePose =
        snapshot.framePoses?.[frame] ||
        snapshot.framePoses?.[String(frame)];

      if (!framePose) return;

      let touched = false;

      for (const figure of snapshot.figures || []) {
        const pose =
          framePose?.[figure.id] ||
          framePose?.[String(figure.id)];

        if (!pose?.nodes) continue;

        // First visit to an old frame: capture its actual geometry.
        ensurePoseLengths(figure, pose);

        for (const segment of figure.segments || []) {
          const length = Number(pose.denxSegmentLengths?.[segment.id]);
          if (!Number.isFinite(length) || length <= 0) continue;
          if (Math.abs(Number(segment.length || 0)-length) > 0.01) {
            segment.length = length;
            touched = true;
          }
        }
      }

      if (touched) {
        window.denxBonesRestoreProjectState(snapshot);
        window.denxWebGLRenderer?.requestRender?.();
      }
    }

    // IMPORTANT: workspace-ui.js calls these window functions at interaction time.
    // This installation occurs only AFTER bones.js has exported them, fixing the
    // v0.5.3 load-order bug.
    window.denxScaleFigure = (figureId, factor) =>
      scaleCurrent(figureId, factor, { record: true });

    window.denxScaleFigureLive = (figureId, factor) =>
      scaleCurrent(figureId, factor, { record: false });

    window.denxRotateFigure = (figureId, degrees) =>
      rotateCurrent(figureId, degrees, { record: true });

    window.denxRotateFigureLive = (figureId, degrees) =>
      rotateCurrent(figureId, degrees, { record: false });

    window.denxFlipFigure = flipCurrent;

    window.denxBeginFigureTransform = figureId => {
      transaction = {
        figureId,
        before: window.denxBonesCaptureProjectState?.(),
        changed: false
      };
      return original.begin?.(figureId) ?? true;
    };

    window.denxEndFigureTransform = figureId => {
      const tx = transaction;
      transaction = null;

      // The original transaction system is allowed to close, but all live
      // transform calls above only changed the current pose.
      const result = original.end?.(figureId);
      if (tx?.changed) markChanged();
      return result ?? !!tx?.changed;
    };

    // Restore each frame's working constraint lengths immediately when frame changes.
    const frameHost = document.getElementById("frameContainer");
    if (frameHost) {
      let last = currentFrame();
      new MutationObserver(() => {
        const next = currentFrame();
        if (next === last) return;
        last = next;
        queueMicrotask(syncActiveFrameConstraints);
      }).observe(frameHost, {
        subtree: true,
        childList: true,
        attributes: true,
        attributeFilter: ["class"]
      });
    }

    window.addEventListener("denx:framechange", syncActiveFrameConstraints);

    syncActiveFrameConstraints();

    window.denxFrameLocalCoreV054 = {
      status: "active",
      version: "0.5.4",
      scaleCurrent,
      rotateCurrent,
      flipCurrent,
      syncActiveFrameConstraints
    };

    console.info("[DenX] Frame-local figure transforms active v0.5.4");
    return true;
  }

  // app.js runs before bones.js in workspace.html. Poll briefly until bones
  // finishes loading, then install exactly once.
  let tries = 0;
  const timer = setInterval(() => {
    tries += 1;
    if (install() || tries > 200) {
      clearInterval(timer);
      if (tries > 200 && window.denxFrameLocalCoreV054.status !== "active") {
        window.denxFrameLocalCoreV054.status = "failed";
        console.error("[DenX] Frame-local core could not attach.");
      }
    }
  }, 25);

  window.addEventListener("load", install, { once: true });
})();