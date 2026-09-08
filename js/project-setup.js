(() => {
  const nameInput = document.getElementById("projectNameInput");
  const preset = document.getElementById("projectCanvasPreset");
  const fpsInput = document.getElementById("projectFpsInput");
  const createBtn = document.getElementById("createBtn");
  const errorEl = document.getElementById("projectSetupError");
  const backBtn = document.getElementById("backBtn");

  backBtn && (backBtn.onclick = () => window.location.href = "index.html");

  createBtn && (createBtn.onclick = () => {
    const name = String(nameInput?.value || "").trim();
    if (!name) {
      if (errorEl) errorEl.textContent = "Give the project a name first.";
      nameInput?.focus();
      return;
    }
    const [width, height] = String(preset?.value || "1920x1080").split("x").map(Number);
    const project = DenXProjectStore.createProject({
      name,
      width,
      height,
      fps: Number(fpsInput?.value || 24)
    });
    sessionStorage.setItem("denx.newProjectId", project.id);
    window.location.href = "workspace.html";
  });
})();
