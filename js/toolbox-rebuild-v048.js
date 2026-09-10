(() => {
  "use strict";

  const editor=document.querySelector(".editor");
  const toolbox=document.getElementById("toolbox");
  const quickFind=document.querySelector(".tool-quickfind");
  const viewport=document.getElementById("viewport");
  if(!editor||!toolbox||!quickFind||!viewport||editor.dataset.denxV048==="1")return;

  editor.dataset.denxV048="1";
  editor.classList.remove("denx-v047-shell");
  editor.classList.add("denx-v048-shell");

  const left=document.createElement("div");
  left.className="denx-v048-left";
  left.id="denxV048Left";

  const stage=document.createElement("div");
  stage.className="denx-v048-stage";
  stage.id="denxV048Stage";

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
  let activeIndex=Math.max(0,sections.findIndex(s=>s.dataset.toolSection==="general"));

  const nav=document.createElement("div");
  nav.className="denx-v048-navhint";
  nav.innerHTML='<button type="button" id="denxToolPrev" aria-label="Previous tool section">↑</button><button type="button" id="denxToolNext" aria-label="Next tool section">↓</button>';
  toolbox.appendChild(nav);

  const prev=nav.querySelector("#denxToolPrev");
  const next=nav.querySelector("#denxToolNext");

  function showIndex(index){
    if(!sections.length)return;
    activeIndex=Math.max(0,Math.min(sections.length-1,index));
    sections.forEach((section,i)=>{
      const active=i===activeIndex;
      section.classList.toggle("denx-v048-active",active);
      section.setAttribute("aria-hidden",active?"false":"true");
    });

    const name=sections[activeIndex]?.dataset.toolSection;
    links.forEach(link=>{
      const active=link.dataset.toolTarget===name;
      link.classList.toggle("active",active);
      link.setAttribute("aria-pressed",active?"true":"false");
    });

    prev.disabled=activeIndex===0;
    next.disabled=activeIndex===sections.length-1;
    toolbox.scrollTop=0;
    host.scrollTop=0;
  }

  function showName(name){
    const index=sections.findIndex(s=>s.dataset.toolSection===name);
    if(index>=0)showIndex(index);
  }

  // Quick Find changes static section instantly — no animation or translated layer.
  quickFind.addEventListener("click",e=>{
    const link=e.target.closest(".quickfind-link");
    if(!link)return;
    e.preventDefault();
    e.stopImmediatePropagation();
    showName(link.dataset.toolTarget);
  },true);

  prev.addEventListener("click",()=>showIndex(activeIndex-1));
  next.addEventListener("click",()=>showIndex(activeIndex+1));

  // Swipe gesture is kept, but content never moves with the finger.
  // Release snaps immediately to the adjacent section.
  let startY=null,startX=null,pid=null;
  left.addEventListener("pointerdown",e=>{
    if(e.pointerType!=="touch"&&e.pointerType!=="pen")return;
    startY=e.clientY;startX=e.clientX;pid=e.pointerId;
    left.setPointerCapture?.(pid);
    e.stopPropagation();
  },{passive:true});

  left.addEventListener("pointerup",e=>{
    if(startY==null||e.pointerId!==pid)return;
    const dy=e.clientY-startY;
    const dx=e.clientX-startX;
    startY=null;startX=null;
    left.releasePointerCapture?.(pid);pid=null;

    if(Math.abs(dy)>46&&Math.abs(dy)>Math.abs(dx)*1.15){
      showIndex(activeIndex+(dy<0?1:-1));
    }
    e.stopPropagation();
  },{passive:true});

  left.addEventListener("pointercancel",()=>{
    startY=null;startX=null;pid=null;
  },{passive:true});

  // Wheel also snaps one section at a time.
  let wheelLock=false;
  left.addEventListener("wheel",e=>{
    e.preventDefault();
    if(wheelLock||Math.abs(e.deltaY)<8)return;
    wheelLock=true;
    showIndex(activeIndex+(e.deltaY>0?1:-1));
    setTimeout(()=>wheelLock=false,140);
  },{passive:false});

  window.addEventListener("denx:toolchange",e=>{
    const tool=String(e.detail?.tool||"");
    if(["pan","select"].includes(tool))showName("general");
    else if(["pencil","eraser","text"].includes(tool))showName("draw");
    else if(tool==="camera")showName("camera");
  });

  const anchorRails=()=>{
    ["figureActionsRail","textActionsRail"].forEach(id=>{
      const rail=document.getElementById(id);
      if(!rail)return;
      if(rail.parentElement!==stage)stage.insertBefore(rail,viewport);
      rail.style.right="0";
      rail.style.left="auto";
    });
  };
  window.addEventListener("denx:figureselectionchange",anchorRails);
  window.addEventListener("denx:textselectionchange",anchorRails);
  anchorRails();

  showIndex(activeIndex);
})();