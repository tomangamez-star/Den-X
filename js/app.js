console.log("DenX Animator has started.");

// v0.3.3+ Quick Deck visual patch loader.
(function loadDenxQuickDeckPolish(){
    if (!document.querySelector('link[data-denx-v033]')) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'css/v0.3.3-quickdeck.css';
        link.dataset.denxV033 = 'true';
        document.head.appendChild(link);
    }

    const copyBtn = document.getElementById('copyFrameBtn');
    if (copyBtn) {
        copyBtn.title = 'Copy frame';
        copyBtn.setAttribute('aria-label', 'Copy frame');
        const img = copyBtn.querySelector('img');
        if (img) img.src = 'icons/ui/copy.svg';
    }

    const pasteBtn = document.getElementById('pasteFrameBtn');
    if (pasteBtn) {
        pasteBtn.title = 'Paste frame';
        pasteBtn.setAttribute('aria-label', 'Paste frame');
        const img = pasteBtn.querySelector('img');
        if (img) img.src = 'icons/ui/paste.svg';
    }

    const footer = document.querySelector('#appFooter p');
    if (footer) footer.textContent = 'Version 0.3.5 Stability';
})();

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
