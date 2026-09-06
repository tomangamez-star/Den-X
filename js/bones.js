// ============================================================
// DENX BONES V1
// Object-based figure animation layer.
//
// Core rules:
// - Figure structure is persistent.
// - Each animation frame stores a pose for that structure.
// - Square root/main node moves the entire figure.
// - Round nodes pose a branch in Select mode.
// - Bone mode grows new segments from nodes.
// - Bone mode on empty stage creates a new root + first segment.
// - Pencil/Eraser never modify this layer.
// ============================================================

const figureLayer = document.getElementById("figureLayer");
const SVG_NS = "http://www.w3.org/2000/svg";

const STAGE_WIDTH = 2048;
const STAGE_HEIGHT = 1152;

let nextFigureId = 2;
let nextNodeId = 100;
let nextSegmentId = 100;

let figures = [];
let boneFramePoses = {};

const boneUndoStack = [];
const boneRedoStack = [];
let boneUndoEligible = false;

let selectedFigureId = null;
let selectedNodeId = null;

const boneInteraction = {
    active: false,
    pointerId: null,
    mode: null, // "pose-node" | "move-root" | "build-from-node" | "build-new-figure"
    figureId: null,
    nodeId: null,
    startPoint: null,
    latestPoint: null,
    beforeState: null,
    startPose: null,
    changed: false
};

function deepClone(value) {
    return JSON.parse(JSON.stringify(value));
}

function getFigure(figureId) {
    return figures.find(figure => figure.id === figureId) || null;
}

function getFramePose(frameNumber = currentFrame) {
    if (!boneFramePoses[frameNumber]) {
        const sourceFrame =
            boneFramePoses[currentFrame] ? currentFrame :
            boneFramePoses[frameNumber - 1] ? frameNumber - 1 :
            boneFramePoses[1] ? 1 :
            null;

        boneFramePoses[frameNumber] = sourceFrame
            ? deepClone(boneFramePoses[sourceFrame])
            : {};
    }

    return boneFramePoses[frameNumber];
}

function getFigurePose(figureId, frameNumber = currentFrame) {
    const framePose = getFramePose(frameNumber);

    if (!framePose[figureId]) {
        const figure = getFigure(figureId);

        framePose[figureId] = {
            visible: true,
            nodes: {}
        };

        if (figure) {
            figure.nodes.forEach(node => {
                framePose[figureId].nodes[node.id] = {
                    x: STAGE_WIDTH / 2,
                    y: STAGE_HEIGHT / 2
                };
            });
        }
    }

    return framePose[figureId];
}

function stagePointFromEvent(e) {
    if (!figureLayer) {
        return { x: 0, y: 0 };
    }

    const rect = figureLayer.getBoundingClientRect();

    return {
        x: Math.max(0, Math.min(
            STAGE_WIDTH,
            ((e.clientX - rect.left) / Math.max(1, rect.width)) * STAGE_WIDTH
        )),
        y: Math.max(0, Math.min(
            STAGE_HEIGHT,
            ((e.clientY - rect.top) / Math.max(1, rect.height)) * STAGE_HEIGHT
        ))
    };
}

function createStarterFigure() {
    const figure = {
        id: "figure-1",
        name: "Starter Figure",
        rootNodeId: "node-1",
        headNodeId: "node-4",
        style: {
            color: "#111111",
            thickness: 12,
            headRadius: 18
        },
        nodes: [
            { id: "node-1", parentId: null, role: "root" },       // pelvis / MAIN node
            { id: "node-2", parentId: "node-1", role: "chest" },
            { id: "node-3", parentId: "node-2", role: "neck" },
            { id: "node-4", parentId: "node-3", role: "head" },

            { id: "node-5", parentId: "node-2", role: "left-elbow" },
            { id: "node-6", parentId: "node-5", role: "left-hand" },
            { id: "node-7", parentId: "node-2", role: "right-elbow" },
            { id: "node-8", parentId: "node-7", role: "right-hand" },

            { id: "node-9", parentId: "node-1", role: "left-knee" },
            { id: "node-10", parentId: "node-9", role: "left-foot" },
            { id: "node-11", parentId: "node-1", role: "right-knee" },
            { id: "node-12", parentId: "node-11", role: "right-foot" }
        ],
        segments: [
            { id: "seg-1", from: "node-1", to: "node-2" },
            { id: "seg-2", from: "node-2", to: "node-3" },
            { id: "seg-3", from: "node-3", to: "node-4" },

            { id: "seg-4", from: "node-2", to: "node-5" },
            { id: "seg-5", from: "node-5", to: "node-6" },
            { id: "seg-6", from: "node-2", to: "node-7" },
            { id: "seg-7", from: "node-7", to: "node-8" },

            { id: "seg-8", from: "node-1", to: "node-9" },
            { id: "seg-9", from: "node-9", to: "node-10" },
            { id: "seg-10", from: "node-1", to: "node-11" },
            { id: "seg-11", from: "node-11", to: "node-12" }
        ]
    };

    const cx = STAGE_WIDTH / 2;
    const cy = STAGE_HEIGHT / 2 + 12;

    const pose = {
        visible: true,
        nodes: {
            "node-1": { x: cx, y: cy + 10 },
            "node-2": { x: cx, y: cy - 38 },
            "node-3": { x: cx, y: cy - 68 },
            "node-4": { x: cx, y: cy - 94 },

            "node-5": { x: cx - 43, y: cy - 28 },
            "node-6": { x: cx - 67, y: cy + 7 },
            "node-7": { x: cx + 43, y: cy - 28 },
            "node-8": { x: cx + 67, y: cy + 7 },

            "node-9": { x: cx - 25, y: cy + 58 },
            "node-10": { x: cx - 32, y: cy + 103 },
            "node-11": { x: cx + 25, y: cy + 58 },
            "node-12": { x: cx + 32, y: cy + 103 }
        }
    };

    ensureFigureSegmentLengths(figure, pose);

    figures = [figure];
    boneFramePoses = {
        1: {
            [figure.id]: pose
        }
    };
}

