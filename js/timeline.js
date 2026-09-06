// ============================================================
// DENX TIMELINE V5
// Frames + frame operations + playback + onion skin.
// ============================================================

const addFrame = document.getElementById("addFrame");
const removeFrameBtn = document.getElementById("removeFrameBtn");
const copyFrameBtn = document.getElementById("copyFrameBtn");
const pasteFrameBtn = document.getElementById("pasteFrameBtn");
const frameContainer = document.getElementById("frameContainer");

const playBtn = document.getElementById("playBtn");
const fpsInput = document.getElementById("animationFpsInput");
const loopToggle = document.getElementById("animationLoopToggle");

const onionBtn = document.getElementById("onionSkinBtn");
const onionPrevToggle = document.getElementById("onionPrevToggle");
const onionNextToggle = document.getElementById("onionNextToggle");
const onionOpacityInput = document.getElementById("onionOpacityInput");
const onionCanvas = document.getElementById("onionCanvas");
const onionCtx = onionCanvas?.getContext("2d") || null;

// Every frame stores its own drawing.
let frames = [
    canvas.toDataURL()
];

let copiedFrameSnapshot = null;

const timelineUndoStack = [];
const timelineRedoStack = [];
let timelineUndoEligible = false;

// ------------------------------------------------------------
// Playback
// ------------------------------------------------------------

let playbackActive = false;
let playbackRaf = null;
let playbackLastStep = 0;

function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

function getFPS() {
    const value = clamp(
        Number(fpsInput?.value) || 12,
        1,
        60
    );

    if (fpsInput && String(value) !== fpsInput.value) {
        fpsInput.value = String(value);
    }

    return value;
}

function updatePlayButton() {
    if (!playBtn) return;

    playBtn.textContent = playbackActive ? "■" : "▶";
    playBtn.title = playbackActive ? "Stop" : "Play";
    playBtn.setAttribute(
        "aria-label",
        playbackActive ? "Stop animation" : "Play animation"
    );
    playBtn.classList.toggle("playing", playbackActive);
}

function stopPlayback() {
    if (!playbackActive && !playbackRaf) return;

    playbackActive = false;

    if (playbackRaf) {
        cancelAnimationFrame(playbackRaf);
        playbackRaf = null;
    }

    playbackLastStep = 0;
    document.body.classList.remove("denx-playing");
    updatePlayButton();
    refreshOnionSkin();
}

window.denxStopPlayback = stopPlayback;
window.denxIsPlaying = () => playbackActive;

function advancePlayback() {
    if (!playbackActive) return;

    if (currentFrame >= frames.length) {
        if (loopToggle?.checked !== false) {
            selectFrame(1, {
                skipSave: true,
                fromPlayback: true,
                skipOnion: true
            });
        } else {
            stopPlayback();
        }

        return;
    }

    selectFrame(currentFrame + 1, {
        skipSave: true,
        fromPlayback: true,
        skipOnion: true
    });
}

function playbackTick(now) {
    if (!playbackActive) return;

    const interval = 1000 / getFPS();

    if (!playbackLastStep) {
        playbackLastStep = now;
    }

    const elapsed = now - playbackLastStep;

    if (elapsed >= interval) {
        const steps = Math.max(
            1,
            Math.floor(elapsed / interval)
        );

        playbackLastStep += steps * interval;

        for (let i = 0; i < steps && playbackActive; i++) {
            advancePlayback();
        }
    }

    if (playbackActive) {
        playbackRaf =
            requestAnimationFrame(playbackTick);
    }
}

function startPlayback() {
    if (frames.length <= 1) {
        window.denxShowToast?.("Add another frame to play.");
        return;
    }

    saveCurrentFrame();

    if (window.denxSaveCameraFrameState) {
        window.denxSaveCameraFrameState(currentFrame);
    }

    playbackActive = true;
    playbackLastStep = 0;
    document.body.classList.add("denx-playing");

    clearOnionSkin();
    updatePlayButton();

    playbackRaf =
        requestAnimationFrame(playbackTick);
}

function togglePlayback() {
    if (playbackActive) {
        stopPlayback();
    } else {
        startPlayback();
    }
}

// ------------------------------------------------------------
// Onion skin
// ------------------------------------------------------------

