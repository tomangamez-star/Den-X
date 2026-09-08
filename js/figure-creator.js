// ============================================================
// DENX FIGURE CREATOR V3
// Dedicated figure construction room.
// ============================================================

(() => {
    const SVG_NS = "http://www.w3.org/2000/svg";
    const stage = document.getElementById("creatorStage");
    const stageWrap = document.getElementById("creatorStageWrap");
    const cameraEl = document.getElementById("creatorCamera");

    const nameInput = document.getElementById("figureNameInput");
    const saveBtn = document.getElementById("creatorSaveBtn");
    const cancelBtn = document.getElementById("creatorCancelBtn");
    const undoBtn = document.getElementById("creatorUndoBtn");
    const redoBtn = document.getElementById("creatorRedoBtn");

    const segmentTypeButtons = [...document.querySelectorAll(".segment-type-btn")];
    const segmentColorInput = document.getElementById("segmentColorInput");
    const segmentWidthInput = document.getElementById("segmentWidthInput");
    const elasticToggle = document.getElementById("elasticToggle");
    const deleteSegmentBtn = document.getElementById("deleteSegmentBtn");
    const paletteButtons = [...document.querySelectorAll("[data-color]")];

    const polyfillBeginBtn = document.getElementById("polyfillBeginBtn");
    const polyfillColorInput = document.getElementById("polyfillColorInput");
    const polyfillUndoPointBtn = document.getElementById("polyfillUndoPointBtn");
    const polyfillFinishBtn = document.getElementById("polyfillFinishBtn");

    const creatorToolbar = document.getElementById("creatorToolbar");
    const quickLinks = [...document.querySelectorAll(".creator-quick-link")];
    const quickSections = [...document.querySelectorAll("[data-creator-section]")];

    const zoomInBtn = document.getElementById("creatorZoomIn");
    const zoomOutBtn = document.getElementById("creatorZoomOut");
    const toast = document.getElementById("creatorToast");

    let selectedType = "rounded";
    let selectedSegmentId = "seg-1";
    let defaultColor = "#111111";
    let defaultWidth = 18;
    let defaultElastic = false;

    let nextNodeId = 3;
    let nextSegmentId = 2;
    let nextPolyfillId = 1;

    const nodes = [
        { id: "node-1", parentId: null, role: "root" },
        { id: "node-2", parentId: "node-1", role: "custom" }
    ];

    const segments = [
        {
            id: "seg-1",
            from: "node-1",
            to: "node-2",
            type: "rounded",
            length: 90,
            elastic: false,
            style: { color: "#111111", width: 18 }
        }
    ];

    const pose = {
        "node-1": { x: 460, y: 350 },
        "node-2": { x: 550, y: 350 }
    };

    const polyfills = [];
    const polyfillDraft = {
        active: false,
        nodeIds: []
    };

    const history = {
        undo: [],
        redo: [],
        max: 80
    };

    const camera = {
        x: 0,
        y: 0,
        zoom: 1
    };

    // The creator can edit figures whose workspace coordinates extend well
    // beyond the default 1000×700 construction room. Keep the actual figure
    // coordinates untouched and fit the SVG viewBox around them instead.
    const stageView = {
        x: 0,
        y: 0,
        width: 1000,
        height: 700
    };

    // A large but finite construction world. The nested graph can reveal finer
    // cells indefinitely as you zoom inward, but zooming all the way out now
    // reaches this visible border so a figure can never be lost in empty space.
    // The default 1000×700 build room is centered inside this world.
    const CREATOR_WORLD = {
        x: -2000,
        y: -1400,
        width: 5000,
        height: 3500
    };
    let editViewNeedsFit = false;

    const pointerMap = new Map();
    let pinchStartDistance = null;
    let pinchStartZoom = 1;
    let pinchStartCenter = null;
    let pinchStartCamera = null;
    let pinchStartView = null;
    let panPointerId = null;
    let panLast = null;

    const interaction = {
        active: false,
        pointerId: null,
        mode: null,
        nodeId: null,
        start: null,
        latest: null,
        startPose: null,
        beforeState: null
    };


    let editHandoff = null;
    try {
        const raw = sessionStorage.getItem("denx.figureEditPayload");
        if (raw) editHandoff = JSON.parse(raw);
    } catch (_) {}

    function clone(value) {
        return JSON.parse(JSON.stringify(value));
    }


    if (editHandoff?.definition) {
        const d = editHandoff.definition;
        nodes.splice(0, nodes.length, ...clone(d.nodes || []));
        segments.splice(0, segments.length, ...clone(d.segments || []));
        Object.keys(pose).forEach(key => delete pose[key]);
        Object.assign(pose, clone(d.initialPose || {}));
        polyfills.splice(0, polyfills.length, ...clone(d.polyfills || []));
        nameInput.value = d.name || "Figure";
        saveBtn.textContent = "Save Changes";
        selectedSegmentId = segments[0]?.id || null;
        defaultColor = d.style?.color || segments[0]?.style?.color || defaultColor;
        defaultWidth = Number(d.style?.thickness) || Number(segments[0]?.style?.width) || defaultWidth;
        const nodeNums = nodes.map(n => Number(String(n.id).match(/(\d+)$/)?.[1] || 0));
        const segNums = segments.map(seg => Number(String(seg.id).match(/(\d+)$/)?.[1] || 0));
        nextNodeId = Math.max(2, ...nodeNums) + 1;
        nextSegmentId = Math.max(1, ...segNums) + 1;
        nextPolyfillId = Math.max(0, ...polyfills.map(poly => Number(String(poly.id).match(/(\d+)$/)?.[1] || 0))) + 1;
        editViewNeedsFit = true;
    }

    function snapshot() {
        return {
            nodes: clone(nodes),
            segments: clone(segments),
            pose: clone(pose),
            polyfills: clone(polyfills),
            selectedSegmentId,
            nextNodeId,
            nextSegmentId,
            nextPolyfillId
        };
    }

    function restore(state) {
        nodes.splice(0, nodes.length, ...clone(state.nodes));
        segments.splice(0, segments.length, ...clone(state.segments));

        Object.keys(pose).forEach(key => delete pose[key]);
        Object.assign(pose, clone(state.pose));

        polyfills.splice(0, polyfills.length, ...clone(state.polyfills || []));

        selectedSegmentId = state.selectedSegmentId || segments[0]?.id || null;
        nextNodeId = state.nextNodeId || 3;
        nextSegmentId = state.nextSegmentId || 2;
        nextPolyfillId = state.nextPolyfillId || 1;

        cancelPolyfillDraft();
        syncSegmentControls();
        updateHistoryButtons();
        render();
    }

    function sameState(a, b) {
        return JSON.stringify(a) === JSON.stringify(b);
    }

    function commit(before) {
        const after = snapshot();

        if (sameState(before, after)) return;

        history.undo.push(before);

        if (history.undo.length > history.max) {
            history.undo.shift();
        }

        history.redo.length = 0;
        updateHistoryButtons();
    }

    function undo() {
        if (!history.undo.length) return;

        const current = snapshot();
        const previous = history.undo.pop();

        history.redo.push(current);
        restore(previous);
    }

    function redo() {
        if (!history.redo.length) return;

        const current = snapshot();
        const next = history.redo.pop();

        history.undo.push(current);
        restore(next);
    }

    function updateHistoryButtons() {
        undoBtn.disabled = history.undo.length === 0;
        redoBtn.disabled = history.redo.length === 0;
    }

    function svg(tag, attrs = {}) {
        const el = document.createElementNS(SVG_NS, tag);

        Object.entries(attrs).forEach(([key, value]) => {
            el.setAttribute(key, value);
        });

        return el;
    }

    function updateStageViewBox() {
        clampStageViewToWorld();
        stage.setAttribute(
            "viewBox",
            `${stageView.x} ${stageView.y} ${stageView.width} ${stageView.height}`
        );
        updateAdaptiveGrid();
    }

    function niceGridStep(worldUnitsPerPixel, targetPixels = 26) {
        const ideal = Math.max(0.000001, worldUnitsPerPixel * targetPixels);
        const power = Math.pow(10, Math.floor(Math.log10(ideal)));
        const scaled = ideal / power;
        let factor = 1;
        if (scaled > 5) factor = 10;
        else if (scaled > 2) factor = 5;
        else if (scaled > 1) factor = 2;
        return factor * power;
    }

    function positiveModulo(value, divisor) {
        if (!Number.isFinite(value) || !Number.isFinite(divisor) || divisor === 0) return 0;
        return ((value % divisor) + divisor) % divisor;
    }

    function syncCameraZoomFromView() {
        camera.zoom = Math.max(0.0001, 1000 / Math.max(0.0001, stageView.width));
    }

    function clampStageViewToWorld() {
        // Preserve the current view aspect while preventing it from becoming
        // larger than the creator world.
        if (stageView.width > CREATOR_WORLD.width || stageView.height > CREATOR_WORLD.height) {
            const scale = Math.min(
                CREATOR_WORLD.width / Math.max(0.0001, stageView.width),
                CREATOR_WORLD.height / Math.max(0.0001, stageView.height)
            );
            stageView.width *= scale;
            stageView.height *= scale;
        }

        const maxX = CREATOR_WORLD.x + CREATOR_WORLD.width - stageView.width;
        const maxY = CREATOR_WORLD.y + CREATOR_WORLD.height - stageView.height;
        stageView.x = Math.min(Math.max(stageView.x, CREATOR_WORLD.x), Math.max(CREATOR_WORLD.x, maxX));
        stageView.y = Math.min(Math.max(stageView.y, CREATOR_WORLD.y), Math.max(CREATOR_WORLD.y, maxY));
        syncCameraZoomFromView();
    }

    function drawCreatorWorldBoundary() {
        const boundary = svg("rect", {
            x: CREATOR_WORLD.x,
            y: CREATOR_WORLD.y,
            width: CREATOR_WORLD.width,
            height: CREATOR_WORLD.height,
            fill: "none",
            stroke: "rgba(0,200,255,.9)",
            "stroke-width": "3",
            "vector-effect": "non-scaling-stroke",
            "pointer-events": "none"
        });
        boundary.setAttribute("class", "creator-world-boundary");
        stage.appendChild(boundary);
    }

    function updateAdaptiveGrid() {
        if (!stageWrap) return;
        const rect = stageWrap.getBoundingClientRect();
        if (!(rect.width > 0) || !(rect.height > 0) || !(stageView.width > 0) || !(stageView.height > 0)) return;

        // Infinite nested graph: the figure remains in world coordinates while
        // the graph redraws itself for the current camera scale. Zooming deeper
        // reveals finer cells instead of stretching one fixed 28px texture.
        const worldPerPixelX = stageView.width / rect.width;
        const worldPerPixelY = stageView.height / rect.height;
        const worldPerPixel = Math.max(0.000001, (worldPerPixelX + worldPerPixelY) / 2);
        const minorWorld = niceGridStep(worldPerPixel, 24);
        const mediumWorld = minorWorld * 5;
        const majorWorld = minorWorld * 25;

        const minorPxX = minorWorld / worldPerPixelX;
        const minorPxY = minorWorld / worldPerPixelY;
        const mediumPxX = mediumWorld / worldPerPixelX;
        const mediumPxY = mediumWorld / worldPerPixelY;
        const majorPxX = majorWorld / worldPerPixelX;
        const majorPxY = majorWorld / worldPerPixelY;

        const pos = (worldX, worldY, stepWorld, pxX, pxY) => {
            const screenX = (worldX - stageView.x) / worldPerPixelX;
            const screenY = (worldY - stageView.y) / worldPerPixelY;
            return `${positiveModulo(screenX, pxX)}px ${positiveModulo(screenY, pxY)}px`;
        };

        stageWrap.style.backgroundColor = "#303030";
        stageWrap.style.backgroundImage = [
            "linear-gradient(rgba(255,255,255,.045) 1px, transparent 1px)",
            "linear-gradient(90deg, rgba(255,255,255,.045) 1px, transparent 1px)",
            "linear-gradient(rgba(255,255,255,.080) 1px, transparent 1px)",
            "linear-gradient(90deg, rgba(255,255,255,.080) 1px, transparent 1px)",
            "linear-gradient(rgba(0,200,255,.115) 1px, transparent 1px)",
            "linear-gradient(90deg, rgba(0,200,255,.115) 1px, transparent 1px)"
        ].join(",");
        stageWrap.style.backgroundSize = [
            `${minorPxX}px ${minorPxY}px`, `${minorPxX}px ${minorPxY}px`,
            `${mediumPxX}px ${mediumPxY}px`, `${mediumPxX}px ${mediumPxY}px`,
            `${majorPxX}px ${majorPxY}px`, `${majorPxX}px ${majorPxY}px`
        ].join(",");
        stageWrap.style.backgroundPosition = [
            pos(0, 0, minorWorld, minorPxX, minorPxY), pos(0, 0, minorWorld, minorPxX, minorPxY),
            pos(0, 0, mediumWorld, mediumPxX, mediumPxY), pos(0, 0, mediumWorld, mediumPxX, mediumPxY),
            pos(0, 0, majorWorld, majorPxX, majorPxY), pos(0, 0, majorWorld, majorPxX, majorPxY)
        ].join(",");
    }

    function fitStageViewToPose() {
        const points = Object.values(pose).filter(point =>
            Number.isFinite(Number(point?.x)) && Number.isFinite(Number(point?.y))
        );
        if (!points.length) return;

        let minX = Math.min(...points.map(point => Number(point.x)));
        let maxX = Math.max(...points.map(point => Number(point.x)));
        let minY = Math.min(...points.map(point => Number(point.y)));
        let maxY = Math.max(...points.map(point => Number(point.y)));

        const rawWidth = Math.max(80, maxX - minX);
        const rawHeight = Math.max(80, maxY - minY);
        const padding = Math.max(60, Math.max(rawWidth, rawHeight) * 0.22);
        minX -= padding;
        maxX += padding;
        minY -= padding;
        maxY += padding;

        let width = Math.max(160, maxX - minX);
        let height = Math.max(120, maxY - minY);
        const rect = stageWrap.getBoundingClientRect();
        const aspect = rect.width > 0 && rect.height > 0
            ? rect.width / rect.height
            : 1000 / 700;
        const currentAspect = width / height;

        if (currentAspect > aspect) {
            const nextHeight = width / aspect;
            minY -= (nextHeight - height) / 2;
            height = nextHeight;
        } else {
            const nextWidth = height * aspect;
            minX -= (nextWidth - width) / 2;
            width = nextWidth;
        }

        stageView.x = minX;
        stageView.y = minY;
        stageView.width = width;
        stageView.height = height;
        camera.x = 0;
        camera.y = 0;
        camera.zoom = 1;
        updateStageViewBox();
        updateCamera();
    }

    function updateCamera() {
        // v0.2.5: the SVG viewBox is the creator camera. This is more reliable
        // on Android/PWA than CSS-transforming the creator wrapper and keeps
        // pan/zoom independent from node-handle sizing.
        if (cameraEl) {
            cameraEl.style.transform = "";
            cameraEl.style.transformOrigin = "";
        }
        updateStageViewBox();
    }

    function screenToStage(clientX, clientY) {
        // Use the SVG's real screen matrix so coordinate mapping stays exact
        // even when preserveAspectRatio introduces letterboxing.
        try {
            const point = stage.createSVGPoint();
            point.x = clientX;
            point.y = clientY;
            const matrix = stage.getScreenCTM();
            if (matrix) {
                const mapped = point.matrixTransform(matrix.inverse());
                return { x: mapped.x, y: mapped.y };
            }
        } catch (_) {}

        const rect = stageWrap.getBoundingClientRect();
        const normalizedX = (clientX - rect.left) / Math.max(1, rect.width);
        const normalizedY = (clientY - rect.top) / Math.max(1, rect.height);
        return {
            x: stageView.x + normalizedX * stageView.width,
            y: stageView.y + normalizedY * stageView.height
        };
    }

    function pointFromEvent(e) {
        return screenToStage(e.clientX, e.clientY);
    }

    function setZoom(nextZoom, clientX = null, clientY = null) {
        const rect = stageWrap.getBoundingClientRect();
        const next = Math.max(0.05, Math.min(32, Number(nextZoom) || 1));
        const oldZoom = Math.max(0.0001, camera.zoom || 1);
        if (Math.abs(next - oldZoom) < 0.0001) return;

        const anchorScreenX = clientX == null ? rect.width / 2 : clientX - rect.left;
        const anchorScreenY = clientY == null ? rect.height / 2 : clientY - rect.top;
        const nx = anchorScreenX / Math.max(1, rect.width);
        const ny = anchorScreenY / Math.max(1, rect.height);

        const anchorWorldX = stageView.x + nx * stageView.width;
        const anchorWorldY = stageView.y + ny * stageView.height;
        const ratio = oldZoom / next;
        const nextWidth = stageView.width * ratio;
        const nextHeight = stageView.height * ratio;

        stageView.x = anchorWorldX - nx * nextWidth;
        stageView.y = anchorWorldY - ny * nextHeight;
        stageView.width = nextWidth;
        stageView.height = nextHeight;
        camera.zoom = next;
        updateStageViewBox();
    }

    function childrenOf(nodeId) {
        return nodes.filter(node => node.parentId === nodeId);
    }

    function subtreeIds(nodeId) {
        const result = [];
        const queue = [nodeId];

        while (queue.length) {
            const current = queue.shift();
            if (result.includes(current)) continue;

            result.push(current);
            childrenOf(current).forEach(child => queue.push(child.id));
        }

        return result;
    }

    function segmentForNode(nodeId) {
        return segments.find(segment => segment.to === nodeId) || null;
    }

    function selectedSegment() {
        return segments.find(segment => segment.id === selectedSegmentId) || null;
    }

    function selectNode(nodeId) {
        const connected = segmentForNode(nodeId);

        if (connected) {
            selectedSegmentId = connected.id;
            syncSegmentControls();
        }
    }

    function syncSegmentControls() {
        const segment = selectedSegment();

        if (!segment) {
            deleteSegmentBtn.disabled = true;
            return;
        }

        deleteSegmentBtn.disabled = false;

        segmentColorInput.value = segment.style?.color || defaultColor;
        segmentWidthInput.value = Number(segment.style?.width) || defaultWidth;
        elasticToggle.checked = !!segment.elastic;
    }

    function polygonPointsForSegment(type, from, to, width) {
        const dx = to.x - from.x;
        const dy = to.y - from.y;
        const length = Math.max(1, Math.hypot(dx, dy));
        const ux = dx / length;
        const uy = dy / length;
        const px = -uy;
        const py = ux;
        const half = Math.max(2, width / 2);

        const point = (along, across) => ({
            x: from.x + ux * along + px * across,
            y: from.y + uy * along + py * across
        });

        if (type === "triangle") {
            return [point(0,-half), point(0,half), point(length,0)];
        }

        if (type === "diamond") {
            return [
                point(0,0),
                point(length/2,-half),
                point(length,0),
                point(length/2,half)
            ];
        }

        if (type === "hexagon") {
            const inset = Math.min(length * 0.22, half * 1.2);

            return [
                point(0,0),
                point(inset,-half),
                point(length-inset,-half),
                point(length,0),
                point(length-inset,half),
                point(inset,half)
            ];
        }

        return [
            point(0,-half),
            point(length,-half),
            point(length,half),
            point(0,half)
        ];
    }

    function drawSegment(group, segment) {
        const from = pose[segment.from];
        const to = pose[segment.to];
        if (!from || !to) return;

        const width = Number(segment.style?.width) || 18;
        const color = segment.style?.color || "#111111";
        const selected = segment.id === selectedSegmentId;

        let shape;

        if (segment.type === "circle") {
            /*
              Circle V3:
              The segment's LENGTH is the diameter.
              The segment itself is the centre-line through that circle.
              Short drag = small circle, long drag = large circle.
              No forced minimum except a tiny anti-zero safeguard.
            */
            const dx = to.x - from.x;
            const dy = to.y - from.y;
            const diameter = Math.max(8, Math.hypot(dx, dy));
            const radius = diameter / 2;

            shape = svg("circle", {
                cx: (from.x + to.x) / 2,
                cy: (from.y + to.y) / 2,
                r: radius,
                fill: color,
                class: "creator-segment-shape creator-circle-shape"
            });
        } else if (
            segment.type === "rectangle" ||
            segment.type === "triangle" ||
            segment.type === "diamond" ||
            segment.type === "hexagon"
        ) {
            const points = polygonPointsForSegment(
                segment.type,
                from,
                to,
                width
            ).map(point => `${point.x},${point.y}`).join(" ");

            shape = svg("polygon", {
                points,
                fill: color,
                class: "creator-segment-shape"
            });
        } else {
            shape = svg("line", {
                x1: from.x,
                y1: from.y,
                x2: to.x,
                y2: to.y,
                stroke: color,
                "stroke-width": width,
                "stroke-linecap": "round",
                class: "creator-segment-shape"
            });
        }

        shape.dataset.segmentId = segment.id;

        if (selected) {
            shape.classList.add("selected");
        }

        shape.addEventListener("pointerdown", e => {
            if (polyfillDraft.active) return;

            selectedSegmentId = segment.id;
            syncSegmentControls();
            render();
            e.stopPropagation();
        });

        group.appendChild(shape);
    }

    function drawPolyfills() {
        const group = svg("g", {
            class: "creator-polyfill-layer"
        });

        polyfills.forEach(polyfill => {
            const points = polyfill.nodeIds
                .map(id => pose[id])
                .filter(Boolean);

            if (points.length < 3) return;

            group.appendChild(svg("polygon", {
                points: points.map(point => `${point.x},${point.y}`).join(" "),
                fill: polyfill.color,
                class: "creator-polyfill"
            }));
        });

        if (polyfillDraft.active && polyfillDraft.nodeIds.length >= 2) {
            const points = polyfillDraft.nodeIds
                .map(id => pose[id])
                .filter(Boolean);

            group.appendChild(svg("polyline", {
                points: points.map(point => `${point.x},${point.y}`).join(" "),
                fill: "none",
                class: "creator-polyfill-draft"
            }));
        }

        stage.appendChild(group);
    }

    function nodeUiScale() {
        return 1 / camera.zoom;
    }

    function render() {
        stage.innerHTML = "";
        drawCreatorWorldBoundary();

        // Filled geometry sits behind segment geometry.
        drawPolyfills();

        const segmentGroup = svg("g");
        segments.forEach(segment => drawSegment(segmentGroup, segment));
        stage.appendChild(segmentGroup);

        const uiScale = nodeUiScale();

        nodes.forEach(node => {
            const point = pose[node.id];
            if (!point) return;

            const isRoot = node.parentId == null;
            const chosenForFill = polyfillDraft.nodeIds.includes(node.id);

            const touchSize = 40 * uiScale;
            const touchRadius = 20 * uiScale;

            const touch = isRoot
                ? svg("rect", {
                    x: point.x - touchSize/2,
                    y: point.y - touchSize/2,
                    width: touchSize,
                    height: touchSize,
                    rx: 5 * uiScale,
                    class: "creator-node-touch",
                    "data-node-id": node.id
                })
                : svg("circle", {
                    cx: point.x,
                    cy: point.y,
                    r: touchRadius,
                    class: "creator-node-touch",
                    "data-node-id": node.id
                });

            const visual = isRoot
                ? svg("rect", {
                    x: point.x - 4.5 * uiScale,
                    y: point.y - 4.5 * uiScale,
                    width: 9 * uiScale,
                    height: 9 * uiScale,
                    rx: 1.2 * uiScale,
                    class: `creator-node creator-main-node${chosenForFill ? " polyfill-chosen" : ""}`,
                    "stroke-width": 1.3 * uiScale
                })
                : svg("circle", {
                    cx: point.x,
                    cy: point.y,
                    r: 4 * uiScale,
                    class: `creator-node${chosenForFill ? " polyfill-chosen" : ""}`,
                    "stroke-width": 1.3 * uiScale
                });

            touch.addEventListener("pointerdown", e => {
                if (polyfillDraft.active) {
                    addPolyfillPoint(node.id);
                    e.preventDefault();
                    e.stopPropagation();
                    return;
                }

                beginNodeInteraction(e, node.id);
            });

            stage.appendChild(touch);
            stage.appendChild(visual);
        });

        if (
            interaction.active &&
            interaction.mode === "build" &&
            interaction.start &&
            interaction.latest
        ) {
            stage.appendChild(svg("line", {
                x1: interaction.start.x,
                y1: interaction.start.y,
                x2: interaction.latest.x,
                y2: interaction.latest.y,
                class: "creator-build-preview",
                "stroke-width": 3 * uiScale
            }));
        }

        syncPolyfillButtons();
    }

    function beginNodeInteraction(e, nodeId) {
        if (!e.isPrimary) return;

        const nodePoint = pose[nodeId];
        if (!nodePoint) return;

        selectNode(nodeId);

        interaction.active = true;
        interaction.pointerId = e.pointerId;
        interaction.nodeId = nodeId;
        interaction.start = { ...nodePoint };
        interaction.latest = pointFromEvent(e);
        interaction.startPose = clone(pose);
        interaction.beforeState = snapshot();
        interaction.mode = selectedType === "none" ? "move" : "build";

        try {
            stage.setPointerCapture(e.pointerId);
        } catch (_) {}

        e.preventDefault();
        e.stopPropagation();
        render();
    }

    function rotatePoint(point, pivot, angle) {
        const dx = point.x - pivot.x;
        const dy = point.y - pivot.y;
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);

        return {
            x: pivot.x + dx * cos - dy * sin,
            y: pivot.y + dx * sin + dy * cos
        };
    }

    function moveRigidNode(nodeId, target) {
        const node = nodes.find(item => item.id === nodeId);
        if (!node) return;

        const startPose = interaction.startPose;

        // MAIN/root always moves entire figure.
        if (node.parentId == null) {
            const start = startPose[nodeId];
            const dx = target.x - start.x;
            const dy = target.y - start.y;

            Object.keys(startPose).forEach(id => {
                pose[id] = {
                    x: startPose[id].x + dx,
                    y: startPose[id].y + dy
                };
            });

            return;
        }

        const parent = startPose[node.parentId];
        const original = startPose[nodeId];
        if (!parent || !original) return;

        const segment = segmentForNode(nodeId);

        if (segment?.elastic) {
            // Elastic ON: selected node/subtree translates freely and segment
            // length is updated when the interaction finishes.
            const dx = target.x - original.x;
            const dy = target.y - original.y;

            subtreeIds(nodeId).forEach(id => {
                pose[id] = {
                    x: startPose[id].x + dx,
                    y: startPose[id].y + dy
                };
            });

            return;
        }

        // Elastic OFF (default): rigid forward-kinematic rotation.
        const oldAngle = Math.atan2(
            original.y - parent.y,
            original.x - parent.x
        );

        const newAngle = Math.atan2(
            target.y - parent.y,
            target.x - parent.x
        );

        const delta = newAngle - oldAngle;

        subtreeIds(nodeId).forEach(id => {
            pose[id] = rotatePoint(startPose[id], parent, delta);
        });
    }

    function moveInteraction(e) {
        if (!interaction.active || e.pointerId !== interaction.pointerId) return;

        const point = pointFromEvent(e);
        interaction.latest = point;

        if (interaction.mode === "move") {
            moveRigidNode(interaction.nodeId, point);
        }

        e.preventDefault();
        render();
    }

    function finishInteraction(e) {
        if (!interaction.active || e.pointerId !== interaction.pointerId) return;

        if (interaction.mode === "build") {
            const end = pointFromEvent(e);
            const start = pose[interaction.nodeId];

            const dx = end.x - start.x;
            const dy = end.y - start.y;
            const distance = Math.hypot(dx, dy);

            // V3: tiny drag means tiny segment. We no longer create a huge
            // fallback length. Only protect against an actual zero-length tap.
            const minimum = 8;
            let endpoint = end;

            if (distance < minimum) {
                const angle = distance > 0.1 ? Math.atan2(dy, dx) : 0;
                endpoint = {
                    x: start.x + Math.cos(angle) * minimum,
                    y: start.y + Math.sin(angle) * minimum
                };
            }

            const nodeId = `node-${nextNodeId++}`;
            const segmentId = `seg-${nextSegmentId++}`;
            const newLength = Math.max(
                minimum,
                Math.hypot(endpoint.x - start.x, endpoint.y - start.y)
            );

            nodes.push({
                id: nodeId,
                parentId: interaction.nodeId,
                role: "custom"
            });

            pose[nodeId] = { ...endpoint };

            segments.push({
                id: segmentId,
                from: interaction.nodeId,
                to: nodeId,
                type: selectedType,
                length: newLength,
                elastic: defaultElastic,
                style: {
                    color: defaultColor,
                    width: defaultWidth
                }
            });

            selectedSegmentId = segmentId;
            syncSegmentControls();
        } else if (interaction.mode === "move") {
            const segment = segmentForNode(interaction.nodeId);

            if (segment?.elastic) {
                const from = pose[segment.from];
                const to = pose[segment.to];

                if (from && to) {
                    segment.length = Math.max(
                        1,
                        Math.hypot(to.x - from.x, to.y - from.y)
                    );
                }
            }
        }

        const before = interaction.beforeState;

        interaction.active = false;
        interaction.pointerId = null;
        interaction.mode = null;
        interaction.nodeId = null;
        interaction.start = null;
        interaction.latest = null;
        interaction.startPose = null;
        interaction.beforeState = null;

        try {
            stage.releasePointerCapture(e.pointerId);
        } catch (_) {}

        if (before) commit(before);
        render();
    }

    function cancelInteraction(e) {
        if (!interaction.active) return;
        if (e && e.pointerId !== interaction.pointerId) return;

        if (interaction.startPose) {
            Object.keys(pose).forEach(key => delete pose[key]);
            Object.assign(pose, clone(interaction.startPose));
        }

        interaction.active = false;
        interaction.pointerId = null;
        interaction.mode = null;
        interaction.nodeId = null;
        interaction.start = null;
        interaction.latest = null;
        interaction.startPose = null;
        interaction.beforeState = null;

        render();
    }

    function setSegmentType(type) {
        selectedType = type;

        segmentTypeButtons.forEach(button => {
            button.classList.toggle(
                "active",
                button.dataset.segmentType === type
            );
        });
    }

    function applySegmentColor(color) {
        defaultColor = color;
        segmentColorInput.value = color;

        paletteButtons.forEach(button => {
            button.classList.toggle(
                "active",
                button.dataset.color.toLowerCase() === color.toLowerCase()
            );
        });

        const segment = selectedSegment();
        if (!segment) return;

        const before = snapshot();

        segment.style = segment.style || {};
        segment.style.color = color;

        commit(before);
        render();
    }

    segmentTypeButtons.forEach(button => {
        button.addEventListener("click", () => {
            setSegmentType(button.dataset.segmentType);
        });
    });

    paletteButtons.forEach(button => {
        button.addEventListener("click", () => {
            applySegmentColor(button.dataset.color);
        });
    });

    segmentColorInput.addEventListener("change", e => {
        applySegmentColor(e.target.value);
    });

    segmentWidthInput.addEventListener("change", e => {
        const segment = selectedSegment();
        if (!segment) return;

        const before = snapshot();
        defaultWidth = Number(e.target.value) || 18;

        segment.style = segment.style || {};
        segment.style.width = defaultWidth;

        commit(before);
        render();
    });

    elasticToggle.addEventListener("change", e => {
        defaultElastic = !!e.target.checked;

        const segment = selectedSegment();
        if (!segment) return;

        const before = snapshot();
        segment.elastic = defaultElastic;
        commit(before);
        render();
    });

    deleteSegmentBtn.addEventListener("click", () => {
        const segment = selectedSegment();
        if (!segment) return;

        const before = snapshot();
        const removeNodes = new Set(subtreeIds(segment.to));

        const keptSegments = segments.filter(item =>
            item.id !== segment.id &&
            !removeNodes.has(item.from) &&
            !removeNodes.has(item.to)
        );

        segments.splice(0, segments.length, ...keptSegments);

        for (let index = nodes.length - 1; index >= 0; index--) {
            if (removeNodes.has(nodes[index].id)) {
                delete pose[nodes[index].id];
                nodes.splice(index, 1);
            }
        }

        // Remove fills referencing deleted nodes.
        for (let index = polyfills.length - 1; index >= 0; index--) {
            if (polyfills[index].nodeIds.some(id => removeNodes.has(id))) {
                polyfills.splice(index, 1);
            }
        }

        selectedSegmentId = segments[segments.length - 1]?.id || null;
        syncSegmentControls();
        commit(before);
        render();
    });

    function beginPolyfill() {
        polyfillDraft.active = true;
        polyfillDraft.nodeIds = [];
        syncPolyfillButtons();
        render();
        showToast("Polyfill: tap boundary nodes in order.");
    }

    function addPolyfillPoint(nodeId) {
        if (!polyfillDraft.active) return;

        const current = polyfillDraft.nodeIds;

        if (current.length >= 3 && nodeId === current[0]) {
            finishPolyfill();
            return;
        }

        if (current[current.length - 1] === nodeId) return;

        current.push(nodeId);
        syncPolyfillButtons();
        render();
    }

    function undoPolyfillPoint() {
        if (!polyfillDraft.active || !polyfillDraft.nodeIds.length) return;

        polyfillDraft.nodeIds.pop();
        syncPolyfillButtons();
        render();
    }

    function finishPolyfill() {
        if (!polyfillDraft.active || polyfillDraft.nodeIds.length < 3) {
            showToast("Polyfill needs at least 3 nodes.");
            return;
        }

        const before = snapshot();

        polyfills.push({
            id: `poly-${nextPolyfillId++}`,
            nodeIds: [...polyfillDraft.nodeIds],
            color: polyfillColorInput.value
        });

        cancelPolyfillDraft();
        commit(before);
        render();
        showToast("Polyfill created ✓");
    }

    function cancelPolyfillDraft() {
        polyfillDraft.active = false;
        polyfillDraft.nodeIds = [];
        syncPolyfillButtons();
    }

    function syncPolyfillButtons() {
        const count = polyfillDraft.nodeIds.length;

        polyfillBeginBtn.textContent =
            polyfillDraft.active ? "Cancel" : "Begin";

        polyfillUndoPointBtn.disabled =
            !polyfillDraft.active || count === 0;

        polyfillFinishBtn.disabled =
            !polyfillDraft.active || count < 3;
    }

    polyfillBeginBtn.addEventListener("click", () => {
        if (polyfillDraft.active) {
            cancelPolyfillDraft();
            render();
        } else {
            beginPolyfill();
        }
    });

    polyfillUndoPointBtn.addEventListener("click", undoPolyfillPoint);
    polyfillFinishBtn.addEventListener("click", finishPolyfill);

    undoBtn.addEventListener("click", undo);
    redoBtn.addEventListener("click", redo);

    // -------------------------------------------------------------
    // Creator quick-find rail
    // -------------------------------------------------------------
    function setActiveQuick(name) {
        quickLinks.forEach(link => {
            link.classList.toggle(
                "active",
                link.dataset.creatorTarget === name
            );
        });
    }

    function syncQuickFromScroll() {
        const marker = creatorToolbar.scrollTop + 48;
        let active = quickSections[0];

        quickSections.forEach(section => {
            if (section.offsetTop <= marker) active = section;
        });

        if (active) {
            setActiveQuick(active.dataset.creatorSection);
        }
    }

    quickLinks.forEach(link => {
        link.addEventListener("click", () => {
            const target = document.querySelector(
                `[data-creator-section="${link.dataset.creatorTarget}"]`
            );

            if (!target) return;

            creatorToolbar.scrollTo({
                top: Math.max(0, target.offsetTop - 6),
                behavior: "smooth"
            });

            setActiveQuick(link.dataset.creatorTarget);
        });
    });

    creatorToolbar.addEventListener("scroll", syncQuickFromScroll, {
        passive: true
    });

    // -------------------------------------------------------------
    // Keep the infinite graph aligned if the creator viewport changes size.
    window.addEventListener("resize", updateAdaptiveGrid);

    // Zoom + direct canvas pan + two-finger pan/pinch
    // -------------------------------------------------------------
    zoomInBtn.addEventListener("click", event => {
        event.preventDefault();
        setZoom(camera.zoom * 1.2);
    });

    zoomOutBtn.addEventListener("click", event => {
        event.preventDefault();
        setZoom(camera.zoom / 1.2);
    });

    stageWrap.style.touchAction = "none";

    stageWrap.addEventListener("wheel", event => {
        event.preventDefault();
        setZoom(
            camera.zoom * (event.deltaY < 0 ? 1.12 : 0.89),
            event.clientX,
            event.clientY
        );
    }, { passive: false });

    function isCreatorInteractiveTarget(target) {
        return !!target?.closest?.(
            ".creator-node-touch, .creator-node, .creator-segment, [data-node-id], [data-segment-id], button, input, select, textarea"
        );
    }

    stageWrap.addEventListener("pointerdown", e => {
        if (e.pointerType !== "touch" && e.pointerType !== "pen") return;

        pointerMap.set(e.pointerId, {
            x: e.clientX,
            y: e.clientY
        });

        // One finger on genuinely empty creator space pans the view. We no
        // longer require e.target === stage because the grid/background can
        // legitimately be the event target on mobile.
        if (pointerMap.size === 1 && !isCreatorInteractiveTarget(e.target)) {
            panPointerId = e.pointerId;
            panLast = { x: e.clientX, y: e.clientY };
            e.preventDefault();
        }

        if (pointerMap.size === 2) {
            const pts = [...pointerMap.values()];
            pinchStartDistance = Math.max(1, Math.hypot(
                pts[1].x - pts[0].x,
                pts[1].y - pts[0].y
            ));
            pinchStartZoom = camera.zoom;
            pinchStartCenter = {
                x: (pts[0].x + pts[1].x) / 2,
                y: (pts[0].y + pts[1].y) / 2
            };
            pinchStartView = { ...stageView };
            pinchStartCamera = { x: camera.x, y: camera.y };
            panPointerId = null;
            panLast = null;
            cancelInteraction();
            e.preventDefault();
        }
    }, true);

    stageWrap.addEventListener("pointermove", e => {
        if (!pointerMap.has(e.pointerId)) return;

        pointerMap.set(e.pointerId, {
            x: e.clientX,
            y: e.clientY
        });

        if (pointerMap.size === 2) {
            const pts = [...pointerMap.values()];
            const distance = Math.max(1, Math.hypot(
                pts[1].x - pts[0].x,
                pts[1].y - pts[0].y
            ));
            const center = {
                x: (pts[0].x + pts[1].x) / 2,
                y: (pts[0].y + pts[1].y) / 2
            };

            if (pinchStartDistance > 0 && pinchStartCenter && pinchStartView) {
                const rect = stageWrap.getBoundingClientRect();
                const nextZoom = Math.max(
                    0.05,
                    Math.min(32, pinchStartZoom * (distance / pinchStartDistance))
                );
                const ratio = pinchStartZoom / nextZoom;

                const startNX = (pinchStartCenter.x - rect.left) / Math.max(1, rect.width);
                const startNY = (pinchStartCenter.y - rect.top) / Math.max(1, rect.height);
                const nowNX = (center.x - rect.left) / Math.max(1, rect.width);
                const nowNY = (center.y - rect.top) / Math.max(1, rect.height);

                const anchorWorldX = pinchStartView.x + startNX * pinchStartView.width;
                const anchorWorldY = pinchStartView.y + startNY * pinchStartView.height;
                const nextWidth = pinchStartView.width * ratio;
                const nextHeight = pinchStartView.height * ratio;

                stageView.x = anchorWorldX - nowNX * nextWidth;
                stageView.y = anchorWorldY - nowNY * nextHeight;
                stageView.width = nextWidth;
                stageView.height = nextHeight;
                camera.zoom = nextZoom;
                updateStageViewBox();
            }

            e.preventDefault();
            return;
        }

        if (pointerMap.size === 1 && panPointerId === e.pointerId && panLast) {
            const previousWorld = screenToStage(panLast.x, panLast.y);
            const currentWorld = screenToStage(e.clientX, e.clientY);

            stageView.x += previousWorld.x - currentWorld.x;
            stageView.y += previousWorld.y - currentWorld.y;
            panLast = { x: e.clientX, y: e.clientY };
            updateStageViewBox();
            e.preventDefault();
        }
    }, true);

    function removePointer(e) {
        pointerMap.delete(e.pointerId);

        if (panPointerId === e.pointerId) {
            panPointerId = null;
            panLast = null;
        }

        if (pointerMap.size < 2) {
            pinchStartDistance = null;
            pinchStartCenter = null;
            pinchStartCamera = null;
            pinchStartView = null;
        }

        // If one finger remains after a pinch, require a fresh touch for pan.
        if (pointerMap.size === 1) {
            panPointerId = null;
            panLast = null;
        }
    }

    stageWrap.addEventListener("pointerup", removePointer, true);
    stageWrap.addEventListener("pointercancel", removePointer, true);

    stage.addEventListener("pointermove", moveInteraction);
    stage.addEventListener("pointerup", finishInteraction);
    stage.addEventListener("pointercancel", cancelInteraction);

    function buildDefinition() {
        const name = nameInput.value.trim() || "Untitled Figure";

        const figureColor =
            segments[0]?.style?.color ||
            defaultColor ||
            "#111111";

        const figureThickness =
            Number(segments[0]?.style?.width) ||
            defaultWidth ||
            18;

        return {
            format: "denx-figure",
            version: 2,
            id: editHandoff?.definition?.id || DenXFigureLibrary.uid("dxf"),
            name,
            rootNodeId: editHandoff?.definition?.rootNodeId || nodes.find(node => node.parentId == null)?.id || nodes[0]?.id,
            style: {
                color: figureColor,
                thickness: figureThickness
            },
            nodes: clone(nodes),
            segments: clone(segments),
            polyfills: clone(polyfills),
            initialPose: clone(pose)
        };
    }

    saveBtn.addEventListener("click", () => {
        if (segments.length < 1 || nodes.length < 2) return;

        try {
            const definition = buildDefinition();
            if (editHandoff?.figureId && editHandoff?.timelineSession) {
                sessionStorage.setItem("denx.figureEditReturn", JSON.stringify({
                    figureId: editHandoff.figureId,
                    definition,
                    timelineSession: editHandoff.timelineSession
                }));
                sessionStorage.removeItem("denx.figureEditPayload");
                window.location.href = "workspace.html";
                return;
            }

            const saved = DenXFigureLibrary.saveToLibrary(definition);
            const persisted = DenXFigureLibrary.getLibrary()
                .some(figure => figure.id === saved.id);
            if (!persisted) throw new Error("Figure did not persist. Save cancelled.");
            sessionStorage.setItem("denx.figureCreatedNotice", saved.name);
            sessionStorage.setItem("denx.figureCreatedReturn", JSON.stringify(saved));
            window.location.href = "workspace.html";
        } catch (error) {
            showToast(error?.message || "Could not save figure.");
        }
    });

    cancelBtn.addEventListener("click", () => {
        if (editHandoff?.timelineSession) {
            sessionStorage.setItem("denx.figureEditReturn", JSON.stringify({
                timelineSession: editHandoff.timelineSession
            }));
            sessionStorage.removeItem("denx.figureEditPayload");
        }
        window.location.href = "workspace.html";
    });

    let toastTimer = null;

    function showToast(message) {
        toast.textContent = message;
        toast.classList.add("show");

        clearTimeout(toastTimer);
        toastTimer = setTimeout(
            () => toast.classList.remove("show"),
            1800
        );
    }

    syncSegmentControls();
    updateHistoryButtons();
    syncPolyfillButtons();
    syncQuickFromScroll();
    updateCamera();
    updateStageViewBox();
    if (editViewNeedsFit) {
        requestAnimationFrame(() => {
            fitStageViewToPose();
            render();
        });
    }

    render();
})();