function createSvg(tag, attrs = {}) {
    const el = document.createElementNS(SVG_NS, tag);

    Object.entries(attrs).forEach(([key, value]) => {
        el.setAttribute(key, value);
    });

    return el;
}


function appendFigureSegment(group, figure, segment, from, to) {
    const type = segment.type || "rounded";
    const width = Number(segment.style?.width) || figure.style?.thickness || 12;
    const color = segment.style?.color || figure.style?.color || "#111111";

    if (type === "circle") {
        const dx = to.x - from.x;
        const dy = to.y - from.y;
        const length = Math.max(1, Math.hypot(dx, dy));
        const angle = Math.atan2(dy, dx) * (180 / Math.PI);
        const cx = (from.x + to.x) / 2;
        const cy = (from.y + to.y) / 2;

        group.appendChild(createSvg("ellipse", {
            cx,
            cy,
            rx: length / 2,
            ry: Math.max(2, width / 2),
            fill: color,
            class: "figure-segment figure-segment-shape",
            transform: `rotate(${angle} ${cx} ${cy})`
        }));

        return;
    }

    const line = createSvg("line", {
        x1: from.x,
        y1: from.y,
        x2: to.x,
        y2: to.y,
        class: "figure-segment",
        stroke: color,
        "stroke-width": width,
        "stroke-linecap": type === "rounded" ? "round" : "butt"
    });

    group.appendChild(line);
}

