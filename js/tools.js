// =========================
// TOOL MANAGER
// =========================
console.log("Reached Tool Manager");

const selectTool = document.getElementById("selectTool");
const pencilTool = document.getElementById("pencilTool");
const eraserTool = document.getElementById("eraserTool");
const cameraTool = document.getElementById("cameraTool");
const cameraFrame = document.getElementById("cameraFrame");

let currentTool = "select";

function setTool(tool){

    currentTool = tool;

    // Remove active state from all buttons
    if(selectTool) selectTool.classList.remove("active");
    if(pencilTool) pencilTool.classList.remove("active");
    if(eraserTool) eraserTool.classList.remove("active");
    if(cameraTool) cameraTool.classList.remove("active");

    // Highlight selected tool
    if(tool === "select" && selectTool){
        selectTool.classList.add("active");
    }

    if(tool === "pencil" && pencilTool){
        pencilTool.classList.add("active");
    }

    if(tool === "eraser" && eraserTool){
        eraserTool.classList.add("active");
    }

    if(tool === "camera" && cameraTool){
        cameraTool.classList.add("active");
    }

    // Camera glow
    if(cameraFrame){

        cameraFrame.classList.remove("camera-active");

        if(tool === "camera"){
            cameraFrame.classList.add("camera-active");
        }

    }

    console.log("Current Tool:", currentTool);

    window.dispatchEvent(new CustomEvent("denx:toolchange", {
        detail: { tool }
    }));

}

// Button Events
if(selectTool){
    selectTool.onclick = () => setTool("select");
}

if(pencilTool){
    pencilTool.onclick = () => setTool("pencil");
}

if(eraserTool){
    eraserTool.onclick = () => setTool("eraser");
}

if(cameraTool){
    cameraTool.onclick = () => setTool("camera");
}

// Default tool
setTool("select");