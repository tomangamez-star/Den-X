(() => {
  const PROJECTS_KEY = "denx.projects.v1";
  const ACTIVE_KEY = "denx.activeProjectId";
  const SETTINGS_KEY = "denx.projectSettings.v1";

  const clone = value => JSON.parse(JSON.stringify(value));
  const uid = prefix => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

  function readProjects() {
    try {
      const parsed = JSON.parse(localStorage.getItem(PROJECTS_KEY) || "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch (_) {
      return [];
    }
  }

  function writeProjects(items) {
    localStorage.setItem(PROJECTS_KEY, JSON.stringify(items));
  }

  function listProjects() {
    return clone(readProjects().sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0)));
  }

  function getProject(id) {
    if (!id) return null;
    const found = readProjects().find(project => project.id === id);
    return found ? clone(found) : null;
  }

  function createProject(input = {}) {
    const now = Date.now();
    const name = String(input.name || "Untitled Project").trim() || "Untitled Project";
    const width = Math.max(1, Number(input.width) || 1920);
    const height = Math.max(1, Number(input.height) || 1080);
    const fps = Math.max(1, Math.min(60, Number(input.fps) || 24));
    const project = {
      id: uid("project"),
      version: 1,
      name,
      width,
      height,
      fps,
      createdAt: now,
      updatedAt: now,
      snapshot: null
    };
    const projects = readProjects();
    projects.unshift(project);
    writeProjects(projects);
    setActiveProject(project.id);
    return clone(project);
  }

  function saveProject(project) {
    if (!project?.id) throw new Error("Project id is missing.");
    const projects = readProjects();
    const index = projects.findIndex(item => item.id === project.id);
    const next = {
      ...(index >= 0 ? projects[index] : {}),
      ...clone(project),
      updatedAt: Date.now()
    };
    if (index >= 0) projects[index] = next;
    else projects.unshift(next);
    writeProjects(projects);
    return clone(next);
  }

  function deleteProject(id) {
    const projects = readProjects().filter(project => project.id !== id);
    writeProjects(projects);
    if (getActiveProjectId() === id) localStorage.removeItem(ACTIVE_KEY);
  }

  function setActiveProject(id) {
    if (id) localStorage.setItem(ACTIVE_KEY, id);
    else localStorage.removeItem(ACTIVE_KEY);
  }

  function getActiveProjectId() {
    return localStorage.getItem(ACTIVE_KEY) || "";
  }

  function getActiveProject() {
    return getProject(getActiveProjectId());
  }

  function getSettings() {
    const defaults = {
      autoSave: false,
      saveReminder: true,
      intervalMinutes: 10
    };
    try {
      return {
        ...defaults,
        ...(JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}") || {})
      };
    } catch (_) {
      return defaults;
    }
  }

  function saveSettings(settings) {
    const clean = {
      autoSave: !!settings.autoSave,
      saveReminder: !!settings.saveReminder,
      intervalMinutes: [5, 10, 15, 30].includes(Number(settings.intervalMinutes))
        ? Number(settings.intervalMinutes)
        : 10
    };
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(clean));
    return clone(clean);
  }

  window.DenXProjectStore = {
    listProjects,
    getProject,
    createProject,
    saveProject,
    deleteProject,
    setActiveProject,
    getActiveProjectId,
    getActiveProject,
    getSettings,
    saveSettings
  };
})();
