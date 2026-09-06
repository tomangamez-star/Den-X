// =========================
// CAMERA ENGINE
// =========================

const camera = {
    x: 0,
    y: 0,
    zoom: 1
};

window.denxCameraState = camera;

let isPanning = false;
let panPointerId = null;
let lastX = 0;
let lastY = 0;

const activeTouches = new Map();
let pinchStartDistance = null;
let pinchStartZoom = 1;

const viewport = document.getElementById("viewport");
const cameraElement = document.getElementById("camera");
const cameraFrameEl = document.getElementById("cameraFrame");
const stageGuideEl = document.getElementById("stageGuide");
const drawingCanvasEl = document.getElementById("drawingCanvas");
const figureLayerEl = document.getElementById("figureLayer");
const stageEl = document.getElementById("stage");

const playbackMonitorEl = document.getElementById("playbackMonitor");
const playbackScreenEl = document.getElementById("playbackScreen");
const playbackFrameLabelEl = document.getElementById("playbackFrameLabel");

const zoomIn = document.getElementById("zoomIn");
const zoomOut = document.getElementById("zoomOut");
const toggleToolbar = document.getElementById("toggleToolbar");
const toolbar = document.querySelector(".toolbar");

const cameraPropertiesPanel = document.getElementById("cameraProperties");
const cameraPropX = document.getElementById("cameraPropX");
const cameraPropY = document.getElementById("cameraPropY");
const cameraPropWidth = document.getElementById("cameraPropWidth");
const cameraPropHeight = document.getElementById("cameraPropHeight");
const cameraPropRotation = document.getElementById("cameraPropRotation");
const cameraPropGuide = document.getElementById("cameraPropGuide");
const cameraPropQuickMove = document.getElementById("cameraPropQuickMove");

const defaultCameraFrameState = () => ({
    x: 0,
    y: 0,
    width: 260,
    height: 150,
    rotation: 0,
    quickMoveEnabled: true,
    showStageGuide: true
});

function cloneCameraFrameState(state) {
    return {
        x: state.x,
        y: state.y,
        width: state.width,
        height: state.height,
        rotation: state.rotation,
        quickMoveEnabled: state.quickMoveEnabled,
        showStageGuide: state.showStageGuide
    };
}

const cameraFrameStates = window.denxCameraFrameStates || {
    1: defaultCameraFrameState()
};
window.denxCameraFrameStates = cameraFrameStates;

let cameraFrameState = null;

function getCameraFrameState(frameNumber = currentFrame) {
    if (!cameraFrameStates[frameNumber]) {
        const sourceFrame =
            cameraFrameStates[currentFrame] ||
            cameraFrameStates[1] ||
            defaultCameraFrameState();

        cameraFrameStates[frameNumber] = cloneCameraFrameState(sourceFrame);
    }

    return cameraFrameStates[frameNumber];
}

function saveCameraFrameState(frameNumber = currentFrame) {
    const state = getCameraFrameState(frameNumber);

    if (!cameraFrameState) return state;

    state.x = cameraFrameState.x;
    state.y = cameraFrameState.y;
    state.width = cameraFrameState.width;
    state.height = cameraFrameState.height;
    state.rotation = cameraFrameState.rotation;
    state.quickMoveEnabled = cameraFrameState.quickMoveEnabled;
    state.showStageGuide = cameraFrameState.showStageGuide;

    return state;
}

function loadCameraFrameState(frameNumber = currentFrame) {
    cameraFrameState = getCameraFrameState(frameNumber);
    syncCameraFrame();
    syncCameraPropertiesPanel();
    updateCameraInteractionUI();

    if (window.denxPlaybackMonitorActive?.()) {
        requestAnimationFrame(() => {
            window.denxUpdatePlaybackMonitor?.(frameNumber);
        });
    }

    return cameraFrameState;
}

window.denxSaveCameraFrameState = saveCameraFrameState;
window.denxLoadCameraFrameState = loadCameraFrameState;
window.denxCloneCameraFrameState = cloneCameraFrameState;
window.denxGetCameraFrameState = frameNumber =>
    cloneCameraFrameState(getCameraFrameState(frameNumber));

