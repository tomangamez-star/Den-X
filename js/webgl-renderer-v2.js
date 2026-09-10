(() => {
 "use strict";
 const stage=document.getElementById("stage"), drawing=document.getElementById("drawingCanvas"), layer=document.getElementById("figureLayer");
 if(!stage||!drawing||!layer||typeof window.denxBonesCaptureProjectState!=="function"||document.getElementById("denxWebGLFigureLayer"))return;

 const canvas=document.createElement("canvas"); canvas.id="denxWebGLFigureLayer"; canvas.setAttribute("aria-hidden","true");
 layer.parentNode.insertBefore(canvas,layer);

 const status=document.createElement("div"); status.id="denxRendererStatus"; status.textContent="Renderer · starting";
 (document.getElementById("denxV052Stage")||stage.parentElement||stage).appendChild(status);
 const setStatus=(backend,text)=>{window.denxRendererBackend=backend;status.dataset.backend=backend==="webgl2"?"webgl2":"svg";status.textContent=text};

 const gl=canvas.getContext("webgl2",{alpha:true,antialias:true,depth:false,stencil:false,premultipliedAlpha:true,preserveDrawingBuffer:false,powerPreference:"high-performance"});
 if(!gl){canvas.remove();setStatus("svg","Renderer · SVG fallback");return}

 function compile(type,source){
   const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);
   if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(s)||"shader failed");
   return s;
 }
 let program;
 try{
   const vs=compile(gl.VERTEX_SHADER,`#version 300 es
   in vec2 a_position;in vec4 a_color;uniform vec2 u_resolution;out vec4 v_color;
   void main(){vec2 p=a_position/u_resolution;vec2 c=p*2.0-1.0;gl_Position=vec4(c.x,-c.y,0.,1.);v_color=a_color;}`);
   const fs=compile(gl.FRAGMENT_SHADER,`#version 300 es
   precision highp float;in vec4 v_color;out vec4 outColor;void main(){outColor=v_color;}`);
   program=gl.createProgram();gl.attachShader(program,vs);gl.attachShader(program,fs);gl.linkProgram(program);
   gl.deleteShader(vs);gl.deleteShader(fs);
   if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(program)||"link failed");
 }catch(e){console.error("DenX WebGL V2:",e);canvas.remove();setStatus("svg","Renderer · SVG fallback");return}

 const pLoc=gl.getAttribLocation(program,"a_position"),cLoc=gl.getAttribLocation(program,"a_color"),rLoc=gl.getUniformLocation(program,"u_resolution");
 const buffer=gl.createBuffer(),vao=gl.createVertexArray();
 gl.bindVertexArray(vao);gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
 gl.enableVertexAttribArray(pLoc);gl.vertexAttribPointer(pLoc,2,gl.FLOAT,false,24,0);
 gl.enableVertexAttribArray(cLoc);gl.vertexAttribPointer(cLoc,4,gl.FLOAT,false,24,8);
 gl.bindVertexArray(null);gl.disable(gl.DEPTH_TEST);gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);

 const W=Number(drawing.width)||2048,H=Number(drawing.height)||1152;
 let scheduled=false,dead=false;

 function rgba(value,fallback="#111111"){
   let s=String(value||fallback).trim(),h;
   if((h=s.match(/^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i))){
     let x=h[1]; if(x.length===3)x=x.split("").map(c=>c+c).join("");
     return [parseInt(x.slice(0,2),16)/255,parseInt(x.slice(2,4),16)/255,parseInt(x.slice(4,6),16)/255,parseInt(x.slice(6,8)||"ff",16)/255];
   }
   return [.067,.067,.067,1];
 }
 const V=(o,p,c)=>o.push(p.x,p.y,c[0],c[1],c[2],c[3]);
 const T=(o,a,b,c,k)=>{V(o,a,k);V(o,b,k);V(o,c,k)};

 function circle(o,cx,cy,r,k,n=64){
   if(!(r>0))return;
   for(let i=0;i<n;i++){let a=i/n*Math.PI*2,b=(i+1)/n*Math.PI*2;T(o,{x:cx,y:cy},{x:cx+Math.cos(a)*r,y:cy+Math.sin(a)*r},{x:cx+Math.cos(b)*r,y:cy+Math.sin(b)*r},k)}
 }
 function line(o,a,b,w,k,rounded=true){
   const dx=b.x-a.x,dy=b.y-a.y,l=Math.hypot(dx,dy);
   if(l<.001){circle(o,a.x,a.y,Math.max(1,w/2),k);return}
   const q=Math.max(.5,w/2),nx=-dy/l*q,ny=dx/l*q;
   const A={x:a.x+nx,y:a.y+ny},B={x:a.x-nx,y:a.y-ny},C={x:b.x-nx,y:b.y-ny},D={x:b.x+nx,y:b.y+ny};
   T(o,A,B,C,k);T(o,A,C,D,k);
   if(rounded){circle(o,a.x,a.y,q,k,40);circle(o,b.x,b.y,q,k,40)}
 }
 function points(type,a,b,w){
   const dx=b.x-a.x,dy=b.y-a.y,l=Math.max(1,Math.hypot(dx,dy)),ux=dx/l,uy=dy/l,nx=-uy,ny=ux,q=Math.max(1,w/2),m={x:(a.x+b.x)/2,y:(a.y+b.y)/2};
   if(type==="triangle")return[{x:a.x-nx*q,y:a.y-ny*q},{x:a.x+nx*q,y:a.y+ny*q},{x:b.x,y:b.y}];
   if(type==="diamond")return[{x:a.x,y:a.y},{x:m.x+nx*q,y:m.y+ny*q},{x:b.x,y:b.y},{x:m.x-nx*q,y:m.y-ny*q}];
   if(type==="hexagon"){const d=l*.25,u={x:a.x+ux*d,y:a.y+uy*d},v={x:b.x-ux*d,y:b.y-uy*d};return[{x:a.x,y:a.y},{x:u.x+nx*q,y:u.y+ny*q},{x:v.x+nx*q,y:v.y+ny*q},{x:b.x,y:b.y},{x:v.x-nx*q,y:v.y-ny*q},{x:u.x-nx*q,y:u.y-ny*q}]}
   return[{x:a.x+nx*q,y:a.y+ny*q},{x:b.x+nx*q,y:b.y+ny*q},{x:b.x-nx*q,y:b.y-ny*q},{x:a.x-nx*q,y:a.y-ny*q}];
 }
 function polygon(o,p,k){for(let i=1;p&&i<p.length-1;i++)T(o,p[0],p[i],p[i+1],k)}

 function poseOf(state,id){
   const current=Number(window.denxCurrentFrame?.()||window.currentFrame||1);
   for(const store of [state?.boneFramePoses,state?.framePoses,state?.poses,state?.frames]){
     const f=store&&(store[current]||store[String(current)]),p=f&&(f[id]||f[String(id)]);
     if(p?.nodes)return p;
   }
   const f=(state?.figures||[]).find(x=>String(x.id)===String(id));
   return f?.pose?.nodes?f.pose:null;
 }

 function build(state){
   const o=[];
   for(const f of state?.figures||[]){
     const p=poseOf(state,f.id); if(!p||p.visible===false)continue; const nodes=p.nodes||{},fk=rgba(f.style?.color||f.color);
     for(const fill of f.polyfills||[]){const ps=(fill.nodeIds||[]).map(id=>nodes[id]||nodes[String(id)]).filter(Boolean);polygon(o,ps,rgba(fill.color||f.style?.color||"#00c8ff"))}
     for(const s of f.segments||[]){
       const a=nodes[s.from]||nodes[String(s.from)],b=nodes[s.to]||nodes[String(s.to)];if(!a||!b)continue;
       const k=rgba(s.style?.color||s.color||f.style?.color),w=Math.max(1,Number(s.style?.width)||Number(s.width)||Number(f.style?.thickness)||12),type=String(s.type||"rounded").toLowerCase();
       if(type==="circle")circle(o,(a.x+b.x)/2,(a.y+b.y)/2,Math.max(4,Math.hypot(b.x-a.x,b.y-a.y)/2),k,80);
       else if(["rectangle","triangle","diamond","hexagon"].includes(type))polygon(o,points(type,a,b,w),k);
       else line(o,a,b,w,k,type!=="square");
     }
     if(f.headNodeId!=null){const h=nodes[f.headNodeId]||nodes[String(f.headNodeId)];if(h)circle(o,+h.x,+h.y,Math.max(2,+f.style?.headRadius||18),fk,96)}
   }
   return o;
 }

 function resize(){
   // supersample the logical stage to keep zoomed artwork crisp
   const scale=Math.max(1,Math.min(2,window.devicePixelRatio||1));
   const w=Math.round(W*scale),h=Math.round(H*scale);
   if(canvas.width!==w)canvas.width=w;if(canvas.height!==h)canvas.height=h;
 }

 function renderNow(){
   scheduled=false;if(dead)return;resize();
   let state;try{state=window.denxBonesCaptureProjectState()}catch(e){return}
   const data=build(state);gl.viewport(0,0,canvas.width,canvas.height);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);
   if(!data.length)return;
   gl.useProgram(program);gl.uniform2f(rLoc,W,H);gl.bindVertexArray(vao);gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
   gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(data),gl.DYNAMIC_DRAW);gl.drawArrays(gl.TRIANGLES,0,data.length/6);gl.bindVertexArray(null);
 }
 function requestRender(){if(!dead&&!scheduled){scheduled=true;requestAnimationFrame(renderNow)}}

 // Direct event scheduling: pose is changed by bones.js during this same event;
 // V2 reads the completed state in the immediately following animation frame.
 ["pointerdown","pointermove","pointerup","touchstart","touchmove","touchend"].forEach(t=>layer.addEventListener(t,requestRender,{passive:true,capture:true}));
 const observer=new MutationObserver(requestRender);
 observer.observe(layer,{subtree:true,childList:true,attributes:true,attributeFilter:["cx","cy","x","y","x1","y1","x2","y2","width","height","points","transform","fill","stroke","stroke-width"]});
 ["denx:figureselectionchange","denx:toolchange","denx:textselectionchange"].forEach(t=>window.addEventListener(t,requestRender,{passive:true}));
 window.addEventListener("resize",requestRender,{passive:true});window.addEventListener("orientationchange",requestRender,{passive:true});

 canvas.addEventListener("webglcontextlost",e=>{e.preventDefault();dead=true;document.documentElement.classList.remove("denx-webgl-figures");setStatus("svg","Renderer · SVG fallback")});
 window.denxWebGLRenderer={version:"2.0",backend:"webgl2",canvas,requestRender,renderNow,isActive:()=>!dead};
 setStatus("webgl2","Renderer · WebGL2 ✓");document.documentElement.classList.add("denx-webgl-figures");requestRender();
})();