import { useEffect, useRef, useState } from 'react';
import { createSeasonalRenderer, type SceneTheme, type V3 } from './seasonal3d';
export function Theme3DCanvas({ world, motion, preview, reaction, onReady }: {
 world:SceneTheme; motion:'full'|'gentle'|'still'; preview:boolean; reaction:number; onReady:(ready:boolean)=>void;
}) {
 const canvas=useRef<HTMLCanvasElement>(null),engine=useRef<ReturnType<typeof createSeasonalRenderer>>(null);
 const [generation,setGeneration]=useState(0);
 useEffect(()=>{
  const node=canvas.current;onReady(false);
  if(!node||typeof WebGLRenderingContext==='undefined')return;
  let renderer:ReturnType<typeof createSeasonalRenderer>;
  try{renderer=createSeasonalRenderer(node,world);}catch{return;}
  if(!renderer)return;
  engine.current=renderer;onReady(true);
  let raf=0,last=0,clock=1.2,visible=true,stopped=false;
  const pointer:V3=[0,0,preview ? .12 : 0];
  const interval=1000/(motion==='full'?30:20);
  let lastPaint=0;
  const draw=(now:number)=>{
   raf=0;if(stopped||document.hidden||!visible)return;
   if(now-lastPaint>=interval){clock+=Math.min(last?now-last:0,80)/1000;last=now;lastPaint=now;renderer!.draw(clock,pointer);}
   if(motion!=='still')raf=requestAnimationFrame(draw);
  };
  const start=()=>{if(!stopped&&!document.hidden&&visible&&!raf){last=0;raf=requestAnimationFrame(draw);}};
  const resize=()=>{
   const rect=node.getBoundingClientRect();if(!rect.width||!rect.height)return;
   const dpr=Math.max(.5,Math.min(window.devicePixelRatio||1,preview?1.5:1.25,1280/rect.width,1100/rect.height));
   renderer!.resize(rect.width,rect.height,dpr);renderer!.draw(clock,pointer);start();
  };
  const visibility=()=>{if(document.hidden){cancelAnimationFrame(raf);raf=0;last=0;}else start();};
  const observer=typeof IntersectionObserver==='undefined'?null:new IntersectionObserver(([entry])=>{visible=entry.isIntersecting;if(visible)start();else{cancelAnimationFrame(raf);raf=0;last=0;}});
  observer?.observe(node);
  const ro=typeof ResizeObserver==='undefined'?null:new ResizeObserver(resize);ro?.observe(node);
  const interactive=(target:EventTarget|null)=>target instanceof Element&&!!target.closest('button,a,input,select,textarea,label,[role="button"],.member-hub,.surface-panel,.stakeys-milestone-copy,.theme-world-preview,.theme-studio,.theme-scene-overlay');
  let down:{x:number;y:number;time:number}|null=null;
  const press=(event:PointerEvent)=>{if(motion==='still'||(!preview&&interactive(event.target)))return;down={x:event.clientX,y:event.clientY,time:performance.now()};};
  const release=(event:PointerEvent)=>{
   const origin=down;down=null;if(!origin||motion==='still'||performance.now()-origin.time>600||Math.hypot(event.clientX-origin.x,event.clientY-origin.y)>12)return;
   if(!preview&&interactive(event.target))return;
   const rect=node.getBoundingClientRect(),index=renderer!.pick(event.clientX-rect.left,event.clientY-rect.top);
   if(index>=0)renderer!.poke(index);
  };
  const move=(event:PointerEvent)=>{
   if(motion==='still'||event.pointerType!=='mouse'||(!preview&&interactive(event.target)))return;
   const rect=node.getBoundingClientRect();pointer[0]=Math.max(-1,Math.min(1,(event.clientX-rect.left)/rect.width*2-1));pointer[1]=Math.max(-1,Math.min(1,1-(event.clientY-rect.top)/rect.height*2));start();
  };
  const lost=(event:Event)=>{event.preventDefault();stopped=true;cancelAnimationFrame(raf);onReady(false);};
  const restored=()=>setGeneration(n=>n+1);
  const target:HTMLElement|Window=preview?node:window;
  target.addEventListener('pointerdown',press as EventListener,{passive:true});
  target.addEventListener('pointerup',release as EventListener,{passive:true});
  target.addEventListener('pointermove',move as EventListener,{passive:true});
  node.addEventListener('webglcontextlost',lost);node.addEventListener('webglcontextrestored',restored);
  document.addEventListener('visibilitychange',visibility);window.addEventListener('resize',resize);
  resize();
  return()=>{
   stopped=true;cancelAnimationFrame(raf);observer?.disconnect();ro?.disconnect();
   target.removeEventListener('pointerdown',press as EventListener);target.removeEventListener('pointerup',release as EventListener);target.removeEventListener('pointermove',move as EventListener);
   node.removeEventListener('webglcontextlost',lost);node.removeEventListener('webglcontextrestored',restored);document.removeEventListener('visibilitychange',visibility);window.removeEventListener('resize',resize);
   renderer!.dispose();if(engine.current===renderer)engine.current=null;
  };
 },[world,motion,preview,onReady,generation]);
 useEffect(()=>{if(reaction>0&&motion!=='still')engine.current?.poke(0);},[reaction,motion]);
 return <canvas ref={canvas} className="theme-3d-canvas" aria-hidden="true" data-testid="theme-3d-canvas"/>;
}