const handleState = {
    active: false,
    pointerId: null,
    mode: null,
    startState: null,
    startPointerWorld: null,
    startAngle: 0,
    startDistance: 1,
    startCenter: null
};

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function getDistance(p1, p2) {
    return Math.hypot(p1.x - p2.x, p1.y - p2.y);
}

function getWorkspacePoint(clientX, clientY) {
    if (!viewport) {
        return { x: clientX, y: clientY };
    }

    const rect = viewport.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    return {
        x: (clientX - centerX - camera.x) / (camera.zoom || 1),
        y: (clientY - centerY - camera.y) / (camera.zoom || 1)
    };
}

function updateWorkspace() {
    if (!cameraElement) return;

    cameraElement.style.transform =
        `translate(-50%, -50%)
         translate(${camera.x}px, ${camera.y}px)
         scale(${camera.zoom})`;

    window.dispatchEvent(new CustomEvent("denx:camera-updated", {
        detail: {
            x: camera.x,
            y: camera.y,
            zoom: camera.zoom
        }
    }));
}

function syncStageGuide() {
    if (!stageGuideEl || !cameraFrameState) return;
    stageGuideEl.classList.toggle("hidden", !cameraFrameState.showStageGuide);
}

function syncCameraFrame() {
    if (!cameraFrameEl || !cameraFrameState) return;

    cameraFrameEl.style.left = `calc(50% + ${cameraFrameState.x}px)`;
    cameraFrameEl.style.top = `calc(50% + ${cameraFrameState.y}px)`;
    cameraFrameEl.style.width = `${cameraFrameState.width}px`;
    cameraFrameEl.style.height = `${cameraFrameState.height}px`;
    cameraFrameEl.style.transform =
        `translate(-50%, -50%) rotate(${cameraFrameState.rotation}deg)`;

    syncStageGuide();
    syncCameraPropertiesPanel();
    updateCameraInteractionUI();
}

function updateCameraPropertiesVisibility() {
    if (!cameraPropertiesPanel) return;

    const showPanel = currentTool === "camera";
    cameraPropertiesPanel.classList.toggle("hidden", !showPanel);
    cameraPropertiesPanel.setAttribute("aria-hidden", String(!showPanel));
}

function syncCameraPropertiesPanel() {
    if (!cameraFrameState) return;

    if (cameraPropX) cameraPropX.value = Math.round(cameraFrameState.x);
    if (cameraPropY) cameraPropY.value = Math.round(cameraFrameState.y);
    if (cameraPropWidth) cameraPropWidth.value = Math.round(cameraFrameState.width);
    if (cameraPropHeight) cameraPropHeight.value = Math.round(cameraFrameState.height);
    if (cameraPropRotation) cameraPropRotation.value = Math.round(cameraFrameState.rotation);
    if (cameraPropGuide) cameraPropGuide.checked = !!cameraFrameState.showStageGuide;
    if (cameraPropQuickMove) cameraPropQuickMove.checked = !!cameraFrameState.quickMoveEnabled;

    [
        "cameraPropX",
        "cameraPropY",
        "cameraPropWidth",
        "cameraPropHeight",
        "cameraPropRotation"
    ].forEach(id => {
        window.denxSyncNumberControl?.(id);
    });
}

function readNumberInput(input, fallback) {
    if (!input) return fallback;
    const value = Number(input.value);
    return Number.isFinite(value) ? value : fallback;
}

function applyCameraPropertiesFromPanel() {
    if (!cameraFrameState) return;

    cameraFrameState.x = readNumberInput(cameraPropX, cameraFrameState.x);
    cameraFrameState.y = readNumberInput(cameraPropY, cameraFrameState.y);
    cameraFrameState.width = clamp(readNumberInput(cameraPropWidth, cameraFrameState.width), 40, 4096);
    cameraFrameState.height = clamp(readNumberInput(cameraPropHeight, cameraFrameState.height), 40, 4096);
    cameraFrameState.rotation = readNumberInput(cameraPropRotation, cameraFrameState.rotation);
    cameraFrameState.showStageGuide = !!cameraPropGuide?.checked;
    cameraFrameState.quickMoveEnabled = !!cameraPropQuickMove?.checked;

    syncCameraFrame();
    saveCameraFrameState(currentFrame);
}

