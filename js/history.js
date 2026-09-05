// =========================
// UNDO / REDO
// =========================

// History for every frame
let frameHistory = {
    1: {
        undo: [],
        redo: []
    }
};

let frameCount = 1;
let currentFrame = 1;


const undoBtn = document.getElementById("undoBtn");
const redoBtn = document.getElementById("redoBtn");

function getHistory(){

    if(!frameHistory[currentFrame]){

        frameHistory[currentFrame] = {

            undo: [],
            redo: []

        };

    }

    return frameHistory[currentFrame];

}

if(undoBtn){

    undoBtn.onclick = ()=>{

    if (window.denxUndoTimelineAction && window.denxUndoTimelineAction()) {
        return;
    }

    if (window.denxUndoBoneAction && window.denxUndoBoneAction()) {
        return;
    }

    const history = getHistory();

    if(history.undo.length <= 1) return;

    history.redo.push(history.undo.pop());

    const img = new Image();

    img.onload = ()=>{

        ctx.clearRect(0,0,canvas.width,canvas.height);

        ctx.drawImage(img,0,0);

        saveCurrentFrame();

    };

    img.src = history.undo[history.undo.length-1];

};

}

if(redoBtn){

    redoBtn.onclick = ()=>{

    if (window.denxRedoTimelineAction && window.denxRedoTimelineAction()) {
        return;
    }

    if (window.denxRedoBoneAction && window.denxRedoBoneAction()) {
        return;
    }

    const history = getHistory();

    if(history.redo.length === 0) return;

    const state = history.redo.pop();

    history.undo.push(state);

    const img = new Image();

    img.onload = ()=>{

        ctx.clearRect(0,0,canvas.width,canvas.height);

        ctx.drawImage(img,0,0);

        saveCurrentFrame();

    };

    img.src = state;

};

}
