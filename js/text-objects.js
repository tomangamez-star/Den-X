// ============================================================
// DENX TEXT OBJECTS V1
// First-class movable text objects with a contextual right toolbar.
// ============================================================

(() => {
    const SVG_NS = "http://www.w3.org/2000/svg";
    const layer = document.getElementById("textLayer");
    const textTool = document.getElementById("textTool");
    if (!layer) return;

    const objects = [];
    let nextId = 1;
    let selectedId = null;
    let drag = null;

    function clone(value) {
        return JSON.parse(JSON.stringify(value));
    }

    function getObject(id) {
        return objects.find(item => item.id === id) || null;
    }

    function stagePoint(clientX, clientY) {
        try {
            const point = layer.createSVGPoint();
            point.x = clientX;
            point.y = clientY;
            const matrix = layer.getScreenCTM();
            if (matrix) {
                const mapped = point.matrixTransform(matrix.inverse());
                return { x: mapped.x, y: mapped.y };
            }
        } catch (_) {}

        const rect = layer.getBoundingClientRect();
        return {
            x: ((clientX - rect.left) / Math.max(1, rect.width)) * 2048,
            y: ((clientY - rect.top) / Math.max(1, rect.height)) * 1152
        };
    }

    function dispatchSelection() {
        const item = getObject(selectedId);
        window.dispatchEvent(new CustomEvent("denx:textselectionchange", {
            detail: item ? clone(item) : { id: null }
        }));
    }

    function selectText(id) {
        selectedId = getObject(id)?.id || null;
        if (selectedId) {
            window.denxClearFigureSelection?.();
        }
        render();
        dispatchSelection();
        return selectedId;
    }

    function renderTextLines(textEl, item) {
        const lines = String(item.text || "Text").split("\n");
        lines.forEach((line, index) => {
            const tspan = document.createElementNS(SVG_NS, "tspan");
            tspan.setAttribute("x", "0");
            tspan.setAttribute("dy", index === 0 ? "0" : "1.18em");
            tspan.textContent = line || " ";
            textEl.appendChild(tspan);
        });
    }

    function render() {
        layer.replaceChildren();

        objects.forEach(item => {
            const group = document.createElementNS(SVG_NS, "g");
            group.classList.add("denx-text-object");
            if (item.id === selectedId) group.classList.add("selected");
            group.dataset.textId = item.id;
            group.setAttribute(
                "transform",
                `translate(${item.x} ${item.y}) rotate(${item.rotation || 0}) scale(${item.scale || 1})`
            );

            const text = document.createElementNS(SVG_NS, "text");
            text.classList.add("denx-text-value");
            text.setAttribute("x", "0");
            text.setAttribute("y", "0");
            text.setAttribute("fill", item.color || "#111111");
            text.setAttribute("font-family", item.font || "system-ui, sans-serif");
            text.setAttribute("font-size", String(item.fontSize || 64));
            text.setAttribute("font-weight", String(item.weight || 700));
            text.setAttribute("xml:space", "preserve");
            renderTextLines(text, item);
            group.appendChild(text);

            layer.appendChild(group);

            let bbox;
            try {
                bbox = text.getBBox();
            } catch (_) {
                bbox = { x: 0, y: 0, width: 220, height: 70 };
            }

            const hit = document.createElementNS(SVG_NS, "rect");
            hit.classList.add("denx-text-hitbox");
            hit.setAttribute("x", String(bbox.x - 16));
            hit.setAttribute("y", String(bbox.y - 14));
            hit.setAttribute("width", String(Math.max(36, bbox.width + 32)));
            hit.setAttribute("height", String(Math.max(44, bbox.height + 28)));
            group.insertBefore(hit, text);
        });

        window.denxRefreshFrameThumbnail?.(window.currentFrame || 1);
    }

    function createText(options = {}) {
        const item = {
            id: `text-${nextId++}`,
            text: options.text || "Text",
            x: Number.isFinite(Number(options.x)) ? Number(options.x) : 1024,
            y: Number.isFinite(Number(options.y)) ? Number(options.y) : 576,
            scale: Number.isFinite(Number(options.scale)) ? Number(options.scale) : 1,
            rotation: Number.isFinite(Number(options.rotation)) ? Number(options.rotation) : 0,
            font: options.font || "system-ui, sans-serif",
            fontSize: Number(options.fontSize) || 64,
            weight: Number(options.weight) || 700,
            color: /^#[0-9a-f]{6}$/i.test(options.color || "") ? options.color : "#111111"
        };
        objects.push(item);
        selectText(item.id);
        render();
        return item.id;
    }

    function patchSelected(patch) {
        const item = getObject(selectedId);
        if (!item) return false;
        Object.assign(item, patch || {});
        render();
        dispatchSelection();
        return true;
    }

    function scaleSelected(factor) {
        const item = getObject(selectedId);
        factor = Number(factor);
        if (!item || !Number.isFinite(factor) || factor <= 0) return false;
        item.scale = Math.max(0.1, Math.min(8, (item.scale || 1) * factor));
        render();
        dispatchSelection();
        return true;
    }

    function deleteSelected() {
        const index = objects.findIndex(item => item.id === selectedId);
        if (index < 0) return false;
        objects.splice(index, 1);
        selectedId = null;
        render();
        dispatchSelection();
        return true;
    }

    layer.addEventListener("pointerdown", event => {
        const group = event.target.closest?.(".denx-text-object");
        if (!group) return;
        const item = getObject(group.dataset.textId);
        if (!item) return;

        selectText(item.id);
        const point = stagePoint(event.clientX, event.clientY);
        drag = {
            pointerId: event.pointerId,
            id: item.id,
            offsetX: point.x - item.x,
            offsetY: point.y - item.y
        };
        group.setPointerCapture?.(event.pointerId);
        event.preventDefault();
        event.stopPropagation();
    });

    layer.addEventListener("pointermove", event => {
        if (!drag || drag.pointerId !== event.pointerId) return;
        const item = getObject(drag.id);
        if (!item) return;
        const point = stagePoint(event.clientX, event.clientY);
        item.x = point.x - drag.offsetX;
        item.y = point.y - drag.offsetY;
        render();
        event.preventDefault();
        event.stopPropagation();
    });

    function finishDrag(event) {
        if (!drag || drag.pointerId !== event.pointerId) return;
        drag = null;
        dispatchSelection();
        window.denxRefreshFrameThumbnail?.(window.currentFrame || 1);
    }

    layer.addEventListener("pointerup", finishDrag);
    layer.addEventListener("pointercancel", finishDrag);

    textTool?.addEventListener("click", event => {
        event.preventDefault();
        event.stopPropagation();
        window.denxStopPlayback?.();
        window.denxSetTool?.("select");
        createText({ text: "Text" });
        window.denxShowToast?.("Text added — use the right toolbar to style it.");
    });

    window.denxTextObjects = objects;
    window.denxCreateTextObject = createText;
    window.denxSelectTextObject = selectText;
    window.denxGetSelectedTextObject = () => clone(getObject(selectedId));
    window.denxPatchSelectedText = patchSelected;
    window.denxScaleSelectedText = scaleSelected;
    window.denxDeleteSelectedText = deleteSelected;
    window.denxCaptureTextObjects = () => clone(objects);
    window.denxRestoreTextObjects = value => {
        objects.splice(0, objects.length, ...clone(Array.isArray(value) ? value : []));
        nextId = Math.max(0, ...objects.map(item => Number(String(item.id).match(/(\d+)$/)?.[1] || 0))) + 1;
        selectedId = null;
        render();
        dispatchSelection();
    };

    render();
})();
