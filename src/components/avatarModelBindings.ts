/** Model-viewer runtime bindings for compatible glTF/GLB avatars.
 * Author assets with materials named Skin, Hair, and Jersey, and animations
 * named Idle, Smile, Serious, Focused, Stand, Casual, etc.
 * These are optional: missing names never crash the editor.
 */
export interface AvatarMaterial {
  name?: string;
  pbrMetallicRoughness?: {
    setBaseColorFactor?: (value: string | number[]) => void;
    setRoughnessFactor?: (value: number) => void;
  };
}
export interface AvatarModelElement extends HTMLElement {
  model?: { materials?: AvatarMaterial[] };
  availableAnimations?: string[];
  animationName?: string;
  autoplay?: boolean;
  play?: () => void;
  pause?: () => void;
  cameraOrbit?: string;
  getCameraOrbit?: () => {theta:number;phi:number;radius:number|string};
}
export interface AvatarAppearance {
  skinColor: string;
  hairColor: string;
  skinRoughness: number;
  accentColor?: string;
}
function matches(name: string | undefined, keys: string[]) {
  const value=(name??'').toLowerCase().replace(/[^a-z0-9]/g,'');
  return keys.some(key=>value.includes(key));
}
export function applyAvatarAppearance(element: AvatarModelElement | null, appearance: AvatarAppearance): number {
  if(!element?.model?.materials)return 0;
  let changed=0;
  for(const material of element.model.materials){
    const pbr=material.pbrMetallicRoughness;
    if(!pbr)continue;
    if(matches(material.name,['skin','face','bodymat','flesh'])){
      pbr.setBaseColorFactor?.(appearance.skinColor);
      pbr.setRoughnessFactor?.(Math.max(0.2,Math.min(1,appearance.skinRoughness)));
      changed++;
    }else if(matches(material.name,['hair','beard','brow'])){
      pbr.setBaseColorFactor?.(appearance.hairColor);
      changed++;
    }else if(appearance.accentColor&&matches(material.name,['accent','trim','brand'])){
      pbr.setBaseColorFactor?.(appearance.accentColor);
      changed++;
    }
  }
  return changed;
}
export function playAvatarAnimation(element: AvatarModelElement|null, requested:string): boolean {
  if(!element)return false;
  const options=element.availableAnimations??[];
  const found=options.find(a=>a.toLowerCase()===requested.toLowerCase())
    ?? options.find(a=>a.toLowerCase().includes(requested.toLowerCase()));
  if(!found)return false;
  element.animationName=found;
  element.autoplay=true;
  element.play?.();
  return true;
}
