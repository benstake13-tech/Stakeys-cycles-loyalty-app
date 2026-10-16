import React, { useEffect, useId, useReducer, useRef, useState } from 'react';
import {
  FaceAvatar,
  FaceAvatarConfig,
  BACKDROP_OPTIONS,
  SKIN_TONE_OPTIONS,
  HAIR_STYLE_OPTIONS,
  HAIR_COLOR_OPTIONS,
  FACIAL_HAIR_OPTIONS,
  EYES_OPTIONS,
  EXPRESSION_OPTIONS,
  GLASSES_OPTIONS,
  ACCESSORY_OPTIONS,
  CLOTHING_OPTIONS,
  CLOTHING_COLORS,
  FACE_SHAPE_OPTIONS,
  PROP_OPTIONS,
  VEHICLE_OPTIONS,
  EYE_COLOR_OPTIONS,
  FACE_DETAIL_OPTIONS,
  BODY_SHAPE_OPTIONS,
  AVATAR_POSE_OPTIONS,
  BROW_STYLE_OPTIONS,
  NOSE_STYLE_OPTIONS,
  getDeterministicConfig,
  parseConfigString,
} from './FaceAvatar';

interface AvatarEditorModalProps {
  name: string;
  currentConfigString?: string;
  onSave: (configString: string) => void;
  onClose: () => void;
}

const COLLECTIONS = {
  All: CLOTHING_OPTIONS.map(o => o.id),
  "Stakey's & Workwear": ['dungarees', 'collar', 'mechanic', 'hi_vis', 'chef', 'paramedic', 'firefighter', 'stakeys_apron'],
  Everyday: ['hoodie', 'brand_tee', 'tank', 'varsity', 'racing_kit', 'leather_jacket', 'rain_shell'],
  Costumes: ['bunny', 'elf', 'skeleton', 'wizard', 'astronaut', 'pirate', 'superhero', 'pumpkin'],
};
const FIXED_COLOR_OUTFITS = new Set(['dungarees', 'brand_tee', 'mechanic', 'hi_vis', 'bunny', 'elf', 'skeleton', 'leather_jacket', 'wizard', 'chef', 'paramedic', 'firefighter', 'astronaut', 'pirate', 'pumpkin']);

type AvatarHistory = { past: FaceAvatarConfig[]; present: FaceAvatarConfig; future: FaceAvatarConfig[] };
type AvatarAction = { type: 'replace'; config: FaceAvatarConfig } | { type: 'undo' | 'redo' };
function editHistory(state: AvatarHistory, action: AvatarAction): AvatarHistory {
  if (action.type === 'replace') {
    if (JSON.stringify(action.config) === JSON.stringify(state.present)) return state;
    return { past: [...state.past.slice(-49), state.present], present: action.config, future: [] };
  }
  if (action.type === 'undo' && state.past.length) return {
    past: state.past.slice(0, -1), present: state.past[state.past.length - 1], future: [state.present, ...state.future],
  };
  if (action.type === 'redo' && state.future.length) return {
    past: [...state.past, state.present], present: state.future[0], future: state.future.slice(1),
  };
  return state;
}

type TabId = 'backdrop' | 'features' | 'model' | 'face' | 'clothes';