const onionState = {
    enabled:
        localStorage.getItem("denx.onion.enabled") === "1",
    token: 0
};

function onionOpacity() {
    return clamp(
        Number(onionOpacityInput?.value) || 0.28,
        0.08,
        0.65
    );
}

function syncOnionControls() {
    if (onionBtn) {
        onionBtn.classList.toggle(
            "active",
            onionState.enabled
        );

        onionBtn.setAttribute(
            "aria-pressed",
            onionState.enabled ? "true" : "false"
        );
    }
}

function resizeOnionCanvas() {
    if (!onionCanvas || !canvas) return;

    if (
        onionCanvas.width !== canvas.width ||
        onionCanvas.height !== canvas.height
    ) {
        onionCanvas.width = canvas.width;
        onionCanvas.height = canvas.height;
    }
}

function clearOnionSkin() {
    onionState.token++;

    if (onionCtx && onionCanvas) {
        resizeOnionCanvas();
        onionCtx.clearRect(
            0,
            0,
            onionCanvas.width,
            onionCanvas.height
        );
    }

    window.denxBonesClearOnion?.();
}

const onionImageCache = new Map();

function loadImageData(data) {
    if (!data) return Promise.resolve(null);

    if (onionImageCache.has(data)) {
        return onionImageCache.get(data);
    }

    const promise = new Promise(resolve => {
        const image = new Image();

        image.onload = () => resolve(image);
        image.onerror = () => resolve(null);
        image.src = data;
    });

    onionImageCache.set(data, promise);

    if (onionImageCache.size > 36) {
        const first = onionImageCache.keys().next().value;
        onionImageCache.delete(first);
    }

    return promise;
}

function drawTintedFrame(image, color, alpha) {
    if (!image || !onionCtx || !onionCanvas) return;

    const temp = document.createElement("canvas");
    temp.width = onionCanvas.width;
    temp.height = onionCanvas.height;

    const tctx = temp.getContext("2d");
    if (!tctx) return;

    tctx.clearRect(0, 0, temp.width, temp.height);
    tctx.drawImage(image, 0, 0, temp.width, temp.height);

    tctx.globalCompositeOperation = "source-in";
    tctx.fillStyle = color;
    tctx.fillRect(0, 0, temp.width, temp.height);
    tctx.globalCompositeOperation = "source-over";

    onionCtx.globalAlpha = alpha;
    onionCtx.drawImage(temp, 0, 0);
    onionCtx.globalAlpha = 1;
}

async function refreshOnionSkin() {
    const token = ++onionState.token;

    if (!onionCtx || !onionCanvas) {
        window.denxBonesClearOnion?.();
        return;
    }

    resizeOnionCanvas();

    onionCtx.clearRect(
        0,
        0,
        onionCanvas.width,
        onionCanvas.height
    );

    if (!onionState.enabled || playbackActive) {
        window.denxBonesClearOnion?.();
        return;
    }

    const showPrev =
        onionPrevToggle?.checked !== false;

    const showNext =
        onionNextToggle?.checked !== false;

    const previousFrame =
        showPrev && currentFrame > 1
            ? currentFrame - 1
            : null;

    const nextFrame =
        showNext && currentFrame < frames.length
            ? currentFrame + 1
            : null;

    const [previousImage, nextImage] =
        await Promise.all([
            previousFrame
                ? loadImageData(frames[previousFrame - 1])
                : Promise.resolve(null),
            nextFrame
                ? loadImageData(frames[nextFrame - 1])
                : Promise.resolve(null)
        ]);

    if (token !== onionState.token) return;

    const alpha = onionOpacity();

    if (previousImage) {
        drawTintedFrame(
            previousImage,
            "#00b7ff",
            alpha
        );
    }

    if (nextImage) {
        drawTintedFrame(
            nextImage,
            "#ff4f9a",
            alpha
        );
    }

    window.denxBonesRenderOnion?.({
        previousFrame,
        nextFrame,
        opacity: alpha
    });
}

window.denxRefreshOnionSkin = refreshOnionSkin;
window.denxClearOnionSkin = clearOnionSkin;

function toggleOnionSkin() {
    onionState.enabled = !onionState.enabled;

    localStorage.setItem(
        "denx.onion.enabled",
        onionState.enabled ? "1" : "0"
    );

    syncOnionControls();
    refreshOnionSkin();
}

