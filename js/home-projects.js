(() => {
  const openBtn = document.getElementById("openProject");
  const newBtn = document.getElementById("newProject");
  const settingsBtn = document.getElementById("settings");
  const list = document.getElementById("recentProjectList");
  const openDialog = document.getElementById("openProjectsDialog");
  const openList = document.getElementById("openProjectsList");
  const closeOpen = document.getElementById("closeOpenProjectsBtn");
  const settingsDialog = document.getElementById("projectSettingsDialog");
  const closeSettings = document.getElementById("closeProjectSettingsBtn");
  const autoSaveToggle = document.getElementById("autoSaveToggle");
  const saveReminderToggle = document.getElementById("saveReminderToggle");
  const saveIntervalSelect = document.getElementById("saveIntervalSelect");

  function ageLabel(timestamp) {
    const diff = Math.max(0, Date.now() - Number(timestamp || Date.now()));
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return "just now";
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }

  function projectCard(project, compact = false) {
    const row = document.createElement("button");
    row.type = "button";
    row.className = `denx-project-card${compact ? " compact" : ""}`;
    const frameCount = project.snapshot?.timeline?.frameCount || project.snapshot?.timeline?.frames?.length || 1;
    row.innerHTML = `
      <span class="denx-project-thumb" aria-hidden="true">◇</span>
      <span class="denx-project-copy">
        <strong>${escapeHtml(project.name)}</strong>
        <small>${project.width}×${project.height} · ${project.fps || 24} FPS · ${frameCount} frame${frameCount === 1 ? "" : "s"}</small>
        <small>Edited ${ageLabel(project.updatedAt)}</small>
      </span>`;
    row.addEventListener("click", () => {
      DenXProjectStore.setActiveProject(project.id);
      window.location.href = "workspace.html";
    });
    return row;
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>'"]/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[ch]));
  }

  function render() {
    const projects = DenXProjectStore.listProjects();
    if (list) {
      list.innerHTML = "";
      if (!projects.length) list.innerHTML = '<div class="denx-empty-projects">No saved projects yet.</div>';
      projects.slice(0, 3).forEach(project => list.appendChild(projectCard(project, true)));
    }
    if (openList) {
      openList.innerHTML = "";
      if (!projects.length) openList.innerHTML = '<div class="denx-empty-projects">Create your first project to see it here.</div>';
      projects.forEach(project => openList.appendChild(projectCard(project)));
    }
  }

  newBtn && (newBtn.onclick = () => window.location.href = "project.html");
  openBtn && (openBtn.onclick = () => {
    render();
    if (typeof openDialog?.showModal === "function") openDialog.showModal();
    else openDialog?.setAttribute("open", "");
  });
  closeOpen?.addEventListener("click", () => openDialog?.close?.());

  function hydrateSettings() {
    const settings = DenXProjectStore.getSettings();
    if (autoSaveToggle) autoSaveToggle.checked = settings.autoSave;
    if (saveReminderToggle) saveReminderToggle.checked = settings.saveReminder;
    if (saveIntervalSelect) saveIntervalSelect.value = String(settings.intervalMinutes);
  }

  function persistSettings() {
    DenXProjectStore.saveSettings({
      autoSave: autoSaveToggle?.checked,
      saveReminder: saveReminderToggle?.checked,
      intervalMinutes: Number(saveIntervalSelect?.value || 10)
    });
  }

  settingsBtn && (settingsBtn.onclick = () => {
    hydrateSettings();
    if (typeof settingsDialog?.showModal === "function") settingsDialog.showModal();
    else settingsDialog?.setAttribute("open", "");
  });
  [autoSaveToggle, saveReminderToggle, saveIntervalSelect].forEach(el => el?.addEventListener("change", persistSettings));
  closeSettings?.addEventListener("click", () => {
    persistSettings();
    settingsDialog?.close?.();
  });

  render();
})();
