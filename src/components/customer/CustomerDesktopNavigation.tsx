import React from 'react';
import { StakeysAppIcon, type StakeysIconName } from '../StakeysAppIcon';
import './CustomerDesktopNavigation.css';
import { GlassDockIcon } from '../navigation/GlassDockIcon';

type CustomerNavId = 'garage' | 'booking' | 'repairs' | 'stamps' | 'more';
const destinations: Array<{ id: CustomerNavId; label: string; icon: StakeysIconName }> = [
  { id: 'more', label: 'Apps', icon: 'apps' },
  { id: 'stamps', label: 'Customer ID', icon: 'rewards' },
];

/** One glass bar: the app drawer and a combined customer ID / QR pass. */
export const CustomerDesktopNavigation: React.FC<{
  active: CustomerNavId;
  onSelect: (id: CustomerNavId) => void;
}> = ({ active, onSelect }) => (
  <nav className="stk-customer-dock" aria-label="Customer app navigation">
    {destinations.map(item => (
      <button key={item.id} type="button" aria-label={item.label} aria-current={active === item.id ? 'page' : undefined} onClick={() => onSelect(item.id)}>
        <span className="customer-glass-glyph">{item.id==='stamps'?<GlassDockIcon index={7}/>:<StakeysAppIcon name={item.icon} size={30}/>}</span>
        <span>{item.label}</span>
      </button>
    ))}
  </nav>
);
