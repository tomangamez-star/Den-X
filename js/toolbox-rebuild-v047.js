
(() => {
  "use strict";
  const editor=document.querySelector(".editor");
  const toolbox=document.getElementById("toolbox");
  const quickFind=document.querySelector(".tool-quickfind");
  const viewport=document.getElementById("viewport");
  if(!editor||!toolbox||!quickFind||!viewport||editor.dataset.denxV047==="1")return;

  editor.dataset.denxV047="1";
  editor.classList.remove("denx-v046-shell");
  editor.classList.add("denx-v047-shell");

  const left=document.createElement("div");
  left.className="denx-v047-left";
  left.id="denxV047Left";

  const stage=document.createElement("div");
  stage.className="denx-v047-stage";
  stage.id="denxV047Stage";

  left.appendChild(toolbox);
  [
    document.getElementById("cameraProperties"),
    document.getElementById("figureActionsRail"),
    document.getElementById("textActionsRail"),
    viewport,
    editor.querySelector(".zoom-controls")
  ].filter(Boolean).forEach(n=>stage.appendChild(n));

  editor.replaceChildren(left,stage,quickFind);

  let host=toolbox.querySelector(":scope > .denx-toolbox-scroller");
  if(!host){
    host=document.createElement("div");
    host.className="denx-toolbox-scroller";
    host.id="denxToolboxScroller";
    [...toolbox.children].filter(el=>el.matches?.("[data-tool-section]")).forEach(s=>host.appendChild(s));
    toolbox.appendChild(host);
  }

  const sections=[...host.querySelectorAll("[data-tool-section]")];
  const links=[...quickFind.querySelectorAll(".quickfind-link")];

  let y=0,dragging=false,pointerId=null,startY=0,startOffset=0,lastY=0,lastT=0,velocity=0,momentumRaf=0;

  const maxScroll=()=>Math.max(0,host.scrollHeight-toolbox.clientHeight);
  const clamp=v=>Math.max(-maxScroll(),Math.min(0,v));

  function sectionOffset(section){return Math.max(0,section.offsetTop-4)}

  function syncQuickFind(){
    const marker=-y+50;
    let active=sections[0]||null;
    for(const s of sections){
      if(sectionOffset(s)<=marker)active=s;
      else break;
    }
    const name=active?.dataset.toolSection;
    links.forEach(l=>l.classList.toggle("active",l.dataset.toolTarget===name));
  }

  function apply(v){
    y=clamp(v);
    host.style.setProperty("--denx-v047-y",`${y}px`);
    syncQuickFind();
  }

  function stopMomentum(){
    if(momentumRaf)cancelAnimationFrame(momentumRaf);
    momentumRaf=0;
  }

  function animateMomentum(initialVelocity){
    stopMomentum();
    let v=initialVelocity;
    let prev=performance.now();
    const tick=now=>{
      const dt=Math.min(32,now-prev); prev=now;
      if(Math.abs(v)<0.015){momentumRaf=0;return}
      const before=y;
      apply(y+v*dt);
      if(Math.abs(y-before)<0.01){momentumRaf=0;return}
      v*=Math.pow(.94,dt/16.67);
      momentumRaf=requestAnimationFrame(tick);
    };
    momentumRaf=requestAnimationFrame(tick);
  }

  left.addEventListener("pointerdown",e=>{
    if(e.pointerType!=="touch"&&e.pointerType!=="pen")return;
    stopMomentum();
    dragging=true; pointerId=e.pointerId; startY=e.clientY; startOffset=y; lastY=e.clientY; lastT=performance.now(); velocity=0;
    left.setPointerCapture?.(pointerId);
    e.stopPropagation();
  },{passive:true});

  left.addEventListener("pointermove",e=>{
    if(!dragging||e.pointerId!==pointerId)return;
    const now=performance.now(),dy=e.clientY-startY,move=e.clientY-lastY,dt=Math.max(1,now-lastT);
    if(Math.abs(dy)>4){
      apply(startOffset+dy);
      velocity=move/dt;
      lastY=e.clientY; lastT=now;
      e.preventDefault();
    }
    e.stopPropagation();
  },{passive:false});

  function endDrag(e){
    if(!dragging||e.pointerId!==pointerId)return;
    dragging=false;
    left.releasePointerCapture?.(pointerId);
    const v=velocity; pointerId=null;
    if(Math.abs(v)>.05)animateMomentum(v);
    e.stopPropagation();
  }
  left.addEventListener("pointerup",endDrag,{passive:true});
  left.addEventListener("pointercancel",endDrag,{passive:true});

  left.addEventListener("wheel",e=>{
    e.preventDefault(); stopMomentum(); apply(y-e.deltaY);
  },{passive:false});

  function jumpTo(targetY){
    stopMomentum();
    const from=y,to=clamp(-targetY),distance=to-from,started=performance.now();
    const duration=Math.min(260,Math.max(120,Math.abs(distance)*.35));
    const tick=now=>{
      const t=Math.min(1,(now-started)/duration);
      const eased=1-Math.pow(1-t,3);
      apply(from+distance*eased);
      if(t<1)requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  quickFind.addEventListener("click",e=>{
    const link=e.target.closest(".quickfind-link");
    if(!link)return;
    const section=sections.find(s=>s.dataset.toolSection===link.dataset.toolTarget);
    if(!section)return;
    e.preventDefault(); e.stopImmediatePropagation();
    jumpTo(sectionOffset(section));
  },true);

  const anchorRails=()=>{
    ["figureActionsRail","textActionsRail"].forEach(id=>{
      const rail=document.getElementById(id);
      if(!rail)return;
      if(rail.parentElement!==stage)stage.insertBefore(rail,viewport);
      rail.style.right="0"; rail.style.left="auto";
    });
  };
  window.addEventListener("denx:figureselectionchange",anchorRails);
  window.addEventListener("denx:textselectionchange",anchorRails);
  anchorRails();
  window.addEventListener("resize",()=>apply(y),{passive:true});
  requestAnimationFrame(()=>apply(0));
})();
