import React, { useState } from 'react';
import { RotateCcw, Camera, Sparkles, UserRound, Shirt, Scissors, Eye } from 'lucide-react';

type Section = 'Face' | 'Hair' | 'Body' | 'Outfit';
const options: Record<Section, string[]> = {
  Face: ['Face shape', 'Skin tone', 'Eyes', 'Jaw definition'],
  Hair: ['Hairstyle', 'Hair colour', 'Beard', 'Eyebrows'],
  Body: ['Height', 'Build', 'Shoulders', 'Posture'],
  Outfit: ['Jersey', 'Jacket', 'Helmet', 'Gloves'],
};

/** Premium avatar studio shell. Rendering actual photorealistic 3D requires a licensed,
 * optimised GLB or Unreal streamed character asset; no synthetic portrait is passed off as 3D.
 */
export const AvatarStudio: React.FC = () => {
  const [section, setSection] = useState<Section>('Face');
  const [values, setValues] = useState<Record<string, number>>({});
  const [angle, setAngle] = useState(0);
  const [view, setView] = useState<'portrait' | 'full'>('portrait');
  const [lighting, setLighting] = useState<'studio' | 'emerald'>('studio');
  return (
    <section className="relative overflow-hidden rounded-[30px] border border-emerald-400/20 bg-[#070d0b] text-white shadow-2xl shadow-emerald-950/30">
      <div className="pointer-events-none absolute -top-32 right-0 h-96 w-96 rounded-full bg-emerald-500/10 blur-[90px]" />
      <header className="relative flex flex-wrap items-center justify-between gap-3 border-b border-white/10 p-5 sm:p-7">
        <div><div className="mb-1 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.3em] text-emerald-400"><Sparkles size={13}/> Stakey's Cycles</div>
          <h2 className="text-2xl font-black tracking-tight sm:text-3xl">Avatar Studio <span className="text-emerald-400">/ 01</span></h2>
          <p className="mt-1 text-xs text-neutral-400">Photorealistic character creator · visual design preview</p>
        </div>
        <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1.5 text-[11px] text-amber-200">3D character asset pending</span>
      </header>
      <div className="relative grid gap-0 lg:grid-cols-[minmax(0,1fr)_310px]">
        <div className="relative flex min-h-[440px] flex-col justify-between overflow-hidden bg-[radial-gradient(ellipse_at_50%_45%,#164f38_0%,#0b211a_34%,#070d0b_73%)] p-5 sm:min-h-[570px]">
          <div className="relative z-10 flex flex-wrap gap-2">
            {(['portrait','full'] as const).map(v=><button key={v} onClick={()=>setView(v)} className={`rounded-xl border px-3 py-2 text-xs font-semibold capitalize transition ${view===v?'border-emerald-400/50 bg-emerald-500/20 text-emerald-200':'border-white/10 bg-black/30 text-neutral-400'}`}>{v==='full'?'Full body':v}</button>)}
            <button onClick={()=>setLighting(x=>x==='studio'?'emerald':'studio')} className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-xs text-neutral-200"><Camera size={14} className="mr-2 inline"/> {lighting==='studio'?'Studio light':'Emerald light'}</button>
          </div>
          <div className="relative mx-auto flex h-80 w-full max-w-sm items-center justify-center sm:h-[390px]">
            <div className={`absolute h-64 w-64 rounded-full blur-[85px] transition-colors ${lighting==='studio'?'bg-white/10':'bg-emerald-400/25'}`} />
            <div className="relative flex h-64 w-56 flex-col items-center justify-center rounded-[90px] border border-emerald-300/10 bg-gradient-to-b from-emerald-900/30 to-black/30 shadow-[0_0_90px_#00e88715] sm:h-80 sm:w-72" style={{ transform:`perspective(700px) rotateY(${angle}deg)`,transition:'transform 350ms ease' }}>
              <UserRound strokeWidth={0.65} className="h-40 w-40 text-emerald-300/35 sm:h-52 sm:w-52" />
              <p className="mt-4 text-center text-[11px] font-semibold uppercase tracking-[.16em] text-emerald-200/70">3D model preview</p>
              <p className="mt-1 text-center text-[10px] text-neutral-400">Awaiting character mesh</p>
            </div>
          </div>
          <div className="relative z-10 flex items-center justify-center gap-3">
            <button onClick={()=>setAngle(a=>a-30)} aria-label="Rotate left" className="rounded-xl border border-white/15 bg-white/5 px-5 py-3 text-sm hover:bg-white/10">↶ 30°</button>
            <button onClick={()=>setAngle(0)} aria-label="Reset rotation" className="rounded-xl border border-white/15 bg-white/5 p-3 hover:bg-white/10"><RotateCcw size={17}/></button>
            <button onClick={()=>setAngle(a=>a+30)} aria-label="Rotate right" className="rounded-xl border border-white/15 bg-white/5 px-5 py-3 text-sm hover:bg-white/10">30° ↷</button>
          </div>
        </div>
        <aside className="relative border-t border-white/10 bg-white/[.035] p-5 backdrop-blur-xl lg:border-l lg:border-t-0 sm:p-6">
          <p className="text-[10px] font-bold uppercase tracking-[.25em] text-neutral-400">Customisation</p>
          <div className="mt-4 grid grid-cols-4 gap-1.5">
            {(['Face','Hair','Body','Outfit'] as const).map((s,i)=>{const Icon=[Eye,Scissors,UserRound,Shirt][i];return <button key={s} onClick={()=>setSection(s)} className={`flex flex-col items-center gap-1.5 rounded-xl border px-1 py-3 text-[11px] transition ${section===s?'border-emerald-400/50 bg-emerald-400/15 text-emerald-200':'border-white/10 text-neutral-400 hover:bg-white/5'}`}><Icon size={17}/>{s}</button>})}
          </div>
          <h3 className="mt-7 text-lg font-bold">{section} details</h3>
          <p className="mt-1 text-xs text-neutral-500">Controls are ready for 3D morph/material binding.</p>
          <div className="mt-6 space-y-6">
            {options[section].map((option)=><label key={option} className="block"><span className="mb-2 flex justify-between text-xs text-neutral-300"><span>{option}</span><span className="font-mono text-emerald-400">{values[option]??50}%</span></span><input type="range" min="0" max="100" value={values[option]??50} onChange={e=>setValues(v=>({...v,[option]:Number(e.target.value)}))} className="w-full accent-emerald-400" /></label>)}
          </div>
          <div className="mt-8 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-xs leading-relaxed text-neutral-400">Next: connect a licensed photorealistic character mesh, morph targets, skin and hair materials, then persist avatar settings to the customer profile.</div>
        </aside>
      </div>
    </section>
  );
};
