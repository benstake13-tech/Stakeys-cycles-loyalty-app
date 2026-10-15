import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useShop } from '../context/ShopContext';
import { buildWorkshopActivities } from '../utils/notificationActivity';
import { activityMilestone, pendingMilestones, claimMilestone, MILESTONE_EVENT, milestoneCopy, type MilestoneEvent } from '../utils/milestoneAnimations';
import { MilestoneMessage } from './MilestoneArtwork';
import { MILESTONE_NOTICE_MS } from '../utils/milestoneVisuals';

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
    const timer = setTimeout(() => setQueue(q => q.slice(1)), MILESTONE_NOTICE_MS);
    return () => clearTimeout(timer);
  }, [active]);
  useEffect(() => {
    const hide = () => { if (document.hidden) setQueue([]); };
    document.addEventListener('visibilitychange', hide);
    return () => document.removeEventListener('visibilitychange', hide);
  }, []);
  if (!active) return null;
  const copy = milestoneCopy[active.kind];
  return createPortal(<div className="stakeys-milestone-overlay">
    <MilestoneMessage key={active.id} kind={active.kind} title={active.title || copy.title} detail={active.detail || copy.detail} onDismiss={() => setQueue(q => q.slice(1))}/>
  </div>, document.body);
}
export function MilestoneOverlay() {
  const { currentUser } = useShop();
  return currentUser ? <AccountMilestones key={currentUser.uid} scope={currentUser.uid}/> : null;
}
