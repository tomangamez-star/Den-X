// =========================
// TIMELINE
// =========================

const addFrame = document.getElementById("addFrame");
const frameContainer = document.getElementById("frameContainer");

// Every frame stores its own drawing
let frames = [
    canvas.toDataURL()
];

function saveCurrentFrame() {

    frames[currentFrame - 1] = canvas.toDataURL();

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

function cloneCameraForNewFrame(sourceFrame) {

    if (!window.denxCameraFrameStates || !window.denxCloneCameraFrameState) {
        return;
    }

    const sourceState =
        window.denxCameraFrameStates[sourceFrame] ||
        window.denxCameraFrameStates[currentFrame] ||
        window.denxCameraFrameStates[1];

    if (sourceState) {
        window.denxCameraFrameStates[currentFrame + 1] =
            window.denxCloneCameraFrameState(sourceState);
    }

}

// Select a frame
function selectFrame(frameNumber) {

    // Save the frame we're leaving
    saveCurrentFrame();

    if (window.denxSaveCameraFrameState) {
        window.denxSaveCameraFrameState(currentFrame);
    }

    currentFrame = frameNumber;

    document.querySelectorAll(".frame").forEach(frame => {
        frame.classList.remove("active");
    });

    const activeFrame = document.querySelector(
        `[data-frame="${frameNumber}"]`
    );

    if (activeFrame) {
        activeFrame.classList.add("active");
    }

    // Load the drawing for this frame
    loadFrame(frameNumber);

    if (window.denxLoadCameraFrameState) {
        window.denxLoadCameraFrameState(frameNumber);
    }

    // Make sure this frame starts with a blank history state
    const history = getHistory();

    if (history.undo.length === 0) {
        history.undo.push(canvas.toDataURL());
    }

    console.log("Current Frame:", currentFrame);

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

// Make Frame 1 clickable
const firstFrame = document.querySelector('[data-frame="1"]');

if (firstFrame) {
    firstFrame.onclick = () => {
        selectFrame(1);
    };
}

// =========================
// ADD FRAME
// =========================

if (addFrame) {

    addFrame.onclick = () => {

        // Insert AFTER the current frame
        const newFrame = currentFrame + 1;

        shiftStateMapUp(frameHistory, newFrame);

        if (window.denxCameraFrameStates) {
            shiftStateMapUp(window.denxCameraFrameStates, newFrame);
        }

        // Shift all existing buttons up by one
        document.querySelectorAll(".frame").forEach(frame => {

            let num = Number(frame.dataset.frame);

            if (num >= newFrame) {

                num++;

                frame.dataset.frame = num;
                frame.textContent = num;

            }

        });

        // Create empty frame
        frames.splice(currentFrame, 0, null);

        // Create history for the new frame
        frameHistory[newFrame] = {
            undo: [],
            redo: []
        };

        if (window.denxCameraFrameStates && window.denxCloneCameraFrameState) {
            const sourceState =
                window.denxCameraFrameStates[currentFrame] ||
                window.denxCameraFrameStates[newFrame - 1] ||
                window.denxCameraFrameStates[1];

            if (sourceState) {
                window.denxCameraFrameStates[newFrame] =
                    window.denxCloneCameraFrameState(sourceState);
            }
        }

        frameCount++;

        const frame = document.createElement("button");

        frame.className = "frame";
        frame.dataset.frame = newFrame;
        frame.textContent = newFrame;

        frame.onclick = () => {
            selectFrame(Number(frame.dataset.frame));
        };

        // Insert after current frame
        const currentBtn = document.querySelector(
            `[data-frame="${currentFrame}"]`
        );

        currentBtn.after(frame);

        // Select the new frame
        selectFrame(newFrame);

        // Renumber buttons in order
        document.querySelectorAll(".frame").forEach((btn, index) => {

            btn.dataset.frame = index + 1;
            btn.textContent = index + 1;

        });

    };

}

// Select Frame 1 on startup
selectFrame(1);
