(() => {
  const HANDOFF_KEY = "denx.workspaceHandoff.v2";
  const NEW_FIGURE_KEY = "denx.figureCreatedReturn";
  const PROJECT_STORE = () => window.DenXProjectStore;

  let activeProject = null;
  let lastSaveAt = Date.now();
  let reminderShownAt = 0;
  let restoreComplete = false;
  let savedSnapshotSignature = "";
  let workspaceDirty = false;

  const clone = value => JSON.parse(JSON.stringify(value));

  function ensureStabilityCss() {
    if (document.querySelector('link[data-denx-stability="034"]')) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "css/v0.3.4-stability.css";
    link.dataset.denxStability = "034";
    document.head.appendChild(link);
  }

  function toast(message) {
    const el = document.getElementById("denxToast");
    if (!el) return;
    el.textContent = message;
    el.classList.add("show");
    clearTimeout(el.__denxTimer);
    el.__denxTimer = setTimeout(() => el.classList.remove("show"), 1900);
  }

  function captureWorkspaceSnapshot() {
    const timeline = window.denxTimelineCaptureSession?.() || null;
    const texts = window.denxCaptureTextObjects?.() || [];
    const projectFigures =
      window.DenXFigureLibrary?.getProjectFigures?.() || [];

    const cameraNavigation = window.denxCameraState ? {
      x: Number(window.denxCameraState.x) || 0,
      y: Number(window.denxCameraState.y) || 0,
      zoom: Number(window.denxCameraState.zoom) || 1
    } : null;

    return {
      version: 2,
      timeline,
      texts,
      projectFigures,
      cameraNavigation,
      ui: {
        background:
          document.getElementById("backgroundColorControl")?.value ||
          "#ffffff",
        drawColor:
          document.getElementById("drawColorControl")?.value ||
          "#000000",
        fps: Number(
          document.getElementById("animationFpsInput")?.value ||
          activeProject?.fps ||
          24
        ),
        loop:
          !!document.getElementById("animationLoopToggle")?.checked,
        onion:
          !!document.getElementById("onionSkinBtn")?.classList.contains("active"),
        onionPrev:
          !!document.getElementById("onionPrevToggle")?.checked,
        onionNext:
          !!document.getElementById("onionNextToggle")?.checked,
        onionOpacity: Number(
          document.getElementById("onionOpacityInput")?.value || 0.28
        )
      }
    };
  }

  function snapshotSignature(snapshot) {
    try {
      return JSON.stringify(snapshot || null);
    } catch (_) {
      return "";
    }
  }

  function refreshProjectFigureUi() {
    window.denxRenderProjectFigures?.();
    window.denxHydrateFigureBrowser?.();
  }

  function restoreWorkspaceSnapshot(snapshot) {
    if (!snapshot) return false;

    if (
      snapshot.projectFigures &&
      window.DenXFigureLibrary?.setProjectFigures
    ) {
      window.DenXFigureLibrary.setProjectFigures(snapshot.projectFigures);
    }

    if (snapshot.timeline) {
      window.denxTimelineRestoreSession?.(clone(snapshot.timeline));
    }

    if (Array.isArray(snapshot.texts)) {
      window.denxRestoreTextObjects?.(clone(snapshot.texts));
    }

    const ui = snapshot.ui || {};
    const background = document.getElementById("backgroundColorControl");
    const drawColor = document.getElementById("drawColorControl");
    const fps = document.getElementById("animationFpsInput");
    const loop = document.getElementById("animationLoopToggle");
    const onionPrev = document.getElementById("onionPrevToggle");
    const onionNext = document.getElementById("onionNextToggle");
    const onionOpacity = document.getElementById("onionOpacityInput");

    if (background && ui.background) {
      background.value = ui.background;
      background.dispatchEvent(new Event("input", { bubbles: true }));
    }

    if (drawColor && ui.drawColor) {
      drawColor.value = ui.drawColor;
      drawColor.dispatchEvent(new Event("input", { bubbles: true }));
    }

    if (fps && ui.fps) {
      fps.value = String(ui.fps);
      fps.dispatchEvent(new Event("change", { bubbles: true }));
    }

    if (loop && typeof ui.loop === "boolean") loop.checked = ui.loop;
    if (onionPrev && typeof ui.onionPrev === "boolean")
      onionPrev.checked = ui.onionPrev;
    if (onionNext && typeof ui.onionNext === "boolean")
      onionNext.checked = ui.onionNext;

    if (
      onionOpacity &&
      Number.isFinite(Number(ui.onionOpacity))
    ) {
      onionOpacity.value = String(ui.onionOpacity);
      onionOpacity.dispatchEvent(new Event("input", { bubbles: true }));
    }

    if (snapshot.cameraNavigation && window.denxCameraState) {
      Object.assign(window.denxCameraState, snapshot.cameraNavigation);
      window.denxRefreshCamera?.();
    }

    refreshProjectFigureUi();
    return true;
  }

  function ensureProjectIdentityUi() {
    const section = document.getElementById("tool-project");
    if (!section) return;

    let card = document.getElementById("denxSidebarProjectIdentity");
    if (!card) {
      card = document.createElement("div");
      card.id = "denxSidebarProjectIdentity";
      card.className = "denx-sidebar-project-identity";
      card.setAttribute("aria-label", "Current project");

      card.innerHTML = `
        <strong id="denxSidebarProjectName">Untitled Project</strong>
        <span class="denx-sidebar-save-state">
          <i aria-hidden="true"></i>
          <span id="denxSidebarSaveState">New</span>
        </span>`;

      const title = section.querySelector(".tool-section-title");
      title?.after(card);
    }

    const name = document.getElementById("denxSidebarProjectName");
    if (name) {
      name.textContent = activeProject?.name || "Untitled Project";
      name.title = activeProject?.name || "Untitled Project";
    }

    syncProjectStateLabel();
  }

  function markWorkspaceDirty() {
    if (!restoreComplete) return;
    workspaceDirty = true;
    syncProjectStateLabel("Unsaved");
  }

  function syncProjectStateLabel(forced = null) {
    const topState = document.getElementById("workspaceSaveState");
    const sidebarState =
      document.getElementById("denxSidebarSaveState");

    const value =
      forced ||
      topState?.textContent ||
      (activeProject?.snapshot ? "Saved" : "New");

    if (topState) topState.textContent = value;
    if (sidebarState) sidebarState.textContent = value;

    const card = document.getElementById("denxSidebarProjectIdentity");
    card?.setAttribute(
      "data-state",
      String(value).toLowerCase().replace(/\s+/g, "-")
    );
  }

  function ensureActiveProject() {
    const store = PROJECT_STORE();
    if (!store) return null;

    const requested = sessionStorage.getItem("denx.newProjectId");
    const isFreshNewProject = !!requested;

    if (requested) {
      sessionStorage.removeItem("denx.newProjectId");
      store.setActiveProject(requested);
    }

    activeProject = store.getActiveProject();

    if (!activeProject) {
      activeProject = store.createProject({
        name: "Untitled Project",
        width: 1920,
        height: 1080,
        fps: 24
      });
    }

    if (
      isFreshNewProject &&
      window.DenXFigureLibrary?.setProjectFigures
    ) {
      window.DenXFigureLibrary.setProjectFigures([]);
      refreshProjectFigureUi();
    }

    const title = document.getElementById("workspaceProjectTitle");
    if (title) title.textContent = activeProject.name;

    const fps = document.getElementById("animationFpsInput");
    if (!activeProject.snapshot && fps) {
      fps.value = String(activeProject.fps || 24);
      fps.dispatchEvent(new Event("change", { bubbles: true }));
    }

    ensureProjectIdentityUi();
    return activeProject;
  }

  function saveProject({ silent = false } = {}) {
    const store = PROJECT_STORE();
    if (!store) return null;
    if (!activeProject) ensureActiveProject();

    syncProjectStateLabel("Saving");
    const snapshot = captureWorkspaceSnapshot();

    activeProject = store.saveProject({
      ...activeProject,
      fps: Number(
        document.getElementById("animationFpsInput")?.value ||
        activeProject.fps ||
        24
      ),
      snapshot
    });

    savedSnapshotSignature = snapshotSignature(snapshot);
    workspaceDirty = false;
    lastSaveAt = Date.now();
    reminderShownAt = 0;
    syncProjectStateLabel("Saved");

    if (!silent) toast(`${activeProject.name} saved ✓`);
    return activeProject;
  }

  function saveWorkspaceHandoff(reason = "creator") {
    const payload = {
      reason,
      projectId:
        activeProject?.id ||
        PROJECT_STORE()?.getActiveProjectId?.() ||
        "",
      snapshot: captureWorkspaceSnapshot(),
      createdAt: Date.now()
    };

    sessionStorage.setItem(HANDOFF_KEY, JSON.stringify(payload));
    return payload;
  }

  function consumeNewFigureReturn() {
    const raw = sessionStorage.getItem(NEW_FIGURE_KEY);
    if (!raw) return;

    sessionStorage.removeItem(NEW_FIGURE_KEY);

    try {
      const definition = JSON.parse(raw);
      if (
        definition &&
        window.DenXFigureLibrary?.importToProject
      ) {
        window.DenXFigureLibrary.importToProject(definition);
        refreshProjectFigureUi();
      }
    } catch (error) {
      console.error("DenX new figure return failed:", error);
    }
  }

  function restoreInitialState() {
    ensureActiveProject();

    let restored = false;
    const raw = sessionStorage.getItem(HANDOFF_KEY);

    if (raw) {
      sessionStorage.removeItem(HANDOFF_KEY);
      try {
        const handoff = JSON.parse(raw);
        if (
          !handoff.projectId ||
          handoff.projectId === activeProject.id
        ) {
          restored = restoreWorkspaceSnapshot(handoff.snapshot);
        }
      } catch (error) {
        console.error("DenX workspace handoff restore failed:", error);
      }
    }

    if (!restored && activeProject?.snapshot) {
      restoreWorkspaceSnapshot(activeProject.snapshot);
      restored = true;
    }

    consumeNewFigureReturn();
    restoreComplete = true;
    lastSaveAt = Number(activeProject?.updatedAt || Date.now());

    savedSnapshotSignature =
      snapshotSignature(activeProject?.snapshot || null);
    workspaceDirty = false;

    syncProjectStateLabel(
      activeProject?.snapshot ? "Saved" : "New"
    );

    ensureProjectIdentityUi();
  }

  function startSaveClock() {
    setInterval(() => {
      if (!restoreComplete) return;

      const settings = PROJECT_STORE()?.getSettings?.();
      if (!settings) return;

      const intervalMs =
        Math.max(
          1,
          Number(settings.intervalMinutes) || 10
        ) * 60000;

      const elapsed = Date.now() - lastSaveAt;
      if (elapsed < intervalMs) return;

      if (settings.autoSave) {
        saveProject({ silent: true });
        toast("Auto-saved ✓");
        return;
      }

      if (
        settings.saveReminder &&
        Date.now() - reminderShownAt >= intervalMs
      ) {
        reminderShownAt = Date.now();
        toast(
          `Save reminder — ${settings.intervalMinutes} minutes since your last save.`
        );
      }
    }, 30000);
  }

  function currentWorkspaceIsDirty() {
    if (workspaceDirty) return true;
    if (!activeProject?.snapshot) return true;

    try {
      return (
        snapshotSignature(captureWorkspaceSnapshot()) !==
        savedSnapshotSignature
      );
    } catch (_) {
      return true;
    }
  }

  function ensureLeaveDialog() {
    let dialog = document.getElementById("denxLeaveProjectDialog");
    if (dialog) return dialog;

    dialog = document.createElement("dialog");
    dialog.id = "denxLeaveProjectDialog";
    dialog.className = "denx-leave-dialog";
    dialog.innerHTML = `
      <div class="denx-leave-head">
        <span class="denx-leave-kicker">DENX WORKSPACE</span>
        <strong id="denxLeaveTitle">Leave Project?</strong>
      </div>
      <p id="denxLeaveMessage"></p>
      <div id="denxLeaveActions" class="denx-leave-actions"></div>`;

    document.body.appendChild(dialog);
    return dialog;
  }

  function confirmLeave({
    destination,
    reason = "navigation",
    preserveWorkspace = false
  }) {
    const dialog = ensureLeaveDialog();
    const title = document.getElementById("denxLeaveTitle");
    const message = document.getElementById("denxLeaveMessage");
    const actions = document.getElementById("denxLeaveActions");
    const dirty = currentWorkspaceIsDirty();

    if (!actions) return;

    title.textContent = "Leave Project?";
    message.textContent = dirty
      ? "This project has changes since your last save."
      : "Your project is saved. Do you want to leave the editor?";

    actions.innerHTML = "";

    const stay = document.createElement("button");
    stay.type = "button";
    stay.className = "denx-leave-stay";
    stay.textContent = "Stay Here";
    stay.onclick = () => dialog.close?.();
    actions.appendChild(stay);

    const navigate = () => {
      if (preserveWorkspace) saveWorkspaceHandoff(reason);
      window.location.href = destination;
    };

    if (dirty) {
      const discard = document.createElement("button");
      discard.type = "button";
      discard.className = "denx-leave-discard";
      discard.textContent = "Leave Without Saving";
      discard.onclick = navigate;
      actions.appendChild(discard);

      const saveLeave = document.createElement("button");
      saveLeave.type = "button";
      saveLeave.className = "denx-leave-primary";
      saveLeave.textContent = "Save & Leave";
      saveLeave.onclick = () => {
        saveProject({ silent: true });
        if (preserveWorkspace) saveWorkspaceHandoff(reason);
        window.location.href = destination;
      };
      actions.appendChild(saveLeave);
    } else {
      const leave = document.createElement("button");
      leave.type = "button";
      leave.className = "denx-leave-primary";
      leave.textContent = "Leave";
      leave.onclick = navigate;
      actions.appendChild(leave);
    }

    if (typeof dialog.showModal === "function") {
      dialog.showModal();
    } else {
      dialog.setAttribute("open", "");
    }
  }

  // Capturing phase blocks existing direct-navigation handlers in older builds.
  document.addEventListener(
    "click",
    event => {
      const button = event.target?.closest?.(
        "#workspaceHomeBtn,#quickSettingsBtn,#createFigureBtn"
      );

      if (!button) return;

      event.preventDefault();
      event.stopImmediatePropagation();

      if (button.id === "workspaceHomeBtn") {
        confirmLeave({
          destination: "index.html",
          reason: "projects"
        });
        return;
      }

      if (button.id === "quickSettingsBtn") {
        sessionStorage.setItem(
          "denx.settingsReturn",
          "workspace.html"
        );
        confirmLeave({
          destination: "settings.html",
          reason: "settings",
          preserveWorkspace: true
        });
        return;
      }

      if (button.id === "createFigureBtn") {
        confirmLeave({
          destination: "figure-creator.html",
          reason: "figure-create",
          preserveWorkspace: true
        });
      }
    },
    true
  );

  
  // v0.3.5 — live Saved/Unsaved status.
  const dirtyControlIds = new Set([
    "addFrame",
    "removeFrameBtn",
    "backgroundColorControl",
    "drawColorControl",
    "animationFpsInput",
    "animationLoopToggle",
    "onionPrevToggle",
    "onionNextToggle",
    "onionOpacityInput",
    "figureScaleDownBtn",
    "figureScaleUpBtn",
    "figureFlipXBtn",
    "figureFlipYBtn",
    "figureFlipZBtn",
    "figureRotateLeftBtn",
    "figureRotateRightBtn",
    "figureMoveFrontBtn",
    "figureMoveBackBtn",
    "figureDeleteBtn",
    "textContentInput",
    "textFontSelect",
    "textColorInput",
    "textScaleDownBtn",
    "textScaleUpBtn",
    "textDeleteBtn"
  ]);

  document.addEventListener("change", event => {
    if (dirtyControlIds.has(event.target?.id)) markWorkspaceDirty();
  }, true);

  document.addEventListener("input", event => {
    if (dirtyControlIds.has(event.target?.id)) markWorkspaceDirty();
  }, true);

  document.addEventListener("click", event => {
    const button = event.target?.closest?.("button");
    if (button && dirtyControlIds.has(button.id)) markWorkspaceDirty();
  }, true);

  document.addEventListener("pointerup", event => {
    const target = event.target;
    if (
      target?.closest?.("#drawingCanvas") ||
      target?.closest?.("#figureLayer") ||
      target?.closest?.("#textLayer")
    ) {
      markWorkspaceDirty();
    }
  }, true);

  window.denxMarkProjectDirty = markWorkspaceDirty;

window.denxCaptureWorkspaceSnapshot = captureWorkspaceSnapshot;
  window.denxRestoreWorkspaceSnapshot = restoreWorkspaceSnapshot;
  window.denxSaveCurrentProject = saveProject;
  window.denxSaveWorkspaceHandoff = saveWorkspaceHandoff;
  window.denxGetActiveProject =
    () => activeProject ? clone(activeProject) : null;
  window.denxConfirmLeaveProject = confirmLeave;

  document
    .getElementById("workspaceSaveBtn")
    ?.addEventListener("click", () => saveProject());

  ensureStabilityCss();
  restoreInitialState();
  startSaveClock();
})();