function updateCameraInteractionUI() {
    if (!cameraFrameEl || !cameraFrameState) return;

    const cameraMode = currentTool === "camera";
    cameraFrameEl.classList.toggle("camera-active", cameraMode);
    cameraFrameEl.classList.toggle("camera-quick-move-enabled", !!cameraFrameState.quickMoveEnabled);

    cameraFrameEl.style.pointerEvents = cameraMode ? "auto" : "none";

    updateCameraPropertiesVisibility();
}

function autoPanWorkspace(clientX, clientY) {
    if (!viewport) return false;

    const rect = viewport.getBoundingClientRect();
    const margin = 48;
    const speed = 12;

    let dx = 0;
    let dy = 0;

    if (clientX < rect.left + margin) dx = speed;
    else if (clientX > rect.right - margin) dx = -speed;

    if (clientY < rect.top + margin) dy = speed;
    else if (clientY > rect.bottom - margin) dy = -speed;

    if (!dx && !dy) return false;

    camera.x += dx;
    camera.y += dy;
    updateWorkspace();
    return true;
}

window.denxAutoPanViewport = autoPanWorkspace;

function setInputState() {
    window.denxInputState = window.denxInputState || {
        touchCount: 0,
        gestureActive: false
    };

    window.denxInputState.touchCount = activeTouches.size;
    window.denxInputState.gestureActive = activeTouches.size > 1;
}

function addTouch(e) {
    if (e.pointerType !== "touch") return;

    activeTouches.set(e.pointerId, {
        x: e.clientX,
        y: e.clientY
    });

    setInputState();
    if (window.denxInputState.gestureActive) {
        window.dispatchEvent(new Event("denx:cancel-drawing"));
    }
}

function moveTouch(e) {
    if (e.pointerType !== "touch") return;
    if (!activeTouches.has(e.pointerId)) return;

    activeTouches.set(e.pointerId, {
        x: e.clientX,
        y: e.clientY
    });

    setInputState();
}

function removeTouch(e) {
    if (e.pointerType !== "touch") return;

    activeTouches.delete(e.pointerId);
    setInputState();

    if (activeTouches.size < 2) {
        pinchStartDistance = null;
    }
}

function startPan(e) {
    if (!viewport) return;
    if (cameraFrameEl && cameraFrameEl.contains(e.target)) return;

    addTouch(e);

    // Bone editing owns pointer gestures that begin on figure nodes.
    // Bone mode also owns empty figure-layer drags because those create figures.
    const figureNodeTarget = e.target.closest?.('[data-denx-node="1"]');

    if ((currentTool === "select" || currentTool === "bone") && figureNodeTarget) {
        return;
    }

    if (currentTool === "bone" && figureLayerEl && e.target === figureLayerEl) {
        return;
    }

    if ((currentTool === "pencil" || currentTool === "eraser") && e.target === drawingCanvasEl) {
        return;
    }

    if (isDraggingCameraFrame()) return;

    if (e.pointerType === "touch" && activeTouches.size > 1) {
        isPanning = false;
        panPointerId = null;
        return;
    }

    isPanning = true;
    panPointerId = e.pointerId;
    lastX = e.clientX;
    lastY = e.clientY;

    try {
        viewport.setPointerCapture(e.pointerId);
    } catch (_) {}

    e.preventDefault();
}

function isDraggingCameraFrame() {
    return handleState.active;
}

function movePan(e) {
    moveTouch(e);

    if (activeTouches.size > 1) {
        isPanning = false;
        panPointerId = null;

        const points = [...activeTouches.values()];
        if (points.length < 2) return;

        const distance = getDistance(points[0], points[1]);

        if (pinchStartDistance === null) {
            pinchStartDistance = distance;
            pinchStartZoom = camera.zoom;
            return;
        }

        const ratio = distance / pinchStartDistance;
        camera.zoom = clamp(pinchStartZoom * ratio, 0.3, 5);
        updateWorkspace();
        return;
    }

    if (!isPanning || e.pointerId !== panPointerId) return;

    camera.x += e.clientX - lastX;
    camera.y += e.clientY - lastY;

    lastX = e.clientX;
    lastY = e.clientY;

    updateWorkspace();
}

