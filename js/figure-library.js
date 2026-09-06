// ============================================================
// DENX FIGURE LIBRARY V3
// Library        = saved figures on this device.
// Project figures = definitions imported into this animation room.
// Canvas figures  = instances created only by Add.
// ============================================================

(() => {
    const STORE_KEY = "denx.figureStore.v3";
    const OLD_LIBRARY_KEYS = [
        "denx.figureLibrary.v1",
        "denx.figureLibrary.v2"
    ];
    const OLD_PROJECT_KEYS = [
        "denx.workspaceFigures.v1",
        "denx.workspaceFigures.v2"
    ];

    function uid(prefix = "figure") {
        if (globalThis.crypto?.randomUUID) {
            return `${prefix}-${crypto.randomUUID()}`;
        }

        return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    }

    function clone(value) {
        return JSON.parse(JSON.stringify(value));
    }

    function blankStore() {
        return {
            version: 3,
            library: [],
            projectFigures: []
        };
    }

    function readLegacyArray(keys) {
        for (const key of keys) {
            try {
                const parsed = JSON.parse(localStorage.getItem(key) || "[]");
                if (Array.isArray(parsed) && parsed.length) {
                    return parsed;
                }
            } catch (_) {}
        }

        return [];
    }

    function migrateStore() {
        const existing = localStorage.getItem(STORE_KEY);

        if (existing) return;

        const store = blankStore();
        store.library = readLegacyArray(OLD_LIBRARY_KEYS);
        store.projectFigures = readLegacyArray(OLD_PROJECT_KEYS);

        localStorage.setItem(STORE_KEY, JSON.stringify(store));
    }

    function readStore() {
        migrateStore();

        try {
            const parsed = JSON.parse(localStorage.getItem(STORE_KEY) || "{}");

            return {
                version: 3,
                library: Array.isArray(parsed.library) ? parsed.library : [],
                projectFigures: Array.isArray(parsed.projectFigures)
                    ? parsed.projectFigures
                    : []
            };
        } catch (_) {
            return blankStore();
        }
    }

    function writeStore(store) {
        const serialized = JSON.stringify({
            version: 3,
            library: Array.isArray(store.library) ? store.library : [],
            projectFigures: Array.isArray(store.projectFigures)
                ? store.projectFigures
                : []
        });

        localStorage.setItem(STORE_KEY, serialized);

        if (localStorage.getItem(STORE_KEY) !== serialized) {
            throw new Error("DenX could not persist figure data on this device.");
        }
    }

    function sanitizeDefinition(input) {
        if (!input || typeof input !== "object") {
            throw new Error("Invalid DenX figure.");
        }

        const nodes = Array.isArray(input.nodes) ? input.nodes : [];
        const segments = Array.isArray(input.segments) ? input.segments : [];
        const polyfills = Array.isArray(input.polyfills) ? input.polyfills : [];
        const initialPose =
            input.initialPose && typeof input.initialPose === "object"
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

        const safeNodeIds = new Set(nodes.map(node => String(node.id)));

        return {
            format: "denx-figure",
            version: 2,
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
                elastic: !!segment.elastic,
                style: {
                    color: segment.style?.color || input.style?.color || "#111111",
                    width:
                        Number(segment.style?.width) ||
                        Number(input.style?.thickness) ||
                        12
                }
            })),
            polyfills: polyfills
                .map(polyfill => ({
                    id: String(polyfill.id || uid("poly")),
                    nodeIds: Array.isArray(polyfill.nodeIds)
                        ? polyfill.nodeIds.map(String).filter(id => safeNodeIds.has(id))
                        : [],
                    color: polyfill.color || "#00c8ff"
                }))
                .filter(polyfill => polyfill.nodeIds.length >= 3),
            initialPose: clone(initialPose)
        };
    }

    function getLibrary() {
        return clone(readStore().library);
    }

    function saveToLibrary(definition) {
        const clean = sanitizeDefinition(definition);
        const store = readStore();
        const existing = store.library.findIndex(item => item.id === clean.id);

        if (existing >= 0) {
            store.library[existing] = clean;
        } else {
            store.library.unshift(clean);
        }

        writeStore(store);
        return clone(clean);
    }

    function getProjectFigures() {
        return clone(readStore().projectFigures);
    }

    function importToProject(definition) {
        const clean = sanitizeDefinition(definition);
        const store = readStore();

        const duplicate = store.projectFigures.find(item =>
            item.id === clean.id ||
            (
                item.name === clean.name &&
                JSON.stringify(item.nodes) === JSON.stringify(clean.nodes) &&
                JSON.stringify(item.segments) === JSON.stringify(clean.segments)
            )
        );

        if (duplicate) {
            return clone(duplicate);
        }

        store.projectFigures.push(clean);
        writeStore(store);
        return clone(clean);
    }

    function getProjectFigure(id) {
        return getProjectFigures().find(item => item.id === id) || null;
    }

    function parseFigureFile(text) {
        return sanitizeDefinition(JSON.parse(text));
    }

    function debugStore() {
        return clone(readStore());
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
        parseFigureFile,
        getLibraryCount: () => getLibrary().length,
        getProjectFigureCount: () => getProjectFigures().length,
        debugStore
    };
})();