function renderFigures() {
    if (!figureLayer) return;

    figureLayer.innerHTML = "";

    const framePose = getFramePose(currentFrame);

    figures.forEach(figure => {
        const pose = framePose[figure.id];

        if (!pose || pose.visible === false) return;

        const group = createSvg("g", {
            "data-figure-id": figure.id,
            "class": "denx-figure"
        });

        group.style.setProperty(
            "--denx-node-contrast",
            getAutomaticNodeContrast(figure)
        );

        // Body segments
        figure.segments.forEach(segment => {
            const from = pose.nodes[segment.from];
            const to = pose.nodes[segment.to];

            if (!from || !to) return;

            appendFigureSegment(group, figure, segment, from, to);
        });

        // Optional simple head circle for starter/humanoid-style figures.
        if (figure.headNodeId && pose.nodes[figure.headNodeId]) {
            const head = pose.nodes[figure.headNodeId];

            group.appendChild(createSvg("circle", {
                cx: head.x,
                cy: head.y,
                r: figure.style?.headRadius || 18,
                class: "figure-head"
            }));
        }

        // Editing controls.
        const handleMetrics = getHandleMetrics();

        figure.nodes.forEach(node => {
            const point = pose.nodes[node.id];
            if (!point) return;

            if (node.id === figure.rootNodeId) {
                const touchSize = handleMetrics.rootTouchSize;
                const rootTouch = createSvg("rect", {
                    x: point.x - touchSize / 2,
                    y: point.y - touchSize / 2,
                    width: touchSize,
                    height: touchSize,
                    rx: Math.max(1, handleMetrics.rootRadius * 2),
                    class: "figure-node-touch-target figure-root-touch-target",
                    "data-denx-node": "1",
                    "data-figure-id": figure.id,
                    "data-node-id": node.id
                });

                const rootSize = handleMetrics.rootSize;
                const rootVisual = createSvg("rect", {
                    x: point.x - rootSize / 2,
                    y: point.y - rootSize / 2,
                    width: rootSize,
                    height: rootSize,
                    rx: handleMetrics.rootRadius,
                    class: "figure-node-visual figure-root-node",
                    style:
                        `--denx-node-stroke:${handleMetrics.rootStrokeWidth}px;` +
                        `--denx-node-selected-stroke:${handleMetrics.selectedStrokeWidth}px;`
                });

                if (selectedFigureId === figure.id && selectedNodeId === node.id) {
                    rootVisual.classList.add("selected");
                }

                group.appendChild(rootTouch);
                group.appendChild(rootVisual);
            } else {
                const touch = createSvg("circle", {
                    cx: point.x,
                    cy: point.y,
                    r: handleMetrics.normalTouchRadius,
                    class: "figure-node-touch-target figure-normal-touch-target",
                    "data-denx-node": "1",
                    "data-figure-id": figure.id,
                    "data-node-id": node.id
                });

                const handle = createSvg("circle", {
                    cx: point.x,
                    cy: point.y,
                    r: handleMetrics.normalVisualRadius,
                    class: "figure-node-visual figure-normal-node",
                    style:
                        `--denx-node-stroke:${handleMetrics.normalStrokeWidth}px;` +
                        `--denx-node-selected-stroke:${handleMetrics.selectedStrokeWidth}px;`
                });

                if (selectedFigureId === figure.id && selectedNodeId === node.id) {
                    handle.classList.add("selected");
                }

                group.appendChild(touch);
                group.appendChild(handle);
            }
        });

        figureLayer.appendChild(group);
    });

    // Build-preview line sits above all figures.
    if (
        boneInteraction.active &&
        (boneInteraction.mode === "build-from-node" ||
         boneInteraction.mode === "build-new-figure") &&
        boneInteraction.startPoint &&
        boneInteraction.latestPoint
    ) {
        figureLayer.appendChild(createSvg("line", {
            x1: boneInteraction.startPoint.x,
            y1: boneInteraction.startPoint.y,
            x2: boneInteraction.latestPoint.x,
            y2: boneInteraction.latestPoint.y,
            class: "bone-build-preview"
        }));
    }

    updateFigureInteractionMode();
}

function updateFigureInteractionMode() {
    if (!figureLayer) return;

    const editingFigures = currentTool === "select";

    figureLayer.classList.toggle("figure-controls-visible", editingFigures);
    figureLayer.classList.remove("bone-build-mode");
    figureLayer.classList.toggle("figure-select-mode", editingFigures);

    // Figure construction lives in Figure Creator.
    // Pencil/Eraser/Camera pass through the object layer.
    figureLayer.style.pointerEvents = editingFigures ? "auto" : "none";
}

function captureBoneProjectState() {
    return deepClone({
        figures,
        framePoses: boneFramePoses,
        nextFigureId,
        nextNodeId,
        nextSegmentId,
        selectedFigureId,
        selectedNodeId
    });
}

function restoreBoneProjectState(snapshot) {
    if (!snapshot) return;

    figures = deepClone(snapshot.figures || []);
    boneFramePoses = deepClone(snapshot.framePoses || {});
    nextFigureId = snapshot.nextFigureId || 1;
    nextNodeId = snapshot.nextNodeId || 1;
    nextSegmentId = snapshot.nextSegmentId || 1;
    selectedFigureId = snapshot.selectedFigureId || null;
    selectedNodeId = snapshot.selectedNodeId || null;

    getFramePose(currentFrame);
    renderFigures();
}

function recordBoneOperation(beforeState) {
    const afterState = captureBoneProjectState();

    boneUndoStack.push({
        before: beforeState,
        after: afterState
    });

    if (boneUndoStack.length > 50) {
        boneUndoStack.shift();
    }

    boneRedoStack.length = 0;
    boneUndoEligible = true;

    if (window.denxInvalidateTimelineUndo) {
        window.denxInvalidateTimelineUndo();
    }
}

window.denxInvalidateBoneUndo = () => {
    boneUndoEligible = false;
    boneUndoStack.length = 0;
    boneRedoStack.length = 0;
};

window.denxUndoBoneAction = () => {
    if (!boneUndoEligible || boneUndoStack.length === 0) {
        return false;
    }

    const action = boneUndoStack.pop();
    boneRedoStack.push(action);
    restoreBoneProjectState(action.before);

    boneUndoEligible = boneUndoStack.length > 0;
    return true;
};

