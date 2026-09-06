// ============================================================
// DENX EXPANDED TOOLBOX + FIGURE WORKFLOW
// ============================================================

(() => {
    const toolbox = document.getElementById("toolbox");
    const quickLinks = [...document.querySelectorAll(".quickfind-link")];
    const sections = [...document.querySelectorAll("[data-tool-section]")];

    const createFigureBtn = document.getElementById("createFigureBtn");
    const importFigureBtn = document.getElementById("importFigureBtn");
    const workspaceFigureSelect = document.getElementById("workspaceFigureSelect");
    const addFigureBtn = document.getElementById("addFigureBtn");

    const modal = document.getElementById("figureImportModal");
    const closeModalBtn = document.getElementById("closeFigureImportBtn");
    const savedFigureList = document.getElementById("savedFigureList");
    const figureFileInput = document.getElementById("figureFileInput");

    const backgroundColorControl = document.getElementById("backgroundColorControl");
    const drawColorControl = document.getElementById("drawColorControl");
    const viewport = document.getElementById("viewport");
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
            link.classList.toggle("active", link.dataset.toolTarget === name);
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
        if (!color || !viewport) return;
        viewport.style.background = color;
        localStorage.setItem("denx.workspaceBackground", color);
    }

    const savedBackground =
        localStorage.getItem("denx.workspaceBackground") || "#111111";

    if (backgroundColorControl) {
        backgroundColorControl.value = savedBackground;
        applyWorkspaceBackground(savedBackground);
        backgroundColorControl.addEventListener("input", e => {
            applyWorkspaceBackground(e.target.value);
        });
    }

    const savedDrawColor = localStorage.getItem("denx.drawColor") || "#000000";
    window.denxDrawColor = savedDrawColor;

    if (drawColorControl) {
        drawColorControl.value = savedDrawColor;
        drawColorControl.addEventListener("input", e => {
            window.denxDrawColor = e.target.value;
            localStorage.setItem("denx.drawColor", e.target.value);
        });
    }

    function renderProjectFigures(selectedId = null) {
        if (!workspaceFigureSelect || !window.DenXFigureLibrary) return;

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

    function closeImportModal() {
        modal?.classList.add("hidden");
        modal?.setAttribute("aria-hidden", "true");
    }

    function importDefinitionToProject(definition) {
        try {
            const imported = DenXFigureLibrary.importToProject(definition);
            renderProjectFigures(imported.id);
            showToast(`${imported.name} imported to project ✓`);
            closeImportModal();
        } catch (error) {
            showToast(error?.message || "Could not import figure.");
        }
    }

    function renderSavedFigures() {
        if (!savedFigureList) return;

        const library = DenXFigureLibrary.getLibrary();
        savedFigureList.innerHTML = "";

        if (library.length === 0) {
            const empty = document.createElement("div");
            empty.className = "figure-list-empty";
            empty.textContent = "No saved figures yet. Create one first.";
            savedFigureList.appendChild(empty);
            return;
        }

        library.forEach(figure => {
            const row = document.createElement("button");
            row.className = "saved-figure-row";
            row.type = "button";
            row.innerHTML = `
                <span class="saved-figure-mark">◇</span>
                <span class="saved-figure-name"></span>
                <span class="saved-figure-action">Import</span>
            `;

            row.querySelector(".saved-figure-name").textContent = figure.name;
            row.addEventListener("click", () => importDefinitionToProject(figure));
            savedFigureList.appendChild(row);
        });
    }

    function openImportModal() {
        renderSavedFigures();
        modal?.classList.remove("hidden");
        modal?.setAttribute("aria-hidden", "false");
    }

    importFigureBtn?.addEventListener("click", openImportModal);
    closeModalBtn?.addEventListener("click", closeImportModal);

    modal?.addEventListener("pointerdown", e => {
        if (e.target === modal) closeImportModal();
    });

    figureFileInput?.addEventListener("change", async e => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            const text = await file.text();
            const definition = DenXFigureLibrary.parseFigureFile(text);
            DenXFigureLibrary.saveToLibrary(definition);
            importDefinitionToProject(definition);
        } catch (error) {
            showToast(error?.message || "That is not a valid DenX figure.");
        } finally {
            e.target.value = "";
        }
    });

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

        const instanceId = window.denxAddFigureDefinition(definition);

        if (instanceId) {
            window.denxSetTool?.("select");
            showToast(`${definition.name} added ✓`);
        }
    });

    createFigureBtn?.addEventListener("click", () => {
        try {
            window.denxSaveWorkspaceHandoff?.();
        } catch (_) {}

        window.location.href = "figure-creator.html";
    });

    const createdNotice = sessionStorage.getItem("denx.figureCreatedNotice");
    if (createdNotice) {
        sessionStorage.removeItem("denx.figureCreatedNotice");
        setTimeout(() => showToast(`${createdNotice} saved to My Figures ✓`), 220);
    }

    renderProjectFigures();
    updateQuickFindFromScroll();
})();