// ------------------------------------------------------------
// Frame persistence helpers
// ------------------------------------------------------------

function saveCurrentFrame() {
    frames[currentFrame - 1] =
        canvas.toDataURL();
}

function cloneHistoryEntry(entry) {
    return {
        undo:
            Array.isArray(entry?.undo)
                ? [...entry.undo]
                : [],
        redo:
            Array.isArray(entry?.redo)
                ? [...entry.redo]
                : []
    };
}

function cloneHistoryMap(map) {
    const copy = {};

    Object.keys(map || {}).forEach(key => {
        copy[key] =
            cloneHistoryEntry(map[key]);
    });

    return copy;
}

function cloneCameraStateMap(map) {
    const copy = {};

    Object.keys(map || {}).forEach(key => {
        const state = map[key];

        if (
            state &&
            window.denxCloneCameraFrameState
        ) {
            copy[key] =
                window.denxCloneCameraFrameState(state);
        } else if (state) {
            copy[key] = { ...state };
        }
    });

    return copy;
}

function captureTimelineSnapshot() {
    saveCurrentFrame();

    if (window.denxSaveCameraFrameState) {
        window.denxSaveCameraFrameState(currentFrame);
    }

    return {
        frames: [...frames],
        frameHistory:
            cloneHistoryMap(frameHistory),
        cameraStates:
            cloneCameraStateMap(
                window.denxCameraFrameStates || {}
            ),
        bonesState:
            window.denxBonesCaptureProjectState
                ? window.denxBonesCaptureProjectState()
                : null,
        currentFrame,
        frameCount
    };
}

function rebuildFrameButtons() {
    if (!frameContainer) return;

    frameContainer.innerHTML = "";

    frames.forEach((_, index) => {
        frameContainer.appendChild(
            createFrameButton(index + 1)
        );
    });
}

function restoreTimelineSnapshot(snapshot) {
    if (!snapshot) return;

    stopPlayback();

    frames = [...snapshot.frames];

    Object.keys(frameHistory)
        .forEach(key => delete frameHistory[key]);

    const restoredHistory =
        cloneHistoryMap(snapshot.frameHistory);

    Object.keys(restoredHistory)
        .forEach(key => {
            frameHistory[key] =
                restoredHistory[key];
        });

    if (window.denxCameraFrameStates) {
        Object.keys(window.denxCameraFrameStates)
            .forEach(key => {
                delete window.denxCameraFrameStates[key];
            });

        const cameraClone =
            cloneCameraStateMap(snapshot.cameraStates);

        Object.keys(cameraClone)
            .forEach(key => {
                window.denxCameraFrameStates[key] =
                    cameraClone[key];
            });
    }

    frameCount = frames.length;

    currentFrame = Math.max(
        1,
        Math.min(
            snapshot.currentFrame,
            frames.length
        )
    );

    if (
        snapshot.bonesState &&
        window.denxBonesRestoreProjectState
    ) {
        window.denxBonesRestoreProjectState(
            snapshot.bonesState
        );
    }

    rebuildFrameButtons();

    selectFrame(currentFrame, {
        skipSave: true
    });

    updateTimelineButtons();
}

function recordTimelineOperation(before, after) {
    if (window.denxInvalidateBoneUndo) {
        window.denxInvalidateBoneUndo();
    }

    timelineUndoStack.push({
        before,
        after
    });

    if (timelineUndoStack.length > 40) {
        timelineUndoStack.shift();
    }

    timelineRedoStack.length = 0;
    timelineUndoEligible = true;
}

window.denxInvalidateTimelineUndo = () => {
    timelineUndoEligible = false;
    timelineUndoStack.length = 0;
    timelineRedoStack.length = 0;
};

window.denxUndoTimelineAction = () => {
    if (
        !timelineUndoEligible ||
        timelineUndoStack.length === 0
    ) {
        return false;
    }

    const action =
        timelineUndoStack.pop();

    timelineRedoStack.push(action);

    restoreTimelineSnapshot(action.before);

    timelineUndoEligible =
        timelineUndoStack.length > 0;

    return true;
};

window.denxRedoTimelineAction = () => {
    if (timelineRedoStack.length === 0) {
        return false;
    }

    const action =
        timelineRedoStack.pop();

    timelineUndoStack.push(action);

    restoreTimelineSnapshot(action.after);

    timelineUndoEligible = true;

    return true;
};

