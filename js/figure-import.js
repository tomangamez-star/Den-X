// ============================================================
// DENX FIGURE BROWSER V1
// Dedicated module so Import cannot silently fail because of unrelated UI.
// ============================================================

(() => {
    const openBtn = document.getElementById("importFigureBtn");
    const modal = document.getElementById("figureImportModal");
    const closeBtn = document.getElementById("closeFigureImportBtn");

    const builtinList = document.getElementById("builtinFigureList");
    const savedList = document.getElementById("savedFigureList");
    const countBadge = document.getElementById("myFiguresCount");

    const importFromPhoneBtn =
        document.getElementById("importFromPhoneBtn");

    const fileInput =
        document.getElementById("figureFileInput");

    function toast(message) {
        if (window.denxShowToast) {
            window.denxShowToast(message);
        }
    }

    function figureRow(figure, sourceLabel = "") {
        const row = document.createElement("button");
        row.type = "button";
        row.className = "saved-figure-row";

        row.innerHTML = `
            <span class="saved-figure-mark">◇</span>
            <span class="saved-figure-copy">
                <strong class="saved-figure-name"></strong>
                <small class="saved-figure-source"></small>
            </span>
            <span class="saved-figure-action">Import</span>
        `;

        row.querySelector(".saved-figure-name").textContent =
            figure.name;

        row.querySelector(".saved-figure-source").textContent =
            sourceLabel;

        row.addEventListener("click", () => {
            try {
                const imported =
                    DenXFigureLibrary.importToProject(figure);

                window.denxRefreshProjectFigurePicker?.(imported.id);

                toast(`${imported.name} imported to project ✓`);
                close();
            } catch (error) {
                toast(
                    error?.message ||
                    "Could not import that figure."
                );
            }
        });

        return row;
    }

    function renderBuiltIns() {
        if (!builtinList) return;

        builtinList.innerHTML = "";

        const builtIns =
            DenXFigureLibrary.getBuiltIns?.() || [];

        builtIns.forEach(figure => {
            builtinList.appendChild(
                figureRow(figure, "Built in")
            );
        });
    }

    function renderLibrary() {
        if (!savedList) return;

        const library =
            DenXFigureLibrary.getLibrary();

        savedList.innerHTML = "";

        if (countBadge) {
            countBadge.textContent = library.length;
        }

        if (library.length === 0) {
            const empty = document.createElement("div");
            empty.className = "figure-list-empty";
            empty.innerHTML =
                `No saved figures yet.<br><span>Create one or import from your phone.</span>`;

            savedList.appendChild(empty);
            return;
        }

        library.forEach(figure => {
            savedList.appendChild(
                figureRow(figure, "My Figures")
            );
        });
    }

    function open() {
        if (!modal) {
            toast("Figure Browser could not open.");
            return;
        }

        renderBuiltIns();
        renderLibrary();

        modal.classList.remove("hidden");
        modal.style.display = "grid";
        modal.setAttribute("aria-hidden", "false");
    }

    function close() {
        if (!modal) return;

        modal.classList.add("hidden");
        modal.style.display = "none";
        modal.setAttribute("aria-hidden", "true");
    }

    openBtn?.addEventListener("click", event => {
        event.preventDefault();
        event.stopPropagation();
        open();
    });

    closeBtn?.addEventListener("click", close);

    modal?.addEventListener("pointerdown", event => {
        if (event.target === modal) {
            close();
        }
    });

    importFromPhoneBtn?.addEventListener("click", () => {
        fileInput?.click();
    });

    fileInput?.addEventListener("change", async event => {
        const file = event.target.files?.[0];

        if (!file) return;

        try {
            const text = await file.text();
            const parsed =
                DenXFigureLibrary.parseFigureFile(text);

            const saved =
                DenXFigureLibrary.saveToLibrary(parsed);

            renderLibrary();

            const imported =
                DenXFigureLibrary.importToProject(saved);

            window.denxRefreshProjectFigurePicker?.(imported.id);

            toast(
                `${saved.name} saved to My Figures + imported ✓`
            );

            close();
        } catch (error) {
            toast(
                error?.message ||
                "That file is not a valid DenX figure."
            );
        } finally {
            event.target.value = "";
        }
    });

    // Exposed for debugging/testing from DevTools later.
    window.denxOpenFigureBrowser = open;
})();
