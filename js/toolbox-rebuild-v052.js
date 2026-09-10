(() => {
  "use strict";

  const editor=document.querySelector(".editor");
  const toolbox=document.getElementById("toolbox");
  const quick=document.querySelector(".tool-quickfind");
  const viewport=document.getElementById("viewport");

  if(!editor||!toolbox||!quick||!viewport||editor.dataset.denxV052==="1")return;

  editor.dataset.denxV052="1";
  editor.classList.remove("denx-v051-shell");
  editor.classList.add("denx-v052-shell");

  const left=document.createElement("div");
  left.className="denx-v052-left";
  left.id="denxV052Left";

  const stage=document.createElement("div");
  stage.className="denx-v052-stage";
  stage.id="denxV052Stage";

  left.appendChild(toolbox);

  [
    document.getElementById("cameraProperties"),
    document.getElementById("figureActionsRail"),
    document.getElementById("textActionsRail"),
    viewport,
    editor.querySelector(".zoom-controls")
  ].filter(Boolean).forEach(node=>stage.appendChild(node));

  editor.replaceChildren(left,stage,quick);

  let host=toolbox.querySelector(":scope > .denx-toolbox-scroller");
  if(!host){
    host=document.createElement("div");
    host.className="denx-toolbox-scroller";
    host.id="denxToolboxScroller";
    [...toolbox.children]
      .filter(el=>el.matches?.("[data-tool-section]"))
      .forEach(section=>host.appendChild(section));
    toolbox.appendChild(host);
  }

  const sections=[...host.querySelectorAll("[data-tool-section]")];
  const links=[...quick.querySelectorAll(".quickfind-link")];
  const memory=new Map();

  // Remove old patch nav if one somehow survived.
  toolbox.querySelectorAll(":scope > .denx-v050-navhint,:scope > .denx-v049-navhint")
    .forEach(node=>node.remove());

  const nav=document.createElement("div");
  nav.className="denx-v052-nav";
  nav.innerHTML=
    '<button type="button" id="denxToolPrev" aria-label="Previous tool section">↑</button>'+
    '<button type="button" id="denxToolNext" aria-label="Next tool section">↓</button>';
  toolbox.appendChild(nav);

  const prev=nav.querySelector("#denxToolPrev");
  const next=nav.querySelector("#denxToolNext");

  let activeIndex=Math.max(0,sections.findIndex(s=>s.dataset.toolSection==="general"));

  const activeSection=()=>sections[activeIndex]||null;
  const atTop=s=>!s||s.scrollTop<=1;
  const atBottom=s=>!s||s.scrollTop+s.clientHeight>=s.scrollHeight-1;

  function showIndex(index,{reset=false}={}){
    const previous=activeSection();
    if(previous) memory.set(previous.dataset.toolSection,previous.scrollTop);

    activeIndex=Math.max(0,Math.min(sections.length-1,index));

    sections.forEach((section,i)=>{
      const active=i===activeIndex;
      section.classList.toggle("denx-v052-active",active);
      section.setAttribute("aria-hidden",active?"false":"true");
    });

    const current=activeSection();
    const name=current?.dataset.toolSection;

    links.forEach(link=>{
      const on=link.dataset.toolTarget===name;
      link.classList.toggle("active",on);
      link.setAttribute("aria-pressed",on?"true":"false");
    });

    prev.disabled=activeIndex===0;
    next.disabled=activeIndex===sections.length-1;

    requestAnimationFrame(()=>{
      if(!current)return;
      current.scrollTop=reset?0:(memory.get(name)||0);
    });
  }

  function showName(name,options={}){
    const index=sections.findIndex(s=>s.dataset.toolSection===name);
    if(index>=0)showIndex(index,options);
  }

  quick.addEventListener("click",event=>{
    const link=event.target.closest(".quickfind-link");
    if(!link)return;
    event.preventDefault();
    event.stopImmediatePropagation();
    showName(link.dataset.toolTarget);
  },true);

  prev.addEventListener("click",()=>showIndex(activeIndex-1));
  next.addEventListener("click",()=>showIndex(activeIndex+1));

  /* Critical behavior:
     - scrolling to the edge does not change section
     - a brand-new touch STARTING at the edge can change section
     Using touch events avoids Chromium cancelling Pointer Events when
     it takes ownership of a native scroll gesture. */
  sections.forEach(section=>{
    let gesture=null;

    section.addEventListener("touchstart",event=>{
      if(!section.classList.contains("denx-v052-active"))return;
      const touch=event.touches[0];
      if(!touch)return;

      gesture={
        startY:touch.clientY,
        startedTop:atTop(section),
        startedBottom:atBottom(section)
      };
    },{passive:true,capture:true});

    section.addEventListener("touchend",event=>{
      if(!gesture||!section.classList.contains("denx-v052-active"))return;
      const touch=event.changedTouches[0];
      if(!touch){gesture=null;return;}

      const dy=touch.clientY-gesture.startY;
      const startedTop=gesture.startedTop;
      const startedBottom=gesture.startedBottom;
      gesture=null;

      if(Math.abs(dy)<38)return;

      if(startedBottom && dy<0 && atBottom(section)){
        showIndex(activeIndex+1);
      }else if(startedTop && dy>0 && atTop(section)){
        showIndex(activeIndex-1);
      }
    },{passive:true,capture:true});

    section.addEventListener("touchcancel",()=>{gesture=null;},{passive:true,capture:true});
  });

  window.addEventListener("denx:toolchange",event=>{
    const tool=String(event.detail?.tool||"");
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

  window.addEventListener("denx:figureselectionchange",()=>{
    anchorRails();
    const rail=document.getElementById("figureActionsRail");
    if(rail && !rail.classList.contains("hidden")){
      requestAnimationFrame(()=>{rail.scrollTop=0;});
    }
  });

  window.addEventListener("denx:textselectionchange",anchorRails);

  anchorRails();
  showIndex(activeIndex,{reset:true});
})();