(() => {
  const back = document.getElementById("openBackBtn");
  const list = document.getElementById("nativeOpenProjectList");
  const count = document.getElementById("openProjectCount");

  const escapeHtml = value => String(value).replace(/[&<>'"]/g, ch => ({
    "&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"
  }[ch]));

  function ageLabel(timestamp) {
    const diff = Math.max(0, Date.now() - Number(timestamp || Date.now()));
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return "just now";
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  }

  function card(project) {
    const frameCount =
      project.snapshot?.timeline?.frameCount ||
      project.snapshot?.timeline?.frames?.length ||
      1;

    const button = document.createElement("button");
    button.type = "button";
    button.className = "denx-native-project-card";
    button.innerHTML = `
      <span class="denx-native-project-mark" aria-hidden="true">◇</span>
      <span class="denx-native-project-copy">
        <strong>${escapeHtml(project.name)}</strong>
        <small>${project.width}×${project.height} · ${project.fps || 24} FPS · ${frameCount} frame${frameCount === 1 ? "" : "s"}</small>
        <small>Edited ${ageLabel(project.updatedAt)}</small>
      </span>
      <span class="denx-native-project-open">OPEN</span>`;

    button.addEventListener("click", () => {
      DenXProjectStore.setActiveProject(project.id);
      window.location.href = "workspace.html";
    });

    return button;
  }

  function render() {
    const projects = DenXProjectStore.listProjects();
    if (count) count.textContent = String(projects.length);
    if (!list) return;

    list.innerHTML = "";
    if (!projects.length) {
      list.innerHTML = `
        <div class="denx-native-empty">
          <strong>No projects yet.</strong>
          <span>Create your first animation from the Home screen.</span>
        </div>`;
      return;
    }

    projects.forEach(project => list.appendChild(card(project)));
  }

  back?.addEventListener("click", () => {
    window.location.href = "index.html";
  });

  render();
})();
