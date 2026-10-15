import type { MilestoneKind } from './milestoneAnimations';

export const MILESTONE_NOTICE_MS = 4200;
export const MILESTONE_ART_MS = 2700;
export interface MotionPoint { x: number; y: number }
const clamp = (n: number) => Math.min(1, Math.max(0, n));
const easeOut = (n: number) => 1 - Math.pow(1 - clamp(n), 3);
const num = (n: number) => Number(n.toFixed(3));

/** Two rigid leg segments solve to the rotating pedal, rather than pivoting a stick. */
export function pedalPose(angle: number, bob = 0) {
  const a = Number.isFinite(angle) ? angle : 0;
  const hip = { x:194, y:91 + bob };
  const pedal = { x:220 + 18 * Math.cos(a), y:164 + 18 * Math.sin(a) };
  const dx = pedal.x - hip.x, dy = pedal.y - hip.y;
  const distance = Math.hypot(dx, dy);
  const along = (55 * 55 - 56 * 56 + distance * distance) / (2 * distance);
  const height = Math.sqrt(Math.max(0, 55 * 55 - along * along));
  const knee = { x:hip.x + dx / distance * along + dy / distance * height, y:hip.y + dy / distance * along - dx / distance * height };
  return { hip, knee, pedal };
}
const legPath = (p: ReturnType<typeof pedalPose>) => 'M' + num(p.hip.x) + ' ' + num(p.hip.y) + 'L' + num(p.knee.x) + ' ' + num(p.knee.y) + 'L' + num(p.pedal.x) + ' ' + num(p.pedal.y);
const shoe = (p: MotionPoint) => 'translate(' + num(p.x) + ' ' + num(p.y) + ')';

/** The same timeline drives the app and exported preview frames. All values are deterministic. */
export function milestoneFrame(elapsedMs: number) {
  const t = Math.max(0, Number.isFinite(elapsedMs) ? elapsedMs : 0);
  const travel = clamp(t / 1850);
  const pedalAngle = t / 650 * Math.PI * 2 - Math.PI / 3;
  const bob = Math.sin(pedalAngle * 2) * 1.1;
  const front = pedalPose(pedalAngle, bob), back = pedalPose(pedalAngle + Math.PI, bob);
  const settle = clamp((t - 1330) / 700);
  const backEase = 1 + 2.15 * Math.pow(settle - 1, 3) + 1.15 * Math.pow(settle - 1, 2);
  const scale = .32 + .68 * backEase;
  const burst = clamp((t - 1660) / 850);
  const radius = 65 + easeOut(burst) * 45;
  const sparkOpacity = Math.sin(burst * Math.PI) * (1 - burst * .5);
  return {
    rideOpacity:num(clamp(t / 170) * (1 - clamp((t - 1360) / 490))),
    rideTransform:'translate(' + num(-310 + travel * 540) + ' 0) translate(240 218) scale(' + num(.9 - .25 * clamp((t - 1340) / 510)) + ') translate(-240 -218)',
    frontPath:legPath(front), backPath:legPath(back),
    frontShoe:shoe(front.pedal), backShoe:shoe(back.pedal),
    bodyTransform:'translate(0 ' + num(bob) + ')',
    crankTransform:'rotate(' + num(pedalAngle * 180 / Math.PI) + ' 220 164)',
    wheelAngle:num(t * .56),
    resultOpacity:num(clamp((t - 1300) / 220)),
    resultTransform:'translate(240 122) scale(' + num(scale) + ') translate(-240 -122)',
    haloOpacity:num(clamp((t - 1310) / 250) * (.34 - .2 * easeOut((t - 1700) / 800))),
    ringOffset:num(1 - easeOut((t - 1430) / 680)),
    drawOffset:num(1 - easeOut((t - 1650) / 520)),
    sparks:Array.from({ length:8 }, (_,i) => {
      const a = i / 8 * Math.PI * 2 - Math.PI / 2;
      return { transform:'translate(' + num(240 + Math.cos(a) * radius) + ' ' + num(122 + Math.sin(a) * radius) + ') rotate(' + i * 45 + ') scale(' + num(.6 + Math.sin(burst * Math.PI) * .55) + ')', opacity:num(sparkOpacity * (i % 2 ? .45 : .85)) };
    }),
  };
}

