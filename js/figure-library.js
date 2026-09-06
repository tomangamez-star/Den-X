// ============================================================
// DENX FIGURE LIBRARY V1
//
// Library        = saved figures the user has created/imported.
// Project figures = definitions available to the current workspace.
// Canvas figures  = instances, created only when Add is pressed.
// ============================================================

(() => {
    const LIBRARY_KEY = "denx.figureLibrary.v1";
    const PROJECT_KEY = "denx.workspaceFigures.v1";

    function uid(prefix = "figure") {
        if (globalThis.crypto?.randomUUID) {
            return `${prefix}-${crypto.randomUUID()}`;
        }

        return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    }

    function clone(value) {
        return JSON.parse(JSON.stringify(value));
    }

    function readArray(key) {
        try {
            const value = JSON.parse(localStorage.getItem(key) || "[]");
            return Array.isArray(value) ? value : [];
        } catch (_) {
            return [];
        }
    }

    function writeArray(key, value) {
        localStorage.setItem(key, JSON.stringify(value));
    }

    function sanitizeDefinition(input) {
        if (!input || typeof input !== "object") {
            throw new Error("Invalid DenX figure.");
        }

        const nodes = Array.isArray(input.nodes) ? input.nodes : [];
        const segments = Array.isArray(input.segments) ? input.segments : [];
        const initialPose = input.initialPose && typeof input.initialPose === "object"
            ? input.initialPose
            : {};

        if (nodes.length < 2 || segments.length < 1) {
            throw new Error("A DenX figure needs at least two nodes and one segment.");
        }

        const rootNodeId =
            input.rootNodeId ||
            nodes.find(node => node.parentId == null)?.id ||
            nodes[0]?.id;

        if (!rootNodeId || !initialPose[rootNodeId]) {
            throw new Error("Figure is missing its MAIN node pose.");
        }

        return {
            format: "denx-figure",
            version: 1,
            id: String(input.id || uid("dxf")),
            name: String(input.name || "Untitled Figure").trim() || "Untitled Figure",
            rootNodeId: String(rootNodeId),
            style: {
                color: input.style?.color || "#111111",
                thickness: Number(input.style?.thickness) || 12
            },
            nodes: nodes.map(node => ({
                id: String(node.id),
                parentId: node.parentId == null ? null : String(node.parentId),
                role: node.role || "custom"
            })),
            segments: segments.map(segment => ({
                id: String(segment.id),
                from: String(segment.from),
                to: String(segment.to),
                type: segment.type || "rounded",
                length: Number(segment.length) || null,
                style: {
                    color: segment.style?.color || input.style?.color || "#111111",
                    width: Number(segment.style?.width) || Number(input.style?.thickness) || 12
                }
            })),
            initialPose: clone(initialPose)
        };
    }

    function getLibrary() {
        return readArray(LIBRARY_KEY);
    }

    function saveToLibrary(definition) {
        const clean = sanitizeDefinition(definition);
        const library = getLibrary();
        const existing = library.findIndex(item => item.id === clean.id);

        if (existing >= 0) {
            library[existing] = clean;
        } else {
            library.unshift(clean);
        }

        writeArray(LIBRARY_KEY, library);
        return clone(clean);
    }

    function getProjectFigures() {
        return readArray(PROJECT_KEY);
    }

    function importToProject(definition) {
        const clean = sanitizeDefinition(definition);
        const project = getProjectFigures();

        const duplicate = project.find(item =>
            item.id === clean.id ||
            (item.name === clean.name &&
             JSON.stringify(item.nodes) === JSON.stringify(clean.nodes) &&
             JSON.stringify(item.segments) === JSON.stringify(clean.segments))
        );

        if (duplicate) {
            return clone(duplicate);
        }

        project.push(clean);
        writeArray(PROJECT_KEY, project);
        return clone(clean);
    }

    function getProjectFigure(id) {
        return getProjectFigures().find(item => item.id === id) || null;
    }

    function parseFigureFile(text) {
        const parsed = JSON.parse(text);
        return sanitizeDefinition(parsed);
    }

    window.DenXFigureLibrary = {
        uid,
        clone,
        sanitizeDefinition,
        getLibrary,
        saveToLibrary,
        getProjectFigures,
        getProjectFigure,
        importToProject,
        parseFigureFile
    };
})();