window.denxRedoBoneAction = () => {
    if (boneRedoStack.length === 0) {
        return false;
    }

    const action = boneRedoStack.pop();
    boneUndoStack.push(action);
    restoreBoneProjectState(action.after);

    boneUndoEligible = true;
    return true;
};

window.denxBonesCaptureProjectState = () => captureBoneProjectState();

window.denxBonesRestoreProjectState = snapshot => {
    restoreBoneProjectState(snapshot);
};

window.denxBonesCopyFrameState = (frameNumber = currentFrame) => {
    return deepClone(getFramePose(frameNumber));
};

window.denxBonesInsertFrame = (newFrame, sourceFrame, poseOverride = null) => {
    const keys = Object.keys(boneFramePoses)
        .map(Number)
        .filter(key => key >= newFrame)
        .sort((a, b) => b - a);

    keys.forEach(key => {
        boneFramePoses[key + 1] = boneFramePoses[key];
        delete boneFramePoses[key];
    });

    boneFramePoses[newFrame] = poseOverride
        ? deepClone(poseOverride)
        : deepClone(getFramePose(sourceFrame));

    renderFigures();
};

window.denxBonesRemoveFrame = removedFrame => {
    delete boneFramePoses[removedFrame];

    const keys = Object.keys(boneFramePoses)
        .map(Number)
        .filter(key => key > removedFrame)
        .sort((a, b) => a - b);

    keys.forEach(key => {
        boneFramePoses[key - 1] = boneFramePoses[key];
        delete boneFramePoses[key];
    });
};

window.denxBonesLoadFrame = frameNumber => {
    getFramePose(frameNumber);
    renderFigures();
};

function nodeDefinition(figure, nodeId) {
    return figure?.nodes.find(node => node.id === nodeId) || null;
}

function segmentToNode(figure, nodeId) {
    return figure?.segments.find(segment => segment.to === nodeId) || null;
}

function segmentLengthForNode(figure, nodeId, pose) {
    const node = nodeDefinition(figure, nodeId);
    if (!node || !node.parentId) return 0;

    const segment = segmentToNode(figure, nodeId);
    const parentPoint = pose?.nodes?.[node.parentId];
    const nodePoint = pose?.nodes?.[nodeId];

    if (!segment || !parentPoint || !nodePoint) return 0;

    if (!Number.isFinite(segment.length) || segment.length <= 0) {
        segment.length = Math.max(
            1,
            Math.hypot(
                nodePoint.x - parentPoint.x,
                nodePoint.y - parentPoint.y
            )
        );
    }

    return segment.length;
}

function ensureFigureSegmentLengths(figure, pose) {
    if (!figure || !pose) return;

    figure.nodes.forEach(node => {
        if (!node.parentId) return;
        segmentLengthForNode(figure, node.id, pose);
    });
}

function rotatePointAround(point, pivot, angleDelta) {
    const cos = Math.cos(angleDelta);
    const sin = Math.sin(angleDelta);
    const dx = point.x - pivot.x;
    const dy = point.y - pivot.y;

    return {
        x: pivot.x + (dx * cos - dy * sin),
        y: pivot.y + (dx * sin + dy * cos)
    };
}

function angleBetween(from, to) {
    return Math.atan2(to.y - from.y, to.x - from.x);
}

function getCameraZoom() {
    const zoom = Number(window.denxCameraState?.zoom);
    return Number.isFinite(zoom) && zoom > 0 ? zoom : 1;
}

