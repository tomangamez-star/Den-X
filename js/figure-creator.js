// ============================================================
// DENX FIGURE CREATOR V1
// Separate construction room. No animation tools live here.
// ============================================================

(() => {
    const SVG_NS = "http://www.w3.org/2000/svg";
    const stage = document.getElementById("creatorStage");
    const nameInput = document.getElementById("figureNameInput");
    const saveBtn = document.getElementById("creatorSaveBtn");
    const cancelBtn = document.getElementById("creatorCancelBtn");

    const segmentTypeButtons = [...document.querySelectorAll(".segment-type-btn")];
    const segmentColorInput = document.getElementById("segmentColorInput");
    const segmentWidthInput = document.getElementById("segmentWidthInput");
    const deleteSegmentBtn = document.getElementById("deleteSegmentBtn");
    const toast = document.getElementById("creatorToast");

    let selectedType = "rounded";
    let selectedSegmentId = "seg-1";
    let defaultColor = "#111111";
    let defaultWidth = 18;

    let nextNodeId = 3;
    let nextSegmentId = 2;

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
            style: { color: "#111111", width: 18 }
        }
    ];

    const pose = {
        "node-1": { x: 460, y: 350 },
        "node-2": { x: 550, y: 350 }
    };

    const interaction = {
        active: false,
        pointerId: null,
        mode: null,
        nodeId: null,
        start: null,
        latest: null,
        startPose: null
    };

    function clone(value) {
        return JSON.parse(JSON.stringify(value));
    }

    function svg(tag, attrs = {}) {
        const el = document.createElementNS(SVG_NS, tag);
        Object.entries(attrs).forEach(([key, value]) => {
            el.setAttribute(key, value);
        });
        return el;
    }

    function pointFromEvent(e) {
        const rect = stage.getBoundingClientRect();

        return {
            x: Math.max(0, Math.min(1000, ((e.clientX - rect.left) / rect.width) * 1000)),
            y: Math.max(0, Math.min(700, ((e.clientY - rect.top) / rect.height) * 700))
        };
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

    function selectNode(nodeId) {
        const connected = segmentForNode(nodeId);
        if (connected) {
            selectedSegmentId = connected.id;
            syncSegmentControls();
        }
    }

    function selectedSegment() {
        return segments.find(segment => segment.id === selectedSegmentId) || null;
    }

    function syncSegmentControls() {
        const segment = selectedSegment();
        if (!segment) return;

        segmentColorInput.value = segment.style?.color || defaultColor;
        segmentWidthInput.value = Number(segment.style?.width) || defaultWidth;
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
            return [
                point(0, -half),
                point(0, half),
                point(length, 0)
            ];
        }

        if (type === "diamond") {
            return [
                point(0, 0),
                point(length / 2, -half),
                point(length, 0),
                point(length / 2, half)
            ];
        }

        if (type === "hexagon") {
            const inset = Math.min(length * 0.22, half * 1.2);
            return [
                point(0, 0),
                point(inset, -half),
                point(length - inset, -half),
                point(length, 0),
                point(length - inset, half),
                point(inset, half)
            ];
        }

        // Rectangle.
        return [
            point(0, -half),
            point(length, -half),
            point(length, half),
            point(0, half)
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
            // Circle is now intuitive: parent node = centre, child node = radius point.
            // This makes it useful for heads/wheels instead of a stretched ellipse.
            const radius = Math.max(3, Math.hypot(to.x - from.x, to.y - from.y));

            shape = svg("circle", {
                cx: from.x,
                cy: from.y,
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
            selectedSegmentId = segment.id;
            syncSegmentControls();
            render();
            e.stopPropagation();
        });

        group.appendChild(shape);
    }

    function render() {
        stage.innerHTML = "";

        const segmentGroup = svg("g");
        segments.forEach(segment => drawSegment(segmentGroup, segment));
        stage.appendChild(segmentGroup);

        nodes.forEach(node => {
            const point = pose[node.id];
            if (!point) return;

            const touch = node.parentId == null
                ? svg("rect", {
                    x: point.x - 24,
                    y: point.y - 24,
                    width: 48,
                    height: 48,
                    rx: 8,
                    class: "creator-node-touch",
                    "data-node-id": node.id
                })
                : svg("circle", {
                    cx: point.x,
                    cy: point.y,
                    r: 24,
                    class: "creator-node-touch",
                    "data-node-id": node.id
                });

            const visual = node.parentId == null
                ? svg("rect", {
                    x: point.x - 5.5,
                    y: point.y - 5.5,
                    width: 11,
                    height: 11,
                    rx: 1.5,
                    class: "creator-node creator-main-node"
                })
                : svg("circle", {
                    cx: point.x,
                    cy: point.y,
                    r: 5,
                    class: "creator-node"
                });

            touch.addEventListener("pointerdown", e => beginNodeInteraction(e, node.id));

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
                class: "creator-build-preview"
            }));
        }
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
        interaction.mode = selectedType === "none" ? "move" : "build";

        try {
            stage.setPointerCapture(e.pointerId);
        } catch (_) {}

        e.preventDefault();
        e.stopPropagation();
        render();
    }

    function moveInteraction(e) {
        if (!interaction.active || e.pointerId !== interaction.pointerId) return;

        const point = pointFromEvent(e);
        interaction.latest = point;

        if (interaction.mode === "move") {
            const start = interaction.start;
            const dx = point.x - start.x;
            const dy = point.y - start.y;
            const nodeId = interaction.nodeId;
            const node = nodes.find(item => item.id === nodeId);

            const affected = node?.parentId == null
                ? nodes.map(item => item.id)
                : subtreeIds(nodeId);

            affected.forEach(id => {
                const base = interaction.startPose[id];
                if (!base) return;

                pose[id] = {
                    x: Math.max(0, Math.min(1000, base.x + dx)),
                    y: Math.max(0, Math.min(700, base.y + dy))
                };
            });
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

            const endpoint = distance < 14
                ? { x: Math.min(1000, start.x + 80), y: start.y }
                : end;

            const nodeId = `node-${nextNodeId++}`;
            const segmentId = `seg-${nextSegmentId++}`;

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
                length: Math.max(
                    1,
                    Math.hypot(endpoint.x - start.x, endpoint.y - start.y)
                ),
                style: {
                    color: defaultColor,
                    width: defaultWidth
                }
            });

            selectedSegmentId = segmentId;
            syncSegmentControls();
        }

        interaction.active = false;
        interaction.pointerId = null;
        interaction.mode = null;
        interaction.nodeId = null;
        interaction.start = null;
        interaction.latest = null;
        interaction.startPose = null;

        try {
            stage.releasePointerCapture(e.pointerId);
        } catch (_) {}

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

        render();
    }

    segmentTypeButtons.forEach(button => {
        button.addEventListener("click", () => {
            selectedType = button.dataset.segmentType;

            segmentTypeButtons.forEach(item => {
                item.classList.toggle("active", item === button);
            });
        });
    });

    segmentColorInput.addEventListener("input", e => {
        defaultColor = e.target.value;

        const segment = selectedSegment();
        if (segment) {
            segment.style = segment.style || {};
            segment.style.color = defaultColor;
            render();
        }
    });

    segmentWidthInput.addEventListener("input", e => {
        defaultWidth = Number(e.target.value) || 18;

        const segment = selectedSegment();
        if (segment) {
            segment.style = segment.style || {};
            segment.style.width = defaultWidth;
            render();
        }
    });

    deleteSegmentBtn.addEventListener("click", () => {
        const segment = selectedSegment();
        if (!segment) return;

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

        selectedSegmentId = segments[segments.length - 1]?.id || null;
        syncSegmentControls();
        render();
    });

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
            version: 1,
            id: DenXFigureLibrary.uid("dxf"),
            name,
            rootNodeId: "node-1",
            style: {
                color: figureColor,
                thickness: figureThickness
            },
            nodes: clone(nodes),
            segments: clone(segments),
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

    cancelBtn.addEventListener("click", () => {
        window.location.href = "workspace.html";
    });

    let toastTimer = null;

    function showToast(message) {
        toast.textContent = message;
        toast.classList.add("show");

        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => toast.classList.remove("show"), 1800);
    }

    syncSegmentControls();
    render();
})();
