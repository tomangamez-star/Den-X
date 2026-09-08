(() => {
  const openBtn = document.getElementById("openProject");
  const newBtn = document.getElementById("newProject");
  const settingsBtn = document.getElementById("settings");
  const list = document.getElementById("recentProjectList");

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

  function escapeHtml(value) {
    return String(value).replace(/[&<>'"]/g, ch => ({
      "&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"
    }[ch]));
  }

  function projectCard(project, compact = false) {
    const row = document.createElement("button");
    row.type = "button";
    row.className = `denx-project-card${compact ? " compact" : ""}`;
    const frameCount =
      project.snapshot?.timeline?.frameCount ||
      project.snapshot?.timeline?.frames?.length ||
      1;

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

  function render() {
    const projects = DenXProjectStore.listProjects();
    if (!list) return;
    list.innerHTML = "";
    if (!projects.length) {
      list.innerHTML = '<div class="denx-empty-projects">No saved projects yet.</div>';
      return;
    }
    projects.slice(0, 3).forEach(project =>
      list.appendChild(projectCard(project, true))
    );
  }

  newBtn && (newBtn.onclick = () => {
    window.location.href = "project.html";
  });

  openBtn && (openBtn.onclick = () => {
    window.location.href = "open-project.html";
  });

  settingsBtn && (settingsBtn.onclick = () => {
    sessionStorage.setItem("denx.settingsReturn", "index.html");
    window.location.href = "settings.html";
  });

  render();
})();
