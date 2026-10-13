import { HOLIDAY_THEME_IDS, SEASONAL_THEME_LABELS, type SeasonalThemeId } from '../../utils/holidayCalendar';
export type WorldFamily = 'winter' | 'haunted' | 'garden' | 'coast' | 'harvest' | 'lantern' | 'festival' | 'cosmic' | 'romance' | 'remembrance';
export type WorldSpec = { id: SeasonalThemeId; label: string; family: WorldFamily; sky: string; horizon: string; accent: string; foliage: string; ground: string; effect: 'snow' | 'embers' | 'petals' | 'leaves' | 'stars' | 'confetti' | 'none'; description: string };
const families: Record<WorldFamily, Omit<WorldSpec, 'id' | 'label' | 'family'>> = {
 winter: { sky:'#07172e', horizon:'#426586', accent:'#a6f6ed', foliage:'#194b4b', ground:'#9bb6c9', effect:'snow', description:'Snow-covered pines, icy mountains and warm workshop lights.' },
 haunted: { sky:'#110c2b', horizon:'#543060', accent:'#ffa348', foliage:'#403245', ground:'#292035', effect:'embers', description:'A moonlit forest, glowing pumpkins and drifting autumn mist.' },
 garden: { sky:'#10293c', horizon:'#6a8395', accent:'#ffc9e7', foliage:'#43785c', ground:'#294f45', effect:'petals', description:'Blossom-filled trails, sculpted trees and soft evening light.' },
 coast: { sky:'#06365b', horizon:'#efa976', accent:'#ffd892', foliage:'#346c60', ground:'#877158', effect:'stars', description:'Coastal sunset, sea reflections and a golden cycling trail.' },
 harvest: { sky:'#22182b', horizon:'#966255', accent:'#ffbd6d', foliage:'#ac5938', ground:'#4d3930', effect:'leaves', description:'Copper woodland, rolling hills and slow falling leaves.' },
 lantern: { sky:'#081d2c', horizon:'#316366', accent:'#ffe2a0', foliage:'#285c58', ground:'#193c40', effect:'stars', description:'Suspended lanterns, a luminous moon and a quiet evening trail.' },
 festival: { sky:'#160f36', horizon:'#704661', accent:'#f9cd77', foliage:'#405649', ground:'#392b45', effect:'confetti', description:'Festive lights and gentle colour bursts above the workshop.' },
 cosmic: { sky:'#060c20', horizon:'#243c65', accent:'#62f0d0', foliage:'#25464d', ground:'#132935', effect:'stars', description:'Emerald light trails and a deep midnight skyline.' },
 romance: { sky:'#27122e', horizon:'#a4617a', accent:'#ffb1cd', foliage:'#9f557f', ground:'#50354c', effect:'petals', description:'Rose-coloured trees, floating hearts and a warm pink sunset.' },
 remembrance: { sky:'#171d2c', horizon:'#686574', accent:'#dc505b', foliage:'#49534c', ground:'#343d36', effect:'none', description:'A still, respectful landscape with poppies beside the trail.' },
};
const groups: Record<WorldFamily,string[]> = {
 winter:['christmas','winter','boxingday'], haunted:['halloween'], garden:['spring','easter','mayday','springbank','earthday','stpatricks'],
 coast:['summer','summerbank','fathersday'], harvest:['autumn','thanksgiving','backtoschool','pancakes'],
 lantern:['cny','midautumn','eidfitr','eidadha','ramadan','hanukkah'], festival:['newyear','diwali','holi','cincodemayo','dussehra','bonfirenight','aprilsfools'],
 cosmic:['blackfriday','cybermonday','januarysales','smallbusinesssaturday','stgeorge'], romance:['valentines','mothersday'], remembrance:['remembranceday'],
};
export const WORLD_CATALOG = Object.fromEntries(HOLIDAY_THEME_IDS.map(id => {
 const family = (Object.keys(groups) as WorldFamily[]).find(key => groups[key].includes(id)) || 'cosmic';
 const spec: WorldSpec = { id, label: SEASONAL_THEME_LABELS[id], family, ...families[family] };
 if (id === 'cny') spec.accent = '#ff7057';
 if (id === 'hanukkah') spec.accent = '#a6cfff';
 if (id === 'stpatricks' || id === 'earthday') spec.accent = '#8bedb1';
 return [id, spec];
})) as Record<Exclude<SeasonalThemeId,'none'>,WorldSpec>;
export const worldFor = (id: string): WorldSpec | null => WORLD_CATALOG[id as keyof typeof WORLD_CATALOG] || null;
