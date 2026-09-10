
(() => {
  "use strict";
  const rail=document.getElementById("figureActionsRail");
  if(!rail||!window.denxBonesCaptureProjectState||!window.denxBonesRestoreProjectState)return;
  if(document.getElementById("denxSegmentToolsV047"))return;

  const section=rail.querySelector(".figure-context-section");
  if(!section)return;

  const tools=document.createElement("div");
  tools.id="denxSegmentToolsV047";
  tools.className="denx-segment-tools-v047";
  tools.hidden=true;
  tools.innerHTML=`
    <div class="denx-segment-title">Node / Segment</div>
    <div class="denx-segment-row">
      <button type="button" id="denxParentNodeBtn">Parent</button>
      <button type="button" id="denxSelectBranchBtn">Branch</button>
    </div>
    <button type="button" class="denx-primary" id="denxSplitSegmentBtn">Split Segment</button>
  `;

  const editBtn=document.getElementById("figureEditBtn");
  if(editBtn)section.insertBefore(tools,editBtn); else section.appendChild(tools);

  const parentBtn=tools.querySelector("#denxParentNodeBtn");
  const branchBtn=tools.querySelector("#denxSelectBranchBtn");
  const splitBtn=tools.querySelector("#denxSplitSegmentBtn");
  const clone=v=>JSON.parse(JSON.stringify(v));

  function toast(message){
    const el=document.getElementById("denxToast");
    if(!el)return;
    el.textContent=message;el.classList.add("show");
    clearTimeout(el.__timer);el.__timer=setTimeout(()=>el.classList.remove("show"),1700);
  }

  function selection(){
    const state=window.denxBonesCaptureProjectState?.();
    const figure=state?.figures?.find(f=>f.id===state.selectedFigureId);
    const node=figure?.nodes?.find(n=>n.id===state.selectedNodeId);
    return {state,figure,node};
  }

  function refresh(){
    const {figure,node}=selection();
    const has=!!(figure&&node);
    tools.hidden=!has;
    if(!has)return;
    parentBtn.disabled=!node.parentId;
    splitBtn.disabled=!node.parentId;
    branchBtn.disabled=!(figure.nodes||[]).some(n=>n.parentId===node.id);
  }

  let last="";
  setInterval(()=>{
    const s=window.denxBonesCaptureProjectState?.();
    const key=`${s?.selectedFigureId||""}:${s?.selectedNodeId||""}`;
    if(key!==last){last=key;refresh()}
  },220);

  parentBtn.addEventListener("click",()=>{
    const {state,figure,node}=selection();
    if(!state||!figure||!node?.parentId)return;
    state.selectedFigureId=figure.id;
    state.selectedNodeId=node.parentId;
    window.denxBonesRestoreProjectState(state);
    toast("Parent selected");
  });

  branchBtn.addEventListener("click",()=>{
    const {figure,node}=selection();
    if(!figure||!node)return;
    const ids=new Set([node.id]);
    let changed=true;
    while(changed){
      changed=false;
      for(const n of figure.nodes||[]){
        if(n.parentId&&ids.has(n.parentId)&&!ids.has(n.id)){ids.add(n.id);changed=true}
      }
    }
    window.denxSelectedBranch={figureId:figure.id,rootNodeId:node.id,nodeIds:[...ids]};
    document.getElementById("figureLayer")?.querySelectorAll(".figure-node-visual").forEach(el=>{
      const id=el.getAttribute("data-node-id");
      el.classList.toggle("denx-node-neighbor",ids.has(id)&&id!==node.id);
    });
    toast(`Branch selected · ${ids.size} nodes`);
  });

  splitBtn.addEventListener("click",()=>{
    const {state,figure,node}=selection();
    if(!state||!figure||!node?.parentId)return;

    const parentId=node.parentId;
    const fi=state.figures.findIndex(f=>f.id===figure.id);
    const nextFigure=clone(figure);
    const ni=nextFigure.nodes.findIndex(n=>n.id===node.id);
    const si=(nextFigure.segments||[]).findIndex(seg=>String(seg.from)===String(parentId)&&String(seg.to)===String(node.id));
    if(fi<0||ni<0||si<0){toast("No parent segment found.");return}

    const usedNodes=new Set((state.figures||[]).flatMap(f=>(f.nodes||[]).map(n=>String(n.id))));
    const usedSegs=new Set((state.figures||[]).flatMap(f=>(f.segments||[]).map(s=>String(s.id))));
    let n=1,newNodeId;
    do{newNodeId=`node-${Date.now().toString(36)}-${n++}`}while(usedNodes.has(newNodeId));

    const newSegId=()=>{
      let id;
      do{id=`segment-${Date.now().toString(36)}-${n++}`}while(usedSegs.has(id));
      usedSegs.add(id);return id;
    };

    nextFigure.nodes[ni]={...nextFigure.nodes[ni],parentId:newNodeId};
    nextFigure.nodes.splice(ni,0,{id:newNodeId,parentId,role:"joint"});

    const original=nextFigure.segments[si];
    const first={...clone(original),id:newSegId(),from:parentId,to:newNodeId};
    const second={...clone(original),id:newSegId(),from:newNodeId,to:node.id};
    if(Number.isFinite(Number(original.length))){
      const half=Math.max(1,Number(original.length)/2); first.length=half; second.length=half;
    }
    nextFigure.segments.splice(si,1,first,second);
    state.figures[fi]=nextFigure;

    Object.values(state.framePoses||{}).forEach(framePose=>{
      const pose=framePose?.[figure.id];
      const a=pose?.nodes?.[parentId],b=pose?.nodes?.[node.id];
      if(!pose||!a||!b)return;
      pose.nodes[newNodeId]={x:(Number(a.x)+Number(b.x))/2,y:(Number(a.y)+Number(b.y))/2};
    });

    state.selectedFigureId=figure.id; state.selectedNodeId=newNodeId;
    window.denxBonesRestoreProjectState(state);
    window.denxRefreshOnionSkin?.();
    window.denxRefreshAllFrameThumbnails?.();
    window.denxMarkWorkspaceDirty?.();
    toast("Segment split ✓");
  });

  refresh();
})();