export const AvatarEditorModal: React.FC<AvatarEditorModalProps> = ({
  name,
  currentConfigString,
  onSave,
  onClose,
}) => {
  // Parse initial config
  const initialConfig = parseConfigString(currentConfigString, name);
  const [history, dispatch] = useReducer(editHistory, { past: [], present: initialConfig, future: [] });
  const config = history.present;
  const originalConfig = useRef(initialConfig).current;
  const setConfig = (next: FaceAvatarConfig) => dispatch({ type: 'replace', config: next });
  const [collection, setCollection] = useState<keyof typeof COLLECTIONS>('All');
  const [compareOriginal, setCompareOriginal] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const titleId = useId();

  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialogRef.current?.focus();
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); closeRef.current(); }
      if (event.key !== 'Tab') return;
      const buttons = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), [tabindex="0"]') || []);
      const first = buttons[0];
      const last = buttons[buttons.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) {
        event.preventDefault(); last?.focus();
      } else if (!event.shiftKey && (document.activeElement === last || document.activeElement === dialogRef.current)) {
        event.preventDefault(); first?.focus();
      }
    };
    const dialog = dialogRef.current;
    dialog?.addEventListener('keydown', handleKey);
    return () => {
      dialog?.removeEventListener('keydown', handleKey);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, []);
  const [activeTab, setActiveTab] = useState<TabId>('backdrop');

  const updateAttr = <K extends keyof FaceAvatarConfig>(key: K, value: FaceAvatarConfig[K]) => {
    setConfig({ ...config, [key]: value });
  };

  const handleRandomize = () => {
    const randomOption = <T,>(list: T[]): T => {
      return list[Math.floor(Math.random() * list.length)];
    };

    setConfig({
      backdrop: randomOption(BACKDROP_OPTIONS).id,
      skinTone: randomOption(SKIN_TONE_OPTIONS).id,
      hairStyle: randomOption(HAIR_STYLE_OPTIONS).id,
      hairColor: randomOption(HAIR_COLOR_OPTIONS).id,
      facialHair: randomOption(FACIAL_HAIR_OPTIONS).id,
      eyesStyle: randomOption(EYES_OPTIONS).id,
      expression: randomOption(EXPRESSION_OPTIONS).id,
      glasses: randomOption(GLASSES_OPTIONS).id,
      accessory: randomOption(ACCESSORY_OPTIONS).id,
      clothing: randomOption(CLOTHING_OPTIONS).id,
      clothingColor: randomOption(CLOTHING_COLORS),
      faceShape: randomOption(FACE_SHAPE_OPTIONS).id,
      prop: randomOption(PROP_OPTIONS).id,
      vehicle: randomOption(VEHICLE_OPTIONS).id,
      eyeColor: randomOption(EYE_COLOR_OPTIONS).id,
      faceDetail: randomOption(FACE_DETAIL_OPTIONS).id,
      bodyShape: randomOption(BODY_SHAPE_OPTIONS).id,
      pose: randomOption(AVATAR_POSE_OPTIONS).id,
      browStyle: randomOption(BROW_STYLE_OPTIONS).id,
      noseStyle: randomOption(NOSE_STYLE_OPTIONS).id,
    });
  };

  const handleResetToDefault = () => {
    setConfig(getDeterministicConfig(name));
  };

  const handleSave = () => {
    onSave(JSON.stringify(config));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-950/80 backdrop-blur-sm">
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} className="bg-[#0d1015]/95 border border-emerald-400/20 rounded-2xl w-full max-w-4xl h-[92dvh] max-h-[900px] overflow-hidden flex flex-col shadow-2xl outline-none">
        
        {/* Modal Header */}
        <div className="p-4 border-b border-neutral-800 flex items-center justify-between shrink-0">
          <div>
            <h3 id={titleId} className="text-base font-bold text-white font-mono">Customize Face Avatar</h3>
            <p className="text-xs text-neutral-400 mt-0.5">Design a personalized high-quality face for {name}</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close avatar editor"
            className="p-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-400 hover:text-white transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Modal Content */}
        <div className="flex-1 min-h-0 flex flex-col md:flex-row">
          
          {/* Left: Live Preview */}
          <div className="flex flex-col items-center gap-2 p-3 md:p-5 shrink-0 border-b md:border-b-0 md:border-r border-white/5 bg-gradient-to-b from-emerald-500/5 to-transparent">
            <div className="p-2 bg-gradient-to-br from-neutral-900/90 to-[#101b15] border border-emerald-500/20 rounded-3xl flex items-center justify-center shadow-inner shadow-emerald-950/40">
              <div className="w-32 md:w-56 aspect-square"><FaceAvatar seed={name} config={compareOriginal ? originalConfig : config} size={224} className="!w-full !h-full" /></div>
            </div>

            <button type="button" onClick={() => setCompareOriginal(v => !v)} aria-pressed={compareOriginal}
              className="text-xs text-emerald-300 underline underline-offset-4 py-1">{compareOriginal ? 'Back to editing' : 'Compare original'}</button>
            <div className="flex gap-2 w-full">
              <button type="button" disabled={!history.past.length} onClick={() => dispatch({ type: 'undo' })} className="flex-1 rounded-lg border border-neutral-700 px-3 py-2 text-xs text-white disabled:opacity-30">Undo</button>
              <button type="button" disabled={!history.future.length} onClick={() => dispatch({ type: 'redo' })} className="flex-1 rounded-lg border border-neutral-700 px-3 py-2 text-xs text-white disabled:opacity-30">Redo</button>
            </div>
            <div className="flex flex-row gap-2.5 w-full">
              <button
                onClick={handleRandomize}
                className="flex-1 py-1.5 px-3 text-[11px] font-bold rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-300 hover:text-white transition-colors cursor-pointer"
              >
                🎲 Randomize
              </button>
              <button
                onClick={handleResetToDefault}
                className="flex-1 py-1.5 px-3 text-[11px] font-bold rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-300 hover:text-white transition-colors cursor-pointer"
              >
                🔄 Reset
              </button>
            </div>
          </div>

          {/* Right: Customization Controls */}
          <div className="flex-1 min-h-0 min-w-0 flex flex-col gap-2 p-3 md:p-5">
            {/* Tabs Bar */}
            <div className="flex shrink-0 overflow-x-auto border-b border-neutral-800 text-xs font-mono font-bold">
              <button
                onClick={() => { setActiveTab('backdrop'); }}
                className={"min-w-max flex-1 px-2 pb-2 border-b-2 transition-all cursor-pointer " + (
                  activeTab === 'backdrop'
                    ? 'border-emerald-500 text-emerald-400'
                    : 'border-transparent text-neutral-400 hover:text-neutral-200'
                )}
              >
                Backdrop
              </button>
              <button
                onClick={() => { setActiveTab('features'); }}
                className={"min-w-max flex-1 px-2 pb-2 border-b-2 transition-all cursor-pointer " + (
                  activeTab === 'features'
                    ? 'border-emerald-500 text-emerald-400'
                    : 'border-transparent text-neutral-400 hover:text-neutral-200'
                )}
              >
                Hair & Skin
              </button>
              <button
                onClick={() => { setActiveTab('model'); }}
                className={"min-w-max flex-1 px-2 pb-2 border-b-2 transition-all cursor-pointer " + (
                  activeTab === 'model'
                    ? 'border-emerald-500 text-emerald-400'
                    : 'border-transparent text-neutral-400 hover:text-neutral-200'
                )}
              >
                Model & Pose
              </button>
              <button
                onClick={() => { setActiveTab('face'); }}
                className={"min-w-max flex-1 px-2 pb-2 border-b-2 transition-all cursor-pointer " + (
                  activeTab === 'face'
                    ? 'border-emerald-500 text-emerald-400'
                    : 'border-transparent text-neutral-400 hover:text-neutral-200'
                )}
              >
                Face & Gear
              </button>
              <button
                onClick={() => { setActiveTab('clothes'); }}
                className={"min-w-max flex-1 px-2 pb-2 border-b-2 transition-all cursor-pointer " + (
                  activeTab === 'clothes'
                    ? 'border-emerald-500 text-emerald-400'
                    : 'border-transparent text-neutral-400 hover:text-neutral-200'
                )}
              >
                Clothing
              </button>
            </div>

            {/* Customizer Panel */}
            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain py-2 px-1">
              
              {/* Tab 1: Backdrop */}
              {activeTab === 'backdrop' && (
                <div className="space-y-4">
                  <h4 className="text-xs font-bold font-mono uppercase tracking-wider text-neutral-400">Backdrop Gradient</h4>
                  <div className="grid grid-cols-2 gap-2.5">
                    {BACKDROP_OPTIONS.map((opt) => (
                      <button
                        key={opt.id}
                        onClick={() => { updateAttr('backdrop', opt.id); }}
                        className={"flex items-center gap-2 p-2 rounded-xl border text-[11px] font-bold text-left transition-all cursor-pointer " + (
                          config.backdrop === opt.id
                            ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400'
                            : 'border-neutral-800 bg-neutral-900/40 hover:border-neutral-700 text-neutral-300'
                        )}
                      >
                        <span
                          className="w-4 h-4 rounded-md shadow shrink-0"
                          style={{ background: "linear-gradient(135deg, " + opt.colors[0] + ", " + opt.colors[1] + ")" }}
                        />
                        {opt.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Tab 2: Hair & Skin */}
              {activeTab === 'features' && (
                <div className="space-y-4">
                  {/* Skin Tone */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold font-mono uppercase tracking-wider text-neutral-400">Skin Tone</h4>
                    <div className="flex flex-wrap gap-2">
                      {SKIN_TONE_OPTIONS.map((opt) => (
                        <button
                          key={opt.id}
                          onClick={() => { updateAttr('skinTone', opt.id); }}
                          className={"w-7 h-7 rounded-full border transition-all cursor-pointer relative " + (
                            config.skinTone === opt.id
                              ? 'border-white scale-110 shadow-lg ring-2 ring-emerald-500/50'
                              : 'border-transparent opacity-70 hover:opacity-100'
                          )}
                          style={{ backgroundColor: opt.base }}
                          title={opt.name}
                        >
                          {config.skinTone === opt.id && (
                            <span className="absolute inset-0 flex items-center justify-center text-[10px] text-neutral-950 font-bold">✓</span>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Hair Style */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold font-mono uppercase tracking-wider text-neutral-400">Hair Style</h4>
                    <div className="grid grid-cols-3 gap-2">
                      {HAIR_STYLE_OPTIONS.map((opt) => (
                        <button
                          key={opt.id}
                          onClick={() => { updateAttr('hairStyle', opt.id); }}
                          className={"py-1.5 px-2 rounded-xl border text-[10px] font-bold transition-all text-center cursor-pointer " + (
                            config.hairStyle === opt.id
                              ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400'
                              : 'border-neutral-800 bg-neutral-900/40 hover:border-neutral-700 text-neutral-300'
                          )}
                        >
                          {opt.name}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Hair Color */}
                  {config.hairStyle !== 'none' && (
                    <div className="space-y-2">
                      <h4 className="text-xs font-bold font-mono uppercase tracking-wider text-neutral-400">Hair Color</h4>
                      <div className="flex flex-wrap gap-2">
                        {HAIR_COLOR_OPTIONS.map((opt) => (
                          <button
                            key={opt.id}
                            onClick={() => { updateAttr('hairColor', opt.id); }}
                            className={"w-7 h-7 rounded-full border transition-all cursor-pointer relative " + (
                              config.hairColor === opt.id
                                ? 'border-white scale-110 shadow-lg ring-2 ring-emerald-500/50'
                                : 'border-transparent opacity-70 hover:opacity-100'
                            )}
                            style={{ background: "linear-gradient(135deg, " + opt.colors[0] + ", " + opt.colors[1] + ")" }}
                            title={opt.name}
                          >
                            {config.hairColor === opt.id && (
                              <span className="absolute inset-0 flex items-center justify-center text-[10px] text-white font-bold">✓</span>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    <h4 className="text-xs font-bold font-mono uppercase tracking-wider text-neutral-400">Face Shape</h4>
                    <div className="grid grid-cols-3 gap-2">
                      {FACE_SHAPE_OPTIONS.map((opt) => (
                        <button key={opt.id} type="button" onClick={() => updateAttr('faceShape', opt.id)} aria-pressed={config.faceShape === opt.id}
                          className={`rounded-xl border px-2 py-2 text-[10px] font-bold transition-all ${config.faceShape === opt.id ? 'border-emerald-400 bg-emerald-500/15 text-emerald-300' : 'border-neutral-800 bg-neutral-900/50 text-neutral-300'}`}>
                          {opt.name}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'model' && (
                <div className="space-y-5">
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold font-mono uppercase tracking-wider text-neutral-400">Portrait build</h4>
                    <div className="grid grid-cols-3 gap-2">
                      {BODY_SHAPE_OPTIONS.map((opt) => <button key={opt.id} type="button" onClick={() => updateAttr('bodyShape', opt.id)} aria-pressed={config.bodyShape === opt.id}
                        className={`rounded-xl border px-2 py-2 text-[11px] font-bold ${config.bodyShape === opt.id ? 'border-emerald-400 bg-emerald-500/15 text-emerald-300' : 'border-neutral-800 bg-neutral-900/50 text-neutral-300'}`}>{opt.name}</button>)}
                    </div>
                    <p className="text-[10px] text-neutral-500">Changes the shoulder and portrait silhouette.</p>
                  </div>
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold font-mono uppercase tracking-wider text-neutral-400">Pose & attitude</h4>
                    <div className="grid grid-cols-1 gap-2">
                      {AVATAR_POSE_OPTIONS.map((opt) => <button key={opt.id} type="button" onClick={() => updateAttr('pose', opt.id)} aria-pressed={config.pose === opt.id}
                        className={`rounded-xl border px-3 py-2 text-left text-[11px] font-bold ${config.pose === opt.id ? 'border-emerald-400 bg-emerald-500/15 text-emerald-300' : 'border-neutral-800 bg-neutral-900/50 text-neutral-300'}`}>{opt.name}</button>)}
                    </div>
                  </div>
                  <div className="rounded-xl border border-emerald-500/15 bg-emerald-500/5 p-3 text-[11px] leading-relaxed text-neutral-400">
                    The portrait preview updates as you choose each feature. Apply your avatar to save these choices to your profile.
                  </div>
                </div>
              )}

              {/* Tab 3: Face & Accessories */}
              {activeTab === 'face' && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold font-mono uppercase tracking-wider text-neutral-400">Eye colour</h4>
                    <div className="grid grid-cols-3 gap-2">
                      {EYE_COLOR_OPTIONS.map((opt) => <button key={opt.id} type="button" onClick={() => updateAttr('eyeColor', opt.id)} aria-pressed={config.eyeColor === opt.id}
                        className={`flex items-center gap-2 rounded-xl border px-2 py-2 text-[10px] font-bold ${config.eyeColor === opt.id ? 'border-emerald-400 bg-emerald-500/15 text-emerald-300' : 'border-neutral-800 bg-neutral-900/50 text-neutral-300'}`}>
                        <span className="h-3 w-3 rounded-full ring-1 ring-white/30" style={{ backgroundColor: opt.color }} />{opt.name}
                      </button>)}
                    </div>
                  </div>

                  {/* Eyes Style */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold font-mono uppercase tracking-wider text-neutral-400">Eyes & Expression</h4>
                    <div className="grid grid-cols-2 gap-2">
                      {EYES_OPTIONS.map((opt) => (
                        <button
                          key={opt.id}
                          onClick={() => { updateAttr('eyesStyle', opt.id); }}
                          className={"py-1.5 px-2.5 rounded-xl border text-[11px] font-bold transition-all text-left cursor-pointer " + (
                            config.eyesStyle === opt.id
                              ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400'
                              : 'border-neutral-800 bg-neutral-900/40 hover:border-neutral-700 text-neutral-300'
                          )}
                        >
                          👀 {opt.name}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <h4 className="text-xs font-bold font-mono uppercase tracking-wider text-neutral-400">Brows & nose</h4>
                    <div className="grid grid-cols-2 gap-2">
                      {BROW_STYLE_OPTIONS.map((opt) => <button key={opt.id} type="button" onClick={() => updateAttr('browStyle', opt.id)} aria-pressed={config.browStyle === opt.id}
                        className={`rounded-xl border px-2 py-2 text-[10px] font-bold ${config.browStyle === opt.id ? 'border-emerald-400 bg-emerald-500/15 text-emerald-300' : 'border-neutral-800 bg-neutral-900/50 text-neutral-300'}`}>{opt.name} brows</button>)}
                      {NOSE_STYLE_OPTIONS.map((opt) => <button key={opt.id} type="button" onClick={() => updateAttr('noseStyle', opt.id)} aria-pressed={config.noseStyle === opt.id}
                        className={`rounded-xl border px-2 py-2 text-[10px] font-bold ${config.noseStyle === opt.id ? 'border-emerald-400 bg-emerald-500/15 text-emerald-300' : 'border-neutral-800 bg-neutral-900/50 text-neutral-300'}`}>{opt.name} nose</button>)}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <h4 className="text-xs font-bold font-mono uppercase tracking-wider text-neutral-400">Skin details</h4>
                    <div className="grid grid-cols-2 gap-2">
                      {FACE_DETAIL_OPTIONS.map((opt) => <button key={opt.id} type="button" onClick={() => updateAttr('faceDetail', opt.id)} aria-pressed={config.faceDetail === opt.id}
                        className={`rounded-xl border px-2 py-2 text-[10px] font-bold ${config.faceDetail === opt.id ? 'border-emerald-400 bg-emerald-500/15 text-emerald-300' : 'border-neutral-800 bg-neutral-900/50 text-neutral-300'}`}>{opt.name}</button>)}
                    </div>
                  </div>

                  {/* Mouth Expression */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold font-mono uppercase tracking-wider text-neutral-400">Mouth Expression</h4>
                    <div className="grid grid-cols-2 gap-2">
                      {EXPRESSION_OPTIONS.map((opt) => (
                        <button
                          key={opt.id}
                          onClick={() => { updateAttr('expression', opt.id); }}
                          className={"py-1.5 px-2.5 rounded-xl border text-[11px] font-bold transition-all text-left cursor-pointer " + (
                            config.expression === opt.id
                              ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400'
                              : 'border-neutral-800 bg-neutral-900/40 hover:border-neutral-700 text-neutral-300'
                          )}
                        >
                          👄 {opt.name}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Facial Hair */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold font-mono uppercase tracking-wider text-neutral-400">Facial Hair</h4>
                    <div className="grid grid-cols-3 gap-2">
                      {FACIAL_HAIR_OPTIONS.map((opt) => (
                        <button
                          key={opt.id}
                          onClick={() => { updateAttr('facialHair', opt.id); }}
                          className={"py-1.5 px-2 rounded-xl border text-[10px] font-bold transition-all text-center cursor-pointer " + (
                            config.facialHair === opt.id
                              ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400'
                              : 'border-neutral-800 bg-neutral-900/40 hover:border-neutral-700 text-neutral-300'
                          )}
                        >
                          {opt.name}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Eyewear / Glasses */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold font-mono uppercase tracking-wider text-neutral-400">Eyewear / Glasses</h4>
                    <div className="grid grid-cols-2 gap-2">
                      {GLASSES_OPTIONS.map((opt) => (
                        <button
                          key={opt.id}
                          onClick={() => { updateAttr('glasses', opt.id); }}
                          className={"py-1.5 px-2.5 rounded-xl border text-[11px] font-bold transition-all text-left cursor-pointer " + (
                            config.glasses === opt.id
                              ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400'
                              : 'border-neutral-800 bg-neutral-900/40 hover:border-neutral-700 text-neutral-300'
                          )}
                        >
                          👓 {opt.name}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 4: Clothing & Gear */}
              {activeTab === 'clothes' && (
                <div className="space-y-4">
                  {/* Clothing */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold font-mono uppercase tracking-wider text-neutral-400">Clothing Style</h4>
                    <div className="flex flex-wrap gap-2" aria-label="Wardrobe collections">
                      {(Object.keys(COLLECTIONS) as (keyof typeof COLLECTIONS)[]).map(label => <button key={label} type="button" aria-pressed={collection === label} onClick={() => setCollection(label)}
                        className={`rounded-full border px-3 py-2 text-[11px] ${collection === label ? 'border-emerald-400 text-emerald-300 bg-emerald-500/10' : 'border-neutral-700 text-neutral-300'}`}>{label}</button>)}
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {CLOTHING_OPTIONS.filter(opt => (COLLECTIONS[collection] as string[]).includes(opt.id)).map((opt) => (
                        <button
                          key={opt.id}
                          onClick={() => { updateAttr('clothing', opt.id); }}
                          aria-pressed={config.clothing === opt.id}
                          className={"py-1.5 px-2.5 rounded-xl border text-[11px] font-bold transition-all text-left cursor-pointer " + (
                            config.clothing === opt.id
                              ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400'
                              : 'border-neutral-800 bg-neutral-900/40 hover:border-neutral-700 text-neutral-300'
                          )}
                        >
                          <span aria-hidden="true" className="block mx-auto w-16 mb-2"><FaceAvatar seed={name} config={{ ...config, clothing: opt.id, prop: 'none', vehicle: 'none' }} size={64} /></span>
                          {opt.name}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Clothing Color */}
                  {!FIXED_COLOR_OUTFITS.has(config.clothing) && (
                    <div className="space-y-2">
                      <h4 className="text-xs font-bold font-mono uppercase tracking-wider text-neutral-400">Clothing Color</h4>
                      <div className="flex flex-wrap gap-2">
                        {CLOTHING_COLORS.map((color) => (
                          <button
                            key={color}
                            onClick={() => { updateAttr('clothingColor', color); }}
                            className={"w-7 h-7 rounded-full border transition-all cursor-pointer relative " + (
                              config.clothingColor === color
                                ? 'border-white scale-110 shadow-lg ring-2 ring-emerald-500/50'
                                : 'border-transparent opacity-70 hover:opacity-100'
                            )}
                            aria-label={`Clothing colour ${color}`}
                            aria-pressed={config.clothingColor === color}
                            style={{ backgroundColor: color }}
                          >
                            {config.clothingColor === color && (
                              <span className="absolute inset-0 flex items-center justify-center text-[10px] text-white font-bold">✓</span>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Accessories */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold font-mono uppercase tracking-wider text-neutral-400">Shop Gear / Accessories</h4>
                    <div className="grid grid-cols-2 gap-2">
                      {ACCESSORY_OPTIONS.map((opt) => (
                        <button
                          key={opt.id}
                          onClick={() => { updateAttr('accessory', opt.id); }}
                          className={"py-1.5 px-2.5 rounded-xl border text-[11px] font-bold transition-all text-left cursor-pointer " + (
                            config.accessory === opt.id
                              ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400'
                              : 'border-neutral-800 bg-neutral-900/40 hover:border-neutral-700 text-neutral-300'
                          )}
                        >
                          🛠️ {opt.name}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <h4 className="text-xs font-bold font-mono uppercase tracking-wider text-neutral-400">Props</h4>
                      <div className="grid grid-cols-2 gap-2">
                        {PROP_OPTIONS.map((opt) => <button key={opt.id} type="button" onClick={() => updateAttr('prop', opt.id)} aria-pressed={config.prop === opt.id}
                          className={`rounded-xl border px-2 py-2 text-[10px] font-bold ${config.prop === opt.id ? 'border-emerald-400 bg-emerald-500/15 text-emerald-300' : 'border-neutral-800 bg-neutral-900/50 text-neutral-300'}`}>{opt.name}</button>)}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <h4 className="text-xs font-bold font-mono uppercase tracking-wider text-neutral-400">Ride</h4>
                      <div className="grid grid-cols-2 gap-2">
                        {VEHICLE_OPTIONS.map((opt) => <button key={opt.id} type="button" onClick={() => updateAttr('vehicle', opt.id)} aria-pressed={config.vehicle === opt.id}
                          className={`rounded-xl border px-2 py-2 text-[10px] font-bold ${config.vehicle === opt.id ? 'border-emerald-400 bg-emerald-500/15 text-emerald-300' : 'border-neutral-800 bg-neutral-900/50 text-neutral-300'}`}>{opt.name}</button>)}
                      </div>
                    </div>
                  </div>
                </div>
              )}

            </div>
          </div>

        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-neutral-800 flex items-center justify-end gap-3 shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold rounded-xl border border-neutral-800 text-neutral-400 hover:text-white hover:border-neutral-700 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-5 py-2 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white transition-colors cursor-pointer"
          >
            Apply Avatar
          </button>
        </div>

      </div>
    </div>
  );
};
