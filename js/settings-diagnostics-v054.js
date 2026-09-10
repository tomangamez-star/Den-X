(() => {
  "use strict";

  const renderer=document.getElementById("denxSettingsRenderer");
  const acceleration=document.getElementById("denxSettingsAcceleration");
  if(!renderer||!acceleration)return;

  const backend=localStorage.getItem("denx.rendererBackend")||"";
  const checkedAt=Number(localStorage.getItem("denx.rendererCheckedAt")||0);

  renderer.classList.remove("fallback");
  acceleration.classList.remove("fallback");

  if(backend==="webgl2"){
    renderer.textContent="WebGL2 · Active ✓";
    acceleration.textContent="GPU accelerated";
  }else if(backend==="svg"){
    renderer.textContent="SVG · Fallback ⚠";
    renderer.classList.add("fallback");
    acceleration.textContent="CPU / SVG";
    acceleration.classList.add("fallback");
  }else{
    renderer.textContent="Not checked";
    renderer.classList.add("fallback");
    acceleration.textContent="Open a project";
    acceleration.classList.add("fallback");
  }

  if(checkedAt){
    const age=Math.max(0,Date.now()-checkedAt);
    renderer.title=`Last workspace renderer check ${Math.round(age/1000)}s ago`;
  }
})();