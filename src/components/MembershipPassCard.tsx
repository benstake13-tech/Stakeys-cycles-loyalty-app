import React, { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { QRCodeSVG } from 'qrcode.react';
import JsBarcode from 'jsbarcode';
import { Award, Ticket, Sparkles, Bike, CalendarDays, ArrowUpRight, ScanLine, Pencil, X } from 'lucide-react';
import type { UserProfile } from '../types/bikeShop';
import { encodeMembershipPayload, membershipBalance } from '../utils/membershipCode';
import { THEME_BANNERS, type HolidayThemeId } from '../utils/themeBanners';
import { AddToWalletButton } from './AddToWalletButton';
import { FaceAvatar } from './FaceAvatar';
import { StakeysLogo } from './StakeysLogo';
import './membershipPass.css';

interface MembershipPassCardProps {
  user: UserProfile;
  seasonalTheme?: string | null;
  garageCount?: number;
  bookingCount?: number;
  onEditAvatar?: () => void;
  onOpenGarage?: () => void;
  onOpenBookings?: () => void;
}

type Motif = 'bat' | 'snow' | 'leaf' | 'heart' | 'flower' | 'sun' | 'clover' | 'lantern' | 'moon' | 'rabbit' | 'spark' | 'poppy';

function motifFor(theme: string): Motif {
  if (theme === 'halloween') return 'bat';
  if (['christmas', 'winter', 'boxingday'].includes(theme)) return 'snow';
  if (['autumn', 'thanksgiving'].includes(theme)) return 'leaf';
  if (theme === 'valentines') return 'heart';
  if (theme === 'stpatricks') return 'clover';
  if (theme === 'easter') return 'rabbit';
  if (['spring', 'mayday', 'springbank', 'mothersday', 'earthday'].includes(theme)) return 'flower';
  if (['summer', 'summerbank', 'fathersday'].includes(theme)) return 'sun';
  if (['ramadan', 'eidfitr', 'eidadha'].includes(theme)) return 'moon';
  if (['cny', 'midautumn', 'diwali', 'hanukkah'].includes(theme)) return 'lantern';
  if (theme === 'remembranceday') return 'poppy';
  return 'spark';
}

/** Small vector ornaments stay in the header, clear of all scan surfaces. */
function SeasonalMotif({ kind }: { kind: Motif }) {
  switch (kind) {
    case 'bat': return <path d="M2 13Q3 5 8 9L10 6L12 9L14 6L16 9Q21 5 22 13Q18 10 17 16Q14 12 12 18Q10 12 7 16Q6 10 2 13Z" fill="currentColor" stroke="none"/>;
    case 'snow': return <path d="M12 2V22M3.4 7L20.6 17M3.4 17L20.6 7M9 4L12 7L15 4M9 20L12 17L15 20M4 10L8 10L8 6M16 18L16 14L20 14M4 14L8 14L8 18M16 6L16 10L20 10"/>;
    case 'leaf': return <><path d="M20 3Q3 2 4 16Q15 24 20 3Z"/><path d="M3 22L16 8M9 16L8 10M13 12L18 12"/></>;
    case 'heart': return <path d="M12 21L3.7 12.5C-2 6.5 6-1 12 6C18-1 26 6.5 20.3 12.5Z" fill="currentColor" stroke="none"/>;
    case 'flower': return <><path d="M12 9C1-3-4 11 9 12C-3 24 11 28 12 15C24 28 28 14 15 12C28 0 14-4 12 9Z"/><circle cx="12" cy="12" r="2"/></>;
    case 'sun': return <><circle cx="12" cy="12" r="4"/><path d="M12 1V4M12 20V23M1 12H4M20 12H23M4 4L6 6M18 18L20 20M4 20L6 18M18 6L20 4"/></>;
    case 'clover': return <><path d="M12 12C0 14 0 2 8 5C5-3 19-3 16 5C24 2 24 14 12 12Z"/><path d="M12 12Q14 19 9 22"/></>;
    case 'lantern': return <><path d="M8 3H16M8 21H16M12 0V3M12 21V24"/><rect x="4" y="5" width="16" height="14" rx="6"/><path d="M10 6Q7 12 10 18M14 6Q17 12 14 18"/></>;
    case 'moon': return <><path d="M18 3A10 10 0 1 0 21 18A9 9 0 0 1 18 3Z"/><path d="M20 5V11M17 8H23"/></>;
    case 'rabbit': return <><ellipse cx="8" cy="6" rx="2.5" ry="5"/><ellipse cx="16" cy="6" rx="2.5" ry="5"/><ellipse cx="12" cy="16" rx="8" ry="7"/><path d="M8 15H8.1M16 15H16.1M10 19L12 20L14 19"/></>;
    case 'poppy': return <><path d="M12 11C0-2-4 13 8 13C-3 24 14 27 13 16C26 27 28 10 17 12C26-2 10-4 12 11Z" fill="currentColor" stroke="none"/><circle cx="12" cy="13" r="3" fill="#101b17" stroke="none"/></>;
    default: return <path d="M12 1L14.5 9.5L23 12L14.5 14.5L12 23L9.5 14.5L1 12L9.5 9.5Z"/>;
  }
}

function Barcode({ payload }: { payload: string }) {
  const barcodeRef = useRef<SVGSVGElement | null>(null);
  const [valid, setValid] = useState(true);
  useEffect(() => {
    const svg = barcodeRef.current;
    if (!svg) return;
    try {
      JsBarcode(svg, payload, { format:'CODE128', displayValue:false, height:54, width:1.6, margin:12, background:'#ffffff', lineColor:'#0b0d10' });
      // JsBarcode writes intrinsic dimensions; a viewBox lets the complete code
      // scale into mobile layouts instead of clipping the right-hand bars.
      svg.setAttribute('viewBox', '0 0 ' + svg.getAttribute('width') + ' ' + svg.getAttribute('height'));
      svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
      setValid(true);
    } catch { setValid(false); }
  }, [payload]);
  return <div className="member-hub__barcode">{valid ? <svg ref={barcodeRef} role="img" aria-label="Membership barcode" /> : <p>Use the QR code above to scan your pass.</p>}</div>;
}

/** One member identity, one live loyalty balance and stationary scan codes. */
export const MembershipPassCard: React.FC<MembershipPassCardProps> = ({
  user, seasonalTheme, garageCount, bookingCount, onEditAvatar, onOpenGarage, onOpenBookings,
}) => {
  const membership = user.membershipNumber || 'STK-000000';
  const balance = membershipBalance(user);
  const payload = encodeMembershipPayload(membership, balance);
  const banner = seasonalTheme ? THEME_BANNERS[seasonalTheme as HolidayThemeId] : undefined;
  const motif = motifFor(seasonalTheme || '');
  const [flourish, setFlourish] = useState(0);
  const [scanOpen, setScanOpen] = useState(false);
  const [paused, setPaused] = useState(false);
  const cardRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const modalTitle = useId();
  const stamps = Math.max(0, Math.min(10, balance.stamps));
  const hasActivity = garageCount !== undefined || bookingCount !== undefined;
  const cardStyle = { '--member-accent':banner?.accent || '#05c97a' } as React.CSSProperties;

  useEffect(() => {
    const node = cardRef.current;
    let visible = true;
    const sync = () => setPaused(document.hidden || !visible);
    const observer = typeof IntersectionObserver === 'undefined' ? null : new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; sync(); });
    if (node) observer?.observe(node);
    document.addEventListener('visibilitychange', sync);
    sync();
    return () => { observer?.disconnect(); document.removeEventListener('visibilitychange', sync); };
  }, []);

  useEffect(() => {
    if (!scanOpen) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setScanOpen(false);
      // The scan sheet has one control, so keep keyboard focus on its close button.
      if (event.key === 'Tab') { event.preventDefault(); closeRef.current?.focus(); }
    };
    document.addEventListener('keydown', keydown);
    return () => { document.body.style.overflow = overflow; document.removeEventListener('keydown', keydown); previousFocus?.focus(); };
  }, [scanOpen]);

  return <>
    <section ref={cardRef} className="member-hub" style={cardStyle} aria-label="Digital Membership Pass" data-testid="member-hub" data-paused={paused || scanOpen} data-season={banner ? seasonalTheme : 'none'}>
      <div className="member-hub__hero">
        <div className="member-hub__halo" aria-hidden="true" />
        {banner && <div key={String(seasonalTheme) + flourish} className={'member-hub__scene' + (flourish ? ' member-hub__scene--flourish' : '')} aria-hidden="true">
          {Array.from({length:6}, (_,i) => <svg key={i} className={'member-hub__ornament member-hub__ornament--' + motif} style={{'--i':i} as React.CSSProperties} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round"><SeasonalMotif kind={motif}/></svg>)}
        </div>}
        <div className="member-hub__brand">
          <div className="member-hub__wordmark"><StakeysLogo className="member-hub__logo"/><div><span>STAKEY'S <b>CYCLES</b></span><small>YOUR RIDE. YOUR REWARDS.</small></div></div>
          {banner && <button type="button" className="member-hub__season" aria-label={'Play ' + banner.short + ' animation'} onClick={() => setFlourish(n => n + 1)}><span aria-hidden="true">✦</span>{banner.short}</button>}
        </div>
        <div className="member-hub__identity">
          <div className="member-hub__welcome"><p>Welcome back,</p><h1>{user.displayName}</h1><span className="member-hub__number">MEMBER <b>{membership}</b></span></div>
          {onEditAvatar ? <button type="button" className="member-hub__avatar" onClick={onEditAvatar} aria-label="Edit your avatar"><FaceAvatar seed={user.displayName} configString={user.avatarColor} size={76}/><span><Pencil size={12}/></span></button> : <div className="member-hub__avatar"><FaceAvatar seed={user.displayName} configString={user.avatarColor} size={76}/></div>}
        </div>
        {hasActivity && <div className="member-hub__activity">
          {garageCount !== undefined && <button type="button" onClick={onOpenGarage} disabled={!onOpenGarage}><Bike size={15}/><b>{garageCount}</b><span>Garage bikes</span>{onOpenGarage && <ArrowUpRight size={13}/>}</button>}
          {bookingCount !== undefined && <button type="button" onClick={onOpenBookings} disabled={!onOpenBookings}><CalendarDays size={15}/><b>{bookingCount}</b><span>Bookings</span>{onOpenBookings && <ArrowUpRight size={13}/>}</button>}
        </div>}
      </div>
      <div className="member-hub__rewards" aria-label="Your rewards">
        <div><span><Award size={14}/>Stamps</span><strong>{balance.stamps}<small>/10</small></strong></div>
        <div><span><Ticket size={14}/>Tickets</span><strong>{balance.tickets}</strong></div>
        <div><span><Sparkles size={14}/>Points</span><strong>{balance.points}</strong></div>
      </div>
      <div className="member-hub__progress" role="progressbar" aria-label="Visit stamps" aria-valuemin={0} aria-valuemax={10} aria-valuenow={stamps}>{Array.from({length:10},(_,i)=><span key={i} className={i<stamps?'is-earned':''}/>)}</div>
      <div className="member-hub__scan">
        <div className="member-hub__scan-row">
          <div className="member-hub__qr"><QRCodeSVG value={payload} size={124} level="M" marginSize={4} bgColor="#ffffff" fgColor="#0b0d10" title={'Membership ' + membership}/></div>
          <div className="member-hub__scan-copy"><span>YOUR DIGITAL PASS</span><h2>Ready when you ride.</h2><p>Show your QR code or barcode at the till.</p><button type="button" onClick={()=>setScanOpen(true)} aria-haspopup="dialog" aria-expanded={scanOpen}><ScanLine size={16}/>Expand to scan</button></div>
        </div>
        <Barcode payload={payload}/>
        <div className="member-hub__scan-footer"><span>MEMBER {membership}</span><span>Stakey's Cycles · Salford</span></div>
      </div>
      <div className="member-hub__wallet"><AddToWalletButton user={user}/></div>
    </section>
    {scanOpen && createPortal(<div className="member-scan-overlay" onClick={event=>{if(event.target===event.currentTarget)setScanOpen(false);}}>
      <section className="member-scan-sheet" role="dialog" aria-modal="true" aria-labelledby={modalTitle}>
        <div className="member-scan-sheet__heading"><h2 id={modalTitle}>Your membership pass</h2><button ref={closeRef} type="button" aria-label="Close membership pass" onClick={()=>setScanOpen(false)}><X size={22}/></button></div>
        <p>{user.displayName}</p><strong>Member {membership}</strong>
        <div className="member-scan-sheet__qr"><QRCodeSVG value={payload} size={240} level="M" marginSize={4} bgColor="#ffffff" fgColor="#0b0d10" title={'Membership ' + membership}/></div>
        <Barcode payload={payload}/>
        <small>Present either code to a team member at the till.</small>
      </section>
    </div>, document.body)}
  </>;
};
