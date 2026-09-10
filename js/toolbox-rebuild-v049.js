(() => {
  "use strict";
  const editor=document.querySelector(".editor");
  const toolbox=document.getElementById("toolbox");
  const quickFind=document.querySelector(".tool-quickfind");
  const viewport=document.getElementById("viewport");
  if(!editor||!toolbox||!quickFind||!viewport||editor.dataset.denxV049==="1")return;

  editor.dataset.denxV049="1";
  editor.classList.remove("denx-v048-shell");
  editor.classList.add("denx-v049-shell");

  const left=document.createElement("div");
  left.className="denx-v049-left";
  const stage=document.createElement("div");
  stage.className="denx-v049-stage";

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
    [...toolbox.children].filter(el=>el.matches?.("[data-tool-section]")).forEach(s=>host.appendChild(s));
    toolbox.appendChild(host);
  }

  const sections=[...host.querySelectorAll("[data-tool-section]")];
  const links=[...quickFind.querySelectorAll(".quickfind-link")];
  let activeIndex=Math.max(0,sections.findIndex(s=>s.dataset.toolSection==="general"));

  const nav=document.createElement("div");
  nav.className="denx-v049-navhint";
  nav.innerHTML='<button type="button" id="denxToolPrev" aria-label="Previous section">↑</button><button type="button" id="denxToolNext" aria-label="Next section">↓</button>';
  toolbox.appendChild(nav);
  const prev=nav.firstElementChild,next=nav.lastElementChild;

  function showIndex(index){
    if(!sections.length)return;
    activeIndex=Math.max(0,Math.min(sections.length-1,index));
    sections.forEach((s,i)=>{
      const active=i===activeIndex;
      s.classList.toggle("denx-v049-active",active);
      s.setAttribute("aria-hidden",active?"false":"true");
      if(active) requestAnimationFrame(()=>{ s.scrollTop=0; });
    });
    const name=sections[activeIndex]?.dataset.toolSection;
    links.forEach(l=>l.classList.toggle("active",l.dataset.toolTarget===name));
    prev.disabled=activeIndex===0;
    next.disabled=activeIndex===sections.length-1;
  }
  function showName(name){
    const i=sections.findIndex(s=>s.dataset.toolSection===name);
    if(i>=0)showIndex(i);
  }

  quickFind.addEventListener("click",e=>{
    const link=e.target.closest(".quickfind-link");
    if(!link)return;
    e.preventDefault();e.stopImmediatePropagation();
    showName(link.dataset.toolTarget);
  },true);
  prev.addEventListener("click",()=>showIndex(activeIndex-1));
  next.addEventListener("click",()=>showIndex(activeIndex+1));

  // Edge-gated switching:
  // first gesture reaches/stays at edge; only a fresh gesture from that edge changes section.
  let startY=null,startScroll=0,pid=null,edgeAtStart=null;
  left.addEventListener("pointerdown",e=>{
    if(e.pointerType!=="touch"&&e.pointerType!=="pen")return;
    const section=sections[activeIndex];
    if(!section)return;
    startY=e.clientY;startScroll=section.scrollTop;pid=e.pointerId;
    const atTop=section.scrollTop<=1;
    const atBottom=section.scrollTop+section.clientHeight>=section.scrollHeight-1;
    edgeAtStart=atTop?"top":(atBottom?"bottom":null);
  },{passive:true});

  left.addEventListener("pointerup",e=>{
    if(startY==null||e.pointerId!==pid)return;
    const dy=e.clientY-startY;
    const section=sections[activeIndex];
    const started=edgeAtStart;
    startY=null;pid=null;edgeAtStart=null;
    if(!section||Math.abs(dy)<42)return;

    // Upward swipe from bottom -> next. Downward swipe from top -> previous.
    if(started==="bottom"&&dy<0&&section.scrollTop+section.clientHeight>=section.scrollHeight-1){
      showIndex(activeIndex+1);
    } else if(started==="top"&&dy>0&&section.scrollTop<=1){
      showIndex(activeIndex-1);
    }
  },{passive:true});

  // Wheel follows same edge rule.
  let edgeWheelArmed=null;
  sections.forEach(section=>{
    section.addEventListener("scroll",()=>{
      const atTop=section.scrollTop<=1;
      const atBottom=section.scrollTop+section.clientHeight>=section.scrollHeight-1;
      if(!atTop&&!atBottom)edgeWheelArmed=null;
    },{passive:true});
  });
  left.addEventListener("wheel",e=>{
    const section=sections[activeIndex];
    if(!section)return;
    const atTop=section.scrollTop<=1;
    const atBottom=section.scrollTop+section.clientHeight>=section.scrollHeight-1;
    const edge=e.deltaY>0&&atBottom?"bottom":(e.deltaY<0&&atTop?"top":null);
    if(!edge){edgeWheelArmed=null;return}
    if(edgeWheelArmed===edge){
      e.preventDefault();
      showIndex(activeIndex+(edge==="bottom"?1:-1));
      edgeWheelArmed=null;
    } else {
      edgeWheelArmed=edge;
    }
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
      rail.style.right="0";rail.style.left="auto";
    });
  };
  window.addEventListener("denx:figureselectionchange",anchorRails);
  window.addEventListener("denx:textselectionchange",anchorRails);
  anchorRails();
  showIndex(activeIndex);
})();