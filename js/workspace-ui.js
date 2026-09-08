// ============================================================
// DENX WORKSPACE UI V5
// Expanded toolbox, reliable Figure Browser, mobile number controls.
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

    const figureActionsRail = document.getElementById("figureActionsRail");
    const figureActionsName = document.getElementById("figureActionsName");
    const figureMainColorInput = document.getElementById("figureMainColorInput");
    const figureScaleDownBtn = document.getElementById("figureScaleDownBtn");
    const figureScaleUpBtn = document.getElementById("figureScaleUpBtn");
    const figureScaleDisplay = document.getElementById("figureScaleDisplay");
    const figureFlipXBtn = document.getElementById("figureFlipXBtn");
    const figureFlipYBtn = document.getElementById("figureFlipYBtn");
    const figureFlipZBtn = document.getElementById("figureFlipZBtn");
    const figureRotateLeftBtn = document.getElementById("figureRotateLeftBtn");
    const figureRotateRightBtn = document.getElementById("figureRotateRightBtn");
    const figureRotateDisplay = document.getElementById("figureRotateDisplay");
    const figureMoveFrontBtn = document.getElementById("figureMoveFrontBtn");
    const figureMoveBackBtn = document.getElementById("figureMoveBackBtn");
    const figureEditBtn = document.getElementById("figureEditBtn");
    const figureDeleteBtn = document.getElementById("figureDeleteBtn");

    const textActionsRail = document.getElementById("textActionsRail");
    const textContentInput = document.getElementById("textContentInput");
    const textFontSelect = document.getElementById("textFontSelect");
    const textColorInput = document.getElementById("textColorInput");
    const textScaleDownBtn = document.getElementById("textScaleDownBtn");
    const textScaleUpBtn = document.getElementById("textScaleUpBtn");
    const textScaleDisplay = document.getElementById("textScaleDisplay");
    const textDeleteBtn = document.getElementById("textDeleteBtn");

    let contextualFigureId = null;
    let contextualTextId = null;

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

    // --------------------------------------------------------
    // Mobile-first numeric controls
    // --------------------------------------------------------

    function numberMeta(inputId) {
        const wrapper = document.querySelector(
            `[data-denx-stepper][data-target="${inputId}"]`
        );

        if (!wrapper) return null;

        const input = document.getElementById(inputId);
        const display = document.querySelector(
            `[data-denx-display-for="${inputId}"]`
        );

        return {
            wrapper,
            input,
            display,
            min: Number(wrapper.dataset.min),
            max: Number(wrapper.dataset.max),
            step: Number(wrapper.dataset.step) || 1
        };
    }

    function formatNumberDisplay(inputId, value) {
        if (inputId === "cameraPropRotation") {
            return `${Math.round(value)}°`;
        }

        return String(
            Number.isInteger(value)
                ? value
                : Math.round(value * 100) / 100
        );
    }

    function syncNumberControl(inputId) {
        const meta = numberMeta(inputId);
        if (!meta?.input || !meta.display) return;

        const value = Number(meta.input.value) || 0;
        meta.display.textContent =
            formatNumberDisplay(inputId, value);
    }

    window.denxSyncNumberControl = syncNumberControl;

    document
        .querySelectorAll("[data-denx-stepper]")
        .forEach(wrapper => {
            const inputId = wrapper.dataset.target;
            const meta = numberMeta(inputId);
            if (!meta?.input) return;

            wrapper
                .querySelectorAll("[data-step-dir]")
                .forEach(button => {
                    button.addEventListener("click", () => {
                        const direction =
                            Number(button.dataset.stepDir) || 0;

                        let value =
                            Number(meta.input.value) || 0;

                        value += direction * meta.step;

                        if (Number.isFinite(meta.min)) {
                            value = Math.max(meta.min, value);
                        }

                        if (Number.isFinite(meta.max)) {
                            value = Math.min(meta.max, value);
                        }

                        meta.input.value = String(value);
                        syncNumberControl(inputId);

                        meta.input.dispatchEvent(
                            new Event("input", { bubbles: true })
                        );

                        meta.input.dispatchEvent(
                            new Event("change", { bubbles: true })
                        );
                    });
                });

            syncNumberControl(inputId);
        });

    // --------------------------------------------------------
    // Quick Find
    // --------------------------------------------------------

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

    // --------------------------------------------------------
    // Stage/drawing colors
    // --------------------------------------------------------

    function applyWorkspaceBackground(color) {
        if (!color) return;

        if (stage) stage.style.background = color;
        if (drawingCanvas) drawingCanvas.style.background = "transparent";

        window.denxStageBackgroundColor = color;
        localStorage.setItem("denx.stageBackground", color);

        window.denxRefreshAllFrameThumbnails?.();
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

    // --------------------------------------------------------
    // Project figure picker
    // --------------------------------------------------------

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

    workspaceFigureSelect?.addEventListener("change", () => {
        addFigureBtn.disabled = !workspaceFigureSelect.value;
    });

    window.denxRenderProjectFigures = renderProjectFigures;

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
            window.denxSaveWorkspaceHandoff?.("figure-create");
        } catch (_) {}

        window.location.href = "figure-creator.html";
    });

    // --------------------------------------------------------
    // FIGURE BROWSER V6 — native dialog + failure isolation.
    // The dialog opens BEFORE any storage/library work is attempted.
    // --------------------------------------------------------

    const importFigureBtn = document.getElementById("importFigureBtn");
    const figureImportModal = document.getElementById("figureImportModal");
    const closeFigureImportBtn = document.getElementById("closeFigureImportBtn");
    const cancelFigureImportBtn = document.getElementById("cancelFigureImportBtn");
    const builtinFigureList = document.getElementById("builtinFigureList");
    const savedFigureList = document.getElementById("savedFigureList");
    const myFiguresCount = document.getElementById("myFiguresCount");
    const importFromPhoneBtn = document.getElementById("importFromPhoneBtn");
    const figureFileInput = document.getElementById("figureFileInput");

    function showFigureDialogNow() {
        if (!figureImportModal) {
            showToast("Figure Browser element is missing.");
            return false;
        }

        try {
            if (
                typeof figureImportModal.showModal === "function" &&
                !figureImportModal.open
            ) {
                figureImportModal.showModal();
            } else {
                figureImportModal.setAttribute("open", "");
            }
        } catch (error) {
            // Last-resort native-dialog fallback.
            figureImportModal.setAttribute("open", "");
            figureImportModal.style.display = "block";
        }

        return true;
    }

    function closeFigureBrowser() {
        if (!figureImportModal) return;

        try {
            if (
                typeof figureImportModal.close === "function" &&
                figureImportModal.open
            ) {
                figureImportModal.close();
            } else {
                figureImportModal.removeAttribute("open");
            }
        } catch (_) {
            figureImportModal.removeAttribute("open");
        }

        figureImportModal.style.display = "";
    }

    function figureBrowserRow(figure, sourceLabel) {
        const row = document.createElement("button");
        row.type = "button";
        row.className = "saved-figure-row";

        const mark = document.createElement("span");
        mark.className = "saved-figure-mark";
        mark.textContent = "◇";

        const copy = document.createElement("span");
        copy.className = "saved-figure-copy";

        const name = document.createElement("strong");
        name.className = "saved-figure-name";
        name.textContent = figure.name;

        const source = document.createElement("small");
        source.className = "saved-figure-source";
        source.textContent = sourceLabel;

        const action = document.createElement("span");
        action.className = "saved-figure-action";
        action.textContent = "Import";

        copy.append(name, source);
        row.append(mark, copy, action);

        row.addEventListener("click", () => {
            try {
                const imported =
                    DenXFigureLibrary.importToProject(figure);

                renderProjectFigures(imported.id);
                closeFigureBrowser();

                showToast(
                    `${imported.name} imported — press Add to place it ✓`
                );
            } catch (error) {
                showToast(
                    error?.message ||
                    "Could not import that figure."
                );
            }
        });

        return row;
    }

    function renderBuiltInFiguresSafe() {
        if (!builtinFigureList) return;

        builtinFigureList.innerHTML = "";

        try {
            const builtIns =
                window.DenXFigureLibrary?.getBuiltIns?.() || [];

            if (!builtIns.length) {
                builtinFigureList.innerHTML =
                    '<div class="figure-list-empty">No built-in figures available.</div>';
                return;
            }

            builtIns.forEach(figure => {
                builtinFigureList.appendChild(
                    figureBrowserRow(figure, "Built in")
                );
            });
        } catch (error) {
            console.error("DenX built-in figure browser error:", error);
            builtinFigureList.innerHTML =
                '<div class="figure-list-error">Built-ins failed to load.<br><span>The browser is still usable.</span></div>';
        }
    }

    function renderMyFiguresSafe() {
        if (!savedFigureList) return;

        savedFigureList.innerHTML = "";

        try {
            const library =
                window.DenXFigureLibrary?.getLibrary?.() || [];

            if (myFiguresCount) {
                myFiguresCount.textContent = String(library.length);
            }

            if (!library.length) {
                savedFigureList.innerHTML =
                    '<div class="figure-list-empty">No readable saved figures yet.<br><span>Create one or import from your phone.</span></div>';
                return;
            }

            library.forEach(figure => {
                savedFigureList.appendChild(
                    figureBrowserRow(figure, "My Figures")
                );
            });
        } catch (error) {
            console.error("DenX My Figures browser error:", error);

            if (myFiguresCount) {
                myFiguresCount.textContent = "!";
            }

            savedFigureList.innerHTML =
                '<div class="figure-list-error">My Figures could not be read.<br><span>You can still import a figure from your phone.</span></div>';
        }
    }

    function hydrateFigureBrowser() {
        // Separate tasks: failure in one section cannot stop the other.
        renderBuiltInFiguresSafe();
        renderMyFiguresSafe();
    }

    function openFigureBrowser() {
        // Critical ordering: OPEN FIRST.
        if (!showFigureDialogNow()) return;

        requestAnimationFrame(() => {
            hydrateFigureBrowser();
        });
    }

    window.denxOpenFigureBrowser = openFigureBrowser;
    window.denxCloseFigureBrowser = closeFigureBrowser;
    window.denxHydrateFigureBrowser = hydrateFigureBrowser;

    if (importFigureBtn) {
        // Keep the inline HTML kill-switch as an independent fallback.
        importFigureBtn.addEventListener("click", event => {
            event.preventDefault();
            openFigureBrowser();
        });
    }

    closeFigureImportBtn?.addEventListener(
        "click",
        closeFigureBrowser
    );

    cancelFigureImportBtn?.addEventListener(
        "click",
        closeFigureBrowser
    );

    figureImportModal?.addEventListener("click", event => {
        // Native dialog backdrop click.
        const rect =
            figureImportModal.getBoundingClientRect();

        const inside =
            event.clientX >= rect.left &&
            event.clientX <= rect.right &&
            event.clientY >= rect.top &&
            event.clientY <= rect.bottom;

        if (!inside) {
            closeFigureBrowser();
        }
    });

    figureImportModal?.addEventListener("cancel", event => {
        event.preventDefault();
        closeFigureBrowser();
    });

    importFromPhoneBtn?.addEventListener("click", () => {
        figureFileInput?.click();
    });

    figureFileInput?.addEventListener("change", async event => {
        const file = event.target.files?.[0];
        if (!file) return;

        try {
            const text = await file.text();
            const parsed =
                DenXFigureLibrary.parseFigureFile(text);

            const saved =
                DenXFigureLibrary.saveToLibrary(parsed);

            const imported =
                DenXFigureLibrary.importToProject(saved);

            renderProjectFigures(imported.id);
            hydrateFigureBrowser();

            showToast(
                `${saved.name} saved to My Figures + imported ✓`
            );
        } catch (error) {
            showToast(
                error?.message ||
                "That file is not a valid DenX figure."
            );
        } finally {
            event.target.value = "";
        }
    });

    // --------------------------------------------------------
    // Return notice
    // --------------------------------------------------------

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

    // --------------------------------------------------------
    // Quick Find gesture-passive rail
    // --------------------------------------------------------
    // When asleep the rail is visible but pointer-transparent, so a pinch or
    // pan that begins on top of it still belongs to the workspace underneath.
    // A clean tap inside its bounds wakes it for normal section selection.

    const quickRail = document.querySelector(".tool-quickfind");
    const quickRailPointers = new Map();
    const activeRailPointers = new Set();
    let quickRailTimer = null;

    function sleepQuickRail() {
        quickRail?.classList.remove("quickfind-awake");
        clearTimeout(quickRailTimer);
        quickRailTimer = null;
    }

    function wakeQuickRail() {
        if (!quickRail) return;
        quickRail.classList.add("quickfind-awake");
        clearTimeout(quickRailTimer);
        quickRailTimer = setTimeout(sleepQuickRail, 5000);
    }

    function pointInsideQuickRail(x, y) {
        if (!quickRail) return false;
        const rect = quickRail.getBoundingClientRect();
        return (
            x >= rect.left && x <= rect.right &&
            y >= rect.top && y <= rect.bottom
        );
    }

    document.addEventListener("pointerdown", event => {
        activeRailPointers.add(event.pointerId);

        if (activeRailPointers.size > 1) {
            quickRailPointers.forEach(state => {
                state.multiTouch = true;
            });
        }

        if (quickRail?.classList.contains("quickfind-awake")) {
            if (!pointInsideQuickRail(event.clientX, event.clientY)) {
                sleepQuickRail();
            } else {
                wakeQuickRail();
            }
            return;
        }

        if (!pointInsideQuickRail(event.clientX, event.clientY)) return;

        quickRailPointers.set(event.pointerId, {
            x: event.clientX,
            y: event.clientY,
            moved: false,
            multiTouch: activeRailPointers.size > 1
        });
    }, true);

    document.addEventListener("pointermove", event => {
        const state = quickRailPointers.get(event.pointerId);
        if (!state) return;

        if (
            Math.hypot(
                event.clientX - state.x,
                event.clientY - state.y
            ) > 9
        ) {
            state.moved = true;
        }
    }, true);

    function finishQuickRailPointer(event) {
        const state = quickRailPointers.get(event.pointerId);
        quickRailPointers.delete(event.pointerId);
        activeRailPointers.delete(event.pointerId);

        if (!state || state.moved || state.multiTouch) return;

        if (pointInsideQuickRail(event.clientX, event.clientY)) {
            wakeQuickRail();
        }
    }

    document.addEventListener("pointerup", finishQuickRailPointer, true);
    document.addEventListener("pointercancel", event => {
        quickRailPointers.delete(event.pointerId);
        activeRailPointers.delete(event.pointerId);
    }, true);

    quickLinks.forEach(link => {
        link.addEventListener("click", wakeQuickRail);
    });


    let contextualFigureScalePercent = 100;
    let contextualFigureRotation = 0;

    function syncFigureRail(detail) {
        const nextFigureId = detail?.figureId || null;
        const changedFigure = nextFigureId !== contextualFigureId;
        contextualFigureId = nextFigureId;
        const visible = !!contextualFigureId;
        figureActionsRail?.classList.toggle("hidden", !visible);
        figureActionsRail?.setAttribute("aria-hidden", visible ? "false" : "true");
        if (visible) {
            textActionsRail?.classList.add("hidden");
            textActionsRail?.setAttribute("aria-hidden", "true");
            contextualTextId = null;
        }
        if (!visible) return;
        if (changedFigure) {
            contextualFigureScalePercent = 100;
            contextualFigureRotation = 0;
        }
        if (figureScaleDisplay) figureScaleDisplay.textContent = `${contextualFigureScalePercent}%`;
        if (figureRotateDisplay) figureRotateDisplay.textContent = `${contextualFigureRotation}°`;
        if (figureActionsName) figureActionsName.textContent = detail.name || "Figure";
        if (figureMainColorInput && /^#[0-9a-f]{6}$/i.test(detail.color || "")) {
            figureMainColorInput.value = detail.color;
        }
    }

    window.addEventListener("denx:figureselectionchange", event => {
        syncFigureRail(event.detail);
    });

    figureMainColorInput?.addEventListener("change", event => {
        if (!contextualFigureId) return;
        window.denxRecolorFigure?.(contextualFigureId, event.target.value);
    });

    function applyContextualFigureScale(factor, live = false) {
        if (!contextualFigureId) return false;
        const worked = live
            ? window.denxScaleFigureLive?.(contextualFigureId, factor)
            : window.denxScaleFigure?.(contextualFigureId, factor);
        if (!worked) return false;
        contextualFigureScalePercent = Math.max(10, Math.min(500, Math.round(contextualFigureScalePercent * factor)));
        if (figureScaleDisplay) figureScaleDisplay.textContent = `${contextualFigureScalePercent}%`;
        return true;
    }

    function bindScaleHold(button, factor) {
        if (!button) return;
        let holdTimer = null;
        let repeatTimer = null;
        let activePointerId = null;

        const clear = () => {
            clearTimeout(holdTimer);
            clearInterval(repeatTimer);
            holdTimer = null;
            repeatTimer = null;
            if (activePointerId !== null && contextualFigureId) {
                window.denxEndFigureTransform?.(contextualFigureId);
            }
            activePointerId = null;
        };

        button.addEventListener("contextmenu", event => event.preventDefault());
        button.addEventListener("pointerdown", event => {
            if (!contextualFigureId || activePointerId !== null) return;
            activePointerId = event.pointerId;
            button.setPointerCapture?.(event.pointerId);
            event.preventDefault();
            window.denxBeginFigureTransform?.(contextualFigureId);
            applyContextualFigureScale(factor, true);

            holdTimer = setTimeout(() => {
                let ticks = 0;
                repeatTimer = setInterval(() => {
                    ticks += 1;
                    const accelerated = ticks > 12
                        ? (factor > 1 ? 1.14 : 0.86)
                        : factor;
                    applyContextualFigureScale(accelerated, true);
                }, 85);
            }, 330);
        });
        button.addEventListener("pointerup", clear);
        button.addEventListener("pointercancel", clear);
        button.addEventListener("lostpointercapture", clear);
    }

    bindScaleHold(figureScaleDownBtn, 0.90);
    bindScaleHold(figureScaleUpBtn, 1.10);

    function applyFigureFlip(axis) {
        if (!contextualFigureId) return;
        if (window.denxFlipFigure?.(contextualFigureId, axis)) {
            if (axis === "z") {
                contextualFigureRotation = ((contextualFigureRotation + 180 + 540) % 360) - 180;
                if (figureRotateDisplay) figureRotateDisplay.textContent = `${contextualFigureRotation}°`;
            }
        }
    }

    figureFlipXBtn?.addEventListener("click", () => applyFigureFlip("x"));
    figureFlipYBtn?.addEventListener("click", () => applyFigureFlip("y"));
    figureFlipZBtn?.addEventListener("click", () => applyFigureFlip("z"));

    function rotateContextualFigure(degrees, live = false) {
        if (!contextualFigureId) return false;
        const worked = live
            ? window.denxRotateFigureLive?.(contextualFigureId, degrees)
            : window.denxRotateFigure?.(contextualFigureId, degrees);
        if (!worked) return false;
        contextualFigureRotation += degrees;
        contextualFigureRotation = ((contextualFigureRotation + 540) % 360) - 180;
        if (figureRotateDisplay) figureRotateDisplay.textContent = `${contextualFigureRotation}°`;
        return true;
    }

    function bindRotateHold(button, degrees) {
        if (!button) return;
        let holdTimer = null;
        let repeatTimer = null;
        let activePointerId = null;

        const clear = () => {
            clearTimeout(holdTimer);
            clearInterval(repeatTimer);
            holdTimer = null;
            repeatTimer = null;
            if (activePointerId !== null && contextualFigureId) {
                window.denxEndFigureTransform?.(contextualFigureId);
            }
            activePointerId = null;
        };

        button.addEventListener("contextmenu", event => event.preventDefault());
        button.addEventListener("pointerdown", event => {
            if (!contextualFigureId || activePointerId !== null) return;
            activePointerId = event.pointerId;
            button.setPointerCapture?.(event.pointerId);
            event.preventDefault();
            window.denxBeginFigureTransform?.(contextualFigureId);
            rotateContextualFigure(degrees, true);

            holdTimer = setTimeout(() => {
                repeatTimer = setInterval(() => {
                    rotateContextualFigure(degrees, true);
                }, 75);
            }, 320);
        });
        button.addEventListener("pointerup", clear);
        button.addEventListener("pointercancel", clear);
        button.addEventListener("lostpointercapture", clear);
    }

    bindRotateHold(figureRotateLeftBtn, -5);
    bindRotateHold(figureRotateRightBtn, 5);

    figureMoveFrontBtn?.addEventListener("click", () => {
        if (!contextualFigureId) return;
        if (!window.denxMoveFigureLayer?.(contextualFigureId, "front")) {
            showToast("Figure is already at the front.");
        }
    });

    figureMoveBackBtn?.addEventListener("click", () => {
        if (!contextualFigureId) return;
        if (!window.denxMoveFigureLayer?.(contextualFigureId, "back")) {
            showToast("Figure is already at the back.");
        }
    });

    figureDeleteBtn?.addEventListener("click", () => {
        if (!contextualFigureId) return;
        if (window.denxDeleteFigure?.(contextualFigureId)) {
            showToast("Figure deleted — Undo is available.");
        }
    });

    figureEditBtn?.addEventListener("click", () => {
        if (!contextualFigureId) return;
        const definition = window.denxFigureDefinitionForEdit?.(contextualFigureId);
        const timelineSession = window.denxTimelineCaptureSession?.();
        if (!definition || !timelineSession) {
            showToast("Could not open Figure Creator.");
            return;
        }
        try {
            window.denxSaveWorkspaceHandoff?.("figure-edit");
        } catch (_) {}
        sessionStorage.setItem("denx.figureEditPayload", JSON.stringify({
            figureId: contextualFigureId,
            definition,
            timelineSession
        }));
        window.location.href = "figure-creator.html";
    });

    // --------------------------------------------------------
    // Text object contextual toolbar
    // --------------------------------------------------------

    function syncTextRail(detail) {
        const visible = !!detail?.id;
        contextualTextId = visible ? detail.id : null;
        textActionsRail?.classList.toggle("hidden", !visible);
        textActionsRail?.setAttribute("aria-hidden", visible ? "false" : "true");

        if (!visible) return;

        figureActionsRail?.classList.add("hidden");
        figureActionsRail?.setAttribute("aria-hidden", "true");
        contextualFigureId = null;

        if (textContentInput && textContentInput.value !== String(detail.text ?? "")) {
            textContentInput.value = String(detail.text ?? "");
        }
        if (textFontSelect) textFontSelect.value = detail.font || "system-ui, sans-serif";
        if (textColorInput && /^#[0-9a-f]{6}$/i.test(detail.color || "")) {
            textColorInput.value = detail.color;
        }
        if (textScaleDisplay) {
            textScaleDisplay.textContent = `${Math.round((Number(detail.scale) || 1) * 100)}%`;
        }
    }

    window.addEventListener("denx:textselectionchange", event => {
        syncTextRail(event.detail);
    });

    textContentInput?.addEventListener("input", event => {
        if (!contextualTextId) return;
        window.denxPatchSelectedText?.({ text: event.target.value });
    });

    textFontSelect?.addEventListener("change", event => {
        if (!contextualTextId) return;
        window.denxPatchSelectedText?.({ font: event.target.value });
    });

    textColorInput?.addEventListener("input", event => {
        if (!contextualTextId) return;
        window.denxPatchSelectedText?.({ color: event.target.value });
    });

    function bindTextScaleHold(button, factor) {
        if (!button) return;
        let holdTimer = null;
        let repeatTimer = null;
        let activePointerId = null;

        const apply = () => {
            if (!contextualTextId) return;
            window.denxScaleSelectedText?.(factor);
        };

        const clear = () => {
            clearTimeout(holdTimer);
            clearInterval(repeatTimer);
            holdTimer = null;
            repeatTimer = null;
            activePointerId = null;
        };

        button.addEventListener("contextmenu", event => event.preventDefault());
        button.addEventListener("pointerdown", event => {
            if (!contextualTextId || activePointerId !== null) return;
            activePointerId = event.pointerId;
            button.setPointerCapture?.(event.pointerId);
            event.preventDefault();
            apply();
            holdTimer = setTimeout(() => {
                repeatTimer = setInterval(apply, 85);
            }, 330);
        });
        button.addEventListener("pointerup", clear);
        button.addEventListener("pointercancel", clear);
        button.addEventListener("lostpointercapture", clear);
    }

    bindTextScaleHold(textScaleDownBtn, 0.90);
    bindTextScaleHold(textScaleUpBtn, 1.10);

    textDeleteBtn?.addEventListener("click", () => {
        if (window.denxDeleteSelectedText?.()) {
            showToast("Text deleted.");
        }
    });

    // Playback should reveal the animation controls automatically.
    const playBtn = document.getElementById("playBtn");
    const animationSection = document.getElementById("tool-animation");

    playBtn?.addEventListener("click", () => {
        if (!toolbox || !animationSection) return;
        requestAnimationFrame(() => {
            toolbox.scrollTo({
                top: Math.max(0, animationSection.offsetTop - 6),
                behavior: "smooth"
            });
            setActiveQuickLink("animation");
        });
    });

    // Figure Creator returns through sessionStorage so the animation timeline is
    // restored before applying the edited structure to the original instance.
    setTimeout(() => {
        const raw = sessionStorage.getItem("denx.figureEditReturn");
        if (!raw) return;
        sessionStorage.removeItem("denx.figureEditReturn");
        try {
            const handoff = JSON.parse(raw);
            if (handoff.timelineSession) {
                window.denxTimelineRestoreSession?.(handoff.timelineSession);
            }
            if (handoff.figureId && handoff.definition) {
                window.denxApplyEditedFigureDefinition?.(handoff.figureId, handoff.definition);
                showToast(`${handoff.definition.name || "Figure"} updated ✓`);
            }
        } catch (error) {
            console.error("DenX figure edit return failed:", error);
            showToast("Figure edit could not be restored.");
        }
    }, 0);

    renderProjectFigures();
    updateQuickFindFromScroll();
})();