function endPan(e) {
    removeTouch(e);

    if (e.pointerId === panPointerId) {
        isPanning = false;
        panPointerId = null;
    }

    try {
        viewport.releasePointerCapture(e.pointerId);
    } catch (_) {}
}

function beginCameraHandleInteraction(mode, e) {
    if (!cameraFrameState) return;
    if (mode !== "move" && currentTool !== "camera") return;
    if (mode === "move" && currentTool !== "camera" && !cameraFrameState.quickMoveEnabled) return;

    const pointerWorld = getWorkspacePoint(e.clientX, e.clientY);

    handleState.active = true;
    handleState.pointerId = e.pointerId;
    handleState.mode = mode;
    handleState.startState = cloneCameraFrameState(cameraFrameState);
    handleState.startPointerWorld = pointerWorld;
    handleState.startCenter = {
        x: handleState.startState.x + (handleState.startState.width / 2),
        y: handleState.startState.y + (handleState.startState.height / 2)
    };
    handleState.startAngle = Math.atan2(
        pointerWorld.y - handleState.startCenter.y,
        pointerWorld.x - handleState.startCenter.x
    );
    handleState.startDistance = Math.max(
        1,
        getDistance(pointerWorld, handleState.startCenter)
    );

    try {
        e.currentTarget.setPointerCapture(e.pointerId);
    } catch (_) {}

    e.preventDefault();
    e.stopPropagation();
}

function applyAutoPanAndRecompute(e, recompute) {
    if (autoPanWorkspace(e.clientX, e.clientY)) {
        recompute(getWorkspacePoint(e.clientX, e.clientY));
        return true;
    }

    return false;
}

function moveCameraHandleInteraction(e) {
    if (!handleState.active || e.pointerId !== handleState.pointerId) return;
    if (!cameraFrameState) return;

    moveTouch(e);

    let pointerWorld = getWorkspacePoint(e.clientX, e.clientY);

    const recompute = (updatedWorld) => {
        pointerWorld = updatedWorld;
    };

    if (handleState.mode === "move") {
        cameraFrameState.x = handleState.startState.x + (pointerWorld.x - handleState.startPointerWorld.x);
        cameraFrameState.y = handleState.startState.y + (pointerWorld.y - handleState.startPointerWorld.y);
    } else if (handleState.mode === "rotate") {
        const angle = Math.atan2(
            pointerWorld.y - handleState.startCenter.y,
            pointerWorld.x - handleState.startCenter.x
        );
        const delta = (angle - handleState.startAngle) * (180 / Math.PI);
        cameraFrameState.rotation = handleState.startState.rotation + delta;
    } else if (handleState.mode === "resize") {
        const distance = Math.max(1, getDistance(pointerWorld, handleState.startCenter));
        const scale = clamp(distance / handleState.startDistance, 0.25, 6);

        cameraFrameState.width = clamp(Math.round(handleState.startState.width * scale), 40, 4096);
        cameraFrameState.height = clamp(Math.round(handleState.startState.height * scale), 40, 4096);
    }

    syncCameraFrame();
    saveCameraFrameState(currentFrame);

    applyAutoPanAndRecompute(e, (updatedWorld) => {
        if (handleState.mode === "move") {
            cameraFrameState.x = handleState.startState.x + (updatedWorld.x - handleState.startPointerWorld.x);
            cameraFrameState.y = handleState.startState.y + (updatedWorld.y - handleState.startPointerWorld.y);
        } else if (handleState.mode === "rotate") {
            const angle = Math.atan2(
                updatedWorld.y - handleState.startCenter.y,
                updatedWorld.x - handleState.startCenter.x
            );
            const delta = (angle - handleState.startAngle) * (180 / Math.PI);
            cameraFrameState.rotation = handleState.startState.rotation + delta;
        } else if (handleState.mode === "resize") {
            const distance = Math.max(1, getDistance(updatedWorld, handleState.startCenter));
            const scale = clamp(distance / handleState.startDistance, 0.25, 6);

            cameraFrameState.width = clamp(Math.round(handleState.startState.width * scale), 40, 4096);
            cameraFrameState.height = clamp(Math.round(handleState.startState.height * scale), 40, 4096);
        }

        syncCameraFrame();
        saveCameraFrameState(currentFrame);
    });

    syncCameraPropertiesPanel();
}