// Used by Figure Creator handoff.
window.denxTimelineCaptureSession =
    () => captureTimelineSnapshot();

window.denxTimelineRestoreSession =
    snapshot => restoreTimelineSnapshot(snapshot);

// ------------------------------------------------------------
// Frame map shifting
// ------------------------------------------------------------

function shiftStateMapUp(map, fromFrame) {
    const keys = Object.keys(map)
        .map(Number)
        .filter(key => key >= fromFrame)
        .sort((a, b) => b - a);

    keys.forEach(key => {
        map[key + 1] = map[key];
        delete map[key];
    });
}

function shiftStateMapDown(map, fromFrame) {
    const keys = Object.keys(map)
        .map(Number)
        .filter(key => key >= fromFrame)
        .sort((a, b) => a - b);

    keys.forEach(key => {
        map[key - 1] = map[key];
        delete map[key];
    });
}

function renumberFrameButtons() {
    document
        .querySelectorAll(".frame")
        .forEach((btn, index) => {
            const frameNumber = index + 1;
            btn.dataset.frame = frameNumber;
            btn.textContent = frameNumber;
        });
}

function createFrameButton(frameNumber) {
    const frame =
        document.createElement("button");

    frame.className = "frame";
    frame.dataset.frame = frameNumber;
    frame.textContent = frameNumber;

    frame.onclick = () => {
        if (playbackActive) {
            stopPlayback();
        }

        selectFrame(
            Number(frame.dataset.frame)
        );
    };

    return frame;
}

function updateTimelineButtons() {
    if (removeFrameBtn) {
        removeFrameBtn.disabled =
            frames.length <= 1;
    }

    if (pasteFrameBtn) {
        pasteFrameBtn.disabled =
            !copiedFrameSnapshot;
    }
}

function ensureCurrentFrameHistorySeed() {
    const history = getHistory();

    if (history.undo.length === 0) {
        history.undo.push(
            canvas.toDataURL()
        );
    }
}

// ------------------------------------------------------------
// Frame drawing loader
// ------------------------------------------------------------

let frameLoadToken = 0;
const frameImageCache = new Map();

function imageForFrameData(data) {
    if (!data) return null;

    let image = frameImageCache.get(data);

    if (image) return image;

    image = new Image();
    image.src = data;

    frameImageCache.set(data, image);

    if (frameImageCache.size > 30) {
        const first =
            frameImageCache.keys().next().value;

        frameImageCache.delete(first);
    }

    return image;
}

function loadFrame(frameNumber) {
    const token = ++frameLoadToken;

    ctx.clearRect(
        0,
        0,
        canvas.width,
        canvas.height
    );

    const data =
        frames[frameNumber - 1];

    if (!data) return;

    const image =
        imageForFrameData(data);

    if (!image) return;

    const draw = () => {
        if (token !== frameLoadToken) return;

        ctx.clearRect(
            0,
            0,
            canvas.width,
            canvas.height
        );

        ctx.drawImage(
            image,
            0,
            0,
            canvas.width,
            canvas.height
        );
    };

    if (image.complete) {
        draw();
    } else {
        image.addEventListener(
            "load",
            draw,
            { once: true }
        );
    }
}

// ------------------------------------------------------------
// Frame selection
// ------------------------------------------------------------

function selectFrame(frameNumber, options = {}) {
    const {
        skipSave = false,
        fromPlayback = false,
        skipOnion = false
    } = options;

    if (
        playbackActive &&
        !fromPlayback
    ) {
        stopPlayback();
    }

    frameNumber =
        Math.max(
            1,
            Math.min(
                frameNumber,
                frames.length
            )
        );

    if (!skipSave) {
        saveCurrentFrame();

        if (window.denxSaveCameraFrameState) {
            window.denxSaveCameraFrameState(
                currentFrame
            );
        }
    }

    currentFrame = frameNumber;

    document
        .querySelectorAll(".frame")
        .forEach(frame => {
            frame.classList.remove("active");
        });

    const activeFrame =
        document.querySelector(
            `[data-frame="${frameNumber}"]`
        );

    activeFrame?.classList.add("active");

    loadFrame(frameNumber);

    if (window.denxLoadCameraFrameState) {
        window.denxLoadCameraFrameState(
            frameNumber
        );
    }

    if (window.denxBonesLoadFrame) {
        window.denxBonesLoadFrame(
            frameNumber
        );
    }

    ensureCurrentFrameHistorySeed();
    updateTimelineButtons();

    if (!skipOnion && !playbackActive) {
        refreshOnionSkin();
    }
}

