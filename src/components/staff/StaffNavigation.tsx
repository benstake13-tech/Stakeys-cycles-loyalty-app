import React from 'react';
import { createPortal } from 'react-dom';
import { LayoutGrid } from 'lucide-react';
import { MacOSDock, type DockTabId } from './MacOSDock';
import { StaffAppDrawer, type StaffApp } from './StaffAppDrawer';
import './StaffNavigation.css';

export const StaffNavigation: React.FC<{
  mode: 'desktop' | 'phone';
  activeTab: DockTabId;
  activeApp: string;
  apps: StaffApp[];
  drawerOpen: boolean;
  onOpenDrawer: () => void;
  onCloseDrawer: () => void;
  onSelectTab: (id: DockTabId) => void;
  onSelectApp: (id: string) => void;
}> = ({ mode, activeTab, activeApp, apps, drawerOpen, onOpenDrawer, onCloseDrawer, onSelectTab, onSelectApp }) => <>
  {mode === 'desktop' ? <MacOSDock activeTab={activeTab} onSelectTab={onSelectTab} onOpenApps={onOpenDrawer} /> :
    createPortal(<nav className="staff-phone-navigation" aria-label="Staff phone navigation">
      <button type="button" data-staff-app-trigger aria-label="Open staff apps" aria-expanded={drawerOpen} aria-haspopup="dialog" onClick={onOpenDrawer}>
        <LayoutGrid size={23} aria-hidden="true" /><span>Apps</span>
      </button>
    </nav>, document.body)}
  {drawerOpen && <StaffAppDrawer apps={apps} mode={mode} activeApp={activeApp} onClose={onCloseDrawer} onSelect={id => {
    onSelectApp(id); onCloseDrawer();
  }} />}
</>;
