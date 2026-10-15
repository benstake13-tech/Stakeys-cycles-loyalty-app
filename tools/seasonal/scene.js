import * as T from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/** Full textured environment; all resources are local and disposed with the scene. */
export async function createPremiumRenderer(canvas, resolve, options={}) {
 const theme=options.theme||'halloween',family=options.family||'',quiet=['remembranceday','ramadan','eidfitr','eidadha','hanukkah'].includes(theme),haunted=theme==='halloween',snow=['christmas','winter','boxingday','newyear','januarysales'].includes(theme)||family==='winter',spring=['easter','stpatricks','spring','mayday','springbank','earthday','valentines','mothersday'].includes(theme)||family==='garden'||family==='romance';
 const roster=quiet?[]:theme==='halloween'?[['goblin',3.15]]:theme==='christmas'||theme==='boxingday'?[['santa',3.2]]:theme==='stpatricks'?[['leprechaun',2.9],['fox',1.35]]:theme==='easter'?[['rabbit',1.6],['rabbit',1.35]]:[['fox',1.7],['rabbit',1.15]];
 const mobile=(options.width||canvas.clientWidth||390)<700;
 let renderer;
 const scene=new T.Scene();scene.background=new T.Color('#09191f');scene.fog=new T.FogExp2('#0f252b',.047);if(!haunted){const sky=spring?'#203d41':snow?'#112735':options.sky||'#1e2631';scene.background=new T.Color(sky);scene.fog.color.set(sky);}
 const camera=new T.PerspectiveCamera(43,1,.1,100),target=new T.Vector3(0,1.55,-2);
 const loader=new T.TextureLoader(),textures=[];
 async function tex(name,repeat=1,srgb=false){const v=await loader.loadAsync(resolve(name));v.wrapS=v.wrapT=T.RepeatWrapping;v.repeat.set(repeat,repeat);v.anisotropy=1;if(srgb)v.colorSpace=T.SRGBColorSpace;textures.push(v);return v;}
 let groundMap,groundNormal,groundRough,barkMap,barkNormal,characters,cottage;
 const jobs=[tex('ground-color.jpg',12,true),tex('ground-normal.jpg',12),tex('ground-rough.jpg',12),tex('bark-color.jpg',2,true),tex('bark-normal.jpg',2),Promise.all(roster.map(([name])=>new GLTFLoader().loadAsync(resolve(name+'.glb')))),new GLTFLoader().loadAsync(resolve('witch-cottage.glb'))];
 const loaded=await Promise.allSettled(jobs);
 if(options.signal?.aborted||loaded.some(r=>r.status==='rejected')){
  const free=value=>{if(Array.isArray(value))value.forEach(free);else if(value?.isTexture)value.dispose();else if(value?.scene)value.scene.traverse(o=>{o.geometry?.dispose();for(const m of o.material?(Array.isArray(o.material)?o.material:[o.material]):[]){for(const t of Object.values(m))if(t?.isTexture)t.dispose();m.dispose();}});};
  loaded.forEach(r=>{if(r.status==='fulfilled')free(r.value)});textures.forEach(t=>t.dispose());
  throw new Error(options.signal?.aborted?'Seasonal scene cancelled':'Seasonal assets could not be loaded');
 }
 [groundMap,groundNormal,groundRough,barkMap,barkNormal,characters,cottage]=loaded.map(r=>r.value);
 renderer=new T.WebGLRenderer({canvas,antialias:!mobile,alpha:false,powerPreference:'low-power'});
 renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.1;
 renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;renderer.shadowMap.autoUpdate=false;
 textures.forEach(t=>t.anisotropy=Math.min(mobile?2:8,renderer.capabilities.getMaxAnisotropy()));
 const hemi=new T.HemisphereLight('#9fcef2','#192520',.7);scene.add(hemi);if(spring)hemi.intensity=1.05;
 const moon=new T.DirectionalLight('#b6dfff',2.5);moon.position.set(-7,12,-10);moon.castShadow=true;moon.shadow.mapSize.set(mobile?1024:2048,mobile?1024:2048);Object.assign(moon.shadow.camera,{left:-13,right:13,top:14,bottom:-12,near:.5,far:45});moon.shadow.bias=-.0005;moon.shadow.normalBias=.035;moon.shadow.radius=3;scene.add(moon);if(spring){moon.color.set('#cde8dc');moon.intensity=2.8;}
 const warm=new T.SpotLight('#ffb86d',38,22,.85,.7,1.2);warm.position.set(2,5,5);warm.target.position.set(-1,1,0);warm.castShadow=false;warm.shadow.mapSize.set(1024,1024);warm.shadow.bias=-.0005;scene.add(warm,warm.target);
 const mat=(color,roughness=.85,metalness=0)=>new T.MeshStandardMaterial({color,roughness,metalness});
 const wood=new T.MeshStandardMaterial({color:'#786049',map:barkMap,normalMap:barkNormal,normalScale:new T.Vector2(.7,.7),roughness:.92});
 const darkWood=mat('#302e2a'),stone=mat('#737979'),iron=mat('#262c2c',.43,.65),copper=mat('#74503b',.4,.6),roofMat=mat('#2b3d46',.72,.08);
 const ground=new T.Mesh(new T.PlaneGeometry(70,70,100,100),new T.MeshStandardMaterial({map:groundMap,normalMap:groundNormal,roughnessMap:groundRough,normalScale:new T.Vector2(1,1),color:'#b3b2a5',roughness:1}));ground.rotation.x=-Math.PI/2;ground.position.y=-.035;ground.receiveShadow=true;if(snow){ground.material.map=null;ground.material.color.set('#d8e7e9');ground.material.normalScale.set(.12,.12);}else if(spring)ground.material.color.set('#a5b990');scene.add(ground);
 const cube=new T.BoxGeometry(1,1,1),sphere=new T.SphereGeometry(1,32,24),cylinder=new T.CylinderGeometry(1,1,1,20);
 function mesh(geo,material,pos,scale=[1,1,1],parent=scene){const m=new T.Mesh(geo,material);m.position.set(...pos);m.scale.set(...scale);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
 function beam(a,b,r,material=wood,parent=scene){const aa=new T.Vector3(...a),bb=new T.Vector3(...b),m=mesh(cylinder,material,aa.clone().add(bb).multiplyScalar(.5).toArray(),[r,aa.distanceTo(bb),r],parent);m.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),bb.sub(aa).normalize());return m;}
 let seed=57021;const rand=()=>{seed=(seed*16807)%2147483647;return (seed-1)/2147483646;};
 const dummy=new T.Object3D();
 // Continuous woodland, with roots and curved boughs extending beyond the camera.
 const treeGroup=new T.Group();scene.add(treeGroup);
 function branch(points,r){const curve=new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p)));const geo=new T.TubeGeometry(curve,18,r,8,false),v=geo.attributes.position;for(let i=0;i<=18;i++){const c=curve.getPointAt(i/18),t=.08+.92*Math.pow(1-i/18,.6);for(let j=0;j<=8;j++){const n=i*9+j;v.setXYZ(n,c.x+(v.getX(n)-c.x)*t,c.y+(v.getY(n)-c.y)*t,c.z+(v.getZ(n)-c.z)*t);}}geo.computeVertexNormals();return mesh(geo,wood,[0,0,0],[1,1,1],treeGroup);}
 for(let i=0;i<(mobile?18:26);i++){
  const side=i%2?1:-1,x=side*(5+rand()*14),z=3-rand()*34,h=5+rand()*5,r=.20+rand()*.25;
  branch([[x,-.1,z],[x+.18,h*.4,z-.15],[x-.3,h*.8,z],[x+.25,h,z+.15]],r);
  for(let k=0;k<4;k++){const angle=k/4*Math.PI*2+rand(),xx=Math.cos(angle),zz=Math.sin(angle);branch([[x,.15,z],[x+xx*.65,.08,z+zz*.65],[x+xx*1.1,-.05,z+zz]],r*.6);const yy=h*(.45+rand()*.4);branch([[x,yy,z],[x+side*.8,yy+.6,z+.3],[x+side*(1.8+rand()),yy+1.1,z+.6],[x+side*(2.7+rand()),yy+1.3,z+.3]],r*.5);}
 }
 // Individually shaped, curved leaf cards produce an open autumn canopy with depth.
 const canopyShape=new T.Shape();canopyShape.moveTo(0,0);canopyShape.bezierCurveTo(.22,.07,.23,.38,0,.58);canopyShape.bezierCurveTo(-.22,.38,-.22,.08,0,0);
 const canopyGeo=new T.ShapeGeometry(canopyShape,5);const cp=canopyGeo.attributes.position;for(let i=0;i<cp.count;i++)cp.setZ(i,Math.sin(cp.getY(i)/.58*Math.PI)*.065);canopyGeo.computeVertexNormals();
 const canopy=new T.InstancedMesh(canopyGeo,new T.MeshStandardMaterial({color:'#9e6132',roughness:1,side:T.DoubleSide}),7000);let ci=0;
 for(let t=0;t<35;t++){const x=(t%2?1:-1)*(5+rand()*11),z=4-rand()*30,h=5+rand()*4;
  for(let j=0;j<150;j++){const a=rand()*6.28,r=Math.sqrt(rand())*2.8;dummy.position.set(x+Math.cos(a)*r,h+rand()*1.1-r*.2,z+Math.sin(a)*r);dummy.rotation.set(rand()*2,rand()*6.28,rand()*6.28);dummy.scale.setScalar(.65+rand()*.7);dummy.updateMatrix();canopy.setMatrixAt(ci,dummy.matrix);canopy.setColorAt(ci,new T.Color().setHSL(.055+rand()*.07,.3+rand()*.3,.19+rand()*.16));ci++;}}
 canopy.count=snow?0:ci;if(spring){canopy.material.color.set('#77bd6d');canopy.instanceColor=null;}canopy.receiveShadow=true;scene.add(canopy);
 // An actual workshop at the end of a cobbled woodland lane.
 const house=cottage.scene;house.position.set(-2.5,0,-7);house.rotation.y=.08;scene.add(house);
 house.traverse(o=>{if(o.isMesh){o.castShadow=o.receiveShadow=true;}});
 const glazing=new T.MeshStandardMaterial({color:'#ffd99c',emissive:'#ffb34b',emissiveIntensity:.9,roughness:.3});
 const signCanvas=document.createElement('canvas');signCanvas.width=1024;signCanvas.height=256;const cx=signCanvas.getContext('2d');cx.fillStyle='#0a211b';cx.fillRect(0,0,1024,256);cx.strokeStyle='#648272';cx.lineWidth=9;cx.strokeRect(12,12,1000,232);cx.textAlign='center';cx.fillStyle='#e5ecd6';cx.font='bold 76px Georgia';cx.fillText('STAKEY’S CYCLES',512,118);cx.font='29px Georgia';cx.fillStyle='#9bbba8';cx.fillText('THE WOODLAND WORKSHOP',512,184);const signTex=new T.CanvasTexture(signCanvas);signTex.colorSpace=T.SRGBColorSpace;textures.push(signTex);mesh(cube,new T.MeshStandardMaterial({map:signTex,roughness:.8}),[-.57,2.95,2.25],[3.3,.70,.14],house);
 const stones=new T.InstancedMesh(new T.DodecahedronGeometry(1,1),stone,550);let pi=0;
 for(let row=0;row<30;row++){const z=5-row*.42,center=-.6-Math.pow((5-z)/13,1.4)*2.2;for(let col=0;col<7;col++){dummy.position.set(center+(col-3)*.31+(rand()-.5)*.1,.025+rand()*.02,z+rand()*.10);dummy.scale.set(.14+rand()*.025,.055,.18);dummy.rotation.set(rand()*.1,rand()*6.28,rand()*.1);dummy.updateMatrix();stones.setMatrixAt(pi++,dummy.matrix);}}
 stones.count=pi;stones.castShadow=stones.receiveShadow=true;scene.add(stones);
 // Weathered fence frames the foreground and continues into the forest.
 for(const side of [-1,1])for(let i=0;i<10;i++){const x=side*4.5,z=5-i*1.4;beam([x,0,z],[x,1.1+rand()*.2,z],.065);if(i<9)for(const y of [.45,.9])beam([x,y,z],[x,y,z-1.4],.045);}
 const lamps=[];
 function lantern(x,y,z,power=12){const g=new T.Group();g.position.set(x,y,z);scene.add(g);mesh(cube,copper,[0,.08,0],[.30,.08,.30],g);mesh(cube,copper,[0,.52,0],[.34,.08,.34],g);for(const xx of [-.12,.12])for(const zz of [-.12,.12])beam([xx,.1,zz],[xx,.5,zz],.018,iron,g);mesh(new T.ConeGeometry(.25,.22,4),copper,[0,.65,0],[1,1,1],g);mesh(sphere,glazing,[0,.29,0],[.055,.15,.055],g);const l=new T.PointLight('#ffaf50',power,6,1.7);l.position.set(x,y+.3,z);scene.add(l);lamps.push({light:l,power});}
 lantern(-4.6,1.4,-5.5,20);lantern(-1.5,1.4,-5.1,20);lantern(3.65,.45,1,18);lantern(-4.2,.05,3,16);
 // High-density carved pumpkin surfaces, with recessed emissive faces.
 const pumpkinMat=new T.MeshStandardMaterial({color:'#b85417',roughness:.68});
 const pumpkinGeo=new T.SphereGeometry(1,64,48),pa=pumpkinGeo.attributes.position;
 for(let i=0;i<pa.count;i++){const x=pa.getX(i),y=pa.getY(i),z=pa.getZ(i),a=Math.atan2(z,x),lobes=1+.10*Math.cos(a*10);pa.setXYZ(i,x*lobes,y*.78,z*lobes);}pumpkinGeo.computeVertexNormals();
 function pumpkin(x,z,s){const group=new T.Group();group.position.set(x,s*.77,z);group.rotation.y=rand()*2;scene.add(group);mesh(pumpkinGeo,pumpkinMat,[0,0,0],[s,s,s],group);beam([0,s*.65,0],[s*.16,s*1.1,.03],s*.065,wood,group);for(const xx of [-.30,.30])mesh(new T.ConeGeometry(s*.15,s*.24,3),glazing,[xx*s,s*.16,s*.89],[1,1,.15],group);const grin=mesh(new T.TorusGeometry(s*.27,s*.035,8,32,Math.PI),glazing,[0,-s*.11,s*.96],[1,1,1],group);grin.rotation.z=Math.PI;}
 if(haunted)for(const p of [[-2.3,1,.45],[2.6,.1,.42],[3.1,-.4,.30],[-4,-4,.4],[-1.5,-5,.27],[-3,3.5,.24]])pumpkin(...p);
 // A textured goblin with an authored facial and body rig, with authored idle animation and an additive reaction rig.
 const actors=[];
 const clothCanvas=document.createElement('canvas');clothCanvas.width=clothCanvas.height=128;
 const cloth=clothCanvas.getContext('2d');const pixels=cloth.createImageData(128,128);
 for(let y=0;y<128;y++)for(let x=0;x<128;x++){const n=(y*128+x)*4,v=150+Math.floor(rand()*55)+((x%3===0||y%3===0)?22:0);pixels.data.set([v,v,v,255],n);}cloth.putImageData(pixels,0,0);
 const fabric=new T.CanvasTexture(clothCanvas);fabric.wrapS=fabric.wrapT=T.RepeatWrapping;fabric.repeat.set(7,7);textures.push(fabric);
 characters.forEach((gltf,index)=>{
  const model=gltf.scene,box=new T.Box3().setFromObject(model),size=box.getSize(new T.Vector3()),center=box.getCenter(new T.Vector3());
  const k=roster[index][1]/size.y;model.position.sub(center);model.position.y+=size.y*.5;model.position.multiplyScalar(k);model.scale.setScalar(k);
  const bones=new Map();model.traverse(o=>{if(o.isBone)bones.set(o.name,o);if(o.isMesh){o.castShadow=true;o.receiveShadow=true;o.frustumCulled=false;const materials=Array.isArray(o.material)?o.material:[o.material];for(const m of materials){m.roughness=.82;m.envMapIntensity=.5;if(m.transparent){m.transparent=false;m.alphaTest=.45;}}}});
  const mixer=new T.AnimationMixer(model);const clip=gltf.animations.find(a=>/idle/i.test(a.name))||gltf.animations.find(a=>/hello|wave/i.test(a.name))||gltf.animations[0];if(clip)mixer.clipAction(clip).play();
  const pivot=new T.Group();pivot.add(model);pivot.position.set(index===0?-1.65:1.65,0,index===0?.4:-.4);pivot.rotation.y=.15;scene.add(pivot);
  actors.push({kind:roster[index][0],pivot,base:pivot.position.clone(),rotation:pivot.rotation.y,start:-100,mixer,bones,clip:clip?.name});
 });
 if(haunted){
 // A locally authored cloth ghost. Smooth weighted skinning bends the hem and arms independently.
 const ghost=new T.Group(),segments=48,rows=28,gv=[],gn=[],guv=[],gi=[],gweights=[],gindices=[];
 for(let row=0;row<=rows;row++){
  const v=row/rows,y=2.5*(1-v),radius=v<.2?Math.sqrt(Math.max(.0001,1-((y-2)/.5)**2))*.52:.52+Math.max(0,v-.35)*.3;
  for(let col=0;col<=segments;col++){
   const u=col/segments,a=u*Math.PI*2,fold=Math.cos(a*12+v*1.2)*.055*(v+.1)+Math.sin(a*7-v*5)*.022,hem=Math.sin(a*6)*.12*v**5;
   gv.push(Math.sin(a)*(radius+fold),y+hem,Math.cos(a)*(radius+fold)*.78);guv.push(u,v);
   const lower=Math.max(0,(v-.35)/.65),left=(Math.sin(a)+1)*.5;
   gindices.push(0,1,2,3);gweights.push(1-lower,lower*(1-left)*.6,lower*left*.6,lower*.4);
   if(row<rows&&col<segments){const n=row*(segments+1)+col;gi.push(n,n+1,n+segments+1,n+1,n+segments+2,n+segments+1);}
  }
 }
 const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(gv,3));geo.setAttribute('uv',new T.Float32BufferAttribute(guv,2));geo.setAttribute('skinIndex',new T.Uint16BufferAttribute(gindices,4));geo.setAttribute('skinWeight',new T.Float32BufferAttribute(gweights,4));geo.setIndex(gi);geo.computeVertexNormals();
 const ghostMat=new T.MeshStandardMaterial({color:'#e4e9d5',roughness:.96,bumpMap:fabric,bumpScale:.016,side:T.DoubleSide});
 const sheet=new T.SkinnedMesh(geo,ghostMat),root=new T.Bone(),left=new T.Bone(),right=new T.Bone(),hem=new T.Bone();left.position.set(-.35,.8,0);right.position.set(.35,.8,0);hem.position.y=.2;root.add(left,right,hem);sheet.add(root);sheet.bind(new T.Skeleton([root,left,right,hem]));sheet.castShadow=sheet.receiveShadow=true;ghost.add(sheet);
 const face=new T.Group();face.position.set(0,1.83,.37);ghost.add(face);
 const ink=new T.MeshStandardMaterial({color:'#121d20',roughness:1});
 // Eye patches conform to the cloth surface, rather than spherical eyeballs.
 function patch(rx,ry){const shape=new T.Shape();shape.absellipse(0,0,rx,ry,0,Math.PI*2,false,0);return new T.ShapeGeometry(shape,32);}
 const eyes=[];for(const x of [-.16,.16]){const eye=new T.Mesh(patch(.075,.115),ink);eye.position.set(x,0,.018);eye.rotation.y=x<0?-.3:.3;face.add(eye);eyes.push(eye);}
 const mouth=new T.Mesh(patch(.065,.09),ink);mouth.position.set(0,-.24,.095);face.add(mouth);
 ghost.position.set(1.55,.25,-.4);scene.add(ghost);actors.push({kind:'ghost',pivot:ghost,base:ghost.position.clone(),rotation:0,start:-100,left,right,hem,eyes,mouth});
 }
 // Bats have a shaped wing membrane and articulated paired wings.
 const bats=[];
 const wingShape=new T.Shape();wingShape.moveTo(0,0);wingShape.quadraticCurveTo(.24,.36,.62,.19);wingShape.quadraticCurveTo(.42,.1,.48,-.12);wingShape.quadraticCurveTo(.28,.02,.24,-.2);wingShape.quadraticCurveTo(.1,-.06,0,-.15);
 const wingGeometry=new T.ShapeGeometry(wingShape),batMaterial=new T.MeshStandardMaterial({color:'#161d24',roughness:.8,side:T.DoubleSide});
 for(let i=0;i<(haunted?7:0);i++){const bat=new T.Group(),l=new T.Mesh(wingGeometry,batMaterial),r=new T.Mesh(wingGeometry,batMaterial);r.scale.x=-1;bat.add(l,r);bat.scale.setScalar(.3+rand()*.18);scene.add(bat);bats.push({bat,l,r,phase:rand()*6.28});}
 // Ferns and grass use instanced leaf geometry along both edges of the lane.
 const leafShape=new T.Shape();leafShape.moveTo(0,0);leafShape.quadraticCurveTo(.09,.16,0,.35);leafShape.quadraticCurveTo(-.09,.16,0,0);
 const fernGeo=new T.ShapeGeometry(leafShape),ferns=new T.InstancedMesh(fernGeo,new T.MeshStandardMaterial({color:'#64794e',roughness:1,side:T.DoubleSide}),1600);let fi=0;
 for(let i=0;i<100;i++){const x=(i%2?1:-1)*(3.2+rand()*9),z=5-rand()*22;for(let j=0;j<12;j++){const a=j/12*Math.PI*2;dummy.position.set(x+Math.cos(a)*.12,.04+rand()*.08,z+Math.sin(a)*.12);dummy.rotation.set(Math.cos(a)*.9,a,Math.sin(a)*.9);dummy.scale.setScalar(.7+rand()*1.4);dummy.updateMatrix();ferns.setMatrixAt(fi++,dummy.matrix);}}ferns.count=snow?0:fi;ferns.receiveShadow=true;scene.add(ferns);
 // Season-specific props. These are scenery; characters always come from the licensed skin rigs.
 if(snow){
  scene.updateMatrixWorld(true);const snowVertices=[];
  house.traverse(o=>{if(!o.isMesh)return;const g=o.geometry,p=g.attributes.position,ix=g.index;for(let i=0;i<(ix?ix.count:p.count);i+=3){const a=new T.Vector3().fromBufferAttribute(p,ix?ix.getX(i):i).applyMatrix4(o.matrixWorld),b=new T.Vector3().fromBufferAttribute(p,ix?ix.getX(i+1):i+1).applyMatrix4(o.matrixWorld),c=new T.Vector3().fromBufferAttribute(p,ix?ix.getX(i+2):i+2).applyMatrix4(o.matrixWorld);const n=b.clone().sub(a).cross(c.clone().sub(a)).normalize();if(n.y>.35&&Math.min(a.y,b.y,c.y)>2.8)for(const v of [a,b,c])snowVertices.push(v.x,v.y+.035,v.z);}});
  if(snowVertices.length){const sg=new T.BufferGeometry();sg.setAttribute('position',new T.Float32BufferAttribute(snowVertices,3));sg.computeVertexNormals();mesh(sg,mat('#d9e5e7',.95),[0,0,0]);}
  const ribbon=mat('#bda36a',.4,.25),gift=mat('#1c6649',.7),red=mat('#9e3c3e',.7);
  if(theme!=='winter')for(let i=0;i<6;i++){const x=1.3+(i%3)*.52,z=.1-Math.floor(i/3)*.6,h=.35+(i%3)*.12;mesh(cube,i%2?gift:red,[x,h/2,z],[.45,h,.45]);mesh(cube,ribbon,[x,h/2,z],[.07,h+.01,.46]);mesh(cube,ribbon,[x,h+.008,z],[.46,.025,.07]);}
  workshopLights();
  for(const material of [wood,...new Set(staticMaterialList(house))]){
   material.onBeforeCompile=shader=>{shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying float seasonalSnow;').replace('#include <begin_vertex>','#include <begin_vertex>\nseasonalSnow=smoothstep(.45,.9,normalize(mat3(modelMatrix)*normal).y);');shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying float seasonalSnow;').replace('#include <map_fragment>','#include <map_fragment>\ndiffuseColor.rgb=mix(diffuseColor.rgb,vec3(.72,.84,.88),seasonalSnow*.85);');};
   material.customProgramCacheKey=()=> 'stakeys-snow-v1';
  }
 }
 function workshopLights(){
  const bulbs=[new T.MeshStandardMaterial({color:'#ffd599',emissive:'#ffb94b',emissiveIntensity:2}),new T.MeshStandardMaterial({color:'#83d5ac',emissive:'#32b86e',emissiveIntensity:2})],points=[];
  for(let i=0;i<28;i++){const p=new T.Vector3(-2.8+i*.21,3.6+Math.sin(i/27*Math.PI)*.5,-4.8);points.push(p);mesh(sphere,bulbs[i%2],p.toArray(),[.04,.04,.04]);}
  mesh(new T.TubeGeometry(new T.CatmullRomCurve3(points),32,.008,4,false),iron,[0,0,0]);
 }
 if(family==='festival'&&!snow)workshopLights();
 function staticMaterialList(group){const mats=[];group.traverse(o=>{if(o.isMesh)for(const m of Array.isArray(o.material)?o.material:[o.material])mats.push(m);});return mats;}
 if(theme==='easter'){
  const eggCanvas=document.createElement('canvas');eggCanvas.width=eggCanvas.height=256;const ec=eggCanvas.getContext('2d');ec.fillStyle='#b5d5bf';ec.fillRect(0,0,256,256);for(let i=0;i<8;i++){ec.fillStyle=i%2?'#dfa7b7':'#f4dca4';ec.fillRect(0,i*32,256,10);for(let x=0;x<12;x++){ec.beginPath();ec.arc(x*24,i*32+21,3.5,0,7);ec.fill();}}const et=new T.CanvasTexture(eggCanvas);et.colorSpace=T.SRGBColorSpace;textures.push(et);
  const eggGeo=new T.SphereGeometry(.28,32,24),ep=eggGeo.attributes.position;for(let i=0;i<ep.count;i++){const y=ep.getY(i);ep.setXYZ(i,ep.getX(i)*(1-y*.5),y*1.35,ep.getZ(i)*(1-y*.5));}eggGeo.computeVertexNormals();const em=new T.MeshStandardMaterial({map:et,roughness:.65});for(let i=0;i<12;i++)mesh(eggGeo,em,[(i%2?1:-1)*(2+rand()*1.5),.34,2-rand()*6],[1,1,1]);
 }
 if(theme==='valentines'||family==='romance'){
  canopy.material.color.set('#e4a6b7');canopy.instanceColor=null;
  const heart=new T.Shape();heart.moveTo(0,0);heart.bezierCurveTo(-.3,.25,-.5,-.15,0,-.48);heart.bezierCurveTo(.5,-.15,.3,.25,0,0);const hg=new T.ExtrudeGeometry(heart,{depth:.055,bevelEnabled:true,bevelSize:.02,bevelThickness:.02,bevelSegments:2,steps:1,curveSegments:12}),hm=mat('#bd5a7c',.6);
  for(let i=0;i<9;i++)mesh(hg,hm,[(i%2?1:-1)*(2.6+rand()*.6),.9+rand()*1.1,-1-rand()*5],[.55,.55,.55]);
 }
 if(theme==='remembranceday'){
  const petals=new T.Shape();petals.absellipse(0,0,.075,.09,0,Math.PI*2,false,0);const pg=new T.ShapeGeometry(petals),pm=mat('#9f2839',.94),centres=mat('#17201c');
  for(let i=0;i<90;i++){const x=(i%2?1:-1)*(2.7+rand()*5),z=3-rand()*12,h=.22+rand()*.3;beam([x,0,z],[x,h,z],.008,mat('#344d36'));for(let j=0;j<4;j++){const a=j/4*6.28;mesh(pg,pm,[x+Math.cos(a)*.045,h+Math.sin(a)*.045,z],[1,1,1]);}mesh(sphere,centres,[x,h,z+.012],[.023,.023,.012]);}
 }
 // Merge static architecture/trees by material. Preserve character rigs, instances and moving props.
 const staticMeshes=[];scene.updateMatrixWorld(true);scene.traverse(o=>{if(o.isMesh&&!o.isSkinnedMesh&&!o.isInstancedMesh&&!Array.isArray(o.material)&&!actors.some(a=>{let n=o;while(n){if(n===a.pivot)return true;n=n.parent;}return false;})&&!bats.some(b=>o.parent===b.bat))staticMeshes.push(o);});
 const buckets=new Map();for(const m of staticMeshes){const key=m.material.uuid;let list=buckets.get(key);if(!list)buckets.set(key,list={material:m.material,geos:[]});const g=m.geometry.index?m.geometry.toNonIndexed():m.geometry.clone();g.applyMatrix4(m.matrixWorld);g.deleteAttribute('uv1');if(!g.attributes.uv)g.setAttribute('uv',new T.Float32BufferAttribute(new Float32Array(g.attributes.position.count*2),2));list.geos.push(g);m.removeFromParent();}
 for(const b of buckets.values()){const g=mergeGeometries(b.geos,false);b.geos.forEach(v=>v.dispose());if(g){const m=new T.Mesh(g,b.material);m.castShadow=m.receiveShadow=true;scene.add(m);}}
 for(const g of new Set(staticMeshes.map(m=>m.geometry)))g.dispose();
 // Ground fog, drifting leaf silhouettes, insects and dust are spatial, not DOM overlays.
 const fogCanvas=document.createElement('canvas');fogCanvas.width=fogCanvas.height=128;const f=fogCanvas.getContext('2d'),gr=f.createRadialGradient(64,64,0,64,64,64);gr.addColorStop(0,'rgba(179,208,202,.25)');gr.addColorStop(1,'rgba(179,208,202,0)');f.fillStyle=gr;f.fillRect(0,0,128,128);const fogTex=new T.CanvasTexture(fogCanvas);textures.push(fogTex);
 const fogs=[];for(let i=0;i<16;i++){const m=new T.SpriteMaterial({map:fogTex,transparent:true,opacity:.16,depthWrite:false,color:'#96b4b3'}),sp=new T.Sprite(m);sp.position.set((rand()-.5)*24,.3+rand()*.6,-rand()*24);sp.scale.set(10+rand()*8,1.7,1);scene.add(sp);fogs.push({sp,x:sp.position.x,z:sp.position.z});}
 const leafGeo=new T.BufferGeometry(),positions=new Float32Array(90*3);for(let i=0;i<90;i++){positions[i*3]=(rand()-.5)*24;positions[i*3+1]=rand()*9;positions[i*3+2]=4-rand()*24;}leafGeo.setAttribute('position',new T.BufferAttribute(positions,3));const leaves=new T.Points(leafGeo,new T.PointsMaterial({color:snow?'#e4f4ff':spring?'#f6cbb3':'#d6a66b',size:snow?.055:.045,transparent:true,opacity:.65}));scene.add(leaves);
 const leafStart=positions.slice();
 let width=800,height=600,currentTime=0,lastPointer=[0,0,0],closed=false,shadowsDirty=true,lastShadow=-100;
 const ray=new T.Raycaster(),mouse=new T.Vector2();
 function resize(w,h,dpr=1){width=w;height=h;renderer.setPixelRatio(Math.min(dpr,1.5));renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();shadowsDirty=true;}
 function draw(time,pointer=[0,0,0]){if(closed)return;currentTime=time;time=options.motion==='gentle'?time*.4:time;lastPointer=pointer;const portrait=width<height,zoom=pointer[2]||0;camera.position.set((portrait?.4:4.4)+pointer[0]*.25,2.35+pointer[1]*.1,(portrait?16.5:9.5)*(1-zoom));camera.lookAt(portrait?new T.Vector3(-.6,1.65,-2):target);
  actors.forEach((a,i)=>{
   const dt=currentTime-a.start,reacting=dt>=0&&dt<4.5;let roll=0,hop=0,flail=0,recovery=0;
   if(reacting){if(dt<.55){const t=dt/.55;roll=1.38*(1-(1-t)**3);hop=Math.sin(t*Math.PI)*.14;flail=Math.sin(t*Math.PI);}else if(dt<1.4){roll=1.38;flail=.6;}else{const t=dt-1.4;roll=1.38*Math.exp(-2*t)*Math.cos(3.4*t);flail=Math.exp(-t)*.5;recovery=Math.sin(Math.min(1,t/1.8)*Math.PI);}}
   a.pivot.position.copy(a.base);a.pivot.rotation.set(0,a.rotation,0);
   if(a.kind!=='ghost'){
    a.mixer.setTime(time);a.pivot.rotation.z=-roll;a.pivot.position.y=hop;
    const rotate=(name,x,y=0,z=0)=>{const b=a.bones.get(name)||a.bones.get(name.replaceAll('.',''));if(b){b.rotation.x+=x;b.rotation.y+=y;b.rotation.z+=z;}};
    if(a.kind==='goblin'){
    const blink=Math.pow(Math.max(0,Math.cos(time*1.4)),38);
    rotate('B_Head_05',Math.sin(time*.55)*.035,Math.sin(time*.32)*.10,flail*.12);
    rotate('B_Arm_L_0131',-flail*.45,0,flail*.65);rotate('B_Arm_R_0172',flail*.45,0,-flail*.65);
    rotate('B_Forearm_L_0152',-flail*.7);rotate('B_Forearm_R_0173',flail*.7);
    rotate('B_leg_L_2_0193',recovery*.25);rotate('B_leg_R_2_0215',recovery*.3);
    rotate('B_Jaw_097',flail*.28);rotate('B_Ear_L_1_093',0,0,Math.sin(time*1.1)*.025+flail*.18);rotate('B_Ear_R_1_0104',0,0,-Math.sin(time*1.1)*.025-flail*.18);
    // Eyelid joints close over the eyes, with a small surprised brow lift on impact.
    for(const [name,b] of a.bones){if(name.startsWith('B_eyelid_U'))b.rotation.x+=blink*.30;if(name.startsWith('B_eyelid_D'))b.rotation.x-=blink*.15;if(name.startsWith('B_Eyebrow')&&!name.endsWith('_0'))b.rotation.z+=flail*.05;}
    for(const name of ['B_Cape_2_0146','B_Cape_3_0147','B_Fabric_F_2_0198','B_Fabric_B_2_0201'])rotate(name,Math.sin(time*1.4)*.018+Math.sin(dt*5)*flail*.18);
    }else{
     for(const [name,b] of a.bones){
      if(/Head|head/.test(name)&&!/end|End/.test(name))b.rotation.y+=Math.sin(time*.55)*.05;
      if(/LeftArm|Arm_L_/.test(name))b.rotation.z+=flail*.65;
      if(/RightArm|Arm_R_/.test(name))b.rotation.z-=flail*.65;
      if(/ForeArm|Forearm|frontKnee/.test(name))b.rotation.x+=flail*.35;
      if(/LeftLeg|RightLeg|backKnee/.test(name))b.rotation.x+=recovery*.3;
      if(/Spine1|Spine_1|Chest/.test(name))b.rotation.x+=Math.sin(time*1.6)*.008;
      if(/Ear_L_|Ear_R_/.test(name))b.rotation.z+=Math.sin(time*1.2)*.03+flail*.2;
     }
    }
   }else{
    a.pivot.position.y+=Math.sin(time*1.25)*.10+hop;a.pivot.rotation.z=-roll*.7+Math.sin(time*.8)*.035;
    a.left.rotation.z=Math.sin(time*1.4)*.09-flail*.8;a.right.rotation.z=-Math.sin(time*1.4+1)*.09+flail*.8;a.hem.rotation.x=Math.sin(time*1.6)*.08+flail*.25;
    const blink=Math.pow(Math.max(0,Math.cos(time*1.65)),35);a.eyes.forEach(e=>e.scale.y=1-blink*.88);a.mouth.scale.y=1+flail*.9;
   }
  });
  bats.forEach((b,i)=>{const a=time*.28+b.phase;b.bat.position.set(Math.sin(a)*(5+i*.45),4+Math.sin(a*1.7+i)*.65,-4+Math.cos(a)*3-i*.5);b.bat.rotation.y=-a;b.l.rotation.y=Math.sin(time*9+i)*.75;b.r.rotation.y=-b.l.rotation.y;});
  lamps.forEach((o,i)=>o.light.intensity=o.power*(.95+.05*Math.sin(time*7+i)+.025*Math.sin(time*13+i)));fogs.forEach((o,i)=>o.sp.position.x=o.x+Math.sin(time*.12+i)*1.4);leaves.rotation.y=Math.sin(time*.07)*.12;const lp=leaves.geometry.attributes.position;for(let i=0;i<lp.count;i++){const y=(leafStart[i*3+1]-time*.2%9+9)%9;lp.setY(i,y);}lp.needsUpdate=true;
  renderer.shadowMap.needsUpdate=shadowsDirty||time-lastShadow>.18;if(renderer.shadowMap.needsUpdate)lastShadow=time;shadowsDirty=false;
  renderer.render(scene,camera);
 }
 function poke(index=0){if(!actors[index])return false;actors[index].start=currentTime;draw(currentTime,lastPointer);return true;}
 function pick(x,y){if(x<0||y<0||x>width||y>height)return -1;scene.updateMatrixWorld(true);mouse.set(x/width*2-1,1-y/height*2);ray.setFromCamera(mouse,camera);const hits=ray.intersectObjects(actors.map(a=>a.pivot),true);if(!hits.length)return -1;return actors.findIndex(a=>{let n=hits[0].object;while(n){if(n===a.pivot)return true;n=n.parent;}return false;});}
 function dispose(){closed=true;const geometries=new Set(),materials=new Set();scene.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material)for(const m of Array.isArray(o.material)?o.material:[o.material])materials.add(m);});const skeletons=new Set();scene.traverse(o=>{if(o.skeleton)skeletons.add(o.skeleton);o.shadow?.dispose();});for(const s of skeletons)s.dispose();for(const g of geometries)g.dispose();for(const m of materials){for(const value of Object.values(m))if(value?.isTexture)textures.push(value);m.dispose();}for(const t of new Set(textures))t.dispose();renderer.dispose();renderer.forceContextLoss();}
 return {resize,draw,poke,pick,dispose,stats:()=>({...renderer.info.render,memory:{...renderer.info.memory},actors:actors.map(a=>({kind:a.kind,clip:a.clip||'weighted-cloth',bones:a.bones?.size||4,roll:a.pivot.rotation.z,position:a.pivot.position.toArray()})),quality:mobile?'mobile':'desktop'})};
}
