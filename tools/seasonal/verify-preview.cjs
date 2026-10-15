const {chromium}=require('/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('fs');
(async()=>{
 const browser=await chromium.launch({executablePath:'/tmp/theme-headless/chrome-headless-shell-linux64/chrome-headless-shell',headless:true,args:['--no-sandbox','--no-zygote','--single-process','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const page=await browser.newPage({viewport:{width:1100,height:780},deviceScaleFactor:1});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('file://'+process.cwd()+'/preview/seasonal/Stakeys-Seasonal-Worlds.html');await page.waitForFunction(()=>window.worldReady,{timeout:60000});
 const results={environment:'Headless Chromium / SwiftShader software WebGL; no physical Android device',errors};
 for(const [name,width,height] of [['desktop',1100,780],['portrait',390,844]]){
  await page.setViewportSize({width,height});await page.evaluate(()=>window.freezeWorld(1.2));
  const picks=await page.evaluate(()=>{const r=window.worldRenderer,found={};for(let y=210;y<innerHeight-120;y+=40)for(let x=20;x<innerWidth-20;x+=40){const i=r.pick(x,y);if(i>=0&&!found[i])found[i]=[x,y];}return found;});
  if(!picks[0]||!picks[1])throw Error(name+' cannot pick both characters: '+JSON.stringify(picks));
  const before=await page.evaluate(()=>window.worldRenderer.stats());
  await page.evaluate(()=>{window.worldRenderer.poke(0);window.freezeWorld(2);});
  const reaction=await page.evaluate(()=>window.worldRenderer.stats());
  if(Math.abs(reaction.actors[0].roll)<1)throw Error('goblin reaction did not play');
  await page.screenshot({path:'preview/seasonal/'+name+'-reaction.png'});
  await page.evaluate(()=>window.freezeWorld(6));const recovered=await page.evaluate(()=>window.worldRenderer.stats());
  if(Math.abs(recovered.actors[0].roll)>.001)throw Error('goblin did not recover');
  results[name]={picks,before,reaction,recovered};
 }
 await page.setViewportSize({width:720,height:600});await page.evaluate(()=>{window.freezeWorld(1.2);window.worldRenderer.poke(0);window.worldRenderer.poke(1)});
 fs.mkdirSync('preview/seasonal/frames',{recursive:true});
 for(let i=0;i<40;i++){await page.evaluate(t=>window.freezeWorld(t),1.2+i/8);await page.screenshot({path:'preview/seasonal/frames/'+String(i).padStart(3,'0')+'.png'});}
 results.dispose=await page.evaluate(()=>{window.worldRenderer.dispose();return window.worldRenderer.stats()});
 fs.writeFileSync('preview/seasonal/verification.json',JSON.stringify(results,null,2));await browser.close();console.log(JSON.stringify(results,null,2));
})().catch(e=>{console.error(e);process.exit(1)});