function endCameraHandleInteraction(e) {
    if (!handleState.active || e.pointerId !== handleState.pointerId) return;

    handleState.active = false;
    handleState.pointerId = null;
    handleState.mode = null;

    saveCameraFrameState(currentFrame);

    try {
        e.currentTarget.releasePointerCapture(e.pointerId);
    } catch (_) {}
}

function beginCameraBodyDrag(e) {
    if (currentTool !== "camera") return;
    if (!cameraFrameState) return;
    if (e.target !== cameraFrameEl) return;

    handleState.active = true;
    handleState.pointerId = e.pointerId;
    handleState.mode = "move";
    handleState.startState = cloneCameraFrameState(cameraFrameState);
    handleState.startPointerWorld = getWorkspacePoint(e.clientX, e.clientY);
    handleState.startCenter = {
        x: handleState.startState.x + (handleState.startState.width / 2),
        y: handleState.startState.y + (handleState.startState.height / 2)
    };

    try {
        cameraFrameEl.setPointerCapture(e.pointerId);
    } catch (_) {}

    e.preventDefault();
    e.stopPropagation();
}

function moveCameraBodyDrag(e) {
    if (!handleState.active || e.pointerId !== handleState.pointerId) return;
    if (handleState.mode !== "move" || currentTool !== "camera") return;

    moveTouch(e);

    let pointerWorld = getWorkspacePoint(e.clientX, e.clientY);

    handleState.startPointerWorld;

    cameraFrameState.x = handleState.startState.x + (pointerWorld.x - handleState.startPointerWorld.x);
    cameraFrameState.y = handleState.startState.y + (pointerWorld.y - handleState.startPointerWorld.y);

    syncCameraFrame();
    saveCameraFrameState(currentFrame);

    applyAutoPanAndRecompute(e, (updatedWorld) => {
        cameraFrameState.x = handleState.startState.x + (updatedWorld.x - handleState.startPointerWorld.x);
        cameraFrameState.y = handleState.startState.y + (updatedWorld.y - handleState.startPointerWorld.y);
        syncCameraFrame();
        saveCameraFrameState(currentFrame);
    });

    syncCameraPropertiesPanel();
}

function endCameraBodyDrag(e) {
    if (!handleState.active || e.pointerId !== handleState.pointerId) return;
    if (handleState.mode !== "move") return;

    handleState.active = false;
    handleState.pointerId = null;
    handleState.mode = null;

    saveCameraFrameState(currentFrame);

    try {
        cameraFrameEl.releasePointerCapture(e.pointerId);
    } catch (_) {}
}

function setCameraFrameInteraction(tool) {
    if (!cameraFrameEl || !cameraFrameState) return;

    const cameraMode = tool === "camera";

    cameraFrameEl.classList.toggle("camera-active", cameraMode);
    cameraFrameEl.classList.toggle("camera-quick-move-enabled", !!cameraFrameState.quickMoveEnabled);
    cameraFrameEl.style.pointerEvents = cameraMode ? "auto" : "none";

    updateCameraPropertiesVisibility();
}

if (viewport) {
    viewport.addEventListener("pointerdown", startPan, true);
    viewport.addEventListener("pointermove", movePan, true);
    viewport.addEventListener("pointerup", endPan, true);
    viewport.addEventListener("pointercancel", endPan, true);
}

if (cameraFrameEl) {
    cameraFrameEl.addEventListener("pointerdown", beginCameraBodyDrag);
    cameraFrameEl.addEventListener("pointermove", moveCameraBodyDrag);
    cameraFrameEl.addEventListener("pointerup", endCameraBodyDrag);
    cameraFrameEl.addEventListener("pointercancel", endCameraBodyDrag);
}