function outcome(kind: MilestoneKind, paint: (name: string) => string) {
  const stroke = ' stroke="' + paint('ink') + '" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"';
  const draw = ' data-draw="" stroke-dasharray="100"';
  switch (kind) {
    case 'garage': return [
      '<path d="M181 112L240 66L299 112" fill="none"' + stroke + '/>',
      '<path d="M192 107V172H288V107L240 77Z" fill="' + paint('surface') + '"' + stroke + '/>',
      '<rect x="208" y="117" width="64" height="55" rx="5" fill="#091c15" stroke="#6ccc9b" stroke-width="1.4"/>',
      '<path d="M213 128H267M213 138H267" stroke="#629b7e" stroke-opacity=".45"/>',
      '<g stroke="#c9ffe1" stroke-width="2.2" fill="none"><circle cx="225" cy="156" r="8"/><circle cx="256" cy="156" r="8"/><path d="M225 156L233 141L243 156H225L249 143L256 156M231 141H237M249 143L246 137H252"/></g>',
      '<path d="M187 175H293" stroke="#ceffe2" stroke-width="3" stroke-linecap="round"/>',
    ].join('');
    case 'listing': return [
      '<path d="M191 78H251L289 116L232 173L184 125V85Q184 78 191 78Z" fill="' + paint('surface') + '"' + stroke + '/>',
      '<circle cx="207" cy="100" r="7" fill="#071b11" stroke="#abf5cc" stroke-width="2"/>',
      '<path d="M228 109L258 139M218 119L239 140" stroke="#c3ffe0" stroke-width="5" stroke-linecap="round"/>',
      '<path d="M258 73L283 99" stroke="#84cfaa" stroke-width="2" stroke-linecap="round" opacity=".55"/>',
    ].join('');
    case 'sale': return [
      '<path d="M198 99H282L291 171H189Z" fill="' + paint('surface') + '"' + stroke + '/>',
      '<path d="M221 101V86C221 60 259 60 259 86V101" fill="none"' + stroke + '/>',
      '<path d="M218 135L235 152L263 121" fill="none" stroke="#d7ffe8" stroke-width="6"' + draw + ' stroke-linecap="round" stroke-linejoin="round"/>',
    ].join('');
    case 'reward': return [
      '<rect x="189" y="105" width="102" height="65" rx="8" fill="' + paint('surface') + '"' + stroke + '/>',
      '<rect x="183" y="91" width="114" height="23" rx="5" fill="' + paint('ink') + '"/>',
      '<path d="M240 93C201 96 199 62 215 65C229 66 234 82 240 93C246 82 251 66 265 65C281 62 279 96 240 93Z" fill="none"' + stroke + '/>',
      '<path d="M232 93H248V170H232Z" fill="#d2ffe4" opacity=".9"/>',
      '<path d="M194 119V163" stroke="#dbffe8" opacity=".3"/>',
    ].join('');
    case 'voucher': return [
      '<path d="M186 88H294V112C276 112 276 136 294 136V160H186V136C204 136 204 112 186 112Z" fill="' + paint('surface') + '"' + stroke + '/>',
      '<path d="M265 94V154" stroke="#b8e6ca" stroke-width="2" stroke-dasharray="3 5"/>',
      '<text x="223" y="139" text-anchor="middle" font-family="Arial,sans-serif" font-size="43" font-weight="700" fill="#dcffeb">£</text>',
      '<path d="M205 98H247" stroke="#caffdf" opacity=".3" stroke-linecap="round"/>',
    ].join('');
    case 'prize': return [
      '<path d="M207 76H273V113C273 157 207 157 207 113Z" fill="' + paint('gold') + '" stroke="#ffe9a8" stroke-width="2.5"/>',
      '<path d="M207 84H188V99C188 119 196 127 211 127M273 84H292V99C292 119 284 127 269 127" fill="none" stroke="#edbc57" stroke-width="5" stroke-linecap="round"/>',
      '<path d="M240 146V170M219 173H261" stroke="#ffda80" stroke-width="6" stroke-linecap="round"/>',
      '<path d="M240 94L244 104L255 105L247 112L249 123L240 117L231 123L233 112L225 105L236 104Z" fill="#77542b" opacity=".7"/>',
      '<path d="M215 82V111Q215 127 227 133" fill="none" stroke="#fff6cf" stroke-opacity=".6" stroke-width="3" stroke-linecap="round"/>',
    ].join('');
    case 'welcome': return [
      '<path d="M240 68L285 85V121C285 146 269 165 240 180C211 165 195 146 195 121V85Z" fill="' + paint('surface') + '"' + stroke + '/>',
      '<path d="M216 122L234 140L265 104" fill="none" stroke="#caffdf" stroke-width="6"' + draw + ' stroke-linecap="round" stroke-linejoin="round"/>',
      '<path d="M204 90L240 77L276 90" stroke="#d7ffe7" opacity=".3" stroke-width="2" fill="none"/>',
    ].join('');
    default: return '<path d="M208 123L232 147L275 99" fill="none" stroke="' + paint('ink') + '" stroke-width="8"' + draw + ' stroke-linecap="round" stroke-linejoin="round"/>';
  }
}

