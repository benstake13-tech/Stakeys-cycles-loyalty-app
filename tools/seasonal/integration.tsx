import React,{useState} from 'react';
import{createRoot}from'react-dom/client';
import{ThemeWorld,ThemeMotionControl}from'../../src/components/theme/ThemeWorld';
function Harness(){const[theme,setTheme]=useState('halloween');return <><ThemeWorld theme={theme}/><main style={{position:'relative',zIndex:2,maxWidth:480,margin:'20px auto',padding:24,color:'#ecfff1',background:'#0b251fe6',borderRadius:24}}><h1>Stakeys Cycles</h1><label>Booking name<input aria-label="Booking name" style={{display:'block',color:'#111'}}/></label><button type="button" onClick={()=>setTheme(theme==='halloween'?'easter':'halloween')}>Change season</button><ThemeMotionControl/><p>Booking controls remain available over the seasonal background.</p></main></>};
createRoot(document.getElementById('root')!).render(<React.StrictMode><Harness/></React.StrictMode>);
