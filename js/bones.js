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

        // Body segments
        figure.segments.forEach(segment => {
            const from = pose.nodes[segment.from];
            const to = pose.nodes[segment.to];

            if (!from || !to) return;

            const line = createSvg("line", {
                x1: from.x,
                y1: from.y,
                x2: to.x,
                y2: to.y,
                class: "figure-segment",
                "stroke-width": figure.style?.thickness || 12
            });

            group.appendChild(line);
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
        figure.nodes.forEach(node => {
            const point = pose.nodes[node.id];
            if (!point) return;

            if (node.id === figure.rootNodeId) {
                const rootSize = 22;
                const root = createSvg("rect", {
                    x: point.x - rootSize / 2,
                    y: point.y - rootSize / 2,
                    width: rootSize,
                    height: rootSize,
                    rx: 3,
                    class: "figure-node-handle figure-root-node",
                    "data-denx-node": "1",
                    "data-figure-id": figure.id,
                    "data-node-id": node.id
                });

                if (selectedFigureId === figure.id && selectedNodeId === node.id) {
                    root.classList.add("selected");
                }

                group.appendChild(root);
            } else {
                const handle = createSvg("circle", {
                    cx: point.x,
                    cy: point.y,
                    r: 10,
                    class: "figure-node-handle figure-normal-node",
                    "data-denx-node": "1",
                    "data-figure-id": figure.id,
                    "data-node-id": node.id
                });

                if (selectedFigureId === figure.id && selectedNodeId === node.id) {
                    handle.classList.add("selected");
                }

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

    const editingFigures = currentTool === "select" || currentTool === "bone";

    figureLayer.classList.toggle("figure-controls-visible", editingFigures);
    figureLayer.classList.toggle("bone-build-mode", currentTool === "bone");
    figureLayer.classList.toggle("figure-select-mode", currentTool === "select");

    // Pencil/Eraser/Camera pass through this layer completely.
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
        // MAIN/root square moves every node in the figure.
        Object.keys(boneInteraction.startPose.nodes).forEach(nodeId => {
            const start = boneInteraction.startPose.nodes[nodeId];

            pose.nodes[nodeId] = {
                x: start.x + dx,
                y: start.y + dy
            };
        });
    } else if (boneInteraction.mode === "pose-node") {
        // Move this joint and its descendants together.
        // This gives branch-like behavior without locking segment length yet.
        const affected = descendantNodeIds(figure, boneInteraction.nodeId);

        affected.forEach(nodeId => {
            const start = boneInteraction.startPose.nodes[nodeId];
            if (!start) return;

            pose.nodes[nodeId] = {
                x: start.x + dx,
                y: start.y + dy
            };
        });
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
        to: newNodeId
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
            { id: segmentId, from: rootId, to: childId }
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

if (figureLayer) {
    figureLayer.addEventListener("pointerdown", e => {
        if (currentTool !== "select" && currentTool !== "bone") return;
        if (!e.isPrimary) return;

        const nodeEl = e.target.closest?.('[data-denx-node="1"]');

        if (nodeEl) {
            const figureId = nodeEl.getAttribute("data-figure-id");
            const nodeId = nodeEl.getAttribute("data-node-id");

            if (currentTool === "select") {
                beginNodePose(e, figureId, nodeId);
            } else {
                beginBoneBuildFromNode(e, figureId, nodeId);
            }

            return;
        }

        if (currentTool === "bone" && e.target === figureLayer) {
            beginNewFigureBuild(e);
        }
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

// Initial project contains one real editable starter figure.
createStarterFigure();
selectedFigureId = figures[0]?.id || null;
selectedNodeId = figures[0]?.rootNodeId || null;
renderFigures();
