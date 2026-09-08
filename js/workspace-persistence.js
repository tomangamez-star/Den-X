(() => {
  const HANDOFF_KEY = "denx.workspaceHandoff.v2";
  const NEW_FIGURE_KEY = "denx.figureCreatedReturn";
  const PROJECT_STORE = () => window.DenXProjectStore;

  let activeProject = null;
  let lastSaveAt = Date.now();
  let reminderShownAt = 0;
  let restoreComplete = false;

  const clone = value => JSON.parse(JSON.stringify(value));
  const toast = message => {
    const el = document.getElementById("denxToast");
    if (!el) return;
    el.textContent = message;
    el.classList.add("show");
    clearTimeout(el.__denxTimer);
    el.__denxTimer = setTimeout(() => el.classList.remove("show"), 1900);
  };

  function captureWorkspaceSnapshot() {
    const timeline = window.denxTimelineCaptureSession?.() || null;
    const texts = window.denxCaptureTextObjects?.() || [];
    const projectFigures = window.DenXFigureLibrary?.getProjectFigures?.() || [];
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
        background: document.getElementById("backgroundColorControl")?.value || "#ffffff",
        drawColor: document.getElementById("drawColorControl")?.value || "#000000",
        fps: Number(document.getElementById("animationFpsInput")?.value || activeProject?.fps || 24),
        loop: !!document.getElementById("animationLoopToggle")?.checked,
        onion: !!document.getElementById("onionSkinBtn")?.classList.contains("active"),
        onionPrev: !!document.getElementById("onionPrevToggle")?.checked,
        onionNext: !!document.getElementById("onionNextToggle")?.checked,
        onionOpacity: Number(document.getElementById("onionOpacityInput")?.value || 0.28)
      }
    };
  }

  function refreshProjectFigureUi() {
    window.denxRenderProjectFigures?.();
    window.denxHydrateFigureBrowser?.();
  }

  function restoreWorkspaceSnapshot(snapshot) {
    if (!snapshot) return false;

    if (snapshot.projectFigures && window.DenXFigureLibrary?.setProjectFigures) {
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
    if (onionPrev && typeof ui.onionPrev === "boolean") onionPrev.checked = ui.onionPrev;
    if (onionNext && typeof ui.onionNext === "boolean") onionNext.checked = ui.onionNext;
    if (onionOpacity && Number.isFinite(Number(ui.onionOpacity))) {
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
      activeProject = store.createProject({ name: "Untitled Project", width: 1920, height: 1080, fps: 24 });
    }
    if (isFreshNewProject && window.DenXFigureLibrary?.setProjectFigures) {
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
    return activeProject;
  }

  function saveProject({ silent = false } = {}) {
    const store = PROJECT_STORE();
    if (!store) return null;
    if (!activeProject) ensureActiveProject();
    activeProject = store.saveProject({
      ...activeProject,
      fps: Number(document.getElementById("animationFpsInput")?.value || activeProject.fps || 24),
      snapshot: captureWorkspaceSnapshot()
    });
    lastSaveAt = Date.now();
    reminderShownAt = 0;
    const state = document.getElementById("workspaceSaveState");
    if (state) state.textContent = "Saved";
    if (!silent) toast(`${activeProject.name} saved ✓`);
    return activeProject;
  }

  function saveWorkspaceHandoff(reason = "creator") {
    const payload = {
      reason,
      projectId: activeProject?.id || PROJECT_STORE()?.getActiveProjectId?.() || "",
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
      if (definition && window.DenXFigureLibrary?.importToProject) {
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
        if (!handoff.projectId || handoff.projectId === activeProject.id) {
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
    const state = document.getElementById("workspaceSaveState");
    if (state) state.textContent = activeProject?.snapshot ? "Saved" : "New";
  }

  function startSaveClock() {
    setInterval(() => {
      if (!restoreComplete) return;
      const settings = PROJECT_STORE()?.getSettings?.();
      if (!settings) return;
      const intervalMs = Math.max(1, Number(settings.intervalMinutes) || 10) * 60000;
      const elapsed = Date.now() - lastSaveAt;
      if (elapsed < intervalMs) return;
      if (settings.autoSave) {
        saveProject({ silent: true });
        toast("Auto-saved ✓");
        return;
      }
      if (settings.saveReminder && Date.now() - reminderShownAt >= intervalMs) {
        reminderShownAt = Date.now();
        toast(`Save reminder — ${settings.intervalMinutes} minutes since your last save.`);
      }
    }, 30000);
  }

  window.denxCaptureWorkspaceSnapshot = captureWorkspaceSnapshot;
  window.denxRestoreWorkspaceSnapshot = restoreWorkspaceSnapshot;
  window.denxSaveCurrentProject = saveProject;
  window.denxSaveWorkspaceHandoff = saveWorkspaceHandoff;
  window.denxGetActiveProject = () => activeProject ? clone(activeProject) : null;

  document.getElementById("workspaceSaveBtn")?.addEventListener("click", () => saveProject());
  document.getElementById("workspaceHomeBtn")?.addEventListener("click", () => {
    window.location.href = "index.html";
  });

  restoreInitialState();
  startSaveClock();
})();

// Workspace Project Settings panel — project controls live in the left toolbox,
// keeping the frame/playback cluster focused only on animation controls.
(() => {
  const btn = document.getElementById("workspaceSettingsBtn");
  const dialog = document.getElementById("workspaceProjectSettingsDialog");
  const close = document.getElementById("closeWorkspaceProjectSettingsBtn");
  const auto = document.getElementById("workspaceAutoSaveToggle");
  const reminder = document.getElementById("workspaceSaveReminderToggle");
  const interval = document.getElementById("workspaceSaveIntervalSelect");
  if (!btn || !dialog || !window.DenXProjectStore) return;

  const hydrate = () => {
    const settings = DenXProjectStore.getSettings();
    if (auto) auto.checked = !!settings.autoSave;
    if (reminder) reminder.checked = !!settings.saveReminder;
    if (interval) interval.value = String(settings.intervalMinutes || 10);
  };
  const persist = () => DenXProjectStore.saveSettings({
    autoSave: !!auto?.checked,
    saveReminder: !!reminder?.checked,
    intervalMinutes: Number(interval?.value || 10)
  });
  btn.addEventListener("click", () => {
    hydrate();
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
  });
  close?.addEventListener("click", () => dialog.close?.());
  auto?.addEventListener("change", persist);
  reminder?.addEventListener("change", persist);
  interval?.addEventListener("change", persist);
})();
