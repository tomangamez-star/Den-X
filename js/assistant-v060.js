// DenX Assistant v1 — onboarding, contextual teaching and save guardian.
(() => {
  "use strict";
  if(!document.getElementById("workspace")||window.denxAssistantV060)return;window.denxAssistantV060=true;
  const DONE="denx.assistant.onboarding.v1",SEEN="denx.assistant.context.v1";
  const host=document.createElement("div");host.className="denx-assistant";host.innerHTML=`<section class="denx-assistant-card" hidden><span class="denx-assistant-kicker">DENX ASSISTANT</span><strong></strong><p></p><div class="denx-assistant-actions"></div></section>`;document.body.appendChild(host);
  const card=host.querySelector(".denx-assistant-card"),title=card.querySelector("strong"),copy=card.querySelector("p"),actions=card.querySelector(".denx-assistant-actions"),orb=document.getElementById("denxAssistantBtn");let timer;
  function hide(){card.hidden=true;clearTimeout(timer);}function button(label,fn,primary=false){const b=document.createElement("button");b.type="button";b.textContent=label;b.classList.toggle("primary",primary);b.onclick=fn;actions.appendChild(b);}
  function say(heading,message,buildActions,auto=0){clearTimeout(timer);title.textContent=heading;copy.textContent=message;actions.replaceChildren();buildActions?.();if(!actions.children.length)button("Got it",hide,true);card.hidden=false;host.classList.remove("denx-assistant-pulse");void host.offsetWidth;host.classList.add("denx-assistant-pulse");if(auto)timer=setTimeout(hide,auto);}
  orb?.addEventListener("click",()=>{if(!card.hidden){hide();return;}say("What do you need?","I can replay the basics, save your project, or explain tools the first time you use them.",()=>{button("Save now",()=>{window.denxSaveCurrentProject?.();hide();},true);button("Basics",()=>startTutorial(true));button("Close",hide);});});
  window.denxAssistantSaveReminder=minutes=>say("Time to save",`You have ${minutes} minutes of unsaved work. Save it before you keep cooking.`,()=>{button("Save now",()=>{window.denxSaveCurrentProject?.();hide();},true);button("Later",hide);});
  const steps=[
    {target:"#tool-figure",title:"Add your character",text:"Open Figure, import or create a figure, then add it to the canvas."},
    {target:"#selectTool",title:"Pose with Select",text:"Choose Select, tap a figure, then drag its joints to make a pose."},
    {target:"#addFrame",title:"Build the motion",text:"Add a new frame for the next pose. Duplicate a frame when you want a close starting point."},
    {target:"#playBtn",title:"Preview the animation",text:"Press Play to watch your frames at the FPS selected in Animate."},
    {target:"#workspaceSaveBtn",title:"Save your work",text:"Save regularly. I will remind you after five minutes of unsaved editing."}
  ];
  let tutorial,index=0,focus=null;
  function clearFocus(){focus?.classList.remove("denx-help-focus");focus=null;}
  function renderStep(){clearFocus();const step=steps[index];focus=document.querySelector(step.target);focus?.classList.add("denx-help-focus");tutorial.querySelector(".denx-tutorial-step").textContent=`BASICS · ${index+1} OF ${steps.length}`;tutorial.querySelector("h2").textContent=step.title;tutorial.querySelector("p").textContent=step.text;tutorial.querySelector(".back").disabled=index===0;tutorial.querySelector(".next").textContent=index===steps.length-1?"Finish":"Next";}
  function finishTutorial(){clearFocus();tutorial.hidden=true;localStorage.setItem(DONE,"1");say("Basics complete","That is enough to begin. I will explain advanced tools only when you open them.",null,4500);}
  function startTutorial(replay=false){hide();if(!tutorial){tutorial=document.createElement("div");tutorial.className="denx-tutorial";tutorial.innerHTML=`<section class="denx-tutorial-card"><span class="denx-tutorial-step"></span><h2></h2><p></p><div class="denx-tutorial-actions"><button class="skip">Skip</button><span><button class="back">Back</button> <button class="next">Next</button></span></div></section>`;document.body.appendChild(tutorial);tutorial.querySelector(".skip").onclick=finishTutorial;tutorial.querySelector(".back").onclick=()=>{if(index>0){index--;renderStep();}};tutorial.querySelector(".next").onclick=()=>{if(index<steps.length-1){index++;renderStep();}else finishTutorial();};}index=0;tutorial.hidden=false;renderStep();}
  window.denxStartBasicTutorial=()=>startTutorial(true);
  const topics={
    onionSkinBtn:["Onion skin","Shows faint neighbouring frames so you can line up motion without guessing."],
    cameraTool:["Animation camera","Move, resize or rotate the camera to control exactly what the export sees."],
    textTool:["Frame-local text","Text starts on this frame. Each frame keeps its own position, wording and style."],
    workspaceExportBtn:["Export studio","PNG can export one, selected, ranged or all frames. MP4 creates the complete animation."],
    createFigureBtn:["Figure Creator","Build editable rigs from nodes and segments. You can return to the animation without losing it."],
    figureEditBtn:["Edit the rig","This opens the selected figure's actual node structure—not just its pose."],
    cameraPropGuide:["Camera guide","The guide helps compose the shot but never appears in exported images or video."]
  };
  function seen(){try{return JSON.parse(localStorage.getItem(SEEN)||"{}");}catch(_){return{};}}
  document.addEventListener("click",event=>{if(localStorage.getItem(DONE)!=="1")return;const target=event.target.closest?.("[id]");if(!target||!topics[target.id])return;const state=seen();if(state[target.id])return;state[target.id]=1;localStorage.setItem(SEEN,JSON.stringify(state));const [heading,message]=topics[target.id];setTimeout(()=>say(heading,message,null,6500),180);},true);
  setTimeout(()=>{if(localStorage.getItem(DONE)!=="1")startTutorial();else say("Assistant online","I will watch your save state and explain unfamiliar tools when needed.",null,3200);},900);
})();