const rotateHandle = cameraFrameEl?.querySelector('[data-handle="rotate"]');
const resizeHandle = cameraFrameEl?.querySelector('[data-handle="resize"]');
const moveHandle = cameraFrameEl?.querySelector('[data-handle="move"]');

if (rotateHandle) {
    rotateHandle.addEventListener("pointerdown", (e) => beginCameraHandleInteraction("rotate", e));
    rotateHandle.addEventListener("pointermove", moveCameraHandleInteraction);
    rotateHandle.addEventListener("pointerup", endCameraHandleInteraction);
    rotateHandle.addEventListener("pointercancel", endCameraHandleInteraction);
}

if (resizeHandle) {
    resizeHandle.addEventListener("pointerdown", (e) => beginCameraHandleInteraction("resize", e));
    resizeHandle.addEventListener("pointermove", moveCameraHandleInteraction);
    resizeHandle.addEventListener("pointerup", endCameraHandleInteraction);
    resizeHandle.addEventListener("pointercancel", endCameraHandleInteraction);
}

if (moveHandle) {
    moveHandle.addEventListener("pointerdown", (e) => beginCameraHandleInteraction("move", e));
    moveHandle.addEventListener("pointermove", moveCameraHandleInteraction);
    moveHandle.addEventListener("pointerup", endCameraHandleInteraction);
    moveHandle.addEventListener("pointercancel", endCameraHandleInteraction);
}

if (zoomIn) {
    zoomIn.onclick = () => {
        camera.zoom = clamp(camera.zoom + 0.1, 0.3, 5);
        updateWorkspace();
    };
}

if (zoomOut) {
    zoomOut.onclick = () => {
        camera.zoom = clamp(camera.zoom - 0.1, 0.3, 5);
        updateWorkspace();
    };
}

if (cameraPropertiesPanel) {
    [
        cameraPropX,
        cameraPropY,
        cameraPropWidth,
        cameraPropHeight,
        cameraPropRotation,
        cameraPropGuide,
        cameraPropQuickMove
    ].forEach(el => {
        if (!el) return;
        const evt = el.type === "checkbox" ? "change" : "input";
        el.addEventListener(evt, applyCameraPropertiesFromPanel);
    });
}

if (toggleToolbar) {
    toggleToolbar.onclick = () => {
        toolbar?.classList.toggle("toolbar-hidden");
        toggleToolbar.textContent = toolbar?.classList.contains("toolbar-hidden")
            ? "❯"
            : "☰";
        window.dispatchEvent(new Event("resize"));
    };
}

window.addEventListener("denx:toolchange", (e) => {
    setCameraFrameInteraction(e.detail?.tool);
});


// ============================================================
// CAMERA-ONLY PLAYBACK MONITOR
// The real stage is temporarily moved into a clipped "TV" screen.
// No duplicate renderer, no fullscreen, and camera animation remains live.
// ============================================================

const playbackStageHome = {
    parent: stageEl?.parentNode || null,
    before: cameraFrameEl || null
};

const playbackStageInline = stageEl
    ? {
        position: stageEl.style.position,
        left: stageEl.style.left,
        top: stageEl.style.top,
        transform: stageEl.style.transform,
        transformOrigin: stageEl.style.transformOrigin,
        margin: stageEl.style.margin
    }
    : null;

let playbackMonitorActive = false;
let playbackMonitorFrame = 1;

function fitPlaybackScreen(state) {
    if (!viewport || !playbackScreenEl || !state) {
        return null;
    }

    const viewportRect = viewport.getBoundingClientRect();

    const availableWidth =
        Math.max(120, viewportRect.width - 34);

    const availableHeight =
        Math.max(90, viewportRect.height - 76);

    const cropWidth = Math.max(40, state.width);
    const cropHeight = Math.max(40, state.height);

    const scale = Math.min(
        availableWidth / cropWidth,
        availableHeight / cropHeight
    );

    const width = Math.max(80, cropWidth * scale);
    const height = Math.max(60, cropHeight * scale);

    playbackScreenEl.style.width = `${width}px`;
    playbackScreenEl.style.height = `${height}px`;

    return {
        width,
        height,
        scale
    };
}

