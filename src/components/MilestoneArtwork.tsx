import React, { useEffect, useId, useMemo, useRef } from 'react';
import type { MilestoneKind } from '../utils/milestoneAnimations';
import { MILESTONE_ART_MS, milestoneFrame, milestoneSvgMarkup } from '../utils/milestoneVisuals';
import './milestoneAnimations.css';

/** Crisp authored vector artwork; only SVG attributes change during playback. */
export function MilestoneArtwork({ kind, animate = true }: { kind: MilestoneKind; animate?: boolean }) {
  const id = useId();
  const ref = useRef<SVGSVGElement>(null);
  const markup = useMemo(() => milestoneSvgMarkup(kind, id, animate ? 0 : MILESTONE_ART_MS), [kind, id, animate]);

  useEffect(() => {
    const svg = ref.current;
    if (!svg) return;
    const element = (selector: string) => svg.querySelector<SVGElement>(selector);
    const ride = element('[data-ride]'), frontLeg = element('[data-front-leg]'), backLeg = element('[data-back-leg]');
    const frontShoe = element('[data-front-shoe]'), backShoe = element('[data-back-shoe]'), body = element('[data-body]');
    const crank = element('[data-crank]'), result = element('[data-result]'), halo = element('[data-halo]'), ring = element('[data-ring]');
    const spokes = Array.from(svg.querySelectorAll<SVGElement>('[data-spokes]'));
    const draw = Array.from(svg.querySelectorAll<SVGElement>('[data-draw]'));
    const sparks = Array.from(svg.querySelectorAll<SVGElement>('[data-spark]'));
    const apply = (time: number) => {
      const frame = milestoneFrame(time);
      ride?.setAttribute('transform', frame.rideTransform); ride?.setAttribute('opacity', String(frame.rideOpacity));
      frontLeg?.setAttribute('d', frame.frontPath); backLeg?.setAttribute('d', frame.backPath);
      frontShoe?.setAttribute('transform', frame.frontShoe); backShoe?.setAttribute('transform', frame.backShoe);
      body?.setAttribute('transform', frame.bodyTransform); crank?.setAttribute('transform', frame.crankTransform);
      for (const spoke of spokes) spoke.setAttribute('transform', 'rotate(' + frame.wheelAngle + ' ' + spoke.getAttribute('data-cx') + ' 172)');
      result?.setAttribute('transform', frame.resultTransform); result?.setAttribute('opacity', String(frame.resultOpacity));
      halo?.setAttribute('opacity', String(frame.haloOpacity));
      ring?.setAttribute('stroke-dashoffset', String(frame.ringOffset * 421));
      for (const path of draw) path.setAttribute('stroke-dashoffset', String(frame.drawOffset * 100));
      sparks.forEach((spark,i) => { spark.setAttribute('transform', frame.sparks[i].transform); spark.setAttribute('opacity', String(frame.sparks[i].opacity)); });
    };
    const motion = typeof window.matchMedia === 'function' ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
    let raf = 0;
    let finished = false;
    const cancel = () => { if (raf && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(raf); };
    const finish = () => { cancel(); finished = true; apply(MILESTONE_ART_MS); };
    const changed = () => { if (motion?.matches || document.hidden) finish(); };
    if (!animate || motion?.matches || document.hidden || typeof requestAnimationFrame !== 'function') { finish(); return; }
    const start = performance.now();
    const tick = (now: number) => {
      if (finished) return;
      const elapsed = Math.min(now - start, MILESTONE_ART_MS);
      apply(elapsed);
      if (elapsed < MILESTONE_ART_MS) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    motion?.addEventListener?.('change', changed);
    document.addEventListener('visibilitychange', changed);
    return () => { cancel(); motion?.removeEventListener?.('change', changed); document.removeEventListener('visibilitychange', changed); };
  }, [kind, animate, markup]);

  return <svg ref={ref} viewBox="0 0 480 240" fill="none" aria-hidden="true" focusable="false" className="stakeys-milestone-art" data-variant={kind} dangerouslySetInnerHTML={{__html:markup}}/>;
}

const contextLabel: Record<MilestoneKind,string> = {
  booking:'Workshop update', garage:'Your garage', listing:'Marketplace', sale:'Marketplace',
  reward:'Loyalty rewards', voucher:'Your rewards wallet', prize:'Prize draw', welcome:'Stakey’s membership',
};

/** Shared by realtime notices and the saved-booking confirmation. */
export function MilestoneMessage({ kind, title, detail, onDismiss, dismissLabel = 'Dismiss animation' }: {
  kind:MilestoneKind; title:string; detail:string; onDismiss:()=>void; dismissLabel?:string;
}) {
  return <div className="stakeys-milestone-message" role="status" aria-live="polite" aria-atomic="true">
    <MilestoneArtwork kind={kind}/>
    <div className="stakeys-milestone-copy">
      <div className="stakeys-milestone-eyebrow"><span aria-hidden="true"/>{contextLabel[kind]}</div>
      <h3>{title}</h3><p>{detail}</p>
      <button type="button" aria-label={dismissLabel} onClick={onDismiss}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true"><path d="M6 6L18 18M18 6L6 18"/></svg></button>
      <div className="stakeys-milestone-timer" aria-hidden="true"><span/></div>
    </div>
  </div>;
}
