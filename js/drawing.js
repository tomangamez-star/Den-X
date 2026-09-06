// =========================
// DRAWING CANVAS
// =========================

const canvas = document.getElementById("drawingCanvas");
const ctx = canvas ? canvas.getContext("2d") : null;

window.denxInputState = window.denxInputState || {
    touchCount: 0,
    gestureActive: false
};

if (canvas && ctx) {

    let drawing = false;
    let activePointerId = null;

    function resizeCanvas() {

        const snapshot = canvas.toDataURL();
        const img = new Image();

        img.onload = () => {

            canvas.width = canvas.clientWidth;
            canvas.height = canvas.clientHeight;

            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            ctx.lineWidth = 4;
            ctx.lineCap = "round";
            ctx.lineJoin = "round";
            ctx.strokeStyle = window.denxDrawColor || "#000000";
            ctx.globalCompositeOperation = "source-over";

            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

            requestAnimationFrame(() => {
                window.denxRefreshOnionSkin?.();
            });

        };

        img.src = snapshot;

    }

    function getCanvasPoint(e) {

        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;

        return {
            x: (e.clientX - rect.left) * scaleX,
            y: (e.clientY - rect.top) * scaleY
        };

    }

    function finishStroke() {

        if (!drawing) return;

        drawing = false;
        activePointerId = null;

        if (window.denxInvalidateTimelineUndo) {
            window.denxInvalidateTimelineUndo();
        }

        if (window.denxInvalidateBoneUndo) {
            window.denxInvalidateBoneUndo();
        }

        const history = getHistory();
        history.undo.push(canvas.toDataURL());

        if (history.undo.length > 50) {
            history.undo.shift();
        }

        history.redo = [];
        saveCurrentFrame();

        window.denxRefreshOnionSkin?.();

        ctx.globalCompositeOperation = "source-over";

    }

    window.addEventListener("denx:cancel-drawing", finishStroke);

    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    getHistory().undo.push(canvas.toDataURL());

    canvas.addEventListener("pointerdown", (e) => {

        if (currentTool !== "pencil" && currentTool !== "eraser") return;
        if (!e.isPrimary) return;
        if (window.denxInputState.gestureActive || window.denxInputState.touchCount > 1) return;

        e.stopPropagation();
        e.preventDefault();

        activePointerId = e.pointerId;
        drawing = true;

        try { canvas.setPointerCapture(e.pointerId); } catch (_) {}

        const p = getCanvasPoint(e);

        ctx.beginPath();
        ctx.moveTo(p.x, p.y);

    });

    canvas.addEventListener("pointermove", (e) => {

        if (currentTool !== "pencil" && currentTool !== "eraser") return;
        if (!drawing) return;
        if (activePointerId !== e.pointerId) return;

        if ((window.denxInputState && window.denxInputState.touchCount > 1) || window.denxInputState.gestureActive) {
            finishStroke();
            return;
        }

        if (currentTool === "eraser") {

            ctx.globalCompositeOperation = "destination-out";
            ctx.lineWidth = 20;

        } else {

            ctx.globalCompositeOperation = "source-over";
            ctx.strokeStyle = window.denxDrawColor || "#000000";
            ctx.lineWidth = 4;

        }

        const p = getCanvasPoint(e);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();

    });

    canvas.addEventListener("pointerup", finishStroke);
    canvas.addEventListener("pointercancel", finishStroke);
    canvas.addEventListener("pointerleave", finishStroke);

}