function syncPlaybackMonitor(frameNumber = currentFrame) {
    if (
        !playbackMonitorActive ||
        !stageEl ||
        !playbackScreenEl
    ) {
        return;
    }

    playbackMonitorFrame = frameNumber;

    const state =
        getCameraFrameState(frameNumber);

    const fitted =
        fitPlaybackScreen(state);

    if (!fitted) return;

    const cropCenterX =
        1024 + state.x;

    const cropCenterY =
        576 + state.y;

    const radians =
        (-state.rotation * Math.PI) / 180;

    const cos = Math.cos(radians);
    const sin = Math.sin(radians);
    const s = fitted.scale;

    // q = screenCenter + s * R(-rotation) * (p - cameraCenter)
    const a = s * cos;
    const b = s * sin;
    const c = -s * sin;
    const d = s * cos;

    const e =
        fitted.width / 2 -
        a * cropCenterX -
        c * cropCenterY;

    const f =
        fitted.height / 2 -
        b * cropCenterX -
        d * cropCenterY;

    stageEl.style.position = "absolute";
    stageEl.style.left = "0";
    stageEl.style.top = "0";
    stageEl.style.margin = "0";
    stageEl.style.transformOrigin = "0 0";
    stageEl.style.transform =
        `matrix(${a}, ${b}, ${c}, ${d}, ${e}, ${f})`;

    if (playbackFrameLabelEl) {
        const total =
            window.denxFrameCount?.() || "?";

        playbackFrameLabelEl.textContent =
            `${frameNumber} / ${total}`;
    }
}

function enterPlaybackMonitor(frameNumber = currentFrame) {
    if (
        playbackMonitorActive ||
        !playbackMonitorEl ||
        !playbackScreenEl ||
        !stageEl
    ) {
        return;
    }

    playbackMonitorActive = true;

    playbackScreenEl.appendChild(stageEl);

    playbackMonitorEl.classList.remove("hidden");
    playbackMonitorEl.setAttribute("aria-hidden", "false");
    document.body.classList.add("denx-camera-preview-playing");

    requestAnimationFrame(() => {
        syncPlaybackMonitor(frameNumber);
    });
}

function exitPlaybackMonitor() {
    if (!playbackMonitorActive) return;

    playbackMonitorActive = false;

    if (stageEl && playbackStageHome.parent) {
        if (
            playbackStageHome.before &&
            playbackStageHome.before.parentNode === playbackStageHome.parent
        ) {
            playbackStageHome.parent.insertBefore(
                stageEl,
                playbackStageHome.before
            );
        } else {
            playbackStageHome.parent.appendChild(stageEl);
        }
    }

    if (stageEl && playbackStageInline) {
        stageEl.style.position =
            playbackStageInline.position;

        stageEl.style.left =
            playbackStageInline.left;

        stageEl.style.top =
            playbackStageInline.top;

        stageEl.style.transform =
            playbackStageInline.transform;

        stageEl.style.transformOrigin =
            playbackStageInline.transformOrigin;

        stageEl.style.margin =
            playbackStageInline.margin;
    }

    playbackMonitorEl?.classList.add("hidden");
    playbackMonitorEl?.setAttribute("aria-hidden", "true");
    document.body.classList.remove("denx-camera-preview-playing");

    updateWorkspace();
    syncCameraFrame();
}

window.denxEnterPlaybackMonitor =
    enterPlaybackMonitor;

window.denxUpdatePlaybackMonitor =
    syncPlaybackMonitor;

window.denxExitPlaybackMonitor =
    exitPlaybackMonitor;

window.denxPlaybackMonitorActive =
    () => playbackMonitorActive;

window.addEventListener("resize", () => {
    if (playbackMonitorActive) {
        requestAnimationFrame(() => {
            syncPlaybackMonitor(playbackMonitorFrame);
        });
    }
});

function resetCamera() {
    camera.x = 0;
    camera.y = 0;
    camera.zoom = 1;
    updateWorkspace();
}

loadCameraFrameState(currentFrame);
setCameraFrameInteraction(currentTool);
updateWorkspace();
syncCameraFrame();
