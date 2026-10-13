import '@google/model-viewer';
import { applyAvatarAppearance, playAvatarAnimation, type AvatarModelElement } from './avatarModelBindings';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Camera, Check, ChevronLeft, ChevronRight, Dices, Eye, Glasses, HardHat, Image, RotateCcw, Save, Scissors, Shirt, Smile, Sparkles, UserRound } from 'lucide-react';

type Category = 'Face'|'Hair'|'Body'|'Outfit'|'Gear'|'Accessories'|'Background'|'Animations';
type View = 'Full body'|'Portrait'|'Close up';
type Settings = { category:Category; view:View; lighting:string; expression:string; pose:string; preset:number; skin:number; hair:number; beard:number; values:Record<string,number> };
const categories: {name:Category; icon:React.ElementType}[] = [
  {name:'Face',icon:UserRound},{name:'Hair',icon:Scissors},{name:'Body',icon:UserRound},{name:'Outfit',icon:Shirt},
  {name:'Gear',icon:HardHat},{name:'Accessories',icon:Glasses},{name:'Background',icon:Image},{name:'Animations',icon:Smile},
];
const fields:Record<Category,string[]> = {
  Face:['Skin detail','Skin roughness','Age','Eye size','Nose width','Jaw definition'],
  Hair:['Hair length','Hair volume','Curl definition','Beard density'],
  Body:['Height','Build','Shoulder width','Posture'],
  Outfit:['Jersey fit','Material detail','Accent intensity'],
  Gear:['Helmet fit','Glove fit','Gear detail'],
  Accessories:['Accessory size','Reflectivity'],
  Background:['Background intensity','Depth of field'],
  Animations:['Idle movement','Blink frequency','Expression strength'],
};
const defaults:Settings={category:'Face',view:'Portrait',lighting:'Studio',expression:'Neutral',pose:'Stand',preset:1,skin:2,hair:0,beard:1,values:{}};
const storageKey='stakeys-avatar-studio-v2';
const skins=['#e8bda0','#d6a17e','#b98463','#a47150','#805238','#603b29','#38241e'];
const hairs=['#18130f','#38251a','#72503b','#ae7845','#e2c39c','#a23e25','#d0d0d0'];
const poses=['Stand','Casual','Arms crossed','On bike','Workshop','Jersey','Winter'];
function initialSettings():Settings {
  try { const raw=localStorage.getItem(storageKey);if(raw)return {...defaults,...JSON.parse(raw)}; }catch{/* unavailable storage */}
  return defaults;
}
export const AvatarStudio:React.FC=()=>{
  const [settings,setSettings]=useState<Settings>(initialSettings);
  const [angle,setAngle]=useState(0);
  const [saved,setSaved]=useState(false);
  const [assetReady,setAssetReady]=useState(false);
  const [assetUrl,setAssetUrl]=useState('/models/stakeys-avatar.glb');
  const [modelError,setModelError]=useState('');
  const [assetName,setAssetName]=useState('');
  const [assetLoading,setAssetLoading]=useState(false);
  const modelRef=useRef<AvatarModelElement|null>(null);
  const [materialCount,setMaterialCount]=useState(0);
  const [animationReady,setAnimationReady]=useState(false);
  const blobRef=useRef<string|null>(null);
  const importModel=(file?:File)=>{
    if(!file)return;
    if(!/\.glb$/i.test(file.name)){setModelError('Choose a .glb 3D model.');return;}
    if(file.size>40*1024*1024){setModelError('The model must be 40 MB or smaller for mobile preview.');return;}
    if(blobRef.current)URL.revokeObjectURL(blobRef.current);
    const url=URL.createObjectURL(file);blobRef.current=url;
    setAssetUrl(url);setAssetReady(true);setAssetName(file.name);setModelError('');setAssetLoading(true);
  };
  const rotate=(degrees:number)=>{
    setAngle(a=>a+degrees);
    const model=modelRef.current as (HTMLElement & {getCameraOrbit?:()=>{theta:number;phi:number;radius:number|string};cameraOrbit?:string})|null;
    if(model?.getCameraOrbit){
      const orbit=model.getCameraOrbit();
      model.cameraOrbit=`${orbit.theta+degrees*Math.PI/180}rad ${orbit.phi}rad ${orbit.radius}`;
    }
  };
  const change=(patch:Partial<Settings>)=>{setSettings(s=>({...s,...patch}));setSaved(false);};
  const fieldList=fields[settings.category];
  const Icon=categories.find(c=>c.name===settings.category)?.icon??UserRound;
  const previewTransform=useMemo(()=>`perspective(850px) rotateY(${angle}deg) scale(${settings.view==='Close up'?1.18:settings.view==='Full body'?.86:1})`,[angle,settings.view]);
  useEffect(()=>{
    let mounted=true;
    fetch('/models/stakeys-avatar.glb',{method:'HEAD'}).then(r=>{if(mounted&&r.ok){setAssetReady(true);setAssetUrl('/models/stakeys-avatar.glb');}}).catch(()=>{});
    return ()=>{mounted=false; if(blobRef.current)URL.revokeObjectURL(blobRef.current);};
  },[]);
  useEffect(()=>{
    if(!assetReady)return;
    const count=applyAvatarAppearance(modelRef.current,{
      skinColor:skins[settings.skin]??skins[2],
      hairColor:hairs[settings.hair]??hairs[0],
      skinRoughness:(settings.values['Skin roughness']??50)/100,
      accentColor:'#22e68c',
    });
    setMaterialCount(count);
  },[assetReady,settings.skin,settings.hair,settings.values,assetUrl]);
  useEffect(()=>{
    if(!assetReady)return;
    const requested=settings.expression!=='Neutral'?settings.expression:settings.pose==='Stand'?'Idle':settings.pose;
    setAnimationReady(playAvatarAnimation(modelRef.current,requested));
  },[assetReady,settings.pose,settings.expression,assetUrl]);
  const save=()=>{try{localStorage.setItem(storageKey,JSON.stringify(settings));setSaved(true);}catch{setSaved(false);}};
  const load=()=>{setSettings(initialSettings());setSaved(false);};
  const randomise=()=>change({preset:Math.floor(Math.random()*5),skin:Math.floor(Math.random()*skins.length),hair:Math.floor(Math.random()*hairs.length),beard:Math.floor(Math.random()*4),values:Object.fromEntries(Object.values(fields).flat().map(k=>[k,Math.floor(Math.random()*101)]))});
  return <section className="relative isolate overflow-hidden rounded-[28px] border border-emerald-400/20 bg-[#06100e] font-sans text-white shadow-2xl shadow-emerald-950/40">
    <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_45%_25%,#13533c65,transparent_46%)]"/>
    <header className="relative flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-black/30 px-4 py-5 backdrop-blur-xl sm:px-6">
      <div><p className="text-[10px] font-bold uppercase tracking-[.3em] text-emerald-400">Stakey's Cycles · Create your identity</p><h2 className="mt-1 text-2xl font-black uppercase tracking-[.14em] sm:text-3xl">Avatar Studio</h2><p className="mt-1 text-xs text-neutral-400">Photorealistic character creator</p></div>
      <div className="flex flex-wrap gap-2"><button onClick={randomise} className="flex items-center gap-2 rounded-xl border border-emerald-500/40 px-3 py-2 text-xs text-emerald-200"><Dices size={15}/> Randomise</button><button onClick={load} className="rounded-xl border border-white/15 px-3 py-2 text-xs">Load</button><button onClick={save} className="flex items-center gap-2 rounded-xl bg-emerald-400 px-4 py-2 text-xs font-bold text-black">{saved?<Check size={15}/>:<Save size={15}/>} {saved?'Saved':'Save avatar'}</button></div>
    </header>
    <div className="relative grid min-w-0 lg:grid-cols-[110px_minmax(0,1fr)_320px]">
      <nav aria-label="Avatar customisation" className="flex gap-1 overflow-x-auto border-b border-white/10 bg-black/30 p-2 lg:flex-col lg:border-b-0 lg:border-r lg:p-3">
        {categories.map(({name,icon:NavIcon})=><button key={name} onClick={()=>change({category:name})} aria-pressed={settings.category===name} className={`flex min-w-[78px] flex-col items-center gap-2 rounded-xl border px-2 py-3 text-[11px] transition lg:min-w-0 ${settings.category===name?'border-emerald-400/50 bg-emerald-500/20 text-emerald-200':'border-transparent text-neutral-400 hover:bg-white/5'}`}><NavIcon size={19}/>{name}</button>)}
      </nav>
      <div className="relative flex min-h-[470px] min-w-0 flex-col justify-between overflow-hidden bg-[radial-gradient(ellipse_at_50%_45%,#164c38_0%,#091b16_48%,#030806_100%)] p-4 sm:min-h-[610px]">
        <div className="pointer-events-none absolute inset-0 opacity-40" style={{backgroundImage:'linear-gradient(90deg,transparent 49.9%,#55f0a622 50%,transparent 50.1%),linear-gradient(transparent 49.9%,#55f0a611 50%,transparent 50.1%)',backgroundSize:'100px 100px'}}/>
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-2"><span className="rounded-full border border-emerald-400/30 bg-black/40 px-3 py-1.5 text-[10px] uppercase tracking-[.18em] text-emerald-200">{settings.pose} · {settings.expression}</span><span className="rounded-full bg-black/50 px-3 py-1.5 text-[10px] text-neutral-300">{assetReady?'3D asset detected':'3D character asset required'}</span></div>
        <div className="relative z-10 mx-auto flex h-[320px] w-full max-w-lg items-center justify-center sm:h-[430px]">
          <div className="pointer-events-none absolute h-64 w-64 rounded-full bg-emerald-400/15 blur-[75px]"/>
          {assetReady?React.createElement('model-viewer', {ref:modelRef,src:assetUrl,'camera-controls':true,'auto-rotate':false,'interaction-prompt':'none','camera-orbit':settings.view==='Close up'?'0deg 75deg 1m':settings.view==='Full body'?'0deg 75deg 4m':'0deg 75deg 2.2m',exposure:settings.lighting==='Dramatic'?'0.7':settings.lighting==='Outdoor'?'1.4':'1.1','shadow-intensity':'1',style:{width:'100%',height:'100%',background:'transparent'},onLoad:()=>{setAssetLoading(false);setModelError('');setMaterialCount(applyAvatarAppearance(modelRef.current,{skinColor:skins[settings.skin]??skins[2],hairColor:hairs[settings.hair]??hairs[0],skinRoughness:(settings.values['Skin roughness']??50)/100,accentColor:'#22e68c'}));setAnimationReady(playAvatarAnimation(modelRef.current,settings.expression==='Neutral'?'Idle':settings.expression));},onError:()=>{setAssetLoading(false);setModelError('Could not render this model. Try a valid glTF 2.0 GLB.');}}):
          <div className="relative flex h-72 w-60 flex-col items-center justify-center rounded-[45%] border border-emerald-400/20 bg-gradient-to-b from-emerald-500/10 to-black/30 transition-transform duration-300 sm:h-80 sm:w-72" style={{transform:previewTransform,boxShadow:'0 0 110px #0ee68c1c'}}><UserRound className="h-40 w-40 text-emerald-300/35 sm:h-48 sm:w-48" strokeWidth={0.65}/><p className="mt-3 text-center text-[11px] font-bold uppercase tracking-[.16em] text-emerald-200">Character preview</p><p className="mt-1 px-4 text-center text-[10px] text-neutral-400">Add a licensed mobile-ready GLB at /public/models/stakeys-avatar.glb</p></div>}
        </div>
        <div className="relative z-10 space-y-3">
          <div className="flex flex-wrap items-center justify-center gap-2">
            <label className="cursor-pointer rounded-xl border border-emerald-400/40 bg-emerald-500/15 px-4 py-2 text-xs font-bold text-emerald-200 hover:bg-emerald-500/25">
              Import 3D avatar (.glb)
              <input type="file" accept=".glb,model/gltf-binary" className="sr-only" onChange={e=>{importModel(e.target.files?.[0]);e.target.value='';}}/>
            </label>
            {assetName&&<span className="max-w-[180px] truncate text-xs text-neutral-400" title={assetName}>{assetName}</span>}
            {assetLoading&&<span className="text-xs text-emerald-300">Loading model…</span>}
          </div>
          {modelError&&<p role="alert" className="text-center text-xs text-rose-300">{modelError}</p>}
          {assetReady&&<p className="text-center text-[10px] text-neutral-400">{materialCount>0?`${materialCount} material(s) linked`:'Name model materials Skin, Hair or Jersey Accent to enable recolouring'} · {animationReady?'Animation linked':'Animation requires named GLB clips'}</p>}
          <div className="flex items-center justify-center gap-2"><button aria-label="Rotate left" onClick={()=>rotate(-30)} className="rounded-xl border border-white/15 bg-black/40 p-3"><ChevronLeft size={18}/></button><button aria-label="Reset rotation" onClick={()=>{setAngle(0);const m=modelRef.current as (HTMLElement & {cameraOrbit?:string})|null;if(m)m.cameraOrbit='0deg 75deg auto';}} className="rounded-xl border border-white/15 bg-black/40 p-3"><RotateCcw size={18}/></button><button aria-label="Rotate right" onClick={()=>rotate(30)} className="rounded-xl border border-white/15 bg-black/40 p-3"><ChevronRight size={18}/></button></div>
          <div className="flex gap-2 overflow-x-auto pb-1">{poses.map(p=><button key={p} onClick={()=>change({pose:p})} className={`shrink-0 rounded-xl border px-3 py-2 text-xs ${settings.pose===p?'border-emerald-400 bg-emerald-500/20 text-emerald-200':'border-white/15 bg-black/40 text-neutral-300'}`}>{p}</button>)}</div>
        </div>
      </div>
      <aside className="min-w-0 border-t border-white/10 bg-[#071310]/95 p-5 backdrop-blur-xl lg:border-l lg:border-t-0">
        <div className="flex items-center gap-2"><Icon className="text-emerald-400" size={20}/><h3 className="text-xl font-black uppercase">{settings.category}</h3></div>
        <p className="mt-1 text-xs text-neutral-500">Select presets and fine-tune details</p>
        <p className="mt-6 text-[10px] font-bold uppercase tracking-widest text-neutral-400">{settings.category} presets</p>
        <div className="mt-3 grid grid-cols-5 gap-2">{[0,1,2,3,4].map(n=><button key={n} aria-label={`Preset ${n+1}`} onClick={()=>change({preset:n})} className={`aspect-square rounded-xl border bg-gradient-to-br from-emerald-950 to-neutral-800 text-xs ${settings.preset===n?'border-emerald-400 ring-2 ring-emerald-400/30':'border-white/15'}`}>{n+1}</button>)}</div>
        {(settings.category==='Face'||settings.category==='Body')&&<><p className="mt-6 text-[10px] font-bold uppercase tracking-widest text-neutral-400">Skin tone</p><div className="mt-3 flex flex-wrap gap-2">{skins.map((c,i)=><button key={c} onClick={()=>change({skin:i})} aria-label={`Skin tone ${i+1}`} className={`h-8 w-8 rounded-full border-2 ${settings.skin===i?'border-emerald-400 ring-2 ring-emerald-400/30':'border-white/20'}`} style={{backgroundColor:c}}/>)}</div></>}
        {(settings.category==='Hair'||settings.category==='Face')&&<><p className="mt-6 text-[10px] font-bold uppercase tracking-widest text-neutral-400">Hair colour</p><div className="mt-3 flex flex-wrap gap-2">{hairs.map((c,i)=><button key={i} onClick={()=>change({hair:i})} aria-label={`Hair colour ${i+1}`} className={`h-8 w-8 rounded-full border-2 ${settings.hair===i?'border-emerald-400 ring-2 ring-emerald-400/30':'border-white/20'}`} style={{backgroundColor:c}}/>)}</div></>}
        <div className="mt-7 space-y-5">{fieldList.map(k=><label key={k} className="block"><span className="mb-2 flex justify-between text-xs text-neutral-300"><span>{k}</span><span className="font-mono text-emerald-400">{settings.values[k]??50}</span></span><input className="w-full accent-emerald-400" type="range" min={0} max={100} value={settings.values[k]??50} onChange={e=>change({values:{...settings.values,[k]:Number(e.target.value)}})}/></label>)}</div>
      </aside>
    </div>
    <footer className="relative grid gap-4 border-t border-white/10 bg-black/35 p-4 sm:grid-cols-3 sm:p-5">
      <div><p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-neutral-400"><Eye size={13} className="mr-1 inline"/> View</p><div className="flex flex-wrap gap-1">{(['Full body','Portrait','Close up'] as const).map(v=><button key={v} onClick={()=>change({view:v})} className={`rounded-lg border px-3 py-2 text-xs ${settings.view===v?'border-emerald-400 bg-emerald-400/15 text-emerald-200':'border-white/15 text-neutral-400'}`}>{v}</button>)}</div></div>
      <div><p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-neutral-400"><Camera size={13} className="mr-1 inline"/> Lighting</p><div className="flex flex-wrap gap-1">{['Studio','Workshop','Outdoor','Dramatic'].map(v=><button key={v} onClick={()=>change({lighting:v})} className={`rounded-lg border px-3 py-2 text-xs ${settings.lighting===v?'border-emerald-400 bg-emerald-400/15 text-emerald-200':'border-white/15 text-neutral-400'}`}>{v}</button>)}</div></div>
      <div><p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-neutral-400"><Sparkles size={13} className="mr-1 inline"/> Expression</p><div className="flex flex-wrap gap-1">{['Neutral','Smile','Serious','Focused'].map(v=><button key={v} onClick={()=>change({expression:v})} className={`rounded-lg border px-3 py-2 text-xs ${settings.expression===v?'border-emerald-400 bg-emerald-400/15 text-emerald-200':'border-white/15 text-neutral-400'}`}>{v}</button>)}</div></div>
    </footer>
    <p className="relative border-t border-white/10 px-5 py-3 text-[11px] leading-relaxed text-neutral-500">Import a mobile-ready GLB to preview it in interactive 3D. Rotation, camera distance and exposure work with compatible models. Skin/hair swatches now recolour compatible named glTF materials, and poses/expressions trigger matching animation clips. Other sliders require matching morph targets and rigging. No photorealistic model is bundled yet.</p>
  </section>;
};