window.denxSelectFrame = selectFrame;
window.denxCurrentFrame =
    () => currentFrame;
window.denxFrameCount =
    () => frames.length;

// ------------------------------------------------------------
// Frame operations
// ------------------------------------------------------------

function buildHistoryForInsertedFrame(imageData) {
    if (!imageData) {
        return {
            undo: [],
            redo: []
        };
    }

    return {
        undo: [imageData],
        redo: []
    };
}

function insertFrameAfterCurrent(
    frameData = null,
    historyData = null,
    cameraState = null,
    boneFrameState = null
) {
    stopPlayback();

    const before =
        captureTimelineSnapshot();

    const sourceFrame =
        currentFrame;

    const newFrame =
        currentFrame + 1;

    shiftStateMapUp(
        frameHistory,
        newFrame
    );

    if (window.denxCameraFrameStates) {
        shiftStateMapUp(
            window.denxCameraFrameStates,
            newFrame
        );
    }

    frames.splice(
        currentFrame,
        0,
        frameData
    );

    frameHistory[newFrame] =
        historyData ||
        buildHistoryForInsertedFrame(
            frameData
        );

    if (
        window.denxCameraFrameStates &&
        window.denxCloneCameraFrameState
    ) {
        const sourceState =
            cameraState ||
            window.denxCameraFrameStates[currentFrame] ||
            window.denxCameraFrameStates[newFrame - 1] ||
            window.denxCameraFrameStates[1];

        if (sourceState) {
            window.denxCameraFrameStates[newFrame] =
                window.denxCloneCameraFrameState(
                    sourceState
                );
        }
    }

    if (window.denxBonesInsertFrame) {
        window.denxBonesInsertFrame(
            newFrame,
            sourceFrame,
            boneFrameState
        );
    }

    frameCount = frames.length;

    const frame =
        createFrameButton(newFrame);

    const currentBtn =
        document.querySelector(
            `[data-frame="${currentFrame}"]`
        );

    if (currentBtn) {
        currentBtn.after(frame);
    } else {
        frameContainer?.appendChild(frame);
    }

    renumberFrameButtons();

    selectFrame(newFrame);

    const after =
        captureTimelineSnapshot();

    recordTimelineOperation(
        before,
        after
    );

    updateTimelineButtons();
    refreshOnionSkin();
}

function removeCurrentFrame() {
    if (frames.length <= 1) return;

    stopPlayback();

    const before =
        captureTimelineSnapshot();

    const removedFrame =
        currentFrame;

    frames.splice(
        removedFrame - 1,
        1
    );

    delete frameHistory[removedFrame];

    shiftStateMapDown(
        frameHistory,
        removedFrame + 1
    );

    if (window.denxCameraFrameStates) {
        delete window.denxCameraFrameStates[
            removedFrame
        ];

        shiftStateMapDown(
            window.denxCameraFrameStates,
            removedFrame + 1
        );
    }

    if (window.denxBonesRemoveFrame) {
        window.denxBonesRemoveFrame(
            removedFrame
        );
    }

    document
        .querySelector(
            `[data-frame="${removedFrame}"]`
        )
        ?.remove();

    frameCount = frames.length;

    renumberFrameButtons();

    const nextFrame =
        Math.min(
            removedFrame,
            frames.length
        );

    selectFrame(nextFrame, {
        skipSave: true
    });

    const after =
        captureTimelineSnapshot();

    recordTimelineOperation(
        before,
        after
    );

    updateTimelineButtons();
    refreshOnionSkin();
}

