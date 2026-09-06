// =========================
// DENX TOOL MANAGER
// =========================

const selectTool = document.getElementById("selectTool");
const pencilTool = document.getElementById("pencilTool");
const eraserTool = document.getElementById("eraserTool");
const cameraTool = document.getElementById("cameraTool");
const cameraFrame = document.getElementById("cameraFrame");

let currentTool = "select";

function setTool(tool) {
    currentTool = tool;

    [selectTool, pencilTool, eraserTool, cameraTool].forEach(button => {
        button?.classList.remove("active");
    });

    if (tool === "select") selectTool?.classList.add("active");
    if (tool === "pencil") pencilTool?.classList.add("active");
    if (tool === "eraser") eraserTool?.classList.add("active");
    if (tool === "camera") cameraTool?.classList.add("active");

    if (cameraFrame) {
        cameraFrame.classList.toggle("camera-active", tool === "camera");
    }

    window.dispatchEvent(new CustomEvent("denx:toolchange", {
        detail: { tool }
    }));
}

window.denxSetTool = setTool;

selectTool?.addEventListener("click", () => setTool("select"));
pencilTool?.addEventListener("click", () => setTool("pencil"));
eraserTool?.addEventListener("click", () => setTool("eraser"));
cameraTool?.addEventListener("click", () => setTool("camera"));

setTool("select");
