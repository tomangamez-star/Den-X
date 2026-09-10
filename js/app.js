console.log("DenX Animator has started.");


(function loadDenx0400VideoExport(){
    if (
        document.getElementById('workspace') &&
        !document.querySelector('script[data-denx-video-v0400]')
    ) {
        const script = document.createElement('script');
        script.src = 'js/video-export.js';
        script.defer = true;
        script.dataset.denxVideoV0400 = 'true';
        document.body.appendChild(script);
    }
})();



(function loadDenx036ToolIdentity(){
    if (!document.querySelector('link[data-denx-tools-v036]')) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'css/tool-identity.css';
        link.dataset.denxToolsV036 = 'true';
        document.head.appendChild(link);
    }

    if (
        document.getElementById('workspace') &&
        !document.querySelector('script[data-denx-tools-v036]')
    ) {
        const script = document.createElement('script');
        script.src = 'js/tool-identity.js';
        script.defer = true;
        script.dataset.denxToolsV036 = 'true';
        document.body.appendChild(script);
    }
})();



(function loadDenx049SectionScroll(){
    if (!document.getElementById('workspace')) return;

    if (!document.querySelector('link[data-denx-toolbox-v049]')) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'css/toolbox-rebuild-v049.css';
        link.dataset.denxToolboxV049 = 'true';
        document.head.appendChild(link);
    }

    if (!document.querySelector('script[data-denx-toolbox-v049]')) {
        const script = document.createElement('script');
        script.src = 'js/toolbox-rebuild-v049.js';
        script.dataset.denxToolboxV049 = 'true';
        document.body.appendChild(script);
    }

    if (!document.querySelector('script[data-denx-segment-tools-v049]')) {
        const script = document.createElement('script');
        script.src = 'js/segment-tools-v049.js';
        script.dataset.denxSegmentToolsV049 = 'true';
        document.body.appendChild(script);
    }
})();

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
    if (footer) footer.textContent = 'Version 0.4.9';
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


function loadDenx042NodeInteraction() {
  if (!document.getElementById("workspace")) return;
  if (document.querySelector('script[data-denx-node-v042]')) return;
  const script = document.createElement("script");
  script.src = "js/node-interaction-v042.js";
  script.dataset.denxNodeV042 = "1";
  document.body.appendChild(script);
}

window.addEventListener('load', () => setTimeout(loadDenx042NodeInteraction, 0));


function loadDenx044FigureCopyPaste() {
  if (!document.getElementById("workspace")) return;
  if (document.querySelector('script[data-denx-figure-copy-v044]')) return;
  const script = document.createElement("script");
  script.src = "js/figure-copy-paste-v044.js";
  script.dataset.denxFigureCopyV044 = "1";
  document.body.appendChild(script);
}
window.addEventListener('load', () => setTimeout(loadDenx044FigureCopyPaste, 0));
