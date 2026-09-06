// ============================================================
// DENX FIGURE CREATOR V3
// Dedicated figure construction room.
// ============================================================

(() => {
    const SVG_NS = "http://www.w3.org/2000/svg";

    const WORLD_WIDTH = 4096;
    const WORLD_HEIGHT = 4096;
    const WORLD_CENTER_X = WORLD_WIDTH / 2;
    const WORLD_CENTER_Y = WORLD_HEIGHT / 2;

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
    const segmentWidthValue = document.getElementById("segmentWidthValue");
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

    const referenceImportBtn = document.getElementById("referenceImportBtn");
    const referenceFileInput = document.getElementById("referenceFileInput");
    const referenceOpacityInput = document.getElementById("referenceOpacityInput");
    const referenceOpacityValue = document.getElementById("referenceOpacityValue");
    const referenceHideBtn = document.getElementById("referenceHideBtn");
    const referenceRemoveBtn = document.getElementById("referenceRemoveBtn");

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
        "node-1": { x: WORLD_CENTER_X - 45, y: WORLD_CENTER_Y },
        "node-2": { x: WORLD_CENTER_X + 45, y: WORLD_CENTER_Y }
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
        centerX: WORLD_CENTER_X,
        centerY: WORLD_CENTER_Y,
        zoom: 1,
        viewLeft: 0,
        viewTop: 0,
        viewWidth: 1,
        viewHeight: 1
    };

    const pointerMap = new Map();

    const panState = {
        active: false,
        pointerId: null,
        startX: 0,
        startY: 0,
        cameraCenterX: WORLD_CENTER_X,
        cameraCenterY: WORLD_CENTER_Y
    };

    const pinchState = {
        active: false,
        startDistance: 0,
        startZoom: 1,
        startCenterX: WORLD_CENTER_X,
        startCenterY: WORLD_CENTER_Y,
        anchorWorldX: WORLD_CENTER_X,
        anchorWorldY: WORLD_CENTER_Y
    };

    const reference = {
        dataUrl: null,
        opacity: 0.45,
        visible: true,
        width: 560,
        height: 420
    };

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

    function clone(value) {
        return JSON.parse(JSON.stringify(value));
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

    function minZoomForViewport() {
        const rect = stageWrap.getBoundingClientRect();

        return Math.max(
            rect.width / WORLD_WIDTH,
            rect.height / WORLD_HEIGHT,
            0.08
        );
    }

    function clampCameraCenter() {
        const rect = stageWrap.getBoundingClientRect();

        const viewWidth =
            Math.min(
                WORLD_WIDTH,
                rect.width / camera.zoom
            );

        const viewHeight =
            Math.min(
                WORLD_HEIGHT,
                rect.height / camera.zoom
            );

        const halfW = viewWidth / 2;
        const halfH = viewHeight / 2;

        camera.centerX =
            Math.max(
                halfW,
                Math.min(
                    WORLD_WIDTH - halfW,
                    camera.centerX
                )
            );

        camera.centerY =
            Math.max(
                halfH,
                Math.min(
                    WORLD_HEIGHT - halfH,
                    camera.centerY
                )
            );

        camera.viewWidth = viewWidth;
        camera.viewHeight = viewHeight;
        camera.viewLeft =
            camera.centerX - halfW;
        camera.viewTop =
            camera.centerY - halfH;
    }

    function chooseGridSpacing() {
        // Keep minor grid lines roughly 28-56 screen pixels apart.
        let spacing = 32;

        while (spacing * camera.zoom < 28) {
            spacing *= 2;
        }

        while (
            spacing > 8 &&
            spacing * camera.zoom > 56
        ) {
            spacing /= 2;
        }

        return spacing;
    }

    function updateGrid() {
        const spacing = chooseGridSpacing();
        const major = spacing * 4;

        const minorPx = spacing * camera.zoom;
        const majorPx = major * camera.zoom;

        stageWrap.style.backgroundSize =
            `${minorPx}px ${minorPx}px, ` +
            `${minorPx}px ${minorPx}px, ` +
            `${majorPx}px ${majorPx}px, ` +
            `${majorPx}px ${majorPx}px`;

        const minorX =
            -(camera.viewLeft % spacing) *
            camera.zoom;

        const minorY =
            -(camera.viewTop % spacing) *
            camera.zoom;

        const majorX =
            -(camera.viewLeft % major) *
            camera.zoom;

        const majorY =
            -(camera.viewTop % major) *
            camera.zoom;

        stageWrap.style.backgroundPosition =
            `${minorX}px ${minorY}px, ` +
            `${minorX}px ${minorY}px, ` +
            `${majorX}px ${majorY}px, ` +
            `${majorX}px ${majorY}px`;
    }

    function updateCamera() {
        const minimum =
            minZoomForViewport();

        camera.zoom =
            Math.max(
                minimum,
                Math.min(12, camera.zoom)
            );

        clampCameraCenter();

        stage.setAttribute(
            "viewBox",
            `${camera.viewLeft} ${camera.viewTop} ${camera.viewWidth} ${camera.viewHeight}`
        );

        // The SVG always occupies the viewport. We move through the finite
        // 4K world using its viewBox instead of scaling a finite board image.
        cameraEl.style.transform = "none";

        updateGrid();
    }

    function screenToStage(clientX, clientY) {
        const rect =
            stageWrap.getBoundingClientRect();

        const screenX =
            Math.max(
                0,
                Math.min(
                    rect.width,
                    clientX - rect.left
                )
            );

        const screenY =
            Math.max(
                0,
                Math.min(
                    rect.height,
                    clientY - rect.top
                )
            );

        return {
            x: Math.max(
                0,
                Math.min(
                    WORLD_WIDTH,
                    camera.viewLeft +
                    (screenX / Math.max(1, rect.width)) *
                    camera.viewWidth
                )
            ),
            y: Math.max(
                0,
                Math.min(
                    WORLD_HEIGHT,
                    camera.viewTop +
                    (screenY / Math.max(1, rect.height)) *
                    camera.viewHeight
                )
            )
        };
    }

    function pointFromEvent(e) {
        return screenToStage(
            e.clientX,
            e.clientY
        );
    }

    function setZoom(
        nextZoom,
        screenAnchor = null
    ) {
        const rect =
            stageWrap.getBoundingClientRect();

        const minimum =
            minZoomForViewport();

        const next =
            Math.max(
                minimum,
                Math.min(12, nextZoom)
            );

        const anchor =
            screenAnchor || {
                x: rect.width / 2,
                y: rect.height / 2
            };

        const anchorClient = {
            x: rect.left + anchor.x,
            y: rect.top + anchor.y
        };

        const worldBefore =
            screenToStage(
                anchorClient.x,
                anchorClient.y
            );

        camera.zoom = next;

        const nextViewWidth =
            Math.min(
                WORLD_WIDTH,
                rect.width / next
            );

        const nextViewHeight =
            Math.min(
                WORLD_HEIGHT,
                rect.height / next
            );

        camera.centerX =
            worldBefore.x -
            (
                anchor.x / Math.max(1, rect.width) -
                0.5
            ) * nextViewWidth;

        camera.centerY =
            worldBefore.y -
            (
                anchor.y / Math.max(1, rect.height) -
                0.5
            ) * nextViewHeight;

        updateCamera();
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

        if (segmentWidthValue) {
            segmentWidthValue.textContent =
                String(
                    Number(segmentWidthInput.value) ||
                    defaultWidth
                );
        }

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

        if (reference.dataUrl && reference.visible) {
            stage.appendChild(svg("image", {
                href: reference.dataUrl,
                x: WORLD_CENTER_X - reference.width / 2,
                y: WORLD_CENTER_Y - reference.height / 2,
                width: reference.width,
                height: reference.height,
                opacity: reference.opacity,
                preserveAspectRatio: "xMidYMid meet",
                class: "creator-reference-image"
            }));
        }

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

    segmentWidthInput.addEventListener("input", e => {
        if (segmentWidthValue) {
            segmentWidthValue.textContent =
                String(Number(e.target.value) || 18);
        }
    });

    segmentWidthInput.addEventListener("change", e => {
        const segment = selectedSegment();
        if (!segment) return;

        const before = snapshot();
        defaultWidth = Number(e.target.value) || 18;

        segment.style = segment.style || {};
        segment.style.width = defaultWidth;

        if (segmentWidthValue) {
            segmentWidthValue.textContent =
                String(defaultWidth);
        }

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
    // FINITE 4K construction-world navigation
    // - drag empty space = pan
    // - pinch anywhere = zoom
    // - 4096 × 4096 hard boundary
    // - grid zooms with the world
    // -------------------------------------------------------------

    zoomInBtn.addEventListener("click", () => {
        setZoom(camera.zoom * 1.22);
        render();
    });

    zoomOutBtn.addEventListener("click", () => {
        setZoom(camera.zoom / 1.22);
        render();
    });

    function pointerIsInteractiveTarget(target) {
        return !!target?.closest?.(
            ".creator-node-touch, .creator-segment-shape"
        );
    }

    function beginPinch() {
        if (pointerMap.size !== 2) return;

        const rect =
            stageWrap.getBoundingClientRect();

        const points =
            [...pointerMap.values()].slice(0, 2);

        const midpoint = {
            x:
                (
                    points[0].x +
                    points[1].x
                ) / 2,
            y:
                (
                    points[0].y +
                    points[1].y
                ) / 2
        };

        const anchorWorld =
            screenToStage(
                midpoint.x,
                midpoint.y
            );

        pinchState.active = true;

        pinchState.startDistance =
            Math.max(
                1,
                Math.hypot(
                    points[1].x -
                    points[0].x,
                    points[1].y -
                    points[0].y
                )
            );

        pinchState.startZoom =
            camera.zoom;

        pinchState.startCenterX =
            camera.centerX;

        pinchState.startCenterY =
            camera.centerY;

        pinchState.anchorWorldX =
            anchorWorld.x;

        pinchState.anchorWorldY =
            anchorWorld.y;

        panState.active = false;
        panState.pointerId = null;

        cancelInteraction();
    }

    stageWrap.addEventListener(
        "pointerdown",
        e => {
            pointerMap.set(
                e.pointerId,
                {
                    x: e.clientX,
                    y: e.clientY
                }
            );

            if (pointerMap.size === 2) {
                beginPinch();
                return;
            }

            if (
                pointerMap.size === 1 &&
                !pointerIsInteractiveTarget(e.target)
            ) {
                panState.active = true;
                panState.pointerId =
                    e.pointerId;

                panState.startX =
                    e.clientX;

                panState.startY =
                    e.clientY;

                panState.cameraCenterX =
                    camera.centerX;

                panState.cameraCenterY =
                    camera.centerY;

                try {
                    stageWrap.setPointerCapture(
                        e.pointerId
                    );
                } catch (_) {}
            }
        },
        true
    );

    stageWrap.addEventListener(
        "pointermove",
        e => {
            if (!pointerMap.has(e.pointerId)) {
                return;
            }

            pointerMap.set(
                e.pointerId,
                {
                    x: e.clientX,
                    y: e.clientY
                }
            );

            if (
                pinchState.active &&
                pointerMap.size >= 2
            ) {
                const rect =
                    stageWrap.getBoundingClientRect();

                const points =
                    [...pointerMap.values()]
                        .slice(0, 2);

                const distance =
                    Math.max(
                        1,
                        Math.hypot(
                            points[1].x -
                            points[0].x,
                            points[1].y -
                            points[0].y
                        )
                    );

                const midpoint = {
                    x:
                        (
                            points[0].x +
                            points[1].x
                        ) / 2 -
                        rect.left,
                    y:
                        (
                            points[0].y +
                            points[1].y
                        ) / 2 -
                        rect.top
                };

                const minimum =
                    minZoomForViewport();

                const nextZoom =
                    Math.max(
                        minimum,
                        Math.min(
                            12,
                            pinchState.startZoom *
                            (
                                distance /
                                pinchState.startDistance
                            )
                        )
                    );

                const nextViewWidth =
                    Math.min(
                        WORLD_WIDTH,
                        rect.width / nextZoom
                    );

                const nextViewHeight =
                    Math.min(
                        WORLD_HEIGHT,
                        rect.height / nextZoom
                    );

                camera.zoom =
                    nextZoom;

                camera.centerX =
                    pinchState.anchorWorldX -
                    (
                        midpoint.x /
                        Math.max(1, rect.width) -
                        0.5
                    ) * nextViewWidth;

                camera.centerY =
                    pinchState.anchorWorldY -
                    (
                        midpoint.y /
                        Math.max(1, rect.height) -
                        0.5
                    ) * nextViewHeight;

                updateCamera();
                render();

                e.preventDefault();
                return;
            }

            if (
                panState.active &&
                e.pointerId ===
                    panState.pointerId
            ) {
                const dx =
                    e.clientX -
                    panState.startX;

                const dy =
                    e.clientY -
                    panState.startY;

                camera.centerX =
                    panState.cameraCenterX -
                    dx / camera.zoom;

                camera.centerY =
                    panState.cameraCenterY -
                    dy / camera.zoom;

                updateCamera();
                e.preventDefault();
            }
        },
        true
    );

    function finishNavigationPointer(e) {
        pointerMap.delete(e.pointerId);

        if (
            e.pointerId ===
            panState.pointerId
        ) {
            panState.active = false;
            panState.pointerId = null;
        }

        if (pointerMap.size < 2) {
            pinchState.active = false;
        }
    }

    stageWrap.addEventListener(
        "pointerup",
        finishNavigationPointer,
        true
    );

    stageWrap.addEventListener(
        "pointercancel",
        finishNavigationPointer,
        true
    );

    stage.addEventListener(
        "pointermove",
        moveInteraction
    );

    stage.addEventListener(
        "pointerup",
        finishInteraction
    );

    stage.addEventListener(
        "pointercancel",
        cancelInteraction
    );

    // -------------------------------------------------------------
    // Reference image — temporary construction aid, not saved in .dxf
    // -------------------------------------------------------------

    function syncReferenceControls() {
        const hasReference = !!reference.dataUrl;

        if (referenceHideBtn) {
            referenceHideBtn.disabled = !hasReference;
            referenceHideBtn.textContent =
                reference.visible ? "Hide" : "Show";
        }

        if (referenceRemoveBtn) {
            referenceRemoveBtn.disabled = !hasReference;
        }

        if (referenceOpacityInput) {
            referenceOpacityInput.disabled = !hasReference;
            referenceOpacityInput.value =
                String(reference.opacity);
        }

        if (referenceOpacityValue) {
            referenceOpacityValue.textContent =
                `${Math.round(
                    reference.opacity * 100
                )}%`;
        }
    }

    referenceImportBtn?.addEventListener("click", () => {
        referenceFileInput?.click();
    });

    referenceFileInput?.addEventListener("change", event => {
        const file = event.target.files?.[0];

        if (!file) return;

        const reader = new FileReader();

        reader.onload = () => {
            const url = String(reader.result || "");
            const image = new Image();

            image.onload = () => {
                const maxWidth = 650;
                const maxHeight = 520;
                const scale = Math.min(
                    maxWidth / Math.max(1, image.naturalWidth),
                    maxHeight / Math.max(1, image.naturalHeight),
                    1
                );

                reference.dataUrl = url;
                reference.width =
                    Math.max(80, image.naturalWidth * scale);
                reference.height =
                    Math.max(80, image.naturalHeight * scale);
                reference.visible = true;

                syncReferenceControls();
                render();
                showToast("Reference image loaded ✓");
            };

            image.src = url;
        };

        reader.readAsDataURL(file);
        event.target.value = "";
    });

    referenceOpacityInput?.addEventListener("input", event => {
        reference.opacity = Math.max(
            0.08,
            Math.min(1, Number(event.target.value) || 0.45)
        );

        if (referenceOpacityValue) {
            referenceOpacityValue.textContent =
                `${Math.round(
                    reference.opacity * 100
                )}%`;
        }

        render();
    });

    referenceHideBtn?.addEventListener("click", () => {
        if (!reference.dataUrl) return;

        reference.visible = !reference.visible;
        syncReferenceControls();
        render();
    });

    referenceRemoveBtn?.addEventListener("click", () => {
        reference.dataUrl = null;
        reference.visible = true;

        syncReferenceControls();
        render();
    });

    syncReferenceControls();

    window.addEventListener("resize", () => {
        requestAnimationFrame(() => {
            updateCamera();
            render();
        });
    });

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
            id: DenXFigureLibrary.uid("dxf"),
            name,
            rootNodeId: "node-1",
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
            const saved = DenXFigureLibrary.saveToLibrary(buildDefinition());

            const persisted = DenXFigureLibrary.getLibrary()
                .some(figure => figure.id === saved.id);

            if (!persisted) {
                throw new Error("Figure did not persist. Save cancelled.");
            }

            sessionStorage.setItem("denx.figureCreatedNotice", saved.name);
            window.location.href = "workspace.html";
        } catch (error) {
            showToast(error?.message || "Could not save figure.");
        }
    });

    cancelBtn?.addEventListener("click", () => {
        const hasWork =
            history.undo.length > 0 ||
            polyfills.length > 0 ||
            segments.length > 1;

        if (
            hasWork &&
            !window.confirm("Leave Figure Creator without saving?")
        ) {
            return;
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

    requestAnimationFrame(() => {
        updateCamera();
        render();
    });
})();
