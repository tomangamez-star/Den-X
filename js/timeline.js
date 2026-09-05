// =========================
// TIMELINE
// =========================

const addFrame = document.getElementById("addFrame");
const removeFrameBtn = document.getElementById("removeFrameBtn");
const copyFrameBtn = document.getElementById("copyFrameBtn");
const pasteFrameBtn = document.getElementById("pasteFrameBtn");
const frameContainer = document.getElementById("frameContainer");

// Every frame stores its own drawing
let frames = [
    canvas.toDataURL()
];

let copiedFrameSnapshot = null;

function saveCurrentFrame() {
    frames[currentFrame - 1] = canvas.toDataURL();
}

function cloneHistoryEntry(entry) {
    return {
        undo: Array.isArray(entry?.undo) ? [...entry.undo] : [],
        redo: Array.isArray(entry?.redo) ? [...entry.redo] : []
    };
}

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
    document.querySelectorAll(".frame").forEach((btn, index) => {
        const frameNumber = index + 1;
        btn.dataset.frame = frameNumber;
        btn.textContent = frameNumber;
    });
}

function createFrameButton(frameNumber) {
    const frame = document.createElement("button");
    frame.className = "frame";
    frame.dataset.frame = frameNumber;
    frame.textContent = frameNumber;
    frame.onclick = () => {
        selectFrame(Number(frame.dataset.frame));
    };
    return frame;
}

function updateTimelineButtons() {
    if (removeFrameBtn) {
        removeFrameBtn.disabled = frames.length <= 1;
    }

    if (pasteFrameBtn) {
        pasteFrameBtn.disabled = !copiedFrameSnapshot;
    }
}

function ensureCurrentFrameHistorySeed() {
    const history = getHistory();

    if (history.undo.length === 0) {
        history.undo.push(canvas.toDataURL());
    }
}

function loadFrame(frameNumber) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const data = frames[frameNumber - 1];

    if (!data) return;

    const img = new Image();

    img.onload = () => {
        ctx.drawImage(img, 0, 0);
    };

    img.src = data;
}

// Select a frame
function selectFrame(frameNumber, options = {}) {
    const { skipSave = false } = options;

    if (!skipSave) {
        saveCurrentFrame();

        if (window.denxSaveCameraFrameState) {
            window.denxSaveCameraFrameState(currentFrame);
        }
    }

    currentFrame = frameNumber;

    document.querySelectorAll(".frame").forEach(frame => {
        frame.classList.remove("active");
    });

    const activeFrame = document.querySelector(`[data-frame="${frameNumber}"]`);

    if (activeFrame) {
        activeFrame.classList.add("active");
    }

    // Load the drawing for this frame
    loadFrame(frameNumber);

    if (window.denxLoadCameraFrameState) {
        window.denxLoadCameraFrameState(frameNumber);
    }

    ensureCurrentFrameHistorySeed();
    updateTimelineButtons();

    console.log("Current Frame:", currentFrame);
}

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

function insertFrameAfterCurrent(frameData = null, historyData = null, cameraState = null) {
    const newFrame = currentFrame + 1;

    shiftStateMapUp(frameHistory, newFrame);

    if (window.denxCameraFrameStates) {
        shiftStateMapUp(window.denxCameraFrameStates, newFrame);
    }

    frames.splice(currentFrame, 0, frameData);

    frameHistory[newFrame] = historyData || buildHistoryForInsertedFrame(frameData);

    if (window.denxCameraFrameStates && window.denxCloneCameraFrameState) {
        const sourceState = cameraState ||
            window.denxCameraFrameStates[currentFrame] ||
            window.denxCameraFrameStates[newFrame - 1] ||
            window.denxCameraFrameStates[1];

        if (sourceState) {
            window.denxCameraFrameStates[newFrame] =
                window.denxCloneCameraFrameState(sourceState);
        }
    }

    frameCount = frames.length;

    const frame = createFrameButton(newFrame);
    const currentBtn = document.querySelector(`[data-frame="${currentFrame}"]`);

    if (currentBtn) {
        currentBtn.after(frame);
    } else if (frameContainer) {
        frameContainer.appendChild(frame);
    }

    renumberFrameButtons();
    selectFrame(newFrame);
    updateTimelineButtons();
}

function removeCurrentFrame() {
    if (frames.length <= 1) return;

    saveCurrentFrame();

    if (window.denxSaveCameraFrameState) {
        window.denxSaveCameraFrameState(currentFrame);
    }

    const removedFrame = currentFrame;
    frames.splice(removedFrame - 1, 1);

    delete frameHistory[removedFrame];
    shiftStateMapDown(frameHistory, removedFrame + 1);

    if (window.denxCameraFrameStates) {
        delete window.denxCameraFrameStates[removedFrame];
        shiftStateMapDown(window.denxCameraFrameStates, removedFrame + 1);
    }

    const activeButton = document.querySelector(`[data-frame="${removedFrame}"]`);
    if (activeButton) {
        activeButton.remove();
    }

    frameCount = frames.length;
    renumberFrameButtons();

    const nextFrame = Math.min(removedFrame, frames.length);
    selectFrame(nextFrame, { skipSave: true });
    updateTimelineButtons();
}

function copyCurrentFrame() {
    saveCurrentFrame();

    if (window.denxSaveCameraFrameState) {
        window.denxSaveCameraFrameState(currentFrame);
    }

    const frameImage = frames[currentFrame - 1] || canvas.toDataURL();
    const historyClone = cloneHistoryEntry(frameHistory[currentFrame]);

    let cameraClone = null;
    if (window.denxCameraFrameStates && window.denxCloneCameraFrameState) {
        const state = window.denxCameraFrameStates[currentFrame];
        if (state) {
            cameraClone = window.denxCloneCameraFrameState(state);
        }
    }

    copiedFrameSnapshot = {
        imageData: frameImage,
        history: historyClone,
        camera: cameraClone
    };

    updateTimelineButtons();
}

function pasteCopiedFrame() {
    if (!copiedFrameSnapshot) return;

    const historyClone = cloneHistoryEntry(copiedFrameSnapshot.history);
    const cameraClone =
        copiedFrameSnapshot.camera && window.denxCloneCameraFrameState
            ? window.denxCloneCameraFrameState(copiedFrameSnapshot.camera)
            : null;

    insertFrameAfterCurrent(
        copiedFrameSnapshot.imageData,
        historyClone,
        cameraClone
    );
}

// Make Frame 1 clickable
const firstFrame = document.querySelector('[data-frame="1"]');
if (firstFrame) {
    firstFrame.onclick = () => {
        selectFrame(1);
    };
}

if (addFrame) {
    addFrame.onclick = () => {
        insertFrameAfterCurrent();
    };
}

if (removeFrameBtn) {
    removeFrameBtn.onclick = () => {
        removeCurrentFrame();
    };
}

if (copyFrameBtn) {
    copyFrameBtn.onclick = () => {
        copyCurrentFrame();
    };
}

if (pasteFrameBtn) {
    pasteFrameBtn.onclick = () => {
        pasteCopiedFrame();
    };
}

// Select Frame 1 on startup
selectFrame(1, { skipSave: true });
updateTimelineButtons();
