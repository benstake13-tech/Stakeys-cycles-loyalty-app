/** Dependency-free, offline WebGL seasonal dioramas and articulated characters. */
export type CharacterKind = 'goblin'|'ghost'|'santa'|'elf'|'leprechaun'|'cupid'|'bunny'|'fox'|'owl'|'bee'|'dragon'|'snowman'|'fairy'|'robot'|'lantern';
export interface SceneTheme { id:string; family:string; sky:string; horizon:string; accent:string; ground:string; foliage:string; label:string }
export type V3 = [number,number,number];
export type MeshKind = 'sphere'|'box'|'cylinder'|'cone'|'plane'|'torus'|'roof';
export interface MeshData { vertices:Float32Array }
export interface DrawItem { mesh:MeshKind; model:Float32Array; color:V3; rough:number; metal:number; alpha:number; emission:number; shadow:boolean }
export interface Reaction { start:number; direction:number }
export const CHARACTER_CATALOG:Record<string,[CharacterKind,CharacterKind|null]> = {
 halloween:['goblin','ghost'],christmas:['santa','elf'],stpatricks:['leprechaun','fairy'],newyear:['robot','fox'],
 valentines:['cupid','fairy'],easter:['bunny','bunny'],thanksgiving:['owl','fox'],cny:['dragon','lantern'],
 midautumn:['bunny','lantern'],diwali:['fairy','lantern'],holi:['fairy','robot'],eidfitr:['lantern','bunny'],
 eidadha:['lantern','owl'],hanukkah:['owl','lantern'],cincodemayo:['fox','robot'],spring:['fairy','bunny'],
 summer:['fox','bee'],autumn:['fox','owl'],winter:['snowman','owl'],mayday:['fairy','bee'],
 springbank:['bee','bunny'],summerbank:['fox','bee'],fathersday:['robot','fox'],mothersday:['fairy','bunny'],
 pancakes:['robot','bunny'],ramadan:['lantern','owl'],dussehra:['robot','dragon'],stgeorge:['dragon','robot'],
 aprilsfools:['robot','goblin'],earthday:['bee','fairy'],backtoschool:['owl','robot'],bonfirenight:['fox','lantern'],
 remembranceday:['owl',null],boxingday:['elf','snowman'],januarysales:['robot','elf'],blackfriday:['robot','fox'],
 cybermonday:['robot','lantern'],smallbusinesssaturday:['robot','fox'],
};
export const characterLabel = (theme:string) => {
 const pair=CHARACTER_CATALOG[theme];return pair ? pair.filter(Boolean).map(v=>v![0].toUpperCase()+v!.slice(1)).join(' & ') : '';
};
const PI=Math.PI,TAU=PI*2;
const clamp=(v:number,a=0,b=1)=>Math.min(b,Math.max(a,v));
const mix=(a:number,b:number,t:number)=>a+(b-a)*t;
const dot=(a:V3,b:V3)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const cross=(a:V3,b:V3):V3=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const sub=(a:V3,b:V3):V3=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
const norm=(v:V3):V3=>{const n=Math.hypot(...v)||1;return [v[0]/n,v[1]/n,v[2]/n];};
export function color(hex:string):V3 {
 const s=hex.replace('#','');const h=s.length===3?s.split('').map(v=>v+v).join(''):s;
 return [0,2,4].map(i=>Math.pow(parseInt(h.slice(i,i+2),16)/255,2.2)) as V3;
}
export function multiply(a:Float32Array,b:Float32Array) {
 const out=new Float32Array(16);
 for(let c=0;c<4;c++)for(let r=0;r<4;r++)for(let k=0;k<4;k++)out[c*4+r]+=a[k*4+r]*b[c*4+k];
 return out;
}
export function transform(pos:V3=[0,0,0],scale:V3=[1,1,1],rot:V3=[0,0,0]) {
 const [x,y,z]=rot,cx=Math.cos(x),sx=Math.sin(x),cy=Math.cos(y),sy=Math.sin(y),cz=Math.cos(z),sz=Math.sin(z);
 return new Float32Array([
 (cz*cy)*scale[0],(sz*cy)*scale[0],-sy*scale[0],0,
 (cz*sy*sx-sz*cx)*scale[1],(sz*sy*sx+cz*cx)*scale[1],cy*sx*scale[1],0,
 (cz*sy*cx+sz*sx)*scale[2],(sz*sy*cx-cz*sx)*scale[2],cy*cx*scale[2],0,
 ...pos,1,
 ]);
}
const identity=()=>transform();
export function normalMatrix(m:Float32Array) {
 const x:V3=[m[0],m[1],m[2]],y:V3=[m[4],m[5],m[6]],z:V3=[m[8],m[9],m[10]];
 const a=cross(y,z),b=cross(z,x),c=cross(x,y),d=dot(x,a)||1;
 return new Float32Array([...a.map(v=>v/d),...b.map(v=>v/d),...c.map(v=>v/d)]);
}
export function reactionPose(elapsed:number) {
 const t=Math.max(0,elapsed);
 if(t>=3)return {roll:0,hop:0,stars:0};
 let roll=0;
 if(t<.38){const p=clamp(t/.38);roll=1.24*(1-Math.pow(1-p,3));}
 else if(t<.95)roll=1.24+Math.sin((t-.38)*18)*.045*Math.exp(-(t-.38)*3);
 else {const p=t-.95;roll=1.24*Math.exp(-3*p)*Math.cos(5.4*p);}
 return {roll,hop:Math.max(0,Math.sin(clamp(t/.65)*PI))*.08,stars:t>.3&&t<1.9?Math.sin(clamp((t-.3)/1.6)*PI):0};
}
export function meshData(kind:MeshKind):MeshData {
 const out:number[]=[];
 const tri=(a:V3,b:V3,c:V3,na?:V3,nb?:V3,nc?:V3)=>{
  const n=na||norm(cross(sub(b,a),sub(c,a)));
  for(const [p,q] of [[a,na||n],[b,nb||n],[c,nc||n]])out.push(...p,...q);
 };
 const quad=(a:V3,b:V3,c:V3,d:V3,n?:V3)=>{tri(a,b,c,n,n,n);tri(a,c,d,n,n,n);};
 if(kind==='sphere'){
  const point=(lat:number,lng:number):V3=>[Math.sin(lat)*Math.cos(lng),Math.cos(lat),Math.sin(lat)*Math.sin(lng)];
  for(let y=0;y<16;y++)for(let x=0;x<24;x++){
   const a=point(y/16*PI,x/24*TAU),b=point((y+1)/16*PI,x/24*TAU),c=point((y+1)/16*PI,(x+1)/24*TAU),d=point(y/16*PI,(x+1)/24*TAU);
   tri(a,b,c,a,b,c);tri(a,c,d,a,c,d);
  }
 }else if(kind==='plane')quad([-1,0,-1],[-1,0,1],[1,0,1],[1,0,-1],[0,1,0]);
 else if(kind==='box'){
  for(const [axis,side] of [[0,1],[0,-1],[1,1],[1,-1],[2,1],[2,-1]] as [number,number][]){
   const n:V3=[0,0,0];n[axis]=side;const ids=[0,1,2].filter(i=>i!==axis);
   const p=(u:number,v:number):V3=>{const q:V3=[0,0,0];q[axis]=side*.5;q[ids[0]]=u;q[ids[1]]=v;return q;};
   quad(p(-.5,-.5),p(.5,-.5),p(.5,.5),p(-.5,.5),n);
  }
 }else if(kind==='roof'){
  const a:V3=[-.5,0,-.5],b:V3=[.5,0,-.5],c:V3=[0,.5,-.5],d:V3=[-.5,0,.5],e:V3=[.5,0,.5],f:V3=[0,.5,.5];
  tri(a,c,b);tri(d,e,f);quad(a,d,f,c);quad(b,c,f,e);quad(a,b,e,d);
 }else if(kind==='cylinder'||kind==='cone'){
  const top=kind==='cone'?0:1;
  for(let i=0;i<24;i++){
   const a=i/24*TAU,b=(i+1)/24*TAU;
   const pa:V3=[Math.cos(a),0,Math.sin(a)],pb:V3=[Math.cos(b),0,Math.sin(b)],pc:V3=[Math.cos(b)*top,1,Math.sin(b)*top],pd:V3=[Math.cos(a)*top,1,Math.sin(a)*top];
   const na=norm([Math.cos(a),1-top,Math.sin(a)]),nb=norm([Math.cos(b),1-top,Math.sin(b)]);
   tri(pa,pb,pc,na,nb,nb);tri(pa,pc,pd,na,nb,na);
   tri([0,0,0],pb,pa,[0,-1,0],[0,-1,0],[0,-1,0]);
   if(top)tri([0,1,0],pd,pc,[0,1,0],[0,1,0],[0,1,0]);
  }
 }else{
  const point=(a:number,b:number):[V3,V3]=>{const n:V3=[Math.cos(a)*Math.cos(b),Math.sin(a)*Math.cos(b),Math.sin(b)];return [[Math.cos(a)*(1+.12*Math.cos(b)),Math.sin(a)*(1+.12*Math.cos(b)),.12*Math.sin(b)],n];};
  for(let i=0;i<32;i++)for(let j=0;j<8;j++){
   const [a,na]=point(i/32*TAU,j/8*TAU),[b,nb]=point((i+1)/32*TAU,j/8*TAU),[c,nc]=point((i+1)/32*TAU,(j+1)/8*TAU),[d,nd]=point(i/32*TAU,(j+1)/8*TAU);
   tri(a,b,c,na,nb,nc);tri(a,c,d,na,nc,nd);
  }
 }
 return {vertices:new Float32Array(out)};
}
export const VERTEX_SHADER = 'attribute vec3 aPosition;attribute vec3 aNormal;uniform mat4 uModel;uniform mat4 uViewProjection;uniform mat3 uNormal;varying vec3 vWorld;varying vec3 vNormal;varying vec3 vLocal;void main(){vec4 p=uModel*vec4(aPosition,1.0);vWorld=p.xyz;vNormal=normalize(uNormal*aNormal);vLocal=aPosition;gl_Position=uViewProjection*p;}';
export const FRAGMENT_SHADER = `precision highp float;
varying vec3 vWorld;varying vec3 vNormal;varying vec3 vLocal;
uniform vec3 uColor;uniform vec3 uEye;uniform vec3 uFog;
uniform float uRough;uniform float uMetal;uniform float uAlpha;uniform float uEmission;uniform float uShadow;
void main(){
 if(uShadow>0.5){float a=pow(max(0.0,1.0-dot(vLocal.xz,vLocal.xz)),2.0)*uAlpha;if(a<0.003)discard;gl_FragColor=vec4(0.008,0.018,0.012,a);return;}
 vec3 N=normalize(vNormal),V=normalize(uEye-vWorld),L=normalize(vec3(-0.65,1.2,0.75)),H=normalize(V+L);
 float diffuse=max(dot(N,L),0.0),hemisphere=N.y*0.5+0.5;
 vec3 ambient=mix(vec3(0.11,0.14,0.12),vec3(0.30,0.34,0.40),hemisphere);
 vec3 specColor=mix(vec3(0.06),uColor,uMetal);
 float spec=pow(max(dot(N,H),0.0),mix(90.0,12.0,uRough))*(1.0-uRough*0.6);
 float rim=pow(1.0-max(dot(N,V),0.0),3.5)*0.08;
 vec3 c=uColor*(ambient+diffuse*1.15)*(1.0-uMetal*0.25)+specColor*spec*1.4+mix(uColor,vec3(0.60,0.78,0.72),0.18)*rim+uColor*uEmission;
 float fog=1.0-exp(-0.0015*pow(max(0.0,length(uEye-vWorld)-3.5),2.0));
 c=mix(c,uFog,fog);c=c/(vec3(1.0)+c*0.35);c=pow(max(c,vec3(0.0)),vec3(1.0/2.2));
 gl_FragColor=vec4(c,uAlpha);
}`;
const rgbCache=new Map<string,V3>();
const rgb=(s:string)=>{let v=rgbCache.get(s);if(!v){v=color(s);rgbCache.set(s,v);}return v;};
function builder(draw:DrawItem[],parent:Float32Array){
 const add=(mesh:MeshKind,pos:V3,scale:V3,hex:string,rot:V3=[0,0,0],rough=.55,metal=0,alpha=1,emission=0)=>{
  const item={mesh,model:multiply(parent,transform(pos,scale,rot)),color:rgb(hex),rough,metal,alpha,emission,shadow:false};draw.push(item);return item;
 };
 const ball=(pos:V3,scale:V3,hex:string,rough=.55)=>add('sphere',pos,scale,hex,[0,0,0],rough);
 const limb=(a:V3,b:V3,r:number,hex:string)=>{
  const y=norm(sub(b,a)),ref:V3=Math.abs(y[1])>.96?[1,0,0]:[0,1,0],x=norm(cross(ref,y)),z=cross(x,y),len=Math.hypot(...sub(b,a))/2+r;
  const m=new Float32Array([x[0]*r,x[1]*r,x[2]*r,0,y[0]*len,y[1]*len,y[2]*len,0,z[0]*r,z[1]*r,z[2]*r,0,(a[0]+b[0])/2,(a[1]+b[1])/2,(a[2]+b[2])/2,1]);
  draw.push({mesh:'sphere',model:multiply(parent,m),color:rgb(hex),rough:.65,metal:0,alpha:1,emission:0,shadow:false});
 };
 return {add,ball,limb};
}
function heart(draw:DrawItem[],root:Float32Array,pos:V3,size:number,hex:string){
 const b=builder(draw,multiply(root,transform(pos,[size,size,size])));
 b.ball([-.22,.12,0],[.30,.30,.14],hex,.3);b.ball([.22,.12,0],[.30,.30,.14],hex,.3);
 b.add('cone',[0,.08,0],[.45,.64,.15],hex,[0,0,PI],.3);
}
function character(draw:DrawItem[],root:Float32Array,kind:CharacterKind,t:number,theme:SceneTheme,stunned:number){
 const {add,ball,limb}=builder(draw,root),wave=Math.sin(t*1.7)*.10;
 const blink=stunned>.2?.18:1-.94*Math.exp(-Math.pow(((t+.7)%4.3-.18)/.065,2));
 const eye=(x:number,y:number,z:number,s=.065)=>{
  ball([x,y,z],[s,s*1.12*blink,s*.5],'#fff5df',.28);
  ball([x+.012,y-.008,z+s*.45],[s*.46,s*.64*blink,s*.25],'#18282b',.23);
  if(blink>.5)ball([x+.023,y+.012,z+s*.65],[s*.13,s*.15,s*.10],'#ffffff',.2);
 };
 if(kind==='ghost'){
  ball([0,.92+wave*.3,0],[.40,.53,.28],'#dcefea',.25);
  for(let i=-2;i<=2;i++)ball([i*.14,.48+Math.sin(t*2+i)*.04,.01],[.12,.16,.21],'#dcefea',.3);
  limb([-.30,.95,0],[-.53,1.10+wave,.08],.09,'#dcefea');limb([.30,.95,0],[.54,1.04-wave,.08],.09,'#dcefea');
  eye(-.12,1.04,.25,.08);eye(.12,1.04,.25,.08);ball([0,.84,.27],[.07,.09,.03],'#253942');
  return;
 }
 if(kind==='snowman'){
  ball([0,.38,0],[.40,.41,.34],'#d9eef3',.75);ball([0,.88,0],[.32,.33,.28],'#e6f4f8',.7);ball([0,1.37,.02],[.27,.29,.25],'#edf9ff',.65);
  eye(-.095,1.44,.248,.047);eye(.095,1.44,.248,.047);add('cone',[0,1.34,.25],[.065,.30,.065],'#f39b35',[PI/2,0,0]);
  add('cylinder',[0,1.59,0],[.27,.08,.27],'#183847');add('cylinder',[0,1.64,0],[.18,.24,.18],'#214958');
  add('torus',[0,1.12,0],[.30,.19,.29],'#b9434d',[PI/2,0,0]);limb([.18,1.07,.23],[.15,.74,.26],.065,'#b9434d');
  for(let i=0;i<3;i++)ball([0,.98-i*.25,.30],[.04,.04,.025],'#244044');
  limb([-.23,.98,0],[-.68,1.16+wave,0],.03,'#655241');limb([.23,.98,0],[.65,1.14-wave,0],.03,'#655241');
  return;
 }
 if(kind==='lantern'){
  ball([0,.74,0],[.37,.43,.30],theme.id==='cny'?'#c94839':'#c69542',.35);
  add('cylinder',[0,1.12,0],[.30,.08,.27],'#f1cc75',[0,0,0],.3,.4);
  add('cylinder',[0,.32,0],[.29,.07,.27],'#b28237',[0,0,0],.35,.4);
  add('torus',[0,1.28,0],[.12,.15,.12],'#e4bf67',[0,0,0],.3,.5);
  for(let i=-2;i<=2;i++)limb([i*.115,.42,.26],[i*.125,1.09,.26],.012,'#f9d886');
  eye(-.12,.84,.285,.065);eye(.12,.84,.285,.065);ball([0,.65,.303],[.07,.045,.018],'#5e4127');
  limb([-.32,.77,0],[-.51,.9+wave,.04],.04,'#d6ae63');limb([.32,.77,0],[.50,.89-wave,.04],.04,'#d6ae63');
  ball([-.16,.20,.08],[.12,.12,.15],'#72552b');ball([.16,.20,.08],[.12,.12,.15],'#72552b');
  return;
 }
 if(kind==='bee'){
  const bob=.08*Math.sin(t*2);
  ball([0,.73+bob,0],[.34,.42,.27],'#e6b63f',.35);
  for(let i=0;i<3;i++)add('torus',[0,.51+i*.19+bob,0],[.30-i*.015,.18,.27],'#3a3229',[PI/2,0,0],.5);
  ball([0,1.18+bob,.03],[.31,.29,.27],'#f3d16c',.4);
  eye(-.12,1.23+bob,.28,.075);eye(.12,1.23+bob,.28,.075);
  for(const side of [-1,1]){
   limb([side*.14,1.40+bob,0],[side*.20,1.61+bob,.01],.023,'#3c352b');
   ball([side*.20,1.63+bob,.01],[.047,.047,.047],'#55462e');
   add('sphere',[side*.29,.94+bob,-.11],[.26,.36,.035],'#bee7ec',[0,0,side*(.65+Math.sin(t*14)*.15)],.2,0,.72);
   ball([side*.14,.32+bob,.08],[.10,.09,.12],'#3f392d');
  }
  return;
 }
 if(kind==='owl'||kind==='bunny'||kind==='fox'||kind==='dragon'){
  const fur=kind==='bunny'?'#e9d6b6':kind==='fox'?'#cf783f':kind==='dragon'?(theme.id==='cny'?'#bd5344':'#4d9d83'):'#836852';
  ball([0,.66,0],[.32,.42,.23],fur,.72);ball([0,.72,.15],[.21,.29,.12],kind==='dragon'?'#ead49a':'#f3dfbb',.8);
  ball([0,1.20,.03],[.37,.32,.29],fur,.65);
  if(kind==='bunny'){
   add('sphere',[-.17,1.63,.01],[.10,.36,.10],fur,[0,0,.12]);add('sphere',[.17,1.63,.01],[.10,.36,.10],fur,[0,0,-.12]);
   add('sphere',[-.17,1.65,.09],[.05,.26,.03],'#cf9691',[0,0,.12]);add('sphere',[.17,1.65,.09],[.05,.26,.03],'#cf9691',[0,0,-.12]);
   eye(-.12,1.23,.298,.065);eye(.12,1.23,.298,.065);
   ball([-.075,1.09,.30],[.10,.075,.085],'#fff1d8');ball([.075,1.09,.30],[.10,.075,.085],'#fff1d8');ball([0,1.14,.37],[.045,.035,.03],'#ad7772');
   ball([0,.55,-.24],[.17,.17,.17],'#fff1de');
  }else if(kind==='owl'){
   for(const s of [-1,1]){
    ball([s*.15,1.24,.25],[.16,.17,.07],'#ecdcba',.7);eye(s*.15,1.25,.31,.10);
    add('cone',[s*.25,1.43,-.02],[.10,.23,.10],fur,[0,0,-s*.32]);
    add('sphere',[s*.31,.74,.01],[.09,.30,.18],fur,[0,0,s*(.12+wave)]);
   }
   add('cone',[0,1.13,.30],[.065,.14,.05],'#d0a050',[PI,0,0]);
   if(theme.id==='backtoschool')add('box',[0,.72,-.26],[.38,.42,.15],'#416f68');
  }else{
   for(const s of [-1,1]){
    add('cone',[s*.25,1.40,.01],[.14,.28,.13],fur,[0,0,-s*.25]);
    if(kind==='fox')add('cone',[s*.25,1.43,.08],[.07,.16,.04],'#efd4a8',[0,0,-s*.25]);
    eye(s*.13,1.25,.285,.07);
   }
   ball([0,1.07,.29],[.24,.12,.16],kind==='dragon'?'#8bbb91':'#efdcb8');ball([0,1.10,.43],[.06,.045,.035],'#342c2b');
   const tail=multiply(root,transform([.24,.48,-.21],[1,1,1],[.30,Math.sin(t)*.1,-.7]));
   builder(draw,tail).ball([0,.12,-.23],[.15,.21,.45],fur,.7);
   builder(draw,tail).ball([0,.20,-.54],[.12,.17,.18],kind==='fox'?'#f6dfb6':'#6ab89b',.7);
   if(kind==='dragon')for(let i=0;i<4;i++)add('cone',[0,1.43-i*.18,-.22],[.075,.16,.075],'#ecd49a',[.5,0,0]);
  }
  for(const s of [-1,1]){
   ball([s*.17,.20,.11],[.15,.14,.22],kind==='dragon'?'#427f6d':'#715440');
   if(kind!=='owl')limb([s*.26,.88,.0],[s*(.43+wave),.60,.17],.085,fur);
  }
  if(['summer','summerbank','bonfirenight'].includes(theme.id))add('torus',[0,1.00,0],[.28,.12,.25],theme.id==='bonfirenight'?'#ad5555':'#5aabb0',[PI/2,0,0]);
  return;
 }
 if(kind==='robot'){
  const suit=theme.id==='cybermonday'?'#407a85':'#2d6950';
  ball([0,.71,0],[.29,.33,.20],suit,.4);
  add('box',[0,1.19,.02],[.57,.45,.42],'#9aada6',[0,Math.sin(t*.7)*.07,0],.35,.38);
  add('box',[0,1.22,.24],[.45,.27,.04],'#153f39');
  for(const s of [-1,1]){
   ball([s*.12,1.24,.27],[.045,.055*blink,.02],'#b9ffe4',.2);
   limb([s*.24,.84,0],[s*.43,.56+wave,.09],.08,suit);ball([s*.43,.53+wave,.10],[.09,.09,.08],'#a5b5a6');
   limb([s*.12,.47,0],[s*.15,.16,.03],.08,'#708c7c');ball([s*.15,.11,.10],[.12,.09,.17],'#253d34');
  }
  add('cylinder',[0,1.43,0],[.32,.07,.25],theme.id==='pancakes'?'#e8e2cb':suit);
  if(theme.id==='pancakes')ball([0,1.57,0],[.28,.16,.24],'#f3efdd');
  else {add('sphere',[0,1.49,0],[.26,.16,.23],suit);add('box',[0,1.47,.23],[.32,.035,.19],suit);}
  add('box',[0,.76,.20],[.21,.10,.03],'#b7e7ca');return;
 }
 const goblin=kind==='goblin',santa=kind==='santa',elf=kind==='elf',lucky=kind==='leprechaun',angel=kind==='cupid';
 const skin=goblin?'#88a560':'#dbad85',cloth=santa?'#bb4946':goblin?'#625174':lucky?'#387456':angel?'#f2e2c5':elf?'#347c62':'#7fa7a0';
 ball([0,.76,0],[santa?.34:.27,.34,.20],cloth,.75);
 for(const s of [-1,1]){
  limb([s*.13,.49,0],[s*.15,.18,.03],.085,angel?skin:'#3a4c43');ball([s*.15,.12,.13],[.12,.09,.20],angel?skin:'#39443b');
  limb([s*.25,.91,0],[s*.37,.70+wave*s,.08],.08,cloth);limb([s*.37,.70+wave*s,.08],[s*.44,.55+wave*s,.15],.065,skin);ball([s*.44,.54+wave*s,.15],[.075,.075,.065],skin);
 }
 ball([0,1.29,.025],[.285,.30,.25],skin,.8);
 if(goblin||elf||lucky)for(const s of [-1,1])add('cone',[s*.23,1.29,0],[.12,.29,.10],skin,[0,0,-s*PI/2]);
 eye(-.105,1.33,.258,.062);eye(.105,1.33,.258,.062);
 ball([0,1.24,.285],[goblin?.08:.06,.065,.065],skin,.7);
 ball([0,1.14,.247],[.077,.035,.02],'#6c4d43');
 for(const s of [-1,1])limb([s*.06,1.43,.23],[s*.15,1.44+s*.015,.21],.018,goblin?'#3d5430':'#80634f');
 if(santa){
  ball([0,1.10,.18],[.24,.23,.15],'#eee8d8',.9);
  for(let i=-2;i<=2;i++)ball([i*.075,1.03,.25],[.08,.12,.07],'#f4eddd',.9);
  add('torus',[0,1.02,0],[.25,.10,.22],'#ebe6d5',[PI/2,0,0]);
  add('torus',[0,.64,0],[.32,.11,.22],'#3a352c',[PI/2,0,0]);add('box',[0,.65,.22],[.13,.12,.035],'#d6b366',[0,0,0],.35,.6);
 }
 if(lucky){
  ball([0,1.10,.18],[.24,.18,.13],'#b57542',.85);
  add('cylinder',[0,1.52,0],[.35,.055,.32],'#35694e');
  add('cylinder',[0,1.57,0],[.24,.35,.22],'#3c855f');
  add('torus',[0,1.64,0],[.24,.13,.22],'#34372d',[PI/2,0,0]);add('box',[0,1.65,.235],[.09,.075,.025],'#dbc075',[0,0,0],.4,.6);
 }else if(santa||elf||goblin){
  add('cone',[0,1.52,0],[.27,.42,.24],santa?'#bc4844':goblin?'#665277':'#39795d',[0,0,-.18]);
  add('torus',[0,1.53,0],[.27,.10,.24],santa?'#f1ecdd':goblin?'#a99b73':'#b6524e',[PI/2,0,0]);
  ball([.075,1.93,0],[.07,.07,.07],santa?'#f3eddf':'#d9bc76');
 }else{
  for(let i=0;i<8;i++){const a=i/8*TAU;ball([Math.cos(a)*.24,1.43+Math.sin(a)*.12,-.02],[.11,.11,.11],angel?'#d6b96a':'#b7caa4');}
  if(!angel)for(let i=0;i<6;i++){const a=i/6*TAU;ball([Math.cos(a)*.24,1.55+Math.sin(a)*.04,.04],[.075,.05,.075],i%2?'#ddadc6':'#e5cc8a');}
  for(const s of [-1,1]){
   add('sphere',[s*.30,.94,-.18],[.22,.37,.06],angel?'#eae9d5':'#a7d7cf',[0,s*.3,s*(.35+Math.sin(t*3)*.08)],.25,0,.85);
   add('sphere',[s*.25,.68,-.18],[.17,.25,.05],angel?'#ecebd8':'#c9b9dc',[0,s*.3,-s*.3],.3,0,.85);
  }
  heart(draw,root,[0,.85,.21],.25,angel?'#c96a7f':'#d4b36d');
 }
 for(let i=0;i<3;i++)ball([0,.89-i*.13,.205],[.025,.025,.025],santa?'#dec48a':'#bdce9f');
 if(goblin)for(const s of [-1,1])add('cone',[s*.065,1.11,.27],[.022,.075,.024],'#f4e9c8');
}
function tree(draw:DrawItem[],root:Float32Array,pos:V3,s:number,theme:SceneTheme,t:number){
 const {add,ball,limb}=builder(draw,multiply(root,transform(pos,[s,s,s])));
 if(theme.family==='haunted'){
  limb([0,0,0],[.05,1.55,0],.075,'#57414b');
  for(const side of [-1,1]){limb([.02,.65,0],[side*.38,1.04,.04],.045,'#57414b');limb([side*.38,1.04,.04],[side*.50,1.45,.03],.027,'#57414b');limb([.04,1.15,0],[side*.42,1.57,-.05],.026,'#57414b');}
  return;
 }
 add('cylinder',[0,0,0],[.10,.85,.10],'#645344');
 const snow=theme.family==='winter',garden=['garden','romance','harvest'].includes(theme.family);
 if(garden){
  for(const [x,y,z] of [[0,1.3,0],[-.28,1.1,.06],[.28,1.15,0]] as V3[])ball([x,y,z],[.40,.43,.36],theme.family==='harvest'?'#b78250':theme.foliage,.9);
 }else for(let i=0;i<3;i++){
  add('cone',[0,.35+i*.39,0],[.62-i*.13,.88-i*.10,.62-i*.13],theme.foliage);
  if(snow)add('cone',[0,.68+i*.39,0],[.40-i*.09,.55-i*.08,.40-i*.09],'#d6e6df');
 }
 if(theme.id==='christmas'){
  for(let i=0;i<9;i++){const a=i*2.4;ball([Math.cos(a)*(.44-i*.026),.65+i*.10,Math.sin(a)*(.44-i*.026)],[.045,.045,.045],i%2?'#d6b76e':'#ce7467',.25);}
  add('sphere',[0,2.1,0],[.09,.12,.07],'#f2d68c',[0,0,0],.3,.2,1,.2);
 }
}
function pumpkin(draw:DrawItem[],root:Float32Array,pos:V3,s:number){
 const {ball,add}=builder(draw,multiply(root,transform(pos,[s,s,s])));
 for(let i=0;i<7;i++){const a=i/7*TAU;ball([Math.cos(a)*.13,.23,Math.sin(a)*.13],[.17,.23,.17],i%2?'#ca7c3d':'#d68b45',.7);}
 add('cylinder',[0,.41,0],[.045,.14,.04],'#6e7b47',[0,0,-.22]);
 for(const x of [-.10,.10])add('cone',[x,.28,.263],[.045,.065,.025],'#f1cd75',[0,0,PI],.45,0,1,.3);
 ball([0,.15,.27],[.10,.025,.025],'#e8b96a');
}
function workshop(draw:DrawItem[],root:Float32Array,theme:SceneTheme){
 const {add}=builder(draw,multiply(root,transform([-1.55,0,-1.65],[.78,.78,.78],[0,.12,0])));
 add('box',[0,.55,0],[1.75,1.10,1.1],'#a3aaa0');
 add('roof',[0,1.10,0],[2.0,.85,1.4],theme.family==='winter'?'#cfddd4':'#375e4b');
 add('box',[0,.48,.57],[.55,.95,.045],'#1b3c31');
 add('box',[0,1.02,.59],[1.25,.21,.06],'#3c9e6c',[0,0,0],.3,0,1,.12);
 for(const x of [-.61,.61])add('box',[x,.64,.58],[.35,.43,.04],'#d4b77b',[0,0,0],.25,0,1,.14);
 add('box',[.56,1.40,-.2],[.23,.57,.23],'#6f7d70');
}
export function buildScene(theme:SceneTheme,time:number,reactions:Reaction[]=[],pointer:V3=[0,0,0]):DrawItem[] {
 const draw:DrawItem[]=[],root=identity(),b=builder(draw,root);
 const snow=theme.family==='winter',still=theme.id==='remembranceday';
 b.add('cylinder',[0,-.24,0],[3.15,.24,2.55],snow?'#b5c7c5':theme.ground,[0,0,0],.85);
 b.add('cylinder',[0,-.29,0],[3.14,.06,2.54],'#263e34',[0,0,0],.9);
 for(let i=0;i<3;i++)b.ball([-2.7+i*2.5,-.1,-4-i*.5],[2.5,1.5+i*.2,1.8],theme.foliage,.95);
 b.ball([.8,3.5,-5.5],[.62,.62,.62],theme.family==='romance'?'#dfb7c0':'#e2d9ba',.9);
 workshop(draw,root,theme);
 for(let i=0;i<8;i++){const f=i/7;b.ball([mix(.1,-1.4,f),.015,mix(2.15,-.95,f)],[.25,.035,.17],snow?'#d8dfd4':'#82958a',.95);}
 if(theme.id==='halloween'){
  const x=Math.sin(time*.6)*.65,y=2.60+Math.sin(time*1.1)*.12,z=-1.8;
  b.ball([x,y,z],[.06,.09,.05],'#3d354c');
  for(const side of [-1,1])b.add('sphere',[x+side*.15,y,z],[.19,.035,.085],'#46374f',[0,0,side*(.28+Math.sin(time*9)*.5)]);
 }
 tree(draw,root,[2.15,0,-1.5],1.35,theme,time);tree(draw,root,[.8,0,-2.0],.80,theme,time);
 const pair:[CharacterKind,CharacterKind|null]=CHARACTER_CATALOG[theme.id]||['robot','fox'];
 const placement:V3[]=[[-.67,0,.64],[1.18,0,.03]];
 for(let i=0;i<pair.length;i++){
  const kind=pair[i];if(!kind)continue;
  const phase=time+i*1.9,react=reactions[i],pose=react&&!still?reactionPose(time-react.start):{roll:0,hop:0,stars:0};
  const breath=still?0:Math.sin(phase*1.5)*.018;
  const croot=transform([placement[i][0],placement[i][1]+breath+pose.hop,placement[i][2]],[i===0?1.02:.76,i===0?1.02:.76,i===0?1.02:.76],[0,pointer[0]*.10+(i===0?.12:-.20),pose.roll*(react?.direction||1)]);
  character(draw,croot,kind,still?0:phase,theme,pose.stars);
  const shadow=b.add('plane',[placement[i][0],.012,placement[i][2]],[.63,1,.43],'#000000',[0,0,0],1,0,.30);shadow.shadow=true;
  if(pose.stars>.1)for(let j=0;j<3;j++){
   const a=time*3+j/3*TAU;b.add('sphere',[placement[i][0]+Math.cos(a)*.55,1.35+Math.sin(a*2)*.08,placement[i][2]+Math.sin(a)*.4],[.045,.045,.045],'#f4d58a',[0,0,0],.2,.3,1,.2);
  }
 }
 if(['haunted','harvest'].includes(theme.family)){
  pumpkin(draw,root,[-1.8,0,1.15],.80);pumpkin(draw,root,[1.85,0,.95],.6);
 }else if(theme.id==='easter'||theme.id==='midautumn'){
  for(let i=0;i<3;i++)b.ball([-1.85+i*.33,.17,1.2],[.12,.18,.12],['#cfa3b6','#bdcda3','#d8bf82'][i],.35);
 }else if(['lantern','festival'].includes(theme.family)){
  for(const side of [-1,1]){
   const p:V3=[side*2.65,0,.2];b.add('cylinder',p,[.035,1.70,.035],'#82775c');
   const y=1.68+Math.sin(time*.7+side)*.025;b.ball([p[0],y,p[2]],[.17,.23,.17],theme.id==='cny'?'#c56c4f':'#d6b676',.3);
   b.add('cylinder',[p[0],y+.19,p[2]],[.12,.04,.12],'#c39e50',[0,0,0],.3,.5);
  }
 }else if(theme.family==='romance')heart(draw,root,[-1.9,.4,1.05],.42,'#c8869d');
 if(theme.id==='remembranceday')for(let i=0;i<14;i++){
  const x=-2.5+i*.36,z=.5+Math.sin(i*2)*.65;b.add('cylinder',[x,0,z],[.014,.27,.014],'#628561');
  b.ball([x,.31,z],[.085,.05,.075],'#ba5d61');b.ball([x,.35,z],[.025,.018,.025],'#35362d');
 }
 if(theme.id==='pancakes')for(let i=0;i<4;i++)b.add('cylinder',[-1.7,.08+i*.05,1],[.26,.04,.24],i%2?'#c5a976':'#d7ba85');
 return draw;
}
function perspective(aspect:number) {
 const f=1/Math.tan(42/180*PI/2),near=.1,far=65;
 return new Float32Array([f/aspect,0,0,0,0,f,0,0,0,0,(far+near)/(near-far),-1,0,0,2*far*near/(near-far),0]);
}
export function sceneCamera(width:number,height:number,pointer:V3=[0,0,0]){
 const aspect=width/Math.max(1,height),distance=Math.max(1,.9/aspect)*(1-clamp(pointer[2],0,.4));
 const eye:V3=[4.2*distance+pointer[0]*.22,2.95*distance+pointer[1]*.12,6.6*distance];
 const target:V3=[0,.95,0],z=norm(sub(eye,target)),x=norm(cross([0,1,0],z)),y=cross(z,x);
 const view=new Float32Array([x[0],y[0],z[0],0,x[1],y[1],z[1],0,x[2],y[2],z[2],0,-dot(x,eye),-dot(y,eye),-dot(z,eye),1]);
 return {eye,viewProjection:multiply(perspective(aspect),view)};
}
function projectPoint(point:V3,m:Float32Array,width:number,height:number){
 const v=[...point,1],o=[0,0,0,0];for(let r=0;r<4;r++)for(let k=0;k<4;k++)o[r]+=m[k*4+r]*v[k];
 return {x:(o[0]/o[3]*.5+.5)*width,y:(.5-o[1]/o[3]*.5)*height};
}
export function createSeasonalRenderer(canvas:HTMLCanvasElement,theme:SceneTheme) {
 const gl=canvas.getContext('webgl',{alpha:true,antialias:true,premultipliedAlpha:true,powerPreference:'low-power'});
 if(!gl)return null;
 const compile=(type:number,source:string)=>{
  const shader=gl.createShader(type);if(!shader)throw Error('Shader unavailable');
  gl.shaderSource(shader,source);gl.compileShader(shader);
  if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS)){const error=gl.getShaderInfoLog(shader);gl.deleteShader(shader);throw Error(error||'Shader failed');}
  return shader;
 };
 let vertex:WebGLShader|undefined,fragment:WebGLShader|undefined,program:WebGLProgram|undefined;
 const buffers=new Map<MeshKind,{buffer:WebGLBuffer;count:number}>();
 try{
  vertex=compile(gl.VERTEX_SHADER,VERTEX_SHADER);fragment=compile(gl.FRAGMENT_SHADER,FRAGMENT_SHADER);program=gl.createProgram()||undefined;
  if(!program)throw Error('Renderer unavailable');gl.attachShader(program,vertex);gl.attachShader(program,fragment);gl.linkProgram(program);
  if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program)||'Renderer link failed');
  gl.useProgram(program);
  const locations=Object.fromEntries(['uModel','uViewProjection','uNormal','uColor','uEye','uFog','uRough','uMetal','uAlpha','uEmission','uShadow'].map(name=>[name,gl.getUniformLocation(program!,name)]));
  const position=gl.getAttribLocation(program,'aPosition'),normal=gl.getAttribLocation(program,'aNormal');
  for(const kind of ['sphere','box','cylinder','cone','plane','torus','roof'] as MeshKind[]){
   const vertices=meshData(kind).vertices,buffer=gl.createBuffer();if(!buffer)throw Error('Geometry unavailable');
   gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,vertices,gl.STATIC_DRAW);buffers.set(kind,{buffer,count:vertices.length/6});
  }
  gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.clearColor(0,0,0,0);
  let width=1,height=1,currentTime=0,lastPointer:V3=[0,0,0],viewProjection=sceneCamera(1,1).viewProjection;
  const reactions:Reaction[]=[{start:-100,direction:1},{start:-100,direction:-1}];
  const api={
   resize(w:number,h:number,dpr:number){width=Math.max(1,w);height=Math.max(1,h);canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);gl.viewport(0,0,canvas.width,canvas.height);},
   draw(time:number,pointer:V3=[0,0,0]){
    currentTime=time;lastPointer=pointer;
    const camera=sceneCamera(width,height,pointer);viewProjection=camera.viewProjection;
    gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.useProgram(program!);
    gl.uniformMatrix4fv(locations.uViewProjection,false,camera.viewProjection);gl.uniform3fv(locations.uEye,camera.eye);gl.uniform3fv(locations.uFog,color(theme.horizon));
    const list=buildScene(theme,time,reactions,pointer),opaque=list.filter(o=>o.alpha>=1&&!o.shadow),alpha=list.filter(o=>o.alpha<1||o.shadow).sort((a,b)=>Math.hypot(b.model[12]-camera.eye[0],b.model[13]-camera.eye[1],b.model[14]-camera.eye[2])-Math.hypot(a.model[12]-camera.eye[0],a.model[13]-camera.eye[1],a.model[14]-camera.eye[2]));
    let bound:MeshKind|undefined;
    const paint=(item:DrawItem)=>{
     const mesh=buffers.get(item.mesh)!;
     if(bound!==item.mesh){gl.bindBuffer(gl.ARRAY_BUFFER,mesh.buffer);gl.enableVertexAttribArray(position);gl.vertexAttribPointer(position,3,gl.FLOAT,false,24,0);gl.enableVertexAttribArray(normal);gl.vertexAttribPointer(normal,3,gl.FLOAT,false,24,12);bound=item.mesh;}
     gl.uniformMatrix4fv(locations.uModel,false,item.model);gl.uniformMatrix3fv(locations.uNormal,false,normalMatrix(item.model));
     gl.uniform3fv(locations.uColor,item.color);gl.uniform1f(locations.uRough,item.rough);gl.uniform1f(locations.uMetal,item.metal);gl.uniform1f(locations.uAlpha,item.alpha);gl.uniform1f(locations.uEmission,item.emission);gl.uniform1f(locations.uShadow,item.shadow?1:0);gl.drawArrays(gl.TRIANGLES,0,mesh.count);
    };
    gl.disable(gl.BLEND);gl.depthMask(true);opaque.forEach(paint);
    gl.enable(gl.BLEND);gl.blendFuncSeparate(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA,gl.ONE,gl.ONE_MINUS_SRC_ALPHA);gl.depthMask(false);alpha.forEach(paint);gl.depthMask(true);
   },
   poke(index=0){if(theme.id==='remembranceday')return false;reactions[index]={start:currentTime,direction:index?1:-1};api.draw(currentTime,lastPointer);return true;},
   pick(x:number,y:number){
    if(theme.id==='remembranceday')return -1;
    for(let i=0;i<2;i++){
     if(!CHARACTER_CATALOG[theme.id]?.[i])continue;
     const p:V3=i===0?[-.67,.85,.64]:[1.18,.63,.03],c=projectPoint(p,viewProjection,width,height),top=projectPoint([p[0],p[1]+(i===0?.85:.65),p[2]],viewProjection,width,height),radius=Math.max(22,Math.abs(c.y-top.y));
     if(Math.pow((x-c.x)/(radius*.65),2)+Math.pow((y-c.y)/radius,2)<1)return i;
    }return -1;
   },
   dispose(){for(const {buffer} of buffers.values())gl.deleteBuffer(buffer);if(program)gl.deleteProgram(program);if(vertex)gl.deleteShader(vertex);if(fragment)gl.deleteShader(fragment);},
  };
  return api;
 }catch{for(const {buffer} of buffers.values())gl.deleteBuffer(buffer);if(program)gl.deleteProgram(program);if(vertex)gl.deleteShader(vertex);if(fragment)gl.deleteShader(fragment);return null;}
}
