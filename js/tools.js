// =========================
// DENX TOOL MANAGER V2
// Active tool tapped again -> Pan.
// =========================

const panTool = document.getElementById("panTool");
const selectTool = document.getElementById("selectTool");
const pencilTool = document.getElementById("pencilTool");
const eraserTool = document.getElementById("eraserTool");
const cameraTool = document.getElementById("cameraTool");
const cameraFrame = document.getElementById("cameraFrame");

let currentTool = "pan";

function toolButtonFor(tool) {
    if (tool === "pan") return panTool;
    if (tool === "select") return selectTool;
    if (tool === "pencil") return pencilTool;
    if (tool === "eraser") return eraserTool;
    if (tool === "camera") return cameraTool;
    return null;
}

function setTool(tool) {
    currentTool = tool;

    [panTool, selectTool, pencilTool, eraserTool, cameraTool].forEach(button => {
        button?.classList.remove("active");
    });

    toolButtonFor(tool)?.classList.add("active");

    if (cameraFrame) {
        cameraFrame.classList.toggle("camera-active", tool === "camera");
    }

    window.dispatchEvent(new CustomEvent("denx:toolchange", {
        detail: { tool }
    }));
}

function activateOrPan(tool) {
    // Fast mobile escape hatch:
    // tapping the already-active tool returns to Pan.
    setTool(currentTool === tool ? "pan" : tool);
}

window.denxSetTool = setTool;
window.denxCurrentTool = () => currentTool;

panTool?.addEventListener("click", () => setTool("pan"));
selectTool?.addEventListener("click", () => activateOrPan("select"));
pencilTool?.addEventListener("click", () => activateOrPan("pencil"));
eraserTool?.addEventListener("click", () => activateOrPan("eraser"));
cameraTool?.addEventListener("click", () => activateOrPan("camera"));

setTool("pan");
