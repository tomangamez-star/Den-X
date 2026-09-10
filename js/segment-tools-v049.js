(() => {
  "use strict";
  const rail=document.getElementById("figureActionsRail");
  if(!rail||!window.denxBonesCaptureProjectState||!window.denxBonesRestoreProjectState)return;
  if(document.getElementById("denxSegmentToolsV049"))return;

  const section=rail.querySelector(".figure-context-section");
  if(!section)return;

  const tools=document.createElement("div");
  tools.id="denxSegmentToolsV049";
  tools.className="denx-segment-tools-v049";
  tools.hidden=true;
  tools.innerHTML=`
    <div class="denx-segment-title">Segment</div>
    <div class="denx-segment-grid">
      <button type="button" id="denxParentNodeBtn">Parent</button>
      <button type="button" id="denxSelectBranchBtn">Branch</button>
      <button type="button" id="denxSplitSegmentBtn">Split</button>
      <button type="button" id="denxJoinNodeBtn">Join</button>
    </div>
    <button type="button" class="denx-delete-node" id="denxDeleteNodeBtn">Delete Node</button>
  `;

  const editBtn=document.getElementById("figureEditBtn");
  if(editBtn)section.insertBefore(tools,editBtn); else section.appendChild(tools);

  const parentBtn=tools.querySelector("#denxParentNodeBtn");
  const branchBtn=tools.querySelector("#denxSelectBranchBtn");
  const splitBtn=tools.querySelector("#denxSplitSegmentBtn");
  const joinBtn=tools.querySelector("#denxJoinNodeBtn");
  const deleteBtn=tools.querySelector("#denxDeleteNodeBtn");
  const clone=v=>JSON.parse(JSON.stringify(v));
  let joinSource=null;

  function toast(msg){ window.denxShowToast?.(msg); }

  function selection(){
    const state=window.denxBonesCaptureProjectState?.();
    const figure=state?.figures?.find(f=>String(f.id)===String(state.selectedFigureId));
    const node=figure?.nodes?.find(n=>String(n.id)===String(state.selectedNodeId));
    return {state,figure,node};
  }

  function childrenOf(figure,nodeId){
    return (figure?.nodes||[]).filter(n=>String(n.parentId)===String(nodeId));
  }

  function refresh(){
    const {figure,node}=selection();
    const has=!!(figure&&node);
    tools.hidden=!has;
    if(!has)return;
    const children=childrenOf(figure,node.id);
    parentBtn.disabled=!node.parentId;
    branchBtn.disabled=children.length===0;
    splitBtn.disabled=!node.parentId;
    deleteBtn.disabled=!node.parentId || children.length!==1;
    joinBtn.textContent=joinSource ? "Pick Target" : "Join";
  }

  let last="";
  setInterval(()=>{
    const s=window.denxBonesCaptureProjectState?.();
    const key=`${s?.selectedFigureId||""}:${s?.selectedNodeId||""}:${joinSource?.figureId||""}:${joinSource?.nodeId||""}`;
    if(key!==last){last=key;refresh()}
  },180);

  parentBtn.addEventListener("click",()=>{
    const {state,figure,node}=selection();
    if(!state||!figure||!node?.parentId)return;
    state.selectedFigureId=figure.id;state.selectedNodeId=node.parentId;
    window.denxBonesRestoreProjectState(state);toast("Parent selected");
  });

  branchBtn.addEventListener("click",()=>{
    const {figure,node}=selection();if(!figure||!node)return;
    const ids=new Set([String(node.id)]);
    let changed=true;
    while(changed){
      changed=false;
      for(const n of figure.nodes||[]){
        if(n.parentId!=null&&ids.has(String(n.parentId))&&!ids.has(String(n.id))){
          ids.add(String(n.id));changed=true;
        }
      }
    }
    window.denxSelectedBranch={figureId:figure.id,rootNodeId:node.id,nodeIds:[...ids]};
    document.getElementById("figureLayer")?.querySelectorAll(".figure-node-visual").forEach(el=>{
      const id=String(el.getAttribute("data-node-id"));
      el.classList.toggle("denx-node-neighbor",ids.has(id)&&id!==String(node.id));
    });
    toast(`Branch selected · ${ids.size} nodes`);
  });

  splitBtn.addEventListener("click",()=>{
    const {state,figure,node}=selection();
    if(!state||!figure||!node?.parentId)return;
    const parentId=node.parentId,fi=state.figures.findIndex(f=>String(f.id)===String(figure.id));
    const next=clone(figure),ni=next.nodes.findIndex(n=>String(n.id)===String(node.id));
    const si=(next.segments||[]).findIndex(s=>String(s.from)===String(parentId)&&String(s.to)===String(node.id));
    if(fi<0||ni<0||si<0){toast("No parent segment found.");return}

    const usedN=new Set((state.figures||[]).flatMap(f=>(f.nodes||[]).map(n=>String(n.id))));
    const usedS=new Set((state.figures||[]).flatMap(f=>(f.segments||[]).map(s=>String(s.id))));
    let c=1,newNodeId;
    do{newNodeId=`node-${Date.now().toString(36)}-${c++}`}while(usedN.has(newNodeId));
    const segId=()=>{let id;do{id=`segment-${Date.now().toString(36)}-${c++}`}while(usedS.has(id));usedS.add(id);return id};

    next.nodes[ni]={...next.nodes[ni],parentId:newNodeId};
    next.nodes.splice(ni,0,{id:newNodeId,parentId,role:"joint"});
    const original=next.segments[si];
    const a={...clone(original),id:segId(),from:parentId,to:newNodeId};
    const b={...clone(original),id:segId(),from:newNodeId,to:node.id};
    if(Number.isFinite(Number(original.length))){
      const half=Math.max(1,Number(original.length)/2);a.length=half;b.length=half;
    }
    next.segments.splice(si,1,a,b);state.figures[fi]=next;

    Object.values(state.framePoses||{}).forEach(fp=>{
      const pose=fp?.[figure.id],p=pose?.nodes?.[parentId],q=pose?.nodes?.[node.id];
      if(!pose||!p||!q)return;
      pose.nodes[newNodeId]={x:(Number(p.x)+Number(q.x))/2,y:(Number(p.y)+Number(q.y))/2};
    });

    state.selectedFigureId=figure.id;state.selectedNodeId=newNodeId;
    window.denxBonesRestoreProjectState(state);
    window.denxRefreshOnionSkin?.();window.denxRefreshAllFrameThumbnails?.();window.denxMarkWorkspaceDirty?.();
    toast("Segment split ✓");
  });

  // Join is deliberately cross-figure: source node, then a node on another figure.
  joinBtn.addEventListener("click",()=>{
    const {state,figure,node}=selection();
    if(!state||!figure||!node)return;

    if(!joinSource){
      joinSource={figureId:figure.id,nodeId:node.id};
      joinBtn.textContent="Pick Target";
      toast("Join source set — select a node on another figure, then tap Join.");
      return;
    }

    if(String(joinSource.figureId)===String(figure.id)){
      toast("Join target must be on another figure.");
      return;
    }

    state.joins=Array.isArray(state.joins)?state.joins:[];
    const exists=state.joins.some(j=>
      String(j.fromFigureId)===String(joinSource.figureId)&&String(j.fromNodeId)===String(joinSource.nodeId)&&
      String(j.toFigureId)===String(figure.id)&&String(j.toNodeId)===String(node.id)
    );
    if(!exists){
      state.joins.push({
        id:`join-${Date.now().toString(36)}`,
        fromFigureId:joinSource.figureId,fromNodeId:joinSource.nodeId,
        toFigureId:figure.id,toNodeId:node.id,type:"node-link"
      });
    }
    joinSource=null;
    window.denxBonesRestoreProjectState(state);
    window.denxMarkWorkspaceDirty?.();
    toast("Figures joined ✓");
    refresh();
  });

  // Delete Node heals parent -> only child, reversing an accidental split.
  deleteBtn.addEventListener("click",()=>{
    const {state,figure,node}=selection();
    if(!state||!figure||!node?.parentId)return;
    const children=childrenOf(figure,node.id);
    if(children.length!==1){
      toast("Delete Node needs one parent and one child.");
      return;
    }

    const child=children[0],parentId=node.parentId,fi=state.figures.findIndex(f=>String(f.id)===String(figure.id));
    const next=clone(figure);
    const parentSeg=(next.segments||[]).find(s=>String(s.from)===String(parentId)&&String(s.to)===String(node.id));
    const childSeg=(next.segments||[]).find(s=>String(s.from)===String(node.id)&&String(s.to)===String(child.id));
    if(!parentSeg||!childSeg){toast("Connected segment pair not found.");return}

    next.nodes=next.nodes.filter(n=>String(n.id)!==String(node.id)).map(n=>
      String(n.id)===String(child.id)?{...n,parentId}:{...n}
    );
    next.segments=next.segments.filter(s=>
      String(s.id)!==String(parentSeg.id)&&String(s.id)!==String(childSeg.id)
    );
    const healed={...clone(parentSeg),id:`segment-${Date.now().toString(36)}`,from:parentId,to:child.id};
    if(Number.isFinite(Number(parentSeg.length))&&Number.isFinite(Number(childSeg.length))){
      healed.length=Number(parentSeg.length)+Number(childSeg.length);
    }
    next.segments.push(healed);
    state.figures[fi]=next;

    Object.values(state.framePoses||{}).forEach(fp=>{
      const pose=fp?.[figure.id];
      if(pose?.nodes)delete pose.nodes[node.id];
    });

    state.selectedFigureId=figure.id;state.selectedNodeId=child.id;
    window.denxBonesRestoreProjectState(state);
    window.denxRefreshOnionSkin?.();window.denxRefreshAllFrameThumbnails?.();window.denxMarkWorkspaceDirty?.();
    toast("Node deleted · segment healed ✓");
  });

  refresh();
})();