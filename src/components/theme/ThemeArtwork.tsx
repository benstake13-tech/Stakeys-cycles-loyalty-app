import { useId } from 'react';
import type { WorldSpec } from './worldCatalog';

/** Resolution-independent diorama: shaded volumes and separate depth layers. */
export function ThemeArtwork({ world }: { world: WorldSpec }) {
 const uid = useId().replace(/:/g, '');
 const paint = (name: string) => `url(#${uid}-${name})`;
 const snow = world.family === 'winter';
 const pumpkin = world.family === 'haunted' || world.family === 'harvest';
 const lantern = world.family === 'lantern';
 const garden = world.family === 'garden' || world.family === 'romance';
 const festival = world.family === 'festival';
 const Tree = ({x,y,scale = 1}:{x:number;y:number;scale?:number}) => <g transform={`translate(${x} ${y}) scale(${scale})`}>
   <ellipse cy="7" rx="64" ry="14" fill="#000" opacity=".22"/>
   <path d="M-8 0 L-5 -139 L7 -139 L10 0Z" fill="#54443e"/>
   {garden ? <><circle cy="-163" r="64" fill={paint('canopy')}/><circle cx="-40" cy="-124" r="40" fill={paint('canopy')}/><circle cx="40" cy="-124" r="38" fill={paint('canopy')}/><path d="M0 -26 L-27 -112 M0 -67 L30 -147" stroke="#655456" strokeWidth="7" fill="none"/></> : <>
    <path d="M0 -254 L-61 -124 L-38 -130 L-88 -53 L-58 -61 L-103 -9 Q0 27 102 -9 L58 -61 L87 -53 L38 -130 L60 -124Z" fill={paint('canopy')}/>
    <path d="M0 -254 L0 14 L-103 -9 L-58 -61 L-88 -53 L-38 -130 L-61 -124Z" fill="#000" opacity=".15"/>
    {snow && <path d="M0 -254 L-60 -124 L-23 -144 L0 -133 L24 -153 L60 -124Z M-38 -130 L-87 -53 L-40 -71 L0 -60 L43 -76 L86 -53 L38 -130 L0 -113Z" fill="#e1f3f1" opacity=".85"/>}
   </>}
   {world.id === 'christmas' && [-170,-126,-81,-39].map((y,i)=><g key={y}><path d={`M${-20-i*13} ${y} Q0 ${y+26} ${20+i*13} ${y}`} stroke="#e5b863" fill="none" strokeWidth="3"/><circle cx={15+i*9} cy={y+7} r="5" fill={i%2?'#ff6567':'#ffe299'}/><circle cx={-15-i*9} cy={y+5} r="4" fill="#fff5c5"/></g>)}
 </g>;
 const Lamp = ({x,y}:{x:number;y:number}) => <g transform={`translate(${x} ${y})`}><path d="M0 0V-140Q0-161 22-161" fill="none" stroke="#637277" strokeWidth="6"/><circle cx="22" cy="-148" r="43" fill={paint('glow')}/><path d="M10 -161H34L30 -137H14Z" fill={world.accent}/><path d="M8 -164H36" stroke="#a7afa9" strokeWidth="4"/></g>;
 return <svg className="theme-artwork" viewBox="0 0 1200 760" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
 <defs>
  <linearGradient id={`${uid}-sky`} x2="0" y2="1"><stop stopColor={world.sky}/><stop offset="1" stopColor={world.horizon}/></linearGradient>
  <radialGradient id={`${uid}-glow`}><stop stopColor={world.accent} stopOpacity=".65"/><stop offset="1" stopColor={world.accent} stopOpacity="0"/></radialGradient>
  <radialGradient id={`${uid}-canopy`} cx=".7" cy=".2" r=".9"><stop stopColor={garden?world.accent:world.foliage}/><stop offset=".58" stopColor={world.foliage}/><stop offset="1" stopColor="#0b2329"/></radialGradient>
  <linearGradient id={`${uid}-ground`} x2=".6" y2="1"><stop stopColor={world.ground}/><stop offset="1" stopColor={world.sky}/></linearGradient>
  <linearGradient id={`${uid}-roof`} x2=".4" y2="1"><stop stopColor={snow?'#dcf1ef':'#596a72'}/><stop offset="1" stopColor={snow?'#91b5c5':'#243940'}/></linearGradient>
  <linearGradient id={`${uid}-wall`}><stop stopColor="#223b41"/><stop offset="1" stopColor="#40545b"/></linearGradient>
  <linearGradient id={`${uid}-window`} x2="1" y2="1"><stop stopColor={world.accent}/><stop offset="1" stopColor="#68685e"/></linearGradient>
  <radialGradient id={`${uid}-pumpkin`} cx=".3" cy=".25"><stop stopColor="#ffc575"/><stop offset=".55" stopColor="#e67432"/><stop offset="1" stopColor="#863129"/></radialGradient>
 </defs>
 <path d="M0 0H1200V760H0Z" fill={paint('sky')}/>
 <g className="theme-depth-far">
  {Array.from({length:36},(_,i)=><circle key={i} cx={(i*173+67)%1200} cy={(i*73+23)%330} r={i%3===0?1.8:.8} fill="#fff" opacity=".45"/>)}
  <circle cx="874" cy="179" r="166" fill={paint('glow')}/><circle cx="874" cy="179" r="48" fill={world.accent} opacity=".92"/>
  {lantern && <circle cx="894" cy="163" r="45" fill={world.sky}/>}
  <path d="M0 438L134 314L214 358L358 223L508 382L636 299L806 412L975 267L1200 430V670H0Z" fill={world.foliage} opacity=".38"/>
  <path d="M0 464L177 381L297 428L432 315L568 441L740 368L942 435L1082 330L1200 431V650H0Z" fill={world.sky} opacity=".5"/>
  {snow && <path d="M358 223L306 283L345 271L366 285L383 271L410 280Z M975 267L931 310L967 303L989 316L1005 301Z" fill="#c1dedf" opacity=".65"/>}
 </g>
 <path d="M0 534Q240 404 550 490Q912 384 1200 492V760H0Z" fill={paint('ground')}/>
 {world.family === 'coast' && <><path d="M0 480Q230 443 500 493L1200 580V760H0Z" fill="#247281" opacity=".6"/><path d="M650 510L1100 530M610 527L1120 551M690 554L1080 574" stroke={world.accent} opacity=".25" strokeWidth="3"/></>}
 <path d="M634 456C558 510 652 551 774 584S872 686 704 760H355C670 640 714 627 650 595S498 520 607 456Z" fill={snow?'#6b8e9c':'#7d7877'} opacity=".65"/>
 <path d="M622 460C543 515 605 551 727 589S825 688 560 780" fill="none" stroke={world.accent} opacity=".28" strokeWidth="2"/>
 <g className="theme-depth-mid">
  {[70,180,270,1015,1120,1190].map((x,i)=><Tree key={x} x={x} y={500+i%3*30} scale={.45+(i%3)*.2}/>)}
  <ellipse cx="408" cy="614" rx="230" ry="35" fill="#000" opacity=".28"/>
  <path d="M208 458L428 420L553 481V585L331 642L208 579Z" fill={paint('wall')}/>
  <path d="M331 519L553 481V585L331 642Z" fill="#152d32"/>
  <path d="M184 466L312 354L447 333L578 484L329 530Z" fill={paint('roof')}/>
  <path d="M312 354L329 530L184 466Z" fill="#627e86" opacity=".75"/>
  <path d="M447 333L578 484L568 493L443 350L321 370L312 354Z" fill="#dce5de" opacity=".4"/>
  <path d="M340 540L538 505V547L340 584Z" fill={paint('window')}/>
  <path d="M389 533V575M443 523V565M497 514V556" stroke="#244047" strokeWidth="6"/>
  <path d="M231 498L285 519V607L231 583Z" fill="#0c2529"/><path d="M237 508L279 524V565L237 550Z" fill={paint('window')}/>
  <path d="M353 590L525 559V574L353 612Z" fill="#4e686a"/>
  <path d="M340 476L528 446V479L340 513Z" fill="#0b2027"/>
  <text x="353" y="498" transform="rotate(-10 353 498)" fill="#99f6cd" fontFamily="sans-serif" fontWeight="800" fontSize="17" letterSpacing="2">STAKEY’S CYCLES</text>
  <path d="M434 357V306L460 300V370" fill="#3c505a"/><path d="M428 306L457 294L468 300L439 312Z" fill="#829899"/>
  <Lamp x={595} y={603}/><Lamp x={812} y={682}/>
  <g transform="translate(416 632) scale(.7)" strokeLinejoin="round" fill="none">
   <ellipse cx="19" cy="21" rx="132" ry="13" fill="#000" opacity=".22" stroke="none"/>
   <circle cx="-56" cy="-9" r="43" stroke="#0a171e" strokeWidth="10"/><circle cx="104" cy="-9" r="43" stroke="#0a171e" strokeWidth="10"/>
   <circle cx="-56" cy="-9" r="36" stroke="#a5c7c3" strokeWidth="2"/><circle cx="104" cy="-9" r="36" stroke="#a5c7c3" strokeWidth="2"/>
   <path d="M-56 -9L-17 -81L29 -9H-56L69 -75L29 -9L-17 -81M69 -75L104 -9M69 -75L63 -100H87" stroke={world.accent} strokeWidth="7"/>
   <path d="M-33 -84H-4M29 -9L45 1H55" stroke="#cbd8d3" strokeWidth="7"/>
  </g>
 </g>
 <g className="theme-depth-near"><Tree x={112} y={708} scale={1.25}/><Tree x={1062} y={720} scale={1.35}/></g>
 {pumpkin && [0,1,2].map(i=><g key={i} transform={`translate(${755+i*66} ${678-i%2*23}) scale(${1-i*.13})`}><ellipse cy="20" rx="36" ry="8" fill="#000" opacity=".3"/><ellipse rx="32" ry="28" fill={paint('pumpkin')}/><path d="M0 -25L5 -37" stroke="#729366" strokeWidth="7"/><path d="M-20 -3L-9 -12L-5 0Z M8 0L12 -12L23 -3Z M-18 12L0 19L19 8L10 22L-7 24Z" fill={world.family==='haunted'?'#fff1a3':'#bc572a'}/></g>)}
 {lantern && [0,1,2,3,4].map(i=><g key={i} transform={`translate(${320+i*140} ${78+i%2*64})`} className="theme-lantern"><path d="M0 -120V0" stroke="#8a8472"/><circle cy="23" r="63" fill={paint('glow')}/><path d="M-17 0Q-29 23-17 47H17Q29 23 17 0Z" fill={paint('window')}/><path d="M-17 0H17M-17 47H17M0 47V61" stroke="#d0a567" strokeWidth="4"/></g>)}
 {festival && [0,1,2].map(i=><g key={i} transform={`translate(${215+i*380} ${140+i%2*60})`} className="theme-firework" style={{animationDelay:`${i*1.8}s`}}>{Array.from({length:16},(_,j)=><path key={j} d="M0 -32L0 -72" transform={`rotate(${j*22.5})`} stroke={i%2?'#e4b2ef':world.accent} strokeWidth="2" opacity=".6"/>)}</g>)}
 {world.family === 'romance' && <path className="theme-lantern" d="M723 250C685 221 670 247 687 265L723 297L759 265C779 241 746 221 723 250Z" fill={paint('window')}/>}
 {world.id === 'easter' && [0,1,2].map(i=><ellipse key={i} cx={730+i*38} cy={690-i%2*12} rx="17" ry="24" fill={['#ffd3eb','#b9eddf','#ffe7a7'][i]}/>)}
 {world.family === 'remembrance' && Array.from({length:16},(_,i)=><g key={i} transform={`translate(${130+i*65} ${720+(i%3)*12})`}><path d="M0 0V-29" stroke="#59735a"/><circle cy="-32" r="9" fill="#bf3447"/><circle cy="-32" r="3" fill="#13212a"/></g>)}
 </svg>;
}