function copyCurrentFrame() {
    stopPlayback();

    saveCurrentFrame();

    if (window.denxSaveCameraFrameState) {
        window.denxSaveCameraFrameState(
            currentFrame
        );
    }

    const frameImage =
        frames[currentFrame - 1] ||
        canvas.toDataURL();

    const historyClone =
        cloneHistoryEntry(
            frameHistory[currentFrame]
        );

    let cameraClone = null;

    if (
        window.denxCameraFrameStates &&
        window.denxCloneCameraFrameState
    ) {
        const state =
            window.denxCameraFrameStates[
                currentFrame
            ];

        if (state) {
            cameraClone =
                window.denxCloneCameraFrameState(
                    state
                );
        }
    }

    copiedFrameSnapshot = {
        imageData: frameImage,
        history: historyClone,
        camera: cameraClone,
        bones:
            window.denxBonesCopyFrameState
                ? window.denxBonesCopyFrameState(
                    currentFrame
                )
                : null
    };

    updateTimelineButtons();
}

function pasteCopiedFrame() {
    if (!copiedFrameSnapshot) return;

    stopPlayback();

    const historyClone =
        cloneHistoryEntry(
            copiedFrameSnapshot.history
        );

    const cameraClone =
        copiedFrameSnapshot.camera &&
        window.denxCloneCameraFrameState
            ? window.denxCloneCameraFrameState(
                copiedFrameSnapshot.camera
            )
            : null;

    insertFrameAfterCurrent(
        copiedFrameSnapshot.imageData,
        historyClone,
        cameraClone,
        copiedFrameSnapshot.bones
    );
}

// ------------------------------------------------------------
// Controls
// ------------------------------------------------------------

document
    .querySelector('[data-frame="1"]')
    ?.addEventListener("click", () => {
        selectFrame(1);
    });

addFrame?.addEventListener(
    "click",
    () => insertFrameAfterCurrent()
);

removeFrameBtn?.addEventListener(
    "click",
    removeCurrentFrame
);

copyFrameBtn?.addEventListener(
    "click",
    copyCurrentFrame
);

pasteFrameBtn?.addEventListener(
    "click",
    pasteCopiedFrame
);

playBtn?.addEventListener(
    "click",
    togglePlayback
);

onionBtn?.addEventListener(
    "click",
    toggleOnionSkin
);

[
    onionPrevToggle,
    onionNextToggle,
    onionOpacityInput
].forEach(control => {
    control?.addEventListener(
        "input",
        refreshOnionSkin
    );

    control?.addEventListener(
        "change",
        refreshOnionSkin
    );
});

if (fpsInput) {
    fpsInput.value =
        localStorage.getItem(
            "denx.animation.fps"
        ) || "12";

    fpsInput.addEventListener(
        "change",
        () => {
            fpsInput.value =
                String(getFPS());

            localStorage.setItem(
                "denx.animation.fps",
                fpsInput.value
            );
        }
    );
}

if (loopToggle) {
    loopToggle.checked =
        localStorage.getItem(
            "denx.animation.loop"
        ) !== "0";

    loopToggle.addEventListener(
        "change",
        () => {
            localStorage.setItem(
                "denx.animation.loop",
                loopToggle.checked
                    ? "1"
                    : "0"
            );
        }
    );
}

if (onionOpacityInput) {
    onionOpacityInput.value =
        localStorage.getItem(
            "denx.onion.opacity"
        ) || "0.28";

    onionOpacityInput.addEventListener(
        "change",
        () => {
            localStorage.setItem(
                "denx.onion.opacity",
                onionOpacityInput.value
            );
        }
    );
}

if (onionPrevToggle) {
    onionPrevToggle.checked =
        localStorage.getItem(
            "denx.onion.prev"
        ) !== "0";

    onionPrevToggle.addEventListener(
        "change",
        () => {
            localStorage.setItem(
                "denx.onion.prev",
                onionPrevToggle.checked
                    ? "1"
                    : "0"
            );
        }
    );
}

if (onionNextToggle) {
    onionNextToggle.checked =
        localStorage.getItem(
            "denx.onion.next"
        ) !== "0";

    onionNextToggle.addEventListener(
        "change",
        () => {
            localStorage.setItem(
                "denx.onion.next",
                onionNextToggle.checked
                    ? "1"
                    : "0"
            );
        }
    );
}

window.addEventListener(
    "resize",
    () => {
        requestAnimationFrame(
            refreshOnionSkin
        );
    }
);

// Startup.
selectFrame(1, {
    skipSave: true
});

syncOnionControls();
updatePlayButton();
updateTimelineButtons();
refreshOnionSkin();
