console.log("DenX Animator has started.");

// HOME SCREEN
const newBtn = document.getElementById("newProject");

if (newBtn) {
    newBtn.onclick = () => {
        window.location.href = "project.html";
    };
}

// PROJECT SCREEN
const backBtn = document.getElementById("backBtn");

if (backBtn) {
    backBtn.onclick = () => {
        window.location.href = "index.html";
    };
}

const createBtn = document.getElementById("createBtn");

if (createBtn) {
    createBtn.onclick = () => {
        window.location.href = "workspace.html";
    };
}

// WORKSPACE
const workspaceBack = document.getElementById("workspaceBack");

if (workspaceBack) {
    workspaceBack.onclick = () => {
        window.location.href = "index.html";
    };
}







