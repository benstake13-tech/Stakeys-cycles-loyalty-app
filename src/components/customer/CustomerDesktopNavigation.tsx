import React from 'react';
import { StakeysAppIcon, type StakeysIconName } from '../StakeysAppIcon';
import './CustomerDesktopNavigation.css';

type CustomerNavId = 'garage' | 'booking' | 'repairs' | 'stamps' | 'more';
const destinations: Array<{ id: CustomerNavId; label: string; icon: StakeysIconName }> = [
  { id: 'garage', label: 'Garage', icon: 'garage' },
  { id: 'booking', label: 'Book', icon: 'booking' },
  { id: 'repairs', label: 'Repairs', icon: 'workshop' },
  { id: 'stamps', label: 'Pass', icon: 'rewards' },
  { id: 'more', label: 'More', icon: 'apps' },
];

/** One persistent glass bar: More opens the full customer feature directory. */
export const CustomerDesktopNavigation: React.FC<{
  active: CustomerNavId;
  onSelect: (id: CustomerNavId) => void;
}> = ({ active, onSelect }) => (
  <nav className="stk-customer-dock" aria-label="Customer app navigation">
    {destinations.map(item => (
      <button key={item.id} type="button" aria-label={item.label} aria-current={active === item.id ? 'page' : undefined} onClick={() => onSelect(item.id)}>
        <StakeysAppIcon name={item.icon} size={23} />
        <span>{item.label}</span>
      </button>
    ))}
  </nav>
);