function clampHandleValue(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function getHandleMetrics() {
    const zoom = getCameraZoom();

    /*
      Visual controls are sized in SCREEN pixels first, then converted
      back to stage/world units.

      This gives us two useful effects:
      1. joints gently shrink as the user zooms in;
      2. the MAIN/root square has a hard screen-size floor, so it can
         never collapse into a microscopic/disappearing shape.
    */
    const normalScreenRadius = clampHandleValue(
        3.0 / Math.pow(zoom, 0.12),
        2.35,
        3.0
    );

    const rootScreenSize = clampHandleValue(
        10.5 / Math.pow(zoom, 0.10),
        8.5,
        10.5
    );

    const normalStrokeScreen = 1.05;
    const rootStrokeScreen = 1.2;
    const selectedStrokeScreen = 1.55;

    return {
        rootTouchSize: 28 / zoom,
        rootSize: rootScreenSize / zoom,
        rootRadius: Math.max(0.8 / zoom, (rootScreenSize * 0.14) / zoom),

        normalTouchRadius: 14 / zoom,
        normalVisualRadius: normalScreenRadius / zoom,

        normalStrokeWidth: normalStrokeScreen / zoom,
        rootStrokeWidth: rootStrokeScreen / zoom,
        selectedStrokeWidth: selectedStrokeScreen / zoom
    };
}

function parseCssColor(color) {
    if (typeof color !== "string") return null;

    const value = color.trim();

    if (/^#[0-9a-f]{3}$/i.test(value)) {
        return {
            r: parseInt(value[1] + value[1], 16),
            g: parseInt(value[2] + value[2], 16),
            b: parseInt(value[3] + value[3], 16)
        };
    }

    if (/^#[0-9a-f]{6}$/i.test(value)) {
        return {
            r: parseInt(value.slice(1, 3), 16),
            g: parseInt(value.slice(3, 5), 16),
            b: parseInt(value.slice(5, 7), 16)
        };
    }

    const rgbMatch = value.match(
        /^rgba?\(\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)/i
    );

    if (rgbMatch) {
        return {
            r: clampHandleValue(Number(rgbMatch[1]), 0, 255),
            g: clampHandleValue(Number(rgbMatch[2]), 0, 255),
            b: clampHandleValue(Number(rgbMatch[3]), 0, 255)
        };
    }

    return null;
}

function relativeChannel(value) {
    const channel = value / 255;
    return channel <= 0.04045
        ? channel / 12.92
        : Math.pow((channel + 0.055) / 1.055, 2.4);
}

function getAutomaticNodeContrast(figure) {
    const rgb = parseCssColor(figure?.style?.color);

    // Unknown/custom CSS colors default to a bright outline.
    if (!rgb) return "#f4f4f4";

    const luminance =
        0.2126 * relativeChannel(rgb.r) +
        0.7152 * relativeChannel(rgb.g) +
        0.0722 * relativeChannel(rgb.b);

    // High-contrast black/white is more reliable than a literal RGB
    // inversion for colors with similar luminance.
    return luminance > 0.46 ? "#111111" : "#f4f4f4";
}

function descendantNodeIds(figure, nodeId) {
    const result = [];
    const queue = [nodeId];

    while (queue.length) {
        const current = queue.shift();
        if (result.includes(current)) continue;

        result.push(current);

        figure.nodes
            .filter(node => node.parentId === current)
            .forEach(child => queue.push(child.id));
    }

    return result;
}

function beginNodePose(e, figureId, nodeId) {
    const figure = getFigure(figureId);
    const pose = getFigurePose(figureId);

    if (!figure || !pose?.nodes?.[nodeId]) return;

    const startPoint = stagePointFromEvent(e);

    boneInteraction.active = true;
    boneInteraction.pointerId = e.pointerId;
    boneInteraction.figureId = figureId;
    boneInteraction.nodeId = nodeId;
    boneInteraction.startPoint = startPoint;
    boneInteraction.latestPoint = startPoint;
    boneInteraction.beforeState = captureBoneProjectState();
    boneInteraction.startPose = deepClone(pose);
    boneInteraction.changed = false;
    boneInteraction.mode =
        nodeId === figure.rootNodeId ? "move-root" : "pose-node";

    selectedFigureId = figureId;
    selectedNodeId = nodeId;

    try {
        figureLayer.setPointerCapture(e.pointerId);
    } catch (_) {}

    e.preventDefault();
    e.stopPropagation();

    renderFigures();
}

function beginBoneBuildFromNode(e, figureId, nodeId) {
    const pose = getFigurePose(figureId);
    const point = pose?.nodes?.[nodeId];

    if (!point) return;

    boneInteraction.active = true;
    boneInteraction.pointerId = e.pointerId;
    boneInteraction.mode = "build-from-node";
    boneInteraction.figureId = figureId;
    boneInteraction.nodeId = nodeId;
    boneInteraction.startPoint = { ...point };
    boneInteraction.latestPoint = stagePointFromEvent(e);
    boneInteraction.beforeState = captureBoneProjectState();
    boneInteraction.changed = false;

    selectedFigureId = figureId;
    selectedNodeId = nodeId;

    try {
        figureLayer.setPointerCapture(e.pointerId);
    } catch (_) {}

    e.preventDefault();
    e.stopPropagation();

    renderFigures();
}

function beginNewFigureBuild(e) {
    const point = stagePointFromEvent(e);

    boneInteraction.active = true;
    boneInteraction.pointerId = e.pointerId;
    boneInteraction.mode = "build-new-figure";
    boneInteraction.figureId = null;
    boneInteraction.nodeId = null;
    boneInteraction.startPoint = point;
    boneInteraction.latestPoint = point;
    boneInteraction.beforeState = captureBoneProjectState();
    boneInteraction.changed = false;

    try {
        figureLayer.setPointerCapture(e.pointerId);
    } catch (_) {}

    e.preventDefault();
    e.stopPropagation();

    renderFigures();
}

function movePoseInteraction(e) {
    if (!boneInteraction.active || e.pointerId !== boneInteraction.pointerId) {
        return;
    }

    const point = stagePointFromEvent(e);
    boneInteraction.latestPoint = point;

    if (
        boneInteraction.mode === "build-from-node" ||
        boneInteraction.mode === "build-new-figure"
    ) {
        boneInteraction.changed = true;
        renderFigures();
        return;
    }

    const figure = getFigure(boneInteraction.figureId);
    const pose = getFigurePose(boneInteraction.figureId);

    if (!figure || !pose) return;

    const dx = point.x - boneInteraction.startPoint.x;
    const dy = point.y - boneInteraction.startPoint.y;

    if (Math.abs(dx) + Math.abs(dy) > 1) {
        boneInteraction.changed = true;
    }

    if (boneInteraction.mode === "move-root") {
        // MAIN/root square translates the complete figure with no deformation.
        Object.keys(boneInteraction.startPose.nodes).forEach(nodeId => {
            const start = boneInteraction.startPose.nodes[nodeId];

            pose.nodes[nodeId] = {
                x: start.x + dx,
                y: start.y + dy
            };
        });
    } else if (boneInteraction.mode === "pose-node") {
        // Rigid hierarchical rotation:
        // the selected node rotates around its parent at a fixed radius,
        // and every descendant rotates with it around the same pivot.
        const node = nodeDefinition(figure, boneInteraction.nodeId);
        const parentId = node?.parentId;

        if (!node || !parentId) return;

        const startParent = boneInteraction.startPose.nodes[parentId];
        const startNode = boneInteraction.startPose.nodes[boneInteraction.nodeId];

        if (!startParent || !startNode) return;

        ensureFigureSegmentLengths(figure, boneInteraction.startPose);

        const fixedLength = segmentLengthForNode(
            figure,
            boneInteraction.nodeId,
            boneInteraction.startPose
        );

        if (fixedLength <= 0) return;

        const originalAngle = angleBetween(startParent, startNode);

        let targetDx = point.x - startParent.x;
        let targetDy = point.y - startParent.y;
        let targetDistance = Math.hypot(targetDx, targetDy);

        if (targetDistance < 0.001) {
            targetDx = Math.cos(originalAngle);
            targetDy = Math.sin(originalAngle);
            targetDistance = 1;
        }

        const targetAngle = Math.atan2(targetDy, targetDx);
        const angleDelta = targetAngle - originalAngle;

        const affected = descendantNodeIds(figure, boneInteraction.nodeId);

        affected.forEach(nodeId => {
            const start = boneInteraction.startPose.nodes[nodeId];
            if (!start) return;

            pose.nodes[nodeId] = rotatePointAround(
                start,
                startParent,
                angleDelta
            );
        });

        // Explicitly pin the dragged joint to the parent's fixed-radius circle.
        pose.nodes[boneInteraction.nodeId] = {
            x: startParent.x + Math.cos(targetAngle) * fixedLength,
            y: startParent.y + Math.sin(targetAngle) * fixedLength
        };
    }

    e.preventDefault();
    renderFigures();
}

function normalizedBuildEnd(start, end) {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const distance = Math.hypot(dx, dy);

    if (distance >= 18) {
        return end;
    }

    // A quick tap still creates a useful first/new segment.
    return {
        x: Math.min(STAGE_WIDTH, start.x + 72),
        y: start.y
    };
}

function addChildSegment(figureId, parentNodeId, endpoint) {
    const figure = getFigure(figureId);
    if (!figure) return;

    const currentPose = getFigurePose(figureId);
    const parentCurrent = currentPose.nodes[parentNodeId];
    if (!parentCurrent) return;

    const newNodeId = `node-${nextNodeId++}`;
    const newSegmentId = `seg-${nextSegmentId++}`;

    const dx = endpoint.x - parentCurrent.x;
    const dy = endpoint.y - parentCurrent.y;

    figure.nodes.push({
        id: newNodeId,
        parentId: parentNodeId,
        role: "custom"
    });

    figure.segments.push({
        id: newSegmentId,
        from: parentNodeId,
        to: newNodeId,
        length: Math.max(1, Math.hypot(dx, dy))
    });

    // Structure is global, so every existing frame receives the node.
    // The offset follows the parent in each pose so old poses remain coherent.
    Object.keys(boneFramePoses).forEach(frameKey => {
        const pose = getFigurePose(figureId, Number(frameKey));
        const parent = pose.nodes[parentNodeId] || parentCurrent;

        pose.nodes[newNodeId] = {
            x: parent.x + dx,
            y: parent.y + dy
        };
    });

    selectedFigureId = figureId;
    selectedNodeId = newNodeId;
}

function addNewFigure(startPoint, endPoint) {
    const figureId = `figure-${nextFigureId++}`;
    const rootId = `node-${nextNodeId++}`;
    const childId = `node-${nextNodeId++}`;
    const segmentId = `seg-${nextSegmentId++}`;

    const figure = {
        id: figureId,
        name: `Figure ${nextFigureId - 1}`,
        rootNodeId: rootId,
        headNodeId: null,
        style: {
            color: "#111111",
            thickness: 12,
            headRadius: 18
        },
        nodes: [
            { id: rootId, parentId: null, role: "root" },
            { id: childId, parentId: rootId, role: "custom" }
        ],
        segments: [
            {
                id: segmentId,
                from: rootId,
                to: childId,
                length: Math.max(
                    1,
                    Math.hypot(
                        endPoint.x - startPoint.x,
                        endPoint.y - startPoint.y
                    )
                )
            }
        ]
    };

    figures.push(figure);

    Object.keys(boneFramePoses).forEach(frameKey => {
        const frameNumber = Number(frameKey);
        const framePose = getFramePose(frameNumber);

        framePose[figureId] = {
            // New objects begin existing from the frame where they were created.
            visible: frameNumber >= currentFrame,
            nodes: {
                [rootId]: { ...startPoint },
                [childId]: { ...endPoint }
            }
        };
    });

    // Ensure current frame exists even in edge cases.
    const currentPose = getFramePose(currentFrame);
    currentPose[figureId] = {
        visible: true,
        nodes: {
            [rootId]: { ...startPoint },
            [childId]: { ...endPoint }
        }
    };

    selectedFigureId = figureId;
    selectedNodeId = childId;
}

function finishBoneInteraction(e) {
    if (!boneInteraction.active || e.pointerId !== boneInteraction.pointerId) {
        return;
    }

    const beforeState = boneInteraction.beforeState;
    const end = stagePointFromEvent(e);

    if (boneInteraction.mode === "build-from-node") {
        const endpoint = normalizedBuildEnd(boneInteraction.startPoint, end);
        addChildSegment(
            boneInteraction.figureId,
            boneInteraction.nodeId,
            endpoint
        );
        boneInteraction.changed = true;
    } else if (boneInteraction.mode === "build-new-figure") {
        const endpoint = normalizedBuildEnd(boneInteraction.startPoint, end);
        addNewFigure(boneInteraction.startPoint, endpoint);
        boneInteraction.changed = true;
    }

    const changed = boneInteraction.changed;

    boneInteraction.active = false;
    boneInteraction.pointerId = null;
    boneInteraction.mode = null;
    boneInteraction.figureId = null;
    boneInteraction.nodeId = null;
    boneInteraction.startPoint = null;
    boneInteraction.latestPoint = null;
    boneInteraction.beforeState = null;
    boneInteraction.startPose = null;
    boneInteraction.changed = false;

    try {
        figureLayer.releasePointerCapture(e.pointerId);
    } catch (_) {}

    if (changed && beforeState) {
        recordBoneOperation(beforeState);
    }

    renderFigures();
}

function cancelBoneInteraction(e) {
    if (!boneInteraction.active) return;
    if (e && e.pointerId !== boneInteraction.pointerId) return;

    const beforeState = boneInteraction.beforeState;

    boneInteraction.active = false;
    boneInteraction.pointerId = null;
    boneInteraction.mode = null;
    boneInteraction.figureId = null;
    boneInteraction.nodeId = null;
    boneInteraction.startPoint = null;
    boneInteraction.latestPoint = null;
    boneInteraction.startPose = null;
    boneInteraction.changed = false;

    if (beforeState) {
        restoreBoneProjectState(beforeState);
    } else {
        renderFigures();
    }
}


function addFigureDefinitionToWorkspace(definition) {
    if (!definition || !Array.isArray(definition.nodes) || !Array.isArray(definition.segments)) {
        return null;
    }

    const beforeState = captureBoneProjectState();
    const figureId = `figure-${nextFigureId++}`;

    const nodeMap = new Map();
    definition.nodes.forEach(node => {
        nodeMap.set(String(node.id), `node-${nextNodeId++}`);
    });

    const runtimeRootId = nodeMap.get(String(definition.rootNodeId));
    if (!runtimeRootId) return null;

    const runtimeNodes = definition.nodes.map(node => ({
        id: nodeMap.get(String(node.id)),
        parentId: node.parentId == null
            ? null
            : nodeMap.get(String(node.parentId)),
        role: node.role || "custom"
    }));

    const runtimeSegments = definition.segments.map(segment => ({
        id: `seg-${nextSegmentId++}`,
        from: nodeMap.get(String(segment.from)),
        to: nodeMap.get(String(segment.to)),
        type: segment.type || "rounded",
        length: Number(segment.length) || null,
        style: {
            color: segment.style?.color || definition.style?.color || "#111111",
            width: Number(segment.style?.width) || Number(definition.style?.thickness) || 12
        }
    })).filter(segment => segment.from && segment.to);

    const sourcePose = definition.initialPose || {};
    const sourcePoints = definition.nodes
        .map(node => sourcePose[node.id])
        .filter(Boolean);

    if (sourcePoints.length === 0) return null;

    const minX = Math.min(...sourcePoints.map(point => Number(point.x) || 0));
    const maxX = Math.max(...sourcePoints.map(point => Number(point.x) || 0));
    const minY = Math.min(...sourcePoints.map(point => Number(point.y) || 0));
    const maxY = Math.max(...sourcePoints.map(point => Number(point.y) || 0));

    const sourceCenter = {
        x: (minX + maxX) / 2,
        y: (minY + maxY) / 2
    };

    const targetCenter = {
        x: STAGE_WIDTH / 2,
        y: STAGE_HEIGHT / 2
    };

    const runtimePoseNodes = {};

    definition.nodes.forEach(node => {
        const source = sourcePose[node.id];
        const runtimeId = nodeMap.get(String(node.id));
        if (!source || !runtimeId) return;

        runtimePoseNodes[runtimeId] = {
            x: targetCenter.x + (Number(source.x) - sourceCenter.x),
            y: targetCenter.y + (Number(source.y) - sourceCenter.y)
        };
    });

    const figure = {
        id: figureId,
        sourceDefinitionId: definition.id || null,
        name: definition.name || "Figure",
        rootNodeId: runtimeRootId,
        headNodeId: null,
        style: {
            color: definition.style?.color || "#111111",
            thickness: Number(definition.style?.thickness) || 12,
            headRadius: 18
        },
        nodes: runtimeNodes,
        segments: runtimeSegments
    };

    figures.push(figure);

    ensureFigureSegmentLengths(figure, {
        visible: true,
        nodes: runtimePoseNodes
    });

    const frameNumbers = new Set(
        Object.keys(boneFramePoses).map(Number)
    );
    frameNumbers.add(currentFrame);

    frameNumbers.forEach(frameNumber => {
        const framePose = getFramePose(frameNumber);

        framePose[figureId] = {
            visible: frameNumber >= currentFrame,
            nodes: deepClone(runtimePoseNodes)
        };
    });

    selectedFigureId = figureId;
    selectedNodeId = runtimeRootId;

    recordBoneOperation(beforeState);
    renderFigures();

    return figureId;
}

window.denxAddFigureDefinition = definition =>
    addFigureDefinitionToWorkspace(definition);

if (figureLayer) {
    figureLayer.addEventListener("pointerdown", e => {
        if (currentTool !== "select") return;
        if (!e.isPrimary) return;

        const nodeEl = e.target.closest?.('[data-denx-node="1"]');
        if (!nodeEl) return;

        beginNodePose(
            e,
            nodeEl.getAttribute("data-figure-id"),
            nodeEl.getAttribute("data-node-id")
        );
    });

    figureLayer.addEventListener("pointermove", movePoseInteraction);
    figureLayer.addEventListener("pointerup", finishBoneInteraction);
    figureLayer.addEventListener("pointercancel", cancelBoneInteraction);
}

window.addEventListener("denx:toolchange", () => {
    cancelBoneInteraction();
    updateFigureInteractionMode();
    renderFigures();
});

let lastHandleZoom = null;

window.addEventListener("denx:camera-updated", (e) => {
    const zoom = Number(e.detail?.zoom);

    if (Number.isFinite(zoom) && lastHandleZoom !== null && Math.abs(zoom - lastHandleZoom) < 0.0001) {
        return;
    }

    lastHandleZoom = Number.isFinite(zoom) ? zoom : getCameraZoom();
    renderFigures();
});

// Animation workspaces begin without automatically spawning a figure.
// Saved/imported definitions only become canvas instances when Add is pressed.
boneFramePoses = { 1: {} };
selectedFigureId = null;
selectedNodeId = null;
lastHandleZoom = getCameraZoom();
renderFigures();
