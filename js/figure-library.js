// ============================================================
// DENX FIGURE LIBRARY V4
//
// My Figures       = saved/phone-imported figures.
// Project Figures  = definitions explicitly imported into this project.
// Canvas Figures   = runtime instances created only after pressing Add.
// Built-ins        = bundled definitions; never auto-spawned.
// ============================================================

(() => {
    const STORE_KEY = "denx.figureStore.v4";

    const LEGACY_LIBRARY_KEYS = [
        "denx.figureStore.v3",
        "denx.figureLibrary.v2",
        "denx.figureLibrary.v1"
    ];

    const LEGACY_PROJECT_KEYS = [
        "denx.workspaceFigures.v2",
        "denx.workspaceFigures.v1"
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
            version: 4,
            library: [],
            projectFigures: []
        };
    }

    function safeParse(raw, fallback) {
        try {
            const parsed = JSON.parse(raw);
            return parsed ?? fallback;
        } catch (_) {
            return fallback;
        }
    }

    function uniqueById(items) {
        const result = [];
        const seen = new Set();

        (items || []).forEach(item => {
            if (!item || typeof item !== "object") return;

            const id = String(item.id || "");
            const key = id || JSON.stringify([
                item.name,
                item.rootNodeId,
                item.nodes?.length,
                item.segments?.length
            ]);

            if (seen.has(key)) return;
            seen.add(key);
            result.push(item);
        });

        return result;
    }

    function readLegacyLibrary() {
        const result = [];

        LEGACY_LIBRARY_KEYS.forEach(key => {
            const raw = localStorage.getItem(key);
            if (!raw) return;

            const parsed = safeParse(raw, null);

            if (Array.isArray(parsed)) {
                result.push(...parsed);
            } else if (Array.isArray(parsed?.library)) {
                result.push(...parsed.library);
            }
        });

        return uniqueById(result);
    }

    function readLegacyProjectFigures() {
        const result = [];

        LEGACY_PROJECT_KEYS.forEach(key => {
            const parsed = safeParse(localStorage.getItem(key) || "[]", []);

            if (Array.isArray(parsed)) {
                result.push(...parsed);
            }
        });

        const v3 = safeParse(localStorage.getItem("denx.figureStore.v3") || "{}", {});

        if (Array.isArray(v3.projectFigures)) {
            result.push(...v3.projectFigures);
        }

        return uniqueById(result);
    }

    function readStore() {
        const current = safeParse(localStorage.getItem(STORE_KEY) || "{}", {});
        const store = blankStore();

        if (Array.isArray(current.library)) {
            store.library.push(...current.library);
        }

        if (Array.isArray(current.projectFigures)) {
            store.projectFigures.push(...current.projectFigures);
        }

        // V4 always merges older stores instead of migrating only when V4 is
        // empty. This protects figures saved during earlier DenX builds.
        store.library = uniqueById([
            ...store.library,
            ...readLegacyLibrary()
        ]);

        store.projectFigures = uniqueById([
            ...store.projectFigures,
            ...readLegacyProjectFigures()
        ]);

        return store;
    }

    function writeStore(store) {
        const clean = {
            version: 4,
            library: uniqueById(store.library || []),
            projectFigures: uniqueById(store.projectFigures || [])
        };

        const serialized = JSON.stringify(clean);
        localStorage.setItem(STORE_KEY, serialized);

        if (localStorage.getItem(STORE_KEY) !== serialized) {
            throw new Error("DenX could not save figure data on this device.");
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

        const nodeIds = new Set(nodes.map(node => String(node.id)));

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
                id: String(segment.id || uid("seg")),
                from: String(segment.from),
                to: String(segment.to),
                type: segment.type || "rounded",
                length: Number(segment.length) || null,
                elastic: !!segment.elastic,
                style: {
                    color:
                        segment.style?.color ||
                        input.style?.color ||
                        "#111111",
                    width:
                        Number(segment.style?.width) ||
                        Number(input.style?.thickness) ||
                        12
                }
            })).filter(segment =>
                nodeIds.has(segment.from) &&
                nodeIds.has(segment.to)
            ),
            polyfills: polyfills
                .map(polyfill => ({
                    id: String(polyfill.id || uid("poly")),
                    nodeIds: Array.isArray(polyfill.nodeIds)
                        ? polyfill.nodeIds
                            .map(String)
                            .filter(id => nodeIds.has(id))
                        : [],
                    color: polyfill.color || "#00c8ff"
                }))
                .filter(polyfill => polyfill.nodeIds.length >= 3),
            initialPose: clone(initialPose)
        };
    }

    function builtInStickman() {
        const nodes = [
            { id: "r", parentId: null, role: "root" },
            { id: "ch", parentId: "r", role: "chest" },
            { id: "neck", parentId: "ch", role: "neck" },
            { id: "head", parentId: "neck", role: "head" },
            { id: "la", parentId: "ch", role: "left-elbow" },
            { id: "lh", parentId: "la", role: "left-hand" },
            { id: "ra", parentId: "ch", role: "right-elbow" },
            { id: "rh", parentId: "ra", role: "right-hand" },
            { id: "ll", parentId: "r", role: "left-knee" },
            { id: "lf", parentId: "ll", role: "left-foot" },
            { id: "rl", parentId: "r", role: "right-knee" },
            { id: "rf", parentId: "rl", role: "right-foot" }
        ];

        const pose = {
            r: { x: 500, y: 410 },
            ch: { x: 500, y: 330 },
            neck: { x: 500, y: 290 },
            head: { x: 500, y: 235 },
            la: { x: 440, y: 350 },
            lh: { x: 405, y: 405 },
            ra: { x: 560, y: 350 },
            rh: { x: 595, y: 405 },
            ll: { x: 465, y: 495 },
            lf: { x: 455, y: 575 },
            rl: { x: 535, y: 495 },
            rf: { x: 545, y: 575 }
        };

        const pair = [
            ["r","ch","rounded"],
            ["ch","neck","rounded"],
            ["neck","head","circle"],
            ["ch","la","rounded"],
            ["la","lh","rounded"],
            ["ch","ra","rounded"],
            ["ra","rh","rounded"],
            ["r","ll","rounded"],
            ["ll","lf","rounded"],
            ["r","rl","rounded"],
            ["rl","rf","rounded"]
        ];

        return sanitizeDefinition({
            id: "builtin-denx-stickman",
            name: "DenX Stickman",
            rootNodeId: "r",
            style: { color: "#111111", thickness: 16 },
            nodes,
            segments: pair.map((entry, index) => {
                const [from, to, type] = entry;
                const a = pose[from];
                const b = pose[to];

                return {
                    id: `s${index + 1}`,
                    from,
                    to,
                    type,
                    length: Math.hypot(b.x - a.x, b.y - a.y),
                    elastic: false,
                    style: { color: "#111111", width: 16 }
                };
            }),
            initialPose: pose
        });
    }

    function builtInMini() {
        const pose = {
            r: { x: 500, y: 390 },
            h: { x: 500, y: 270 },
            la: { x: 430, y: 355 },
            ra: { x: 570, y: 355 },
            ll: { x: 455, y: 500 },
            rl: { x: 545, y: 500 }
        };

        return sanitizeDefinition({
            id: "builtin-mini-stick",
            name: "Mini Stick",
            rootNodeId: "r",
            style: { color: "#111111", thickness: 18 },
            nodes: [
                { id: "r", parentId: null, role: "root" },
                { id: "h", parentId: "r", role: "head" },
                { id: "la", parentId: "r", role: "left-hand" },
                { id: "ra", parentId: "r", role: "right-hand" },
                { id: "ll", parentId: "r", role: "left-foot" },
                { id: "rl", parentId: "r", role: "right-foot" }
            ],
            segments: [
                ["r","h"],["r","la"],["r","ra"],["r","ll"],["r","rl"]
            ].map((pair, i) => ({
                id: `s${i+1}`,
                from: pair[0],
                to: pair[1],
                type: "rounded",
                length: Math.hypot(
                    pose[pair[1]].x - pose[pair[0]].x,
                    pose[pair[1]].y - pose[pair[0]].y
                ),
                elastic: false,
                style: { color: "#111111", width: 18 }
            })),
            initialPose: pose
        });
    }

    function builtInChain() {
        return sanitizeDefinition({
            id: "builtin-chain",
            name: "Four Node Chain",
            rootNodeId: "n1",
            style: { color: "#111111", thickness: 18 },
            nodes: [
                { id: "n1", parentId: null, role: "root" },
                { id: "n2", parentId: "n1", role: "custom" },
                { id: "n3", parentId: "n2", role: "custom" },
                { id: "n4", parentId: "n3", role: "custom" }
            ],
            segments: [
                { id: "s1", from: "n1", to: "n2", type: "rounded", length: 90, elastic: false, style: { color: "#111111", width: 18 } },
                { id: "s2", from: "n2", to: "n3", type: "rounded", length: 90, elastic: false, style: { color: "#111111", width: 18 } },
                { id: "s3", from: "n3", to: "n4", type: "rounded", length: 90, elastic: false, style: { color: "#111111", width: 18 } }
            ],
            initialPose: {
                n1: { x: 380, y: 350 },
                n2: { x: 470, y: 350 },
                n3: { x: 560, y: 350 },
                n4: { x: 650, y: 350 }
            }
        });
    }

    const BUILT_INS = [
        builtInStickman(),
        builtInMini(),
        builtInChain()
    ];

    function getBuiltIns() {
        return clone(BUILT_INS);
    }

    function getLibrary() {
        const store = readStore();

        // Persist the merged result so older figures are recovered once.
        writeStore(store);

        return clone(store.library.map(sanitizeDefinition));
    }

    function saveToLibrary(definition) {
        const clean = sanitizeDefinition(definition);
        const store = readStore();

        const existing = store.library.findIndex(item =>
            String(item.id) === clean.id
        );

        if (existing >= 0) {
            store.library[existing] = clean;
        } else {
            store.library.unshift(clean);
        }

        writeStore(store);
        return clone(clean);
    }

    function getProjectFigures() {
        const store = readStore();
        writeStore(store);

        return clone(store.projectFigures.map(sanitizeDefinition));
    }

    function importToProject(definition) {
        const clean = sanitizeDefinition(definition);
        const store = readStore();

        const duplicate = store.projectFigures.find(item =>
            String(item.id) === clean.id
        );

        if (duplicate) {
            return clone(sanitizeDefinition(duplicate));
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

    window.DenXFigureLibrary = {
        uid,
        clone,
        sanitizeDefinition,
        getBuiltIns,
        getLibrary,
        saveToLibrary,
        getProjectFigures,
        getProjectFigure,
        importToProject,
        parseFigureFile,
        getLibraryCount: () => getLibrary().length,
        getProjectFigureCount: () => getProjectFigures().length
    };
})();
