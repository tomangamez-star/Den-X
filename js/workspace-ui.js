// ============================================================
// DENX EXPANDED TOOLBOX / WORKSPACE UI V4
// Figure Browser is handled independently in figure-import.js.
// ============================================================

(() => {
    const toolbox = document.getElementById("toolbox");
    const quickLinks = [...document.querySelectorAll(".quickfind-link")];
    const sections = [...document.querySelectorAll("[data-tool-section]")];

    const createFigureBtn = document.getElementById("createFigureBtn");
    const workspaceFigureSelect = document.getElementById("workspaceFigureSelect");
    const addFigureBtn = document.getElementById("addFigureBtn");

    const backgroundColorControl = document.getElementById("backgroundColorControl");
    const drawColorControl = document.getElementById("drawColorControl");
    const stage = document.getElementById("stage");
    const drawingCanvas = document.getElementById("drawingCanvas");
    const toast = document.getElementById("denxToast");

    let toastTimer = null;

    function showToast(message) {
        if (!toast) return;

        toast.textContent = message;
        toast.classList.add("show");

        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => {
            toast.classList.remove("show");
        }, 1800);
    }

    window.denxShowToast = showToast;

    function setActiveQuickLink(name) {
        quickLinks.forEach(link => {
            link.classList.toggle(
                "active",
                link.dataset.toolTarget === name
            );
        });
    }

    function updateQuickFindFromScroll() {
        if (!toolbox || sections.length === 0) return;

        const marker = toolbox.scrollTop + 54;
        let active = sections[0];

        sections.forEach(section => {
            if (section.offsetTop <= marker) {
                active = section;
            }
        });

        setActiveQuickLink(active.dataset.toolSection);
    }

    quickLinks.forEach(link => {
        link.addEventListener("click", () => {
            const target = document.querySelector(
                `[data-tool-section="${link.dataset.toolTarget}"]`
            );

            if (!target || !toolbox) return;

            toolbox.scrollTo({
                top: Math.max(0, target.offsetTop - 6),
                behavior: "smooth"
            });

            setActiveQuickLink(link.dataset.toolTarget);
        });
    });

    toolbox?.addEventListener("scroll", updateQuickFindFromScroll, {
        passive: true
    });

    function applyWorkspaceBackground(color) {
        if (!color) return;

        if (stage) stage.style.background = color;
        if (drawingCanvas) drawingCanvas.style.background = "transparent";

        window.denxStageBackgroundColor = color;
        localStorage.setItem("denx.stageBackground", color);
    }

    const savedBackground =
        localStorage.getItem("denx.stageBackground") ||
        localStorage.getItem("denx.workspaceBackground") ||
        "#ffffff";

    if (backgroundColorControl) {
        backgroundColorControl.value = savedBackground;
        applyWorkspaceBackground(savedBackground);

        backgroundColorControl.addEventListener("input", e => {
            applyWorkspaceBackground(e.target.value);
        });
    }

    const savedDrawColor =
        localStorage.getItem("denx.drawColor") ||
        "#000000";

    window.denxDrawColor = savedDrawColor;

    if (drawColorControl) {
        drawColorControl.value = savedDrawColor;

        drawColorControl.addEventListener("input", e => {
            window.denxDrawColor = e.target.value;
            localStorage.setItem("denx.drawColor", e.target.value);
        });
    }

    function renderProjectFigures(selectedId = null) {
        if (
            !workspaceFigureSelect ||
            !window.DenXFigureLibrary
        ) return;

        const figures = DenXFigureLibrary.getProjectFigures();
        const previous = selectedId || workspaceFigureSelect.value;

        workspaceFigureSelect.innerHTML = "";

        if (figures.length === 0) {
            const empty = document.createElement("option");
            empty.value = "";
            empty.textContent = "No figures";
            workspaceFigureSelect.appendChild(empty);
        } else {
            figures.forEach(figure => {
                const option = document.createElement("option");
                option.value = figure.id;
                option.textContent = figure.name;
                workspaceFigureSelect.appendChild(option);
            });

            if (figures.some(figure => figure.id === previous)) {
                workspaceFigureSelect.value = previous;
            }
        }

        if (addFigureBtn) {
            addFigureBtn.disabled = !workspaceFigureSelect.value;
        }
    }

    window.denxRefreshProjectFigurePicker = renderProjectFigures;

    workspaceFigureSelect?.addEventListener("change", () => {
        addFigureBtn.disabled = !workspaceFigureSelect.value;
    });

    addFigureBtn?.addEventListener("click", () => {
        const id = workspaceFigureSelect?.value;
        const definition = DenXFigureLibrary.getProjectFigure(id);

        if (!definition) {
            showToast("Choose a figure first.");
            return;
        }

        if (!window.denxAddFigureDefinition) {
            showToast("Figure engine is not ready.");
            return;
        }

        const instanceId =
            window.denxAddFigureDefinition(definition);

        if (instanceId) {
            window.denxSetTool?.("select");
            showToast(`${definition.name} added ✓`);
        }
    });

    createFigureBtn?.addEventListener("click", () => {
        try {
            window.denxStopPlayback?.();
            window.denxSaveWorkspaceHandoff?.();
        } catch (_) {}

        window.location.href = "figure-creator.html";
    });

    const createdNotice =
        sessionStorage.getItem("denx.figureCreatedNotice");

    if (createdNotice) {
        sessionStorage.removeItem("denx.figureCreatedNotice");

        renderProjectFigures();

        setTimeout(() => {
            const count =
                DenXFigureLibrary.getLibraryCount?.() ?? 0;

            showToast(
                `${createdNotice} saved ✓  My Figures: ${count}`
            );
        }, 220);
    }

    renderProjectFigures();
    updateQuickFindFromScroll();
})();
