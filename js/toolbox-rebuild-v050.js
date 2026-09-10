
(() => {
 const editor=document.querySelector('.editor'),toolbox=document.getElementById('toolbox'),quick=document.querySelector('.tool-quickfind'),viewport=document.getElementById('viewport');
 if(!editor||!toolbox||!quick||!viewport||editor.dataset.denxV050==='1')return;
 editor.dataset.denxV050='1';editor.classList.remove('denx-v049-shell');editor.classList.add('denx-v050-shell');
 const left=document.createElement('div');left.className='denx-v050-left';
 const stage=document.createElement('div');stage.className='denx-v050-stage';
 left.appendChild(toolbox);
 [document.getElementById('cameraProperties'),document.getElementById('figureActionsRail'),document.getElementById('textActionsRail'),viewport,editor.querySelector('.zoom-controls')].filter(Boolean).forEach(n=>stage.appendChild(n));
 editor.replaceChildren(left,stage,quick);
 let host=toolbox.querySelector(':scope > .denx-toolbox-scroller');
 if(!host){host=document.createElement('div');host.className='denx-toolbox-scroller';[...toolbox.children].filter(el=>el.matches?.('[data-tool-section]')).forEach(s=>host.appendChild(s));toolbox.appendChild(host);}
 const sections=[...host.querySelectorAll('[data-tool-section]')],links=[...quick.querySelectorAll('.quickfind-link')];
 const nav=document.createElement('div');nav.className='denx-v050-navhint';nav.innerHTML='<button type="button">↑</button><button type="button">↓</button>';toolbox.appendChild(nav);
 const [prev,next]=nav.children;let activeIndex=Math.max(0,sections.findIndex(s=>s.dataset.toolSection==='general'));const memory=new Map();
 const active=()=>sections[activeIndex];
 function showIndex(i){const old=active();if(old)memory.set(old.dataset.toolSection,old.scrollTop);activeIndex=Math.max(0,Math.min(sections.length-1,i));sections.forEach((s,x)=>s.classList.toggle('denx-v050-active',x===activeIndex));const name=active()?.dataset.toolSection;links.forEach(l=>l.classList.toggle('active',l.dataset.toolTarget===name));prev.disabled=activeIndex===0;next.disabled=activeIndex===sections.length-1;requestAnimationFrame(()=>{if(active())active().scrollTop=memory.get(name)||0;});}
 function showName(n){const i=sections.findIndex(s=>s.dataset.toolSection===n);if(i>=0)showIndex(i);}
 quick.addEventListener('click',e=>{const l=e.target.closest('.quickfind-link');if(!l)return;e.preventDefault();e.stopImmediatePropagation();showName(l.dataset.toolTarget);},true);
 prev.onclick=()=>showIndex(activeIndex-1);next.onclick=()=>showIndex(activeIndex+1);
 let g=null;host.addEventListener('pointerdown',e=>{const s=e.target.closest?.('.tool-section.denx-v050-active');if(!s||!['touch','pen'].includes(e.pointerType))return;g={id:e.pointerId,s,y:e.clientY,top:s.scrollTop<=1,bottom:s.scrollTop+s.clientHeight>=s.scrollHeight-1};},{passive:true});
 host.addEventListener('pointerup',e=>{if(!g||g.id!==e.pointerId)return;const dy=e.clientY-g.y,cur=g.s;const gg=g;g=null;if(Math.abs(dy)<44)return;if(gg.bottom&&dy<0&&cur.scrollTop+cur.clientHeight>=cur.scrollHeight-1)showIndex(activeIndex+1);else if(gg.top&&dy>0&&cur.scrollTop<=1)showIndex(activeIndex-1);},{passive:true});
 host.addEventListener('pointercancel',()=>g=null,{passive:true});
 window.addEventListener('denx:figureselectionchange',()=>{const r=document.getElementById('figureActionsRail');if(r&&!r.classList.contains('hidden'))requestAnimationFrame(()=>r.scrollTop=0);});
 showIndex(activeIndex);
})();
