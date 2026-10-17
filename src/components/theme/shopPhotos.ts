import type { SeasonalThemeId } from '../../utils/holidayCalendar';

/** One fixed shop camera and storefront, with visitors and light changed by occasion. */
const scene: Record<Exclude<SeasonalThemeId, 'none'>, string> = {
  halloween: 'halloween', christmas: 'christmas', stpatricks: 'stpatricks',
  newyear: 'newyear', valentines: 'valentines', easter: 'easter',
  thanksgiving: 'thanksgiving', cny: 'cny', midautumn: 'midautumn',
  diwali: 'diwali', holi: 'holi', eidfitr: 'eid', eidadha: 'eidadha',
  hanukkah: 'hanukkah', cincodemayo: 'cincodemayo',
  spring: 'spring', summer: 'summer', autumn: 'autumn', winter: 'winter',
  mayday: 'spring', springbank: 'spring', summerbank: 'summer',
  fathersday: 'fathersday', mothersday: 'mothersday', pancakes: 'pancakes',
  ramadan: 'ramadan', dussehra: 'dussehra', stgeorge: 'stgeorge',
  aprilsfools: 'aprilsfools', earthday: 'earthday', backtoschool: 'backtoschool',
  bonfirenight: 'bonfire', remembranceday: 'remembrance',
  boxingday: 'boxingday', januarysales: 'sales', blackfriday: 'sales',
  cybermonday: 'sales', smallbusinesssaturday: 'smallbusinesssaturday',
};

export const shopPhotoFor = (id: Exclude<SeasonalThemeId, 'none'>) =>
  `/seasonal/${scene[id]}.jpg`;
