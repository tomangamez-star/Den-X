(() => {
 "use strict";
 const editor=document.querySelector(".editor.denx-v052-shell")||document.querySelector(".editor");
 if(!editor||editor.dataset.denxViewportGuard==="1")return;
 editor.dataset.denxViewportGuard="1";
 let raf=0;
 function measure(){
   raf=0;
   const rect=editor.getBoundingClientRect();
   let bottom=window.innerHeight;
   const vv=window.visualViewport;
   if(vv&&Number.isFinite(vv.height)) bottom=Math.min(bottom,(Number(vv.offsetTop)||0)+vv.height);
   const h=Math.max(180,Math.floor(bottom-Math.max(0,rect.top)));
   editor.style.setProperty("--denx-editor-visible-height",`${h}px`);
   ["figureActionsRail","textActionsRail"].forEach(id=>{
     const el=document.getElementById(id); if(el) el.style.maxHeight=`${h}px`;
   });
 }
 function schedule(){if(!raf)raf=requestAnimationFrame(measure)}
 window.addEventListener("resize",schedule,{passive:true});
 window.addEventListener("orientationchange",()=>{schedule();setTimeout(schedule,80);setTimeout(schedule,240)},{passive:true});
 if(window.visualViewport){
   visualViewport.addEventListener("resize",schedule,{passive:true});
   visualViewport.addEventListener("scroll",schedule,{passive:true});
 }
 new ResizeObserver(schedule).observe(document.documentElement);
 document.addEventListener("visibilitychange",()=>{if(!document.hidden)schedule()});
 schedule(); setTimeout(schedule,120);
})();