(() => {
  "use strict";

  const stage=document.getElementById("stage");
  const drawing=document.getElementById("drawingCanvas");
  const figureLayer=document.getElementById("figureLayer");

  if(!stage||!drawing||!figureLayer||typeof window.denxBonesCaptureProjectState!=="function")return;
  if(document.getElementById("denxWebGLFigureLayer"))return;

  const canvas=document.createElement("canvas");
  canvas.id="denxWebGLFigureLayer";
  canvas.setAttribute("aria-hidden","true");

  figureLayer.parentNode.insertBefore(canvas,figureLayer);

  const gl=canvas.getContext("webgl2",{
    alpha:true,
    antialias:true,
    depth:false,
    stencil:false,
    premultipliedAlpha:true,
    preserveDrawingBuffer:false,
    powerPreference:"high-performance"
  });

  if(!gl){
    canvas.remove();
    window.denxRendererBackend="svg";
    return;
  }

  const vertexSource=`#version 300 es
    in vec2 a_position;
    in vec4 a_color;
    uniform vec2 u_resolution;
    out vec4 v_color;
    void main(){
      vec2 zeroToOne=a_position/u_resolution;
      vec2 clip=(zeroToOne*2.0)-1.0;
      gl_Position=vec4(clip.x,-clip.y,0.0,1.0);
      v_color=a_color;
    }`;

  const fragmentSource=`#version 300 es
    precision mediump float;
    in vec4 v_color;
    out vec4 outColor;
    void main(){
      outColor=v_color;
    }`;

  function shader(type,source){
    const s=gl.createShader(type);
    gl.shaderSource(s,source);
    gl.compileShader(s);
    if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)){
      const msg=gl.getShaderInfoLog(s)||"WebGL shader compile failed";
      gl.deleteShader(s);
      throw new Error(msg);
    }
    return s;
  }

  let program;
  try{
    const vs=shader(gl.VERTEX_SHADER,vertexSource);
    const fs=shader(gl.FRAGMENT_SHADER,fragmentSource);
    program=gl.createProgram();
    gl.attachShader(program,vs);
    gl.attachShader(program,fs);
    gl.linkProgram(program);
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    if(!gl.getProgramParameter(program,gl.LINK_STATUS)){
      throw new Error(gl.getProgramInfoLog(program)||"WebGL program link failed");
    }
  }catch(error){
    console.error("DenX WebGL renderer init failed:",error);
    canvas.remove();
    window.denxRendererBackend="svg";
    return;
  }

  const positionLoc=gl.getAttribLocation(program,"a_position");
  const colorLoc=gl.getAttribLocation(program,"a_color");
  const resolutionLoc=gl.getUniformLocation(program,"u_resolution");
  const buffer=gl.createBuffer();
  const vao=gl.createVertexArray();

  gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER,buffer);

  const stride=6*4;
  gl.enableVertexAttribArray(positionLoc);
  gl.vertexAttribPointer(positionLoc,2,gl.FLOAT,false,stride,0);
  gl.enableVertexAttribArray(colorLoc);
  gl.vertexAttribPointer(colorLoc,4,gl.FLOAT,false,stride,2*4);

  gl.bindVertexArray(null);

  gl.disable(gl.DEPTH_TEST);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);

  let scheduled=false;
  let dead=false;

  function parseColor(value,fallback="#111111"){
    let s=String(value||fallback).trim();

    if(s.startsWith("#")){
      let hex=s.slice(1);
      if(hex.length===3) hex=hex.split("").map(c=>c+c).join("");
      if(hex.length===6 || hex.length===8){
        const r=parseInt(hex.slice(0,2),16)/255;
        const g=parseInt(hex.slice(2,4),16)/255;
        const b=parseInt(hex.slice(4,6),16)/255;
        const a=hex.length===8?parseInt(hex.slice(6,8),16)/255:1;
        return [r,g,b,a];
      }
    }

    const m=s.match(/rgba?\(([^)]+)\)/i);
    if(m){
      const p=m[1].split(",").map(v=>Number(v.trim()));
      return [
        Math.max(0,Math.min(255,p[0]||0))/255,
        Math.max(0,Math.min(255,p[1]||0))/255,
        Math.max(0,Math.min(255,p[2]||0))/255,
        p.length>3?Math.max(0,Math.min(1,p[3])):1
      ];
    }

    return [0.067,0.067,0.067,1];
  }

  function pushVertex(out,x,y,c){
    out.push(x,y,c[0],c[1],c[2],c[3]);
  }

  function pushTri(out,a,b,c,color){
    pushVertex(out,a.x,a.y,color);
    pushVertex(out,b.x,b.y,color);
    pushVertex(out,c.x,c.y,color);
  }

  function addCircle(out,cx,cy,r,color,steps=18){
    if(!Number.isFinite(r)||r<=0)return;
    for(let i=0;i<steps;i++){
      const a=(i/steps)*Math.PI*2;
      const b=((i+1)/steps)*Math.PI*2;
      pushTri(
        out,
        {x:cx,y:cy},
        {x:cx+Math.cos(a)*r,y:cy+Math.sin(a)*r},
        {x:cx+Math.cos(b)*r,y:cy+Math.sin(b)*r},
        color
      );
    }
  }

  function addLine(out,a,b,width,color,rounded=true){
    if(!a||!b)return;
    const dx=b.x-a.x,dy=b.y-a.y;
    const length=Math.hypot(dx,dy);
    if(length<0.001){
      addCircle(out,a.x,a.y,Math.max(1,width/2),color);
      return;
    }

    const half=Math.max(.5,width/2);
    const nx=(-dy/length)*half;
    const ny=(dx/length)*half;

    const p1={x:a.x+nx,y:a.y+ny};
    const p2={x:a.x-nx,y:a.y-ny};
    const p3={x:b.x-nx,y:b.y-ny};
    const p4={x:b.x+nx,y:b.y+ny};

    pushTri(out,p1,p2,p3,color);
    pushTri(out,p1,p3,p4,color);

    if(rounded){
      addCircle(out,a.x,a.y,half,color,12);
      addCircle(out,b.x,b.y,half,color,12);
    }
  }

  function addPolygon(out,points,color){
    if(points.length<3)return;
    // Figure Creator polyfills are typically simple/convex. This fan keeps
    // Renderer V1 dependency-free; concave triangulation can come later.
    for(let i=1;i<points.length-1;i++){
      pushTri(out,points[0],points[i],points[i+1],color);
    }
  }

  function resize(){
    const w=Math.max(1,Number(drawing.width)||2048);
    const h=Math.max(1,Number(drawing.height)||1152);
    if(canvas.width!==w)canvas.width=w;
    if(canvas.height!==h)canvas.height=h;
  }

  function poseFor(state,figureId,frame){
    const frames=state?.framePoses||{};
    const framePose=frames[frame]||frames[String(frame)]||{};
    return framePose[figureId]||framePose[String(figureId)]||null;
  }

  function buildVertices(state){
    const out=[];
    const frame=Number(window.denxCurrentFrame?.()||1);

    for(const figure of state?.figures||[]){
      const pose=poseFor(state,figure.id,frame);
      if(!pose||pose.visible===false)continue;

      const nodes=pose.nodes||{};
      const figureColor=parseColor(figure.style?.color||figure.color||"#111111");

      for(const poly of figure.polyfills||[]){
        const points=(poly.nodeIds||[])
          .map(id=>nodes[id]||nodes[String(id)])
          .filter(Boolean);
        addPolygon(out,points,parseColor(poly.color||figure.style?.color||"#111111"));
      }

      for(const segment of figure.segments||[]){
        const a=nodes[segment.from]||nodes[String(segment.from)];
        const b=nodes[segment.to]||nodes[String(segment.to)];
        if(!a||!b)continue;

        const color=parseColor(
          segment.style?.color||
          segment.color||
          figure.style?.color||
          "#111111"
        );

        const width=Math.max(
          1,
          Number(segment.style?.width)||
          Number(segment.width)||
          Number(figure.style?.thickness)||
          12
        );

        const type=String(segment.type||"rounded").toLowerCase();

        if(type==="circle"){
          const radius=Math.max(2,Math.hypot(b.x-a.x,b.y-a.y)/2);
          addCircle(out,(a.x+b.x)/2,(a.y+b.y)/2,radius,color,24);
        }else{
          addLine(out,a,b,width,color,type!=="rectangle"&&type!=="square");
        }
      }

      if(figure.headNodeId!=null){
        const head=nodes[figure.headNodeId]||nodes[String(figure.headNodeId)];
        if(head){
          addCircle(
            out,
            Number(head.x),
            Number(head.y),
            Math.max(2,Number(figure.style?.headRadius)||18),
            figureColor,
            28
          );
        }
      }
    }

    return out;
  }

  function renderNow(){
    scheduled=false;
    if(dead)return;

    resize();

    let state;
    try{
      state=window.denxBonesCaptureProjectState();
    }catch(error){
      console.warn("DenX WebGL snapshot failed:",error);
      return;
    }

    const vertices=buildVertices(state);

    gl.viewport(0,0,canvas.width,canvas.height);
    gl.clearColor(0,0,0,0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    if(!vertices.length)return;

    gl.useProgram(program);
    gl.uniform2f(resolutionLoc,canvas.width,canvas.height);

    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
    gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(vertices),gl.DYNAMIC_DRAW);
    gl.drawArrays(gl.TRIANGLES,0,vertices.length/6);
    gl.bindVertexArray(null);
  }

  function schedule(){
    if(dead||scheduled)return;
    scheduled=true;
    requestAnimationFrame(renderNow);
  }

  // Figure SVG remains the interaction model. Any geometry mutation schedules
  // one GPU redraw for that animation frame.
  const observer=new MutationObserver(schedule);
  observer.observe(figureLayer,{
    subtree:true,
    childList:true,
    attributes:true,
    attributeFilter:[
      "cx","cy","x","y","width","height","points",
      "transform","fill","stroke","stroke-width"
    ]
  });

  [
    "denx:figureselectionchange",
    "denx:toolchange",
    "denx:textselectionchange"
  ].forEach(name=>window.addEventListener(name,schedule,{passive:true}));

  window.addEventListener("resize",schedule,{passive:true});

  canvas.addEventListener("webglcontextlost",event=>{
    event.preventDefault();
    dead=true;
    document.documentElement.classList.remove("denx-webgl-figures");
    window.denxRendererBackend="svg";
  });

  canvas.addEventListener("webglcontextrestored",()=>{
    // Context restoration requires recreating buffers/programs; safest V1
    // fallback is SVG until reload instead of risking a broken editor.
    dead=true;
    document.documentElement.classList.remove("denx-webgl-figures");
    window.denxRendererBackend="svg";
  });

  window.denxWebGLRenderer={
    version:"1.0",
    backend:"webgl2",
    canvas,
    requestRender:schedule,
    isActive:()=>!dead
  };

  window.denxRendererBackend="webgl2";
  document.documentElement.classList.add("denx-webgl-figures");

  schedule();
})();