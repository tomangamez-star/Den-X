// =========================
// DENX TOOL MANAGER V3 — v0.4.2 STABLE MODES
// Explicit, stable interaction modes.
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

function setTool(tool, options = {}) {
    const next = String(tool || "pan");
    if (!toolButtonFor(next) && next !== "pan") return false;

    // Duplicate taps do nothing. This prevents repeated Android repaint/rebuild storms.
    if (currentTool === next && !options.force) return false;

    currentTool = next;
    const activeButton = toolButtonFor(next);

    [panTool, selectTool, pencilTool, eraserTool, cameraTool].forEach(button => {
        if (!button) return;
        const active = button === activeButton;
        button.classList.toggle("active", active);
        button.setAttribute("aria-pressed", active ? "true" : "false");
    });

    if (cameraFrame) cameraFrame.classList.toggle("camera-active", next === "camera");

    window.dispatchEvent(new CustomEvent("denx:toolchange", {
        detail: { tool: next }
    }));
    return true;
}

window.denxSetTool = setTool;
window.denxCurrentTool = () => currentTool;

panTool?.addEventListener("click", () => setTool("pan"));
selectTool?.addEventListener("click", () => setTool("select"));
pencilTool?.addEventListener("click", () => setTool("pencil"));
eraserTool?.addEventListener("click", () => setTool("eraser"));
cameraTool?.addEventListener("click", () => setTool("camera"));

setTool("pan", { force: true });
