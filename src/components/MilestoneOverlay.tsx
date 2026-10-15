import React, { useEffect, useRef, useState } from 'react';
import { useShop } from '../context/ShopContext';
import { buildWorkshopActivities } from '../utils/notificationActivity';
import { activityMilestone, pendingMilestones, claimMilestone, MILESTONE_EVENT, milestoneCopy, type MilestoneEvent } from '../utils/milestoneAnimations';
import { MilestoneArtwork } from './MilestoneArtwork';

function AccountMilestones({ scope }: { scope: string }) {
  const { currentUser, users = [], bookings = [], draws = [], notificationPreferences } = useShop();
  const since = useRef(Date.now());
  const [queue, setQueue] = useState<MilestoneEvent[]>([]);
  const active = queue[0];
  const enqueue = (event: MilestoneEvent) => {
    if (event.scope !== scope || !milestoneCopy[event.kind] || document.hidden) return;
    if (claimMilestone(scope, event.id)) setQueue(q => q.length < 3 ? [...q, event] : q);
  };
  useEffect(() => {
    const receive = (e: Event) => enqueue((e as CustomEvent<MilestoneEvent>).detail);
    window.addEventListener(MILESTONE_EVENT, receive);
    return () => window.removeEventListener(MILESTONE_EVENT, receive);
  }, [scope]);
  useEffect(() => {
    if (!currentUser) return;
    const staff = currentUser.role === 'staff' || currentUser.role === 'admin';
    const activities = buildWorkshopActivities({ bookings: staff ? bookings : [], users: staff ? users : [currentUser], draws: staff ? draws : draws.filter(d => d.winnerUid === scope) });
    for (const activity of [...activities].reverse()) {
      const kind = activityMilestone[activity.kind];
      if (!kind || pendingMilestones.has(activity.id) || activity.timestamp < since.current || !notificationPreferences?.[activity.kind]?.visual) continue;
      if (!staff && activity.audience === 'staff') continue;
      enqueue({ id: activity.id, scope, kind, title: activity.title.replace(/^[^\p{L}\p{N}]+/u, ''), detail: activity.detail });
    }
  }, [currentUser, users, bookings, draws, notificationPreferences, scope]);
  useEffect(() => {
    if (!active) return;
    const timer = setTimeout(() => setQueue(q => q.slice(1)), 4200);
    return () => clearTimeout(timer);
  }, [active]);
  useEffect(() => {
    const hide = () => { if (document.hidden) setQueue([]); };
    document.addEventListener('visibilitychange', hide);
    return () => document.removeEventListener('visibilitychange', hide);
  }, []);
  if (!active) return null;
  const copy = milestoneCopy[active.kind];
  return <div className="stakeys-milestone-overlay"><div className="stakeys-milestone-message" role="status" aria-live="polite" key={active.id}>
    <MilestoneArtwork kind={active.kind}/>
    <h3>{active.title || copy.title}</h3><p>{active.detail || copy.detail}</p>
    <button type="button" aria-label="Dismiss animation" onClick={() => setQueue(q => q.slice(1))}>×</button>
  </div></div>;
}
export function MilestoneOverlay() {
  const { currentUser } = useShop();
  return currentUser ? <AccountMilestones key={currentUser.uid} scope={currentUser.uid}/> : null;
}