/** Only fixed, authored SVG and numerical motion enter this markup; no user text or remote SVG. */
export function milestoneSvgMarkup(kind: MilestoneKind, identifier: string, elapsedMs = MILESTONE_ART_MS) {
  const id = identifier.replace(/[^a-zA-Z0-9_-]/g, '') || 'stakeys-milestone';
  const paint = (name: string) => 'url(#' + id + '-' + name + ')';
  const f = milestoneFrame(elapsedMs);
  const gold = kind === 'prize' || kind === 'reward' || kind === 'voucher';
  const accent = gold ? '#f3d38c' : '#9affc7';
  const drawn = outcome(kind,paint).replace(/data-draw=""/g, 'data-draw="" stroke-dashoffset="' + num(f.drawOffset * 100) + '"');
  return [
    '<defs>',
    '<linearGradient id="' + id + '-ink" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#d9ffe8"/><stop offset=".5" stop-color="#69e7a5"/><stop offset="1" stop-color="#0abf71"/></linearGradient>',
    '<linearGradient id="' + id + '-surface" x1="0" y1="0" x2=".8" y2="1"><stop stop-color="#28694c"/><stop offset=".5" stop-color="#12422d"/><stop offset="1" stop-color="#092b1d"/></linearGradient>',
    '<linearGradient id="' + id + '-rim" x1="0" y1="0" x2=".8" y2="1"><stop stop-color="#c6e8d6"/><stop offset="1" stop-color="#3a6651"/></linearGradient>',
    '<linearGradient id="' + id + '-jersey" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#d2ffe3"/><stop offset=".45" stop-color="#70e3a5"/><stop offset="1" stop-color="#178955"/></linearGradient>',
    '<linearGradient id="' + id + '-gold" x1="0" y1="0" x2=".8" y2="1"><stop stop-color="#fff4c5"/><stop offset=".43" stop-color="#eac16c"/><stop offset="1" stop-color="#9c672f"/></linearGradient>',
    '<radialGradient id="' + id + '-glow"><stop stop-color="' + accent + '" stop-opacity=".5"/><stop offset="1" stop-color="' + accent + '" stop-opacity="0"/></radialGradient>',
    '<radialGradient id="' + id + '-shadow"><stop stop-color="#00180c" stop-opacity=".4"/><stop offset="1" stop-color="#00180c" stop-opacity="0"/></radialGradient>',
    '<clipPath id="' + id + '-bounds"><path d="M0 0H480V240H0Z"/></clipPath>',
    '</defs>',
    '<g clip-path="' + paint('bounds') + '">',
    '<g data-ride="" opacity="' + f.rideOpacity + '" transform="' + f.rideTransform + '" stroke-linecap="round" stroke-linejoin="round">',
    '<ellipse cx="230" cy="222" rx="148" ry="8" fill="' + paint('shadow') + '"/>',
    '<path d="M43 128H13M55 141H8M55 155H27" stroke="#6ee6a3" stroke-width="1.7" opacity=".36"/>',
    '<path data-back-leg="" d="' + f.backPath + '" stroke="#1b8254" stroke-width="11" fill="none"/>',
    '<g data-back-shoe="" transform="' + f.backShoe + '"><path d="M-8-4H2L9-1L15 0V4H-9Z" fill="#215b3c"/><path d="M-8 4H15" stroke="#72c48f" stroke-width="2"/></g>',
    ...[132,326].map(cx => [
      '<g><circle cx="' + cx + '" cy="172" r="46" fill="#0c2018" fill-opacity=".18" stroke="#0b261b" stroke-width="7"/>',
      '<circle cx="' + cx + '" cy="172" r="43.5" stroke="' + paint('rim') + '" stroke-width="2" fill="none"/>',
      '<circle cx="' + cx + '" cy="172" r="40" stroke="#75b38e" stroke-opacity=".35" stroke-width=".7" fill="none"/>',
      '<g data-spokes="" data-cx="' + cx + '" transform="rotate(' + f.wheelAngle + ' ' + cx + ' 172)" stroke="#a2d5b5" stroke-width=".8" opacity=".6">',
      ...Array.from({length:8},(_,i)=>'<path d="M' + cx + ' 130V214" transform="rotate(' + i*22.5 + ' ' + cx + ' 172)"/>'),
      '</g><circle cx="' + cx + '" cy="172" r="4" fill="#d0f6dd"/></g>',
    ].join('')),
    '<path d="M132 172L190 104L220 164H132M190 104H292L220 164M292 104L326 172M190 104L184 91M292 104L284 80L306 78" stroke="#082b1a" stroke-width="9" fill="none"/>',
    '<path d="M132 172L190 104L220 164H132M190 104H292L220 164M292 104L326 172M190 104L184 91M292 104L284 80L306 78" stroke="' + paint('ink') + '" stroke-width="5.4" fill="none"/>',
    '<path d="M193 102H285M223 157L286 108" stroke="#d6ffe4" stroke-opacity=".55" stroke-width="1.2" fill="none"/>',
    '<path d="M176 91H199" stroke="#0b2a1a" stroke-width="7"/><path d="M176 89H198" stroke="#90d5aa" stroke-width="2"/>',
    '<path d="M306 78H316L314 86" stroke="#b0e9c6" stroke-width="4" fill="none"/>',
    '<path d="M134 174L221 175L229 166L220 154L132 167" stroke="#4f936c" stroke-width="1" fill="none"/>',
    '<circle cx="220" cy="164" r="12" fill="#0b2c1b" stroke="#9fd4b2" stroke-width="2"/>',
    '<g data-crank="" transform="' + f.crankTransform + '" stroke="#b7f3ca" stroke-width="3"><path d="M202 164H238"/><path d="M198 164H206M234 164H242" stroke="#315c42" stroke-width="4"/></g>',
    '<path data-front-leg="" d="' + f.frontPath + '" stroke="' + paint('jersey') + '" stroke-width="11" fill="none"/>',
    '<g data-front-shoe="" transform="' + f.frontShoe + '"><path d="M-9-5H2L8-1L16 0V5H-10Z" fill="#0d3420"/><path d="M-8 4H15" stroke="#b5fcd1" stroke-width="2"/><path d="M2-2L6 1" stroke="#d4ffe0" stroke-width="1"/></g>',
    '<g data-body="" transform="' + f.bodyTransform + '">',
    '<path d="M219 48L245 68L285 78" stroke="#2f9865" stroke-width="8" fill="none"/>',
    '<path d="M185 85C193 65 202 43 222 39L241 44L229 60L215 69L203 96Z" fill="' + paint('jersey') + '"/>',
    '<path d="M190 87L200 75L215 89L203 103L190 98Z" fill="#0b3320"/><path d="M193 88L199 80" stroke="#a3f6c3" stroke-width="2"/>',
    '<path d="M205 50Q215 42 224 43" stroke="#edfff3" stroke-opacity=".65" stroke-width="2.2" fill="none"/>',
    '<path d="M233 47L259 63" stroke="#96efb9" stroke-width="10"/><path d="M259 63L287 78" stroke="#b5f7cb" stroke-width="7"/><path d="M287 78L296 79" stroke="#267447" stroke-width="5"/>',
    '<path d="M237 45L250 32" stroke="#a3edbf" stroke-width="9"/>',
    '<path d="M250 20Q257 10 266 17L271 28L267 36L256 35L248 28Z" fill="#b9f7ce"/>',
    '<path d="M247 23Q244 11 257 8Q269 7 275 18L278 21L260 22Z" fill="#0f3d28" stroke="#86d9a4" stroke-width="1.6"/>',
    '<path d="M253 12L260 10M262 12L268 15" stroke="#b0f2c8" stroke-width="1.4"/><path d="M266 23L272 24" stroke="#1f5e3a" stroke-width="2.2"/>',
    '</g></g>',
    '<ellipse data-halo="" cx="240" cy="123" rx="108" ry="94" opacity="' + f.haloOpacity + '" fill="' + paint('glow') + '"/>',
    '<g data-result="" opacity="' + f.resultOpacity + '" transform="' + f.resultTransform + '">',
    '<circle cx="240" cy="122" r="67" fill="#09281b" fill-opacity=".83" stroke="#77c895" stroke-opacity=".13"/>',
    '<circle cx="240" cy="122" r="61.5" fill="none" stroke="#78cb9b" stroke-opacity=".13" stroke-width="1.2"/>',
    '<circle data-ring="" cx="240" cy="122" r="67" fill="none" stroke="' + (gold?paint('gold'):paint('ink')) + '" stroke-width="2" stroke-dasharray="421" stroke-dashoffset="' + num(f.ringOffset * 421) + '" transform="rotate(-90 240 122)"/>',
    drawn,
    '<path d="M194 78Q219 56 248 58" fill="none" stroke="#dcffe9" stroke-opacity=".28" stroke-width="1.2" stroke-linecap="round"/>',
    '</g>',
    ...f.sparks.map((spark,i)=>'<g data-spark="' + i + '" transform="' + spark.transform + '" opacity="' + spark.opacity + '" fill="' + accent + '"><path d="M0-4L1-1L4 0L1 1L0 4L-1 1L-4 0L-1-1Z"/></g>'),
    '</g>',
  ].join('');
}

export function milestoneSvgDocument(kind: MilestoneKind, elapsedMs: number, identifier = 'preview') {
  return '<svg xmlns="http://www.w3.org/2000/svg" width="480" height="240" viewBox="0 0 480 240" fill="none">' + milestoneSvgMarkup(kind,identifier,elapsedMs) + '</svg>';
}
