import { announceMilestone } from '../utils/milestoneAnimations';
import React, { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';
import { Bike, CheckCircle2, CircleAlert, Clock3, Gavel, ImagePlus, LoaderCircle, MapPin, MessageCircle, RefreshCw, Send, ShieldCheck, Store, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase';
import { useShop } from '../context/ShopContext';
import { AiBikeIdentifier } from './AiBikeIdentifier';
import { MarketplaceAuction, minimumAuctionBid, type MarketplaceAuctionRow } from './MarketplaceAuction';
import { MarketplaceRecords } from './MarketplaceRecords';
import { MarketplaceManualSale } from './MarketplaceManualSale';
import { MarketplaceInboxEmpty } from './marketplace/MarketplaceInboxEmpty';
import { MarketplaceGuide, type MarketplaceView } from './marketplace/MarketplaceGuide';
const MemberLogin = lazy(() => import('./LoginScreen').then(module => ({ default: module.LoginScreen })));

type Listing = {
  id: string; seller_id?: string; title: string; category: 'bicycle'|'ebike'|'escooter'|'parts'|'accessories'; subcategory?:'commuter'|'hardtail_mtb'|'road'|'other'|null; make_model: string; ai_inspection?:MarketplaceInspection|null;
  condition: string; description: string; asking_price: number; images: string[]; image_paths?:string[]; status: string; created_at: string; serialCheck?:SerialCheck;
};
type LedgerRow = { id:string; listing_id:string; seller_id:string; gross_amount:number; commission_amount:number; seller_payable:number; payment_status:string; payout_status:string; payout_reference?:string|null; created_at:string; listing?:{title:string;make_model:string}[]|null };
type Conversation = { id:string; listing_id:string; buyer_id:string; seller_id:string; listing?:{title:string;make_model:string;asking_price:number}|null };
type ChatMessage = { id:string; conversation_id:string; sender_id:string; body:string; created_at:string };
type DealTerms = { proposed_price:number; proposed_by:string; agreed_price:number|null; accepted_by:string|null; location_method:string|null; location_details:string|null; location_set_by:string|null; buyer_location_confirmed_at:string|null; seller_location_confirmed_at:string|null };
type SerialCheck = { frame_serial_number:string; serial_number_photo_path:string; serial_path?:string; check_status:'clear'|'review_required'; checked_at:string; response_sha256:string; matched_stolen_records:number };
type StolenFlag = { id:string; user_id:string; listing_title:string; make_model:string; serial_sha256:string; bike_index_response_sha256:string; matching_stolen_records:number; status:string; created_at:string };
type AuctionBid = { id:string; listing_id:string; amount:number };
type MarketplaceInspection = { make:string; model:string; year?:string|number|null; type:string; colour?:string|null; frameMaterial?:string|null; overallCondition?:string|null; wheelSizeAndSpecs?:string|null; confidence:number; coverage:number; summary?:string|null; mainSpecs:any[]; obviousProblems:any[]; faults:any[]; photoRequests:any[]; notVisible:string[]; hasVisualData:true; usedFallback:false };

const money = (n: number) => new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(n);
const STATUS: Record<string,string> = { pending_approval: 'Awaiting review', pending_review: 'Serial check review', active: 'Live', sold: 'Sold', cancelled: 'Archived', rejected: 'Needs changes' };
const SUBCATEGORY_LABEL: Record<string,string> = { commuter:'Commuter', hardtail_mtb:'Hardtail MTB', road:'Road bike', other:'Other bicycle' };
const listingCategoryLabel = (item: Pick<Listing,'category'|'subcategory'>) => item.category==='parts'?'Parts':item.category==='accessories'?'Accessories':item.category==='ebike'?'E-bike':item.category==='escooter'?'E-scooter':SUBCATEGORY_LABEL[item.subcategory || ''] || 'Bicycle';
const shortText = (value:unknown, max=240) => typeof value === 'string' ? value.trim().slice(0,max) : '';
const marketplaceInspectionFromResult = (result:any):MarketplaceInspection => ({
  make:shortText(result.make,100), model:shortText(result.model,140), year:result.year ?? null,
  type:shortText(result.type,40), colour:shortText(result.colour,80) || null, frameMaterial:shortText(result.frameMaterial,100) || null,
  overallCondition:shortText(result.overallCondition,60) || null, wheelSizeAndSpecs:shortText(result.wheelSizeAndSpecs,160) || null,
  confidence:Math.max(0,Math.min(1,Number(result.confidence)||0)), coverage:Math.max(0,Math.min(100,Number(result.coverage)||0)),
  summary:shortText(result.summary,800) || null, hasVisualData:true, usedFallback:false,
  mainSpecs:(Array.isArray(result.mainSpecs)?result.mainSpecs:[]).slice(0,50).map((spec:any)=>({
    componentName:shortText(spec.componentName,100), category:shortText(spec.category,100), currentPart:shortText(spec.currentPart,240),
    brand:shortText(spec.brand,100), model:shortText(spec.model,140), specValue:shortText(spec.specValue,160), condition:shortText(spec.condition,60),
    confidence:Math.max(0,Math.min(1,Number(spec.confidence)||0)), visibility:shortText(spec.visibility,60),
    stockComparison:shortText(spec.stockComparison,80), stockComparisonNote:shortText(spec.stockComparisonNote,240),
    specDetails:(Array.isArray(spec.specDetails)?spec.specDetails:[]).slice(0,16).map((detail:any)=>({name:shortText(detail.name,100),value:shortText(detail.value,160),verification:shortText(detail.verification,60)})),
  })),
  obviousProblems:(Array.isArray(result.obviousProblems)?result.obviousProblems:[]).slice(0,30).map((problem:any)=>({issue:shortText(problem.issue,240),severity:shortText(problem.severity,40),location:shortText(problem.location,160),recommendation:shortText(problem.recommendation,240)})),
  faults:(Array.isArray(result.faults)?result.faults:[]).slice(0,30).map((fault:any)=>({faultTitle:shortText(fault.faultTitle,180),component:shortText(fault.component,120),severity:shortText(fault.severity,40),description:shortText(fault.description,240)})),
  photoRequests:(Array.isArray(result.photoRequests)?result.photoRequests:[]).slice(0,20).map((request:any)=>({area:shortText(request.area,120),instruction:shortText(request.instruction,240),reason:shortText(request.reason,240),systemId:shortText(request.systemId,80)})),
  notVisible:(Array.isArray(result.notVisible)?result.notVisible:[]).slice(0,30).map((entry:unknown)=>shortText(entry,140)).filter(Boolean),
});

/** Shared marketplace surface used by the public website and customer app. */
export const MarketplacePanel: React.FC<{ staff?: boolean; enabled?: boolean }> = ({ staff = false, enabled = true }) => {
  const { currentUser } = useShop();
  const userId = currentUser?.uid;
  const [view, setView] = useState<MarketplaceView>('browse');
  const [chatError, setChatError] = useState('');
  const checkoutEnabled = import.meta.env.VITE_MARKETPLACE_PAYMENTS_ENABLED === 'true';
  const [appNotice, setAppNotice] = useState(false);
  const [imageWarning, setImageWarning] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [listings, setListings] = useState<Listing[]>([]);
  const [auctions, setAuctions] = useState<Record<string,MarketplaceAuctionRow>>({});
  const [myBids, setMyBids] = useState<AuctionBid[]>([]);
  const [auctionBusy, setAuctionBusy] = useState<string|null>(null);
  const [manualSaleListing, setManualSaleListing] = useState<Listing|null>(null);
  const [recordsVersion, setRecordsVersion] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [saleMode, setSaleMode] = useState<'fixed'|'auction'>('fixed');
  const [auctionDuration, setAuctionDuration] = useState(72);
  const [stolenFlags, setStolenFlags] = useState<StolenFlag[]>([]);
  const [busy, setBusy] = useState(false);
  const [resettingListings, setResettingListings] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingListing, setEditingListing] = useState<Listing|null>(null);
  const [existingImagePaths, setExistingImagePaths] = useState<string[]>([]);
  const [existingSerialPath, setExistingSerialPath] = useState('');
  const [showAiInspector, setShowAiInspector] = useState(false);
  const [aiInspection, setAiInspection] = useState<MarketplaceInspection|null>(null);
  const [categoryFilter, setCategoryFilter] = useState<'all'|'commuter'|'hardtail_mtb'|'road'|'other'|'ebike'|'escooter'|'parts'|'accessories'>('all');
  const [searchText, setSearchText] = useState('');
  const [detailListing, setDetailListing] = useState<Listing | null>(null);
  const [detailPhotoIndex, setDetailPhotoIndex] = useState(0);
  const [buyingId, setBuyingId] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [ledger, setLedger] = useState<LedgerRow[]>([]);
  const [payoutRefs, setPayoutRefs] = useState<Record<string,string>>({});
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [storedConversation, setSelectedConversation] = useState<Conversation|null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [threadDeal, setDeal] = useState<DealTerms|null>(null);
  const [messageDraft, setMessageDraft] = useState('');
  const [offerDraft, setOfferDraft] = useState('');
  const [manualLocation, setManualLocation] = useState('');
  const [editingLocation, setEditingLocation] = useState(false);
  const [chatBusy, setChatBusy] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [serialPhoto, setSerialPhoto] = useState<File|null>(null);
  const [frameSerial, setFrameSerial] = useState('');
  const [form, setForm] = useState({ title:'', category:'bicycle' as Listing['category'], subcategory:'commuter' as NonNullable<Listing['subcategory']>, make_model:'', condition:'good', description:'', asking_price:'' });
  const selectedConversation = storedConversation && userId && [storedConversation.buyer_id, storedConversation.seller_id].includes(userId) ? storedConversation : null;
  const chatScope = useRef({ userId, conversationId: selectedConversation?.id });
  chatScope.current = { userId, conversationId: selectedConversation?.id };
  const [threadConversationId, setThreadConversationId] = useState<string | null>(null);
  const deal = threadConversationId === selectedConversation?.id ? threadDeal : null;
  useEffect(() => {
    setSelectedConversation(null); setConversations([]); setChatMessages([]); setDeal(null);
    setMessageDraft(''); setOfferDraft(''); setChatError(''); setShowForm(false);
    if (userId) setAppNotice(false);
  }, [userId]);
  useEffect(() => {
    if (!appNotice) return;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const close = document.getElementById('marketplace-member-close'); close?.focus();
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setAppNotice(false);
      if (event.key !== 'Tab') return;
      const elements = Array.from(document.querySelectorAll<HTMLElement>('#marketplace-member-dialog button:not(:disabled), #marketplace-member-dialog input, #marketplace-member-dialog select, #marketplace-member-dialog a[href]')).filter(element => element.getClientRects().length);
      const first = elements[0], last = elements[elements.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener('keydown', key);
    return () => { document.body.style.overflow = overflow; document.removeEventListener('keydown', key); previous?.focus(); };
  }, [appNotice]);

  useEffect(() => {
    if (!enabled || !Object.values(auctions).some(auction => auction.status==='live')) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [enabled,auctions]);

  const load = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    setLoadError('');
    setImageWarning(false);
    try {
    const table = supabase.from('marketplace_listings');
    let query = userId || staff
      ? table.select('id,seller_id,title,category,subcategory,make_model,condition,description,asking_price,images,status,created_at,ai_inspection').order('created_at',{ascending:false})
      : table.select('id,title,category,subcategory,make_model,condition,description,asking_price,images,status,created_at,ai_inspection').order('created_at',{ascending:false});
    if (staff) query = query.in('status',['pending_approval','pending_review','active','cancelled']);
    else if (userId) query = query.or(`status.eq.active,seller_id.eq.${userId}`);
    else query = query.eq('status','active');
    const { data, error } = await query;
    if (error) throw error;
    else {
      const rows = (data || []) as Listing[];
      if (rows.length) {
        const auctionResult = await supabase.from('marketplace_auctions')
          .select('listing_id,start_price,duration_hours,status,starts_at,ends_at,highest_bid,bid_count,extension_count,winning_bid_id')
          .in('listing_id', rows.map(row => row.id));
        if (auctionResult.error) console.warn('Marketplace auctions could not be loaded:',auctionResult.error);
        const auctionRows = ((auctionResult.data || []) as MarketplaceAuctionRow[])
          .filter(auction => Boolean(auction.listing_id) && Boolean(auction.status));
        setAuctions(Object.fromEntries(auctionRows.map(auction => [auction.listing_id,auction])));
        if (userId && auctionRows.length) {
          const bidsResult = await supabase.from('marketplace_bids')
            .select('id,listing_id,amount').eq('bidder_id',userId)
            .in('listing_id',auctionRows.map(auction => auction.listing_id));
          if (bidsResult.error) console.warn('Your auction bids could not be loaded:',bidsResult.error);
          setMyBids((bidsResult.data || []) as AuctionBid[]);
        } else setMyBids([]);
      } else { setAuctions({}); setMyBids([]); }
      const checksResult = (staff || userId) && rows.length
        ? await supabase.from('marketplace_serial_checks').select('listing_id,seller_id,frame_serial_number,serial_number_photo_path,check_status,checked_at,response_sha256,matched_stolen_records').in('listing_id',rows.map(row=>row.id))
        : {data:[],error:null};
      const serialByListing = new Map(((checksResult.data||[]) as any[]).map(row=>[row.listing_id,row as SerialCheck & {listing_id:string}]));
      const enrichedRows = rows.map(row=>({...row,image_paths:[...(row.images||[])],serialCheck:serialByListing.get(row.id)} as Listing & {serialCheck?:SerialCheck}));
      const paths = enrichedRows.flatMap(row => [...(row.images || []), ...(row.serialCheck?.serial_number_photo_path?[row.serialCheck.serial_number_photo_path]:[])]);
      const signed = paths.length ? await supabase.storage.from('marketplace-images').createSignedUrls(paths, 3600) : { data: [] };
      if ('error' in signed && signed.error) setImageWarning(true);
      const signedByPath = new Map((signed.data || []).map((x:any) => [x.path, x.signedUrl]));
      setListings(enrichedRows.map(row => ({ ...row, images:(row.images || []).map(path => signedByPath.get(path) || '').filter(Boolean), serialCheck:row.serialCheck?{...row.serialCheck,serial_path:row.serialCheck.serial_number_photo_path,serial_number_photo_path:signedByPath.get(row.serialCheck.serial_number_photo_path)||''}:undefined })));
    }
    if (staff) {
      const { data: rows, error: ledgerError } = await supabase.from('marketplace_transactions').select('id,listing_id,seller_id,gross_amount,commission_amount,seller_payable,payment_status,payout_status,payout_reference,created_at,listing:marketplace_listings(title,make_model)').order('created_at',{ascending:false}).limit(50);
      if (ledgerError) toast.error('Could not load marketplace ledger.');
      else setLedger((rows || []) as LedgerRow[]);
      const {data:flags,error:flagsError}=await supabase.from('marketplace_stolen_listing_flags').select('id,user_id,listing_title,make_model,serial_sha256,bike_index_response_sha256,matching_stolen_records,status,created_at').eq('status','open').order('created_at',{ascending:false}).limit(50);
      if(flagsError) console.warn('Marketplace security review flags could not be loaded.'); else setStolenFlags((flags||[]) as StolenFlag[]);
    }
    } catch { setLoadError('We could not load the marketplace. Please refresh or contact Stakey’s Cycles if this continues.'); }
    finally { setLoading(false); }
  }, [staff,userId,enabled]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    const ids = Object.values(auctions).filter(auction => auction.status === 'live').map(auction => auction.listing_id);
    if (!enabled || !ids.length) return;
    const timer = window.setInterval(async () => {
      const { data, error } = await supabase.from('marketplace_auctions')
        .select('listing_id,start_price,duration_hours,status,starts_at,ends_at,highest_bid,bid_count,extension_count,winning_bid_id')
        .in('listing_id', ids);
      if (error || !data) return;
      setAuctions(current => ({ ...current, ...Object.fromEntries((data as MarketplaceAuctionRow[]).map(auction => [auction.listing_id, auction])) }));
      if (userId) {
        const bids = await supabase.from('marketplace_bids').select('id,listing_id,amount')
          .eq('bidder_id', userId).in('listing_id', ids);
        if (!bids.error && bids.data) setMyBids(current => [
          ...current.filter(bid => !ids.includes(bid.listing_id)), ...(bids.data as AuctionBid[]),
        ]);
      }
    }, 20000);
    return () => window.clearInterval(timer);
  }, [enabled, userId, auctions]);

  const loadConversations = useCallback(async () => {
    if (staff || !userId || !enabled) return;
    const { data, error } = await supabase.from('marketplace_conversations')
      .select('id,listing_id,buyer_id,seller_id,listing:marketplace_listings(title,make_model,asking_price)')
      .or(`buyer_id.eq.${userId},seller_id.eq.${userId}`).order('updated_at',{ascending:false});
    if (chatScope.current.userId !== userId) return;
    if (error) { setChatError('Your messages could not be loaded. Please retry.'); return; }
    setChatError('');
    const rows = ((data || []) as any[]).map(row => ({...row, listing:Array.isArray(row.listing)?row.listing[0]||null:row.listing})) as Conversation[];
    setConversations(rows);
    if (selectedConversation) setSelectedConversation(rows.find(row=>row.id===selectedConversation.id) || null);
  }, [staff,userId,enabled,selectedConversation?.id]);

  useEffect(() => {
    void loadConversations();
    if (staff || !userId || !enabled) return;
    const timer = window.setInterval(() => { void loadConversations(); }, 10000);
    return () => window.clearInterval(timer);
  }, [loadConversations,staff,userId,enabled]);

  const loadThread = useCallback(async (conversationId:string) => {
    const scopeUser = chatScope.current.userId;
    const [messagesResult, dealResult] = await Promise.all([
      supabase.from('marketplace_messages').select('id,conversation_id,sender_id,body,created_at').eq('conversation_id',conversationId).order('created_at',{ascending:false}).limit(300),
      supabase.from('marketplace_deal_terms').select('proposed_price,proposed_by,agreed_price,accepted_by,location_method,location_details,location_set_by,buyer_location_confirmed_at,seller_location_confirmed_at').eq('conversation_id',conversationId).maybeSingle(),
    ]);
    if (chatScope.current.userId !== scopeUser || chatScope.current.conversationId !== conversationId) return;
    if (messagesResult.error) { toast.error('Could not load this conversation.'); return; }
    setChatMessages([...(messagesResult.data || [])].reverse() as ChatMessage[]);
    setThreadConversationId(conversationId);
    if (dealResult.error && dealResult.error.code !== 'PGRST116') toast.error('Could not load the price agreement.');
    setDeal((dealResult.data || null) as DealTerms|null);
  }, []);

  useEffect(() => {
    if (!selectedConversation) { setChatMessages([]); setDeal(null); return; }
    setChatMessages([]); setDeal(null); setMessageDraft(''); setOfferDraft('');
    void loadThread(selectedConversation.id);
    const timer = window.setInterval(() => { void loadThread(selectedConversation.id); }, 6000);
    return () => window.clearInterval(timer);
  }, [selectedConversation?.id,loadThread,loadConversations]);

  const startConversation = async (item:Listing) => {
    if (!userId) { setAppNotice(true); return; }
    setChatBusy(true);
    try {
      const { data, error } = await supabase.rpc('start_marketplace_conversation',{p_listing_id:item.id});
      if (error) throw error;
      await loadConversations();
      const conversation = { id:String(data), listing_id:item.id, buyer_id:userId, seller_id:item.seller_id || '', listing:{title:item.title,make_model:item.make_model,asking_price:item.asking_price} } as Conversation;
      if (chatScope.current.userId !== userId) return;
      setConversations(rows => rows.some(row => row.id === conversation.id) ? rows : [conversation, ...rows]);
      setSelectedConversation(conversation); setView('messages');
    } catch (error:any) { toast.error(error?.message || 'Could not open a conversation.'); }
    finally { setChatBusy(false); }
  };

  const sendMessage = async (event:React.FormEvent) => {
    event.preventDefault();
    const body = messageDraft.trim();
    if (!selectedConversation || !body || !userId) return;
    setChatBusy(true);
    try {
      const { error } = await supabase.from('marketplace_messages').insert({conversation_id:selectedConversation.id,sender_id:userId,body});
      if (error) throw error;
      if (chatScope.current.userId === userId && chatScope.current.conversationId === selectedConversation.id) {
        setMessageDraft(''); await loadThread(selectedConversation.id); void loadConversations();
      }
    } catch { toast.error('Message could not be sent. Your draft has been kept; please retry.'); }
    finally { setChatBusy(false); }
  };

  const proposePrice = async (event:React.FormEvent) => {
    event.preventDefault();
    const price = Number(offerDraft);
    if (!selectedConversation || !Number.isFinite(price) || price<=0) { toast.error('Enter a valid agreed-price offer.'); return; }
    const { error } = await supabase.rpc('propose_marketplace_price',{p_conversation_id:selectedConversation.id,p_price:price});
    if (error) toast.error(error.message || 'Could not send the price offer.');
    else { setOfferDraft(''); await loadThread(selectedConversation.id); void loadConversations(); toast.success('Price offer sent.'); }
  };

  const acceptPrice = async () => {
    if (!selectedConversation) return;
    const { error } = await supabase.rpc('accept_marketplace_price',{p_conversation_id:selectedConversation.id});
    if (error) toast.error(error.message || 'Could not accept the price.');
    else { await loadThread(selectedConversation.id); void loadConversations(); toast.success('Price agreement confirmed by both parties.'); }
  };

  const setLocation = async (method:'manual'|'whatsapp', details:string) => {
    if (!selectedConversation) return;
    const { error } = await supabase.rpc('set_marketplace_handover_location',{p_conversation_id:selectedConversation.id,p_method:method,p_details:details});
    if (error) toast.error(error.message || 'Could not save the handover location.');
    else { setManualLocation(''); setEditingLocation(false); await loadThread(selectedConversation.id); void loadConversations(); toast.success('Location details saved. Both participants must confirm the updated plan.'); }
  };

  const confirmLocation = async () => {
    if (!selectedConversation) return;
    const { error } = await supabase.rpc('confirm_marketplace_handover_location',{p_conversation_id:selectedConversation.id});
    if (error) toast.error(error.message || 'Could not confirm the location.');
    else { await loadThread(selectedConversation.id); void loadConversations(); }
  };

  const buyAgreedDeal = async () => {
    if (!selectedConversation || !deal?.agreed_price || !userId) return;
    if (!checkoutEnabled) { toast.error('Card checkout is not enabled. Contact Stakey’s Cycles to arrange payment before completing the private sale.'); return; }
    setBuyingId(selectedConversation.listing_id);
    try {
      const { data, error } = await supabase.functions.invoke('marketplace-payments', { body:{action:'create',conversation_id:selectedConversation.id} });
      if (error) throw error;
      if (!data?.checkout_url) throw new Error(data?.error || 'SumUp could not start checkout.');
      window.location.assign(data.checkout_url);
    } catch (error:any) { toast.error(error?.message || 'Could not start checkout.'); setBuyingId(null); }
  };

  useEffect(() => {
    const txId = new URLSearchParams(window.location.search).get('marketplace_tx');
    if (!txId || staff || verifying || !userId) return;
    setVerifying(true);
    void supabase.functions.invoke('marketplace-payments', { body: { action:'confirm', transaction_id:txId } }).then(({data,error}) => {
      if (error) throw error;
      if (data?.status === 'completed') toast.success('Payment confirmed. The seller payout has been queued for the shop.');
      else if (data?.status === 'cancelled') toast.error('That checkout was cancelled or expired.');
      else toast('Payment is still processing. Use refresh in a moment to check again.');
      const url = new URL(window.location.href); url.searchParams.delete('marketplace_tx'); window.history.replaceState(null,'',url.toString());
    }).catch((error:any) => toast.error(error?.message || 'Could not verify the payment yet. Refresh to try again.')).finally(() => setVerifying(false));
  }, [staff]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) { setAppNotice(true); return; }
    const isNonVehicle = form.category==='parts' || form.category==='accessories';
    if (existingImagePaths.length + files.length < 1) { toast.error('Add at least one clear listing photo.'); return; }
    if (existingImagePaths.length + files.length > 5) { toast.error('Choose up to 5 photos in total.'); return; }
    if (files.some(f => !['image/jpeg','image/png','image/webp'].includes(f.type) || f.size > 8*1024*1024)) { toast.error('Use JPG, PNG or WebP photos under 8 MB each.'); return; }
    const price = Number(form.asking_price);
    if (!Number.isFinite(price) || price <= 0) { toast.error('Enter a valid asking price.'); return; }
    if(!isNonVehicle){
      if(!aiInspection){toast.error('Run the AI bike identifier and use its photo assessment before submitting a vehicle listing.');return;}
      const normalizedSerial=frameSerial.trim().replace(/[^A-Za-z0-9]/g,'');
      if(normalizedSerial.length<4||normalizedSerial.length>40){toast.error('Enter the frame serial exactly as stamped (4–40 letters or numbers).');return;}
      if(!serialPhoto&&!existingSerialPath){toast.error('Add a clear photo of the stamped frame serial number.');return;}
      if(serialPhoto&&(!['image/jpeg','image/png','image/webp'].includes(serialPhoto.type)||serialPhoto.size>8*1024*1024)){toast.error('Use a JPG, PNG or WebP serial photo under 8 MB.');return;}
    }
    setBusy(true);
    const uploadedPaths:string[]=[];
    try {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user || auth.user.id !== userId || !auth.user.email_confirmed_at) throw new Error('Verify your email and sign in again before listing.');
      const id = editingListing?.id || crypto.randomUUID();
      const imageUrls: string[] = [...existingImagePaths];
      for (const file of files) {
        const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
        const path = `${userId}/${id}/photo-${crypto.randomUUID()}.${ext}`;
        const { error } = await supabase.storage.from('marketplace-images').upload(path,file,{contentType:file.type,upsert:false});
        if (error) throw error;
        uploadedPaths.push(path);
        imageUrls.push(path);
      }
      let serialPath=isNonVehicle?'':existingSerialPath;
      if(!isNonVehicle&&serialPhoto){
        const serialExt=serialPhoto.type==='image/png'?'png':serialPhoto.type==='image/webp'?'webp':'jpg';
        serialPath=`${userId}/${id}/serial-number.${crypto.randomUUID()}.${serialExt}`;
        const serialUpload=await supabase.storage.from('marketplace-images').upload(serialPath,serialPhoto,{contentType:serialPhoto.type,upsert:false});
        if(serialUpload.error)throw serialUpload.error;
        uploadedPaths.push(serialPath);
      }
      const { data, error } = await supabase.functions.invoke('marketplace-listings',{body:{action:editingListing?'update':'create',listing:{id,seller_id:userId,title:form.title.trim(),category:form.category,subcategory:form.category==='bicycle'?form.subcategory:null,make_model:form.make_model.trim(),condition:form.condition,description:form.description.trim(),asking_price:Math.round(price*100)/100,images:imageUrls,ai_inspection:isNonVehicle?null:aiInspection},frame_serial_number:isNonVehicle?'':frameSerial.trim(),serial_number_photo_path:serialPath,auction:saleMode==='auction'?{enabled:true,duration_hours:auctionDuration}:undefined}});
      if (error) {
        let message=error.message;
        try { const body=await (error as any).context?.json(); message=body?.message||body?.error||message; } catch { /* use the SDK message */ }
        throw new Error(message||'Could not submit the listing.');
      }
      if(data?.status==='rejected_stolen')throw new Error(data.message||'This serial number matches a bike reported as stolen. This listing cannot be published.');
      if(isNonVehicle)toast.success(`${form.category==='parts'?'Parts':'Accessories'} listing ${editingListing?'updated':'submitted'} for staff review.`);
      else if(data?.status==='review_required')toast('A close stolen-record match needs a staff check. Your listing is held privately for review.');
      else toast.success(saleMode==='auction'?'Auction submitted. The countdown begins after staff approval.':`Serial number check passed. Your listing is ${editingListing?'back':'with the'} team for approval.`);
      announceMilestone({ id: `marketplace-submitted:${id}`, scope: userId, kind: 'listing', title: editingListing?'Listing sent for review':'Listing submitted', detail: 'The team will review it before it goes live.' });
      setForm({title:'',category:'bicycle',subcategory:'commuter',make_model:'',condition:'good',description:'',asking_price:''}); setSaleMode('fixed');setAuctionDuration(72);setFiles([]); setExistingImagePaths([]); setSerialPhoto(null);setExistingSerialPath('');setFrameSerial('');setAiInspection(null);setEditingListing(null);setShowForm(false); await load();
    } catch (err:any) { if(uploadedPaths.length&&userId)void supabase.storage.from('marketplace-images').remove(uploadedPaths); toast.error(err?.message || 'Could not submit the listing.'); }
    finally { setBusy(false); }
  };

  const editListing = (item:Listing) => {
    if(auctions[item.id]) { toast('Contact the workshop if this auction needs to be changed or cancelled.'); return; }
    setEditingListing(item);
    setExistingImagePaths(item.image_paths || []);
    setExistingSerialPath(item.serialCheck?.serial_path || '');
    setFrameSerial(item.serialCheck?.frame_serial_number || '');
    setSerialPhoto(null);
    setFiles([]);
    setAiInspection(item.ai_inspection || null);
    setForm({title:item.title,category:item.category,subcategory:item.subcategory || 'other',make_model:item.make_model,condition:item.condition,description:item.description,asking_price:String(item.asking_price)});
    setShowAiInspector(false);
    setShowForm(true);
    window.scrollTo({top:0,behavior:'smooth'});
  };

  const moderate = async (item: Listing, status: 'active'|'rejected'|'sold'|'cancelled'|'pending_approval') => {
    const { error } = await supabase.from('marketplace_listings').update({ status }).eq('id',item.id);
    if (error) toast.error(`Could not update listing: ${error.message}`); else { toast.success(`Listing ${STATUS[status].toLowerCase()}.`); if (userId && (status === 'active' || status === 'sold')) announceMilestone({ id: `marketplace-${status}:${item.id}`, scope: userId, kind: status === 'sold' ? 'sale' : 'listing', title: status === 'sold' ? 'Sale recorded' : 'Listing approved', detail: status === 'sold' ? 'The listing has been marked as sold.' : 'This ride is now visible in the marketplace.' }); await load(); }
  };

  const placeBid = async (item:Listing, amount:number) => {
    const auction=auctions[item.id];
    if (!userId) { setAppNotice(true); return false; }
    if (!auction || !Number.isFinite(amount) || amount<minimumAuctionBid(auction) || amount>50000) {
      toast.error('Enter at least the current minimum bid.'); return false;
    }
    setAuctionBusy(item.id);
    try {
      const { error } = await supabase.functions.invoke('marketplace-auctions', {
        body:{ action:'bid',listing_id:item.id,amount },
      });
      if(error) {
        let message=error.message;
        try { const body=await (error as any).context?.json(); message=body?.error||message; } catch { /* SDK fallback */ }
        throw new Error(message);
      }
      toast.success('Bid placed. The current price has been updated.');
      await load();
      return true;
    } catch(error:any) { toast.error(error?.message||'Bid could not be placed. Refresh and try again.'); await load(); return false; }
    finally { setAuctionBusy(null); }
  };

  const archiveOpenListings = async () => {
    if (!staff || resettingListings) return;
    const openCount = listings.filter(item => item.status === 'pending_approval' || item.status === 'pending_review' || item.status === 'active').length;
    if (!openCount) { toast('There are no open marketplace listings to archive.'); return; }
    const confirmed = window.confirm(`Archive ${openCount} open marketplace listing${openCount === 1 ? '' : 's'}? They will be hidden from customers and marked cancelled. Sold listings and payment/payout history will stay untouched.`);
    if (!confirmed) return;
    setResettingListings(true);
    try {
      const { data, error } = await supabase.from('marketplace_listings').update({ status: 'cancelled' })
        .in('status', ['pending_approval', 'pending_review', 'active']).select('id');
      if (error) throw error;
      const count = Array.isArray(data) ? data.length : 0;
      toast.success(`Archived ${count} open marketplace listing${count === 1 ? '' : 's'}.`);
      await load();
    } catch (error: any) {
      toast.error(error?.message || 'Could not archive the marketplace listings.');
    } finally { setResettingListings(false); }
  };

  const markPayoutPaid = async (tx: LedgerRow) => {
    const reference = (payoutRefs[tx.id] || '').trim();
    if (!reference) { toast.error('Enter the bank or payout reference first.'); return; }
    const { error } = await supabase.from('marketplace_transactions').update({ payout_status:'paid', payout_reference:reference, payout_paid_at:new Date().toISOString(), payout_paid_by:userId }).eq('id',tx.id);
    if (error) toast.error(`Payout update failed: ${error.message}`);
    else { toast.success('Payout recorded.'); await load(); }
  };

  const closeStolenFlag = async (flag:StolenFlag) => {
    if(currentUser?.role!=='admin')return;
    const {error}=await supabase.from('marketplace_stolen_listing_flags').update({status:'reviewed',reviewed_at:new Date().toISOString(),reviewed_by:userId}).eq('id',flag.id);
    if(error)toast.error('Could not update the security review flag.');else{toast.success('Account flag marked reviewed.');await load();}
  };

  const categoryOptions: Array<{ id: typeof categoryFilter; label: string; hint: string }> = [
    { id: 'all', label: 'All listings', hint: 'Every local listing' },
    { id: 'commuter', label: 'Commuter', hint: 'City and hybrid bikes' },
    { id: 'hardtail_mtb', label: 'Hardtail MTB', hint: 'Trail-ready bikes' },
    { id: 'road', label: 'Road bikes', hint: 'Road and gravel' },
    { id: 'ebike', label: 'E-bikes', hint: 'Electric bicycles' },
    { id: 'escooter', label: 'E-scooters', hint: 'Electric scooters' },
    { id: 'parts', label: 'Parts', hint: 'Components and spares' },
    { id: 'accessories', label: 'Accessories', hint: 'Helmets, locks and kit' },
    { id: 'other', label: 'Other bikes', hint: 'Other bicycle types' },
  ];
  const matchesFilter = (item:Listing, filter:typeof categoryFilter) => filter==='all'||(filter==='ebike'&&item.category==='ebike')||(filter==='escooter'&&item.category==='escooter')||(filter==='parts'&&item.category==='parts')||(filter==='accessories'&&item.category==='accessories')||(item.category==='bicycle'&&(item.subcategory===filter||(filter==='other'&&!item.subcategory)));
  const workspaceListings = staff ? listings : view==='selling' ? listings.filter(item=>Boolean(userId)&&item.seller_id===userId) : listings.filter(item=>item.status==='active'&&(view!=='auctions'||Boolean(auctions[item.id])));
  const categoryCounts = categoryOptions.reduce<Record<string, number>>((counts, option) => {
    counts[option.id] = option.id==='all' ? workspaceListings.length : workspaceListings.filter(item=>matchesFilter(item,option.id)).length;
    return counts;
  }, {});

  const visibleListings = workspaceListings.filter(item=>matchesFilter(item,categoryFilter)&&(!searchText.trim()||`${item.title} ${item.make_model} ${item.description} ${listingCategoryLabel(item)}`.toLowerCase().includes(searchText.trim().toLowerCase())));
  const priceAgreed = deal?.agreed_price !== null && deal?.agreed_price !== undefined;
  const locationChosen = Boolean(deal?.location_method);
  const meetupConfirmed = Boolean(deal?.buyer_location_confirmed_at && deal?.seller_location_confirmed_at);
  const awaitingPriceAction = Boolean(deal && !priceAgreed && deal.proposed_by !== userId);
  const selectedAuction = selectedConversation ? auctions[selectedConversation.listing_id] : undefined;
  const currentUserConfirmedLocation = selectedConversation?.buyer_id===userId?Boolean(deal?.buyer_location_confirmed_at):Boolean(deal?.seller_location_confirmed_at);
  const awaitingLocationAction = Boolean(locationChosen && !meetupConfirmed && !currentUserConfirmedLocation);
  const advanceDetailPhoto = (direction: number) => {
    if (!detailListing?.images.length) return;
    setDetailPhotoIndex(index => (index + direction + detailListing.images.length) % detailListing.images.length);
  };

  const auctionWidget = (item:Listing, compact=false) => {
    const auction=auctions[item.id];
    if(!auction)return null;
    const own=myBids.filter(bid=>bid.listing_id===item.id);
    return <MarketplaceAuction key={`${item.id}-${compact?'card':'detail'}`} auction={auction} compact={compact} now={now}
      isSeller={Boolean(userId&&item.seller_id===userId)} isStaff={staff}
      canBid={Boolean(userId)} hasBid={own.length>0}
      isLeading={own.some(bid=>Number(bid.amount)===Number(auction.highest_bid))}
      isWinner={own.some(bid=>bid.id===auction.winning_bid_id)}
      busy={auctionBusy===item.id} onBid={amount=>placeBid(item,amount)}
      onOpen={()=>{setDetailListing(item);setDetailPhotoIndex(0);}}
      onOpenDeal={()=>{setDetailListing(null);void startConversation(item);}}
      onUseApp={()=>setAppNotice(true)}/>;
  };

  return <section className="mx-auto w-full max-w-6xl space-y-6" data-testid={staff?'staff-marketplace':'marketplace'}>
    <header className="rounded-3xl border border-[#39FF14]/20 bg-[#121212] p-6 shadow-[0_20px_60px_-40px_rgba(57,255,20,.45)] sm:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div><div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[.18em] text-[#39FF14]"><Store className="h-4 w-4"/> Local, moderated marketplace</div>
          <h1 className="mt-3 text-3xl font-bold text-white sm:text-4xl">Bikes, e-bikes, scooters &amp; parts</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-300">Browse rides listed by local owners. Every listing is reviewed by Stakey’s Cycles before it goes live.</p>
        </div>
        {!staff && <button type="button" onClick={()=>{if(!userId){setAppNotice(true);return;}if(showForm){setShowForm(false);setEditingListing(null);return;}setEditingListing(null);setSaleMode('fixed');setAuctionDuration(72);setExistingImagePaths([]);setExistingSerialPath('');setFiles([]);setSerialPhoto(null);setFrameSerial('');setAiInspection(null);setForm({title:'',category:'bicycle',subcategory:'commuter',make_model:'',condition:'good',description:'',asking_price:''});setShowForm(true);setView('selling');}} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#39FF14] px-4 py-2.5 text-sm font-bold text-neutral-950 hover:bg-[#72ff55]">{showForm?<X className="h-4 w-4"/>:<ImagePlus className="h-4 w-4"/>}{showForm?'Close':'List your ride'}</button>}
      </div>
      {!staff && <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-xs text-neutral-400"><span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-4 w-4 text-emerald-400"/>Email-verified accounts</span><span className="inline-flex items-center gap-1.5"><MapPin className="h-4 w-4 text-emerald-400"/>Inspection and handover arranged locally</span></div>}
    </header>

    {staff&&<section className="rounded-2xl border border-amber-400/20 bg-amber-950/10 p-4 sm:p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-bold text-white">Reset marketplace listings</h2><p className="mt-1 text-xs text-neutral-400">Archive all open listings at once. Sold listings and payment history are kept.</p></div><button type="button" disabled={resettingListings || listings.every(item => !['pending_approval','pending_review','active'].includes(item.status))} onClick={() => void archiveOpenListings()} className="min-h-10 rounded-lg border border-amber-400/40 px-3 text-xs font-bold text-amber-200 disabled:cursor-not-allowed disabled:opacity-40">{resettingListings ? 'Archiving…' : `Archive open listings (${listings.filter(item => ['pending_approval','pending_review','active'].includes(item.status)).length})`}</button></div>{listings.some(item => item.status === 'cancelled')&&<div className="mt-4 border-t border-white/10 pt-3"><p className="mb-2 text-xs font-semibold text-neutral-300">Archived listings</p><div className="space-y-2">{listings.filter(item => item.status === 'cancelled').map(item=><div key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-neutral-950/60 p-3 text-xs"><span className="text-neutral-300">{item.title} · {item.make_model}</span><button type="button" onClick={() => void moderate(item, 'pending_approval')} className="min-h-9 rounded-lg border border-emerald-400/30 px-3 font-semibold text-emerald-200">Restore for review</button></div>)}</div></div>}</section>}
    {staff&&stolenFlags.length>0&&<section className="space-y-3 rounded-2xl border border-rose-400/30 bg-rose-950/20 p-4 sm:p-5" data-testid="marketplace-stolen-review"><div><h2 className="font-bold text-rose-100">Blocked serial attempts · account review</h2><p className="mt-1 text-xs leading-5 text-rose-100/70">An exact Bike Index stolen-record serial match was blocked before a listing was saved. These records contain hashes, not the frame serial itself. Verify information through the appropriate registry or police process.</p></div>{stolenFlags.map(flag=><div key={flag.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-400/20 bg-neutral-950/60 p-3 text-xs"><div><b className="text-white">{flag.listing_title} · {flag.make_model}</b><p className="mt-1 text-neutral-400">Account {flag.user_id} · {flag.matching_stolen_records} exact stolen match(es) · {new Date(flag.created_at).toLocaleString()}</p><p className="mt-1 break-all font-mono text-[10px] text-neutral-500">Serial hash {flag.serial_sha256} · response {flag.bike_index_response_sha256}</p></div>{currentUser?.role==='admin'&&<button type="button" onClick={()=>void closeStolenFlag(flag)} className="min-h-9 rounded-lg border border-rose-300/30 px-3 font-semibold text-rose-100">Mark reviewed</button>}</div>)}</section>}
    {staff&&<section className="space-y-3 rounded-2xl border border-white/10 bg-neutral-900/70 p-4 sm:p-5"><div><h2 className="font-bold text-white">Marketplace sales &amp; payout ledger</h2><p className="mt-1 text-xs text-neutral-400">SumUp charges the buyer’s full amount to the shop account. Seller balances are due for separate manual payout; this app does not send the payout. Admins can record completed payouts with a reference.</p></div>{ledger.length===0?<p className="rounded-xl border border-dashed border-white/10 p-5 text-center text-sm text-neutral-500">No marketplace payments yet.</p>:<div className="space-y-2">{ledger.map(tx=><div key={tx.id} className="grid gap-3 rounded-xl border border-white/5 bg-neutral-950/70 p-3 text-xs sm:grid-cols-[1fr_auto_auto_auto]"><div className="min-w-0"><div className="truncate font-semibold text-white">{tx.listing?.[0]?.title||'Marketplace item'} · {tx.listing?.[0]?.make_model||''}</div><div className="truncate font-mono text-neutral-500">Sale {tx.id} · seller {tx.seller_id}</div><div className="mt-1 text-neutral-500">{new Date(tx.created_at).toLocaleString()} · payment {tx.payment_status} · payout {tx.payout_status}{tx.payout_reference?` · ref ${tx.payout_reference}`:''}</div></div><div className="text-neutral-300">Gross <b className="text-white">{money(Number(tx.gross_amount))}</b></div><div className="text-neutral-300">Fee <b className="text-emerald-300">{money(Number(tx.commission_amount))}</b></div><div className="text-neutral-300">Seller due <b className="text-amber-200">{money(Number(tx.seller_payable))}</b></div>{currentUser?.role==='admin'&&tx.payment_status==='completed'&&tx.payout_status!=='paid'&&<div className="flex gap-2 sm:col-span-4"><input aria-label="Payout reference" value={payoutRefs[tx.id]??''} onChange={e=>setPayoutRefs({...payoutRefs,[tx.id]:e.target.value})} placeholder="Bank transfer / payout reference" className="min-h-10 min-w-0 flex-1 rounded-lg border border-white/10 bg-neutral-900 px-3 text-xs text-white"/><button onClick={()=>void markPayoutPaid(tx)} className="min-h-10 rounded-lg bg-emerald-400 px-3 font-bold text-neutral-950">Record payout</button></div>}</div>)}</div>}</section>}

    {staff && <MarketplaceRecords key={recordsVersion}/>}
    {staff && manualSaleListing && <MarketplaceManualSale listing={manualSaleListing} onClose={() => setManualSaleListing(null)} onRecorded={async () => { if (userId) announceMilestone({ id:`marketplace-sold:${manualSaleListing.id}`, scope:userId, kind:'sale', title:'Sale recorded', detail:'The buyer and offline sale are in the marketplace record.' }); await load(); setRecordsVersion(version => version + 1); }}/>}
    {!staff && <>
      <nav aria-label="Marketplace workspace" className="grid grid-cols-2 gap-2 sm:grid-cols-5">{([['browse','Browse all'],['auctions','Auctions'],['selling','My listings'],['messages','Messages'],['guide','How it works']] as const).map(([id,label]) => <button type="button" key={id} aria-current={view===id?'page':undefined} onClick={()=>setView(id)} className={`min-h-12 rounded-xl border px-3 text-sm font-bold ${view===id?'border-emerald-400/50 bg-emerald-400/15 text-emerald-200':'border-white/10 bg-neutral-950/80 text-neutral-300'}`}>{label}</button>)}</nav>
      {(view==='browse'||view==='guide') && <MarketplaceGuide onSelect={setView}/>}
      {!userId && (view==='selling'||view==='messages') && <section className="grid gap-5 rounded-2xl border border-emerald-400/20 bg-neutral-950/90 p-6 md:grid-cols-2" aria-label="Marketplace member area">
        <div><MessageCircle className="h-7 w-7 text-emerald-400"/><h2 className="mt-4 text-xl font-bold text-white">{view==='messages'?'Your private negotiation space':'Your selling dashboard'}</h2><p className="mt-3 text-sm leading-6 text-neutral-400">{view==='messages'?'Your conversations stay linked to each listing. Ask questions, propose a price, respond with a counter-offer and agree a handover together.':'Track listings awaiting review, live adverts, auctions and completed sales. Your own items appear here when you start selling.'}</p><button type="button" onClick={()=>setAppNotice(true)} className="mt-5 min-h-11 rounded-xl bg-emerald-400 px-5 font-bold text-neutral-950">Sign in or create an account</button></div>
        <div className="space-y-3 rounded-xl border border-dashed border-white/15 p-5 text-sm text-neutral-400"><p className="font-bold text-white">{view==='messages'?'No conversation selected':'No listings yet'}</p><p>{view==='messages'?'Listing → private chat → price agreement → handover plan':'Guided photos → staff review → live listing → sale'}</p><p>Browse freely. Sign in when you are ready to take part.</p></div>
      </section>}
      {view==='auctions' && <div className="rounded-2xl border border-emerald-400/20 bg-neutral-950/90 p-5"><h2 className="text-lg font-bold text-white">Local auctions</h2><p className="mt-2 text-sm text-neutral-400">See each starting price, bid count and closing time. Sign in to bid. The winning bidder and seller confirm the handover after the auction ends.</p></div>}
    </>}
    {appNotice && !userId && <div className="fixed inset-0 z-[100] overflow-y-auto bg-black/85 p-3 sm:p-8" role="dialog" aria-modal="true" aria-label="Marketplace member sign in" id="marketplace-member-dialog"><div className="relative mx-auto max-w-5xl rounded-2xl border border-emerald-400/20 bg-neutral-950"><button id="marketplace-member-close" type="button" onClick={()=>setAppNotice(false)} className="relative z-10 m-3 min-h-11 rounded-xl border border-white/20 px-4 text-white">Close sign in</button><Suspense fallback={<p className="p-8 text-white">Loading member sign in…</p>}><MemberLogin audience="customer"/></Suspense></div></div>}
    {!staff && userId && view==='messages' && <section className="rounded-2xl border border-emerald-400/20 bg-neutral-950/80 p-4 sm:p-5" data-testid="marketplace-messages">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="flex items-center gap-2 font-bold text-white"><MessageCircle className="h-5 w-5 text-emerald-300"/>Messages and sale agreements</h2><p className="mt-1 text-xs leading-5 text-neutral-400">Chat privately, agree the price, then arrange a safe handover. Only the buyer and seller can see these messages.</p></div><button type="button" onClick={()=>void loadConversations()} className="min-h-10 rounded-lg border border-white/10 px-3 text-xs text-neutral-300">Refresh chats</button></div>
      {chatError && <p role="alert" className="mt-3 text-sm text-amber-200">{chatError}</p>}
      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(180px,.7fr)_minmax(0,1.3fr)]">
        <div className="space-y-2">{conversations.length===0&&<p className="rounded-xl border border-dashed border-white/10 p-4 text-sm text-neutral-500">Your marketplace conversations will appear here.</p>}{conversations.filter(chat=>chat.buyer_id===userId||chat.seller_id===userId).map(chat=><button key={chat.id} type="button" onClick={()=>setSelectedConversation(chat)} className={`w-full rounded-xl border p-3 text-left ${selectedConversation?.id===chat.id?'border-emerald-400/50 bg-emerald-950/30':'border-white/10 bg-neutral-900/70'}`}><span className="block truncate text-sm font-semibold text-white">{chat.listing?.title||'Marketplace listing'}</span><span className="mt-1 block truncate text-xs text-neutral-400">{chat.listing?.make_model||''} · {chat.buyer_id===userId?'You are buying':'You are selling'}</span></button>)}</div>
        {!selectedConversation&&<MarketplaceInboxEmpty/>}
        {selectedConversation && <div className="min-w-0 space-y-4 rounded-xl border border-white/10 bg-neutral-900/60 p-3 sm:p-4">
          <div className="flex items-center justify-between gap-2"><h3 className="truncate font-semibold text-white">{selectedConversation.listing?.title||'Sale chat'}</h3><button type="button" aria-label="Close conversation" onClick={()=>setSelectedConversation(null)} className="rounded-lg p-2 text-neutral-400 hover:text-white"><X className="h-4 w-4"/></button></div>
          <ol aria-label={`Sale progress: price ${priceAgreed?'agreed':'pending'}, location ${locationChosen?'chosen':'pending'}, handover plan ${meetupConfirmed?'confirmed':'pending'}`} className="grid grid-cols-3 gap-2 rounded-xl border border-[#39FF14]/15 bg-neutral-950/70 p-3">{[{label:'Price',done:priceAgreed},{label:'Location',done:locationChosen},{label:'Handover plan',done:meetupConfirmed}].map((step,index)=><li key={step.label} className="relative flex flex-col items-center gap-1.5 text-center">{index>0&&<span aria-hidden="true" className={`absolute right-1/2 top-3 h-px w-full ${step.done?'bg-[#39FF14]':'bg-white/15'}`}/>}<span className={`relative z-10 grid h-6 w-6 place-items-center rounded-full border text-[10px] font-bold ${step.done?'border-[#39FF14] bg-[#39FF14] text-neutral-950':'border-white/20 bg-neutral-900 text-neutral-500'}`}>{step.done?'✓':index+1}</span><span className={`text-[10px] font-bold uppercase tracking-wide ${step.done?'text-[#39FF14]':'text-neutral-400'}`}>{step.label}</span></li>)}</ol>
          <div className="max-h-72 space-y-2 overflow-y-auto rounded-lg bg-neutral-950/80 p-3" aria-live="polite">{chatMessages.length===0?<p className="text-sm text-neutral-500">Start the conversation. Keep payment links and one-time codes out of chat.</p>:chatMessages.filter(msg=>msg.conversation_id===selectedConversation.id).map(msg=><div key={msg.id} className={`max-w-[88%] rounded-xl px-3 py-2 text-sm ${msg.sender_id===userId?'ml-auto bg-emerald-400/15 text-emerald-50':'bg-white/10 text-neutral-200'}`}><p className="whitespace-pre-wrap break-words">{msg.body}</p><time className="mt-1 block text-[10px] opacity-60">{new Date(msg.created_at).toLocaleString()}</time></div>)}</div>
          <form onSubmit={sendMessage} className="flex gap-2"><input aria-label="Private message" disabled={chatBusy} value={messageDraft} onChange={e=>setMessageDraft(e.target.value)} maxLength={2000} placeholder="Write a private message" className="min-h-11 min-w-0 flex-1 rounded-lg border border-white/10 bg-neutral-950 px-3 text-sm text-white disabled:cursor-not-allowed disabled:opacity-50"/><button disabled={chatBusy||!messageDraft.trim()} aria-label="Send message" className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-[#39FF14] px-3 font-bold text-neutral-950 disabled:cursor-not-allowed disabled:opacity-40"><Send className="h-4 w-4"/><span className="hidden sm:inline">Send</span></button></form>{awaitingPriceAction&&<p className="-mt-3 text-[11px] text-amber-200">A price offer needs your response. Accept it or send a counter-offer below. You can keep chatting while you decide.</p>}{awaitingLocationAction&&<p className="-mt-3 text-[11px] text-amber-200">Review the proposed meeting point below, or discuss a different plan in chat.</p>}
          {selectedAuction ? <p className="rounded-xl border border-emerald-400/20 bg-emerald-950/20 p-3 text-xs text-emerald-100">The winning auction bid sets the sale price. Arrange and confirm the handover below.</p> : <form onSubmit={proposePrice} className="flex flex-wrap items-end gap-2 rounded-xl border border-white/10 bg-neutral-950/70 p-3"><label className="min-w-40 flex-1 text-xs font-semibold text-neutral-300">Propose or update sale price (£)<input value={offerDraft} onChange={e=>setOfferDraft(e.target.value)} type="number" min="1" max="50000" step="0.01" inputMode="decimal" placeholder={deal?Number(deal.proposed_price).toFixed(2):'0.00'} className="mt-1.5 min-h-10 w-full rounded-lg border border-white/10 bg-neutral-900 px-3 text-sm text-white"/></label><button disabled={chatBusy||!offerDraft} className="min-h-10 rounded-lg border border-emerald-400/30 px-3 text-xs font-bold text-emerald-200 disabled:opacity-50">Send price offer</button></form>}
          {deal && <div className="space-y-3 rounded-xl border border-emerald-400/20 bg-emerald-950/20 p-3 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2"><div><p className="font-semibold text-white">{deal.agreed_price!==null?`Both parties agreed ${money(Number(deal.agreed_price))}`:`Price proposed: ${money(Number(deal.proposed_price))}`}</p><p className="mt-1 text-xs text-neutral-300">{deal.agreed_price!==null?`No platform commission · seller proceeds: ${money(Number(deal.agreed_price))}.`:`Waiting for ${deal.proposed_by===userId?'the other party':'you'} to accept or make a counter-offer.`}</p></div>{deal.agreed_price===null&&deal.proposed_by!==userId&&<button type="button" onClick={()=>void acceptPrice()} className="min-h-10 rounded-lg bg-emerald-400 px-3 text-xs font-bold text-neutral-950">Accept price</button>}</div>
            {deal.agreed_price!==null && <div className="space-y-3 border-t border-white/10 pt-3"><p className="text-xs leading-5 text-neutral-300">Price agreement confirmed. You can now arrange a handover point. Do not use a home address; choose a public, busy place in daylight.</p>
              {deal.location_method && !editingLocation ? <div className="rounded-lg border border-white/10 bg-neutral-950/60 p-3"><p className="font-semibold text-white">{deal.location_method==='manual'?'Proposed meeting place':'WhatsApp handover planning'}</p><p className="mt-1 break-words text-sm text-neutral-300">{deal.location_details}</p><p className="mt-2 text-xs text-neutral-400">{deal.buyer_location_confirmed_at&&deal.seller_location_confirmed_at?'Both parties confirmed this handover plan.':`Location confirmed by ${deal.location_set_by===userId?'you':'the other party'}; waiting for the other person.`}</p><div className="mt-3 flex flex-wrap gap-2">{!(deal.buyer_location_confirmed_at&&deal.seller_location_confirmed_at)&&<button type="button" onClick={()=>void confirmLocation()} className="min-h-10 rounded-lg border border-emerald-400/40 px-3 text-xs font-bold text-emerald-200">Confirm this location</button>}<button type="button" onClick={()=>setEditingLocation(true)} className="min-h-10 rounded-lg border border-white/15 px-3 text-xs font-semibold text-neutral-200">Suggest a different location</button></div></div> : <div className="space-y-3"><p className="text-xs leading-5 text-neutral-400">Choose a busy, public place in daylight. Suggesting a new location clears the other person’s confirmation so you both review the same plan.</p><div className="grid gap-3 sm:grid-cols-2"><form onSubmit={e=>{e.preventDefault();void setLocation('manual',manualLocation);}} className="space-y-2"><label className="block text-xs font-semibold text-neutral-300">Enter a public meeting place<input value={manualLocation} onChange={e=>setManualLocation(e.target.value)} maxLength={500} placeholder="e.g. named staffed café or public meeting point" className="mt-1.5 min-h-10 w-full rounded-lg border border-white/10 bg-neutral-950 px-3 text-sm text-white"/></label><button disabled={!manualLocation.trim()} className="min-h-10 w-full rounded-lg border border-white/10 px-3 text-xs font-bold text-white disabled:opacity-50">{editingLocation?'Suggest meeting place':'Save meeting place'}</button></form><div className="flex flex-col justify-end gap-2"><a href={`https://wa.me/?text=${encodeURIComponent(`Hi, about ${selectedConversation.listing?.title||'the bike'}: we agreed ${money(Number(deal.agreed_price))}. Let’s choose a busy public meeting place in daylight.`)}`} target="_blank" rel="noreferrer" onClick={()=>void setLocation('whatsapp','Use WhatsApp to agree a public meeting point; confirm the exact location here before travelling.')} className="inline-flex min-h-10 items-center justify-center rounded-lg bg-emerald-400 px-3 text-xs font-bold text-neutral-950">Arrange location in WhatsApp</a><p className="text-[11px] leading-4 text-neutral-500">WhatsApp opens a share picker. Choose the other party yourself; only share location details with them.</p></div></div></div>}
              {deal.buyer_location_confirmed_at&&deal.seller_location_confirmed_at&&<div className="rounded-lg bg-emerald-400/10 p-3 text-xs font-semibold text-emerald-100">Handover plan agreed by both parties. {checkoutEnabled?<button type="button" disabled={buyingId===selectedConversation.listing_id} onClick={()=>void buyAgreedDeal()} className="mt-2 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg bg-emerald-400 px-3 font-bold text-neutral-950">{buyingId===selectedConversation.listing_id&&<LoaderCircle className="h-4 w-4 animate-spin"/>}Pay agreed price with SumUp</button>:<span className="mt-1 block font-normal text-neutral-300">Contact Stakey’s Cycles to arrange payment before completing the private sale.</span>}</div>}
            </div>}
          </div>}
          <aside className="rounded-xl border border-amber-400/20 bg-amber-950/15 p-3 text-xs leading-5 text-amber-100/80"><b className="text-amber-200">Safe handover and payment</b><p className="mt-1">Stakey’s Cycles provides the marketplace and does not take a per-sale commission. The sale, condition, payment and any dispute remain between buyer and seller. Meet in a busy, well-lit public place during daytime, take someone with you, inspect the bike and serial number, confirm payment has cleared before handing it over, and never share verification codes or follow payment links sent by a buyer. Leave if you feel pressured or unsafe. Customer feedback and feature requests are always welcome.</p></aside>
        </div>}
      </div>
    </section>}
    {imageWarning && <p role="status" className="text-sm text-amber-200">Some listing photos could not be loaded. Refresh to try again.</p>}
    {!staff && loadError && <p role="alert" className="rounded-xl border border-amber-400/25 p-4 text-sm text-amber-200">{loadError}</p>}
    {staff && loadError && <p role="alert" className="text-sm text-amber-200">{loadError}</p>}
    {!staff && userId && showForm && <form onSubmit={submit} className="grid gap-4 rounded-2xl border border-white/10 bg-neutral-900/80 p-5 sm:grid-cols-2" data-testid="marketplace-listing-form">
      <div className="sm:col-span-2 flex items-center justify-between gap-3"><h2 className="text-base font-bold text-white">{editingListing ? 'Edit listing' : 'Create a listing'}</h2><button type="button" onClick={()=>{setShowForm(false);setEditingListing(null);setExistingImagePaths([]);setExistingSerialPath('');setFiles([]);setSerialPhoto(null);}} className="min-h-9 rounded-lg border border-white/10 px-3 text-xs text-neutral-300">Close</button></div>
      <label className="text-xs font-semibold text-neutral-300">Listing title<input required maxLength={120} value={form.title} onChange={e=>setForm({...form,title:e.target.value})} placeholder="e.g. Trek hybrid bike, medium" className="mt-1.5 w-full rounded-xl border border-white/10 bg-neutral-950 px-3 py-3 text-sm text-white outline-none focus:border-emerald-400/60"/></label>
      <label className="text-xs font-semibold text-neutral-300">Type<select value={form.category} onChange={e=>{setForm({...form,category:e.target.value as Listing['category']});if(!['bicycle','ebike'].includes(e.target.value))setSaleMode('fixed');setAiInspection(null);setExistingSerialPath(e.target.value==='parts'||e.target.value==='accessories'?'':existingSerialPath);}} className="mt-1.5 w-full rounded-xl border border-white/10 bg-neutral-950 px-3 py-3 text-sm text-white"><option value="bicycle">Bicycle</option><option value="ebike">E-bike</option><option value="escooter">E-scooter</option><option value="parts">Parts</option><option value="accessories">Accessories</option></select></label>
      {!editingListing&&['bicycle','ebike'].includes(form.category)&&<div className="sm:col-span-2 rounded-xl border border-emerald-400/20 bg-emerald-950/10 p-4"><p className="mb-3 flex items-center gap-2 text-sm font-bold text-white"><Gavel className="h-4 w-4 text-emerald-300"/> How would you like to sell?</p><div className="grid grid-cols-2 gap-2">{([['fixed','Set a price'],['auction','Auction · accept bids']] as const).map(([mode,label])=><button key={mode} type="button" aria-pressed={saleMode===mode} onClick={()=>setSaleMode(mode)} className={`min-h-11 rounded-xl border px-3 text-sm font-bold ${saleMode===mode?'border-emerald-400 bg-emerald-400/15 text-emerald-100':'border-white/15 text-neutral-300'}`}>{label}</button>)}</div>{saleMode==='auction'&&<label className="mt-3 block text-xs font-semibold text-neutral-300">Auction length<select value={auctionDuration} onChange={e=>setAuctionDuration(Number(e.target.value))} className="mt-1.5 min-h-11 w-full rounded-xl border border-white/10 bg-neutral-950 px-3 text-sm text-white"><option value={24}>1 day</option><option value={72}>3 days</option><option value={168}>7 days</option></select><span className="mt-2 block font-normal leading-5 text-neutral-400">The countdown begins after staff approval. The highest bid wins. No money is taken when someone bids; the winner and seller confirm a handover before checkout.</span></label>}</div>}
      {!['parts','accessories'].includes(form.category) && <div className="sm:col-span-2 rounded-xl border border-[#39FF14]/20 bg-neutral-950/70 p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="font-semibold text-white">Guided AI bike identification</p><p className="mt-1 text-xs leading-5 text-neutral-400">Run the same 10-photo identifier used for the customer garage. The component assessment is attached for staff review.</p></div><button type="button" onClick={()=>setShowAiInspector(true)} className="min-h-10 rounded-lg bg-[#39FF14] px-3 text-xs font-bold text-neutral-950">{aiInspection?'Re-run AI inspection':'Identify bike with AI'}</button></div>{aiInspection&&<div className="mt-3 rounded-lg border border-emerald-400/20 bg-emerald-950/15 p-3 text-xs"><p className="font-semibold text-emerald-200">AI suggested {aiInspection.make} {aiInspection.model}{aiInspection.year?` · ${aiInspection.year}`:''}</p><p className="mt-1 text-neutral-300">{aiInspection.mainSpecs.length} component records · {aiInspection.coverage}% spec coverage · {Math.round(aiInspection.confidence*100)}% identity confidence</p>{aiInspection.confidence<0.65&&<p className="mt-1 font-semibold text-amber-200">Low confidence: check the photos and correct the make/model below before submitting.</p>}{aiInspection.photoRequests.length>0&&<p className="mt-1 text-amber-200">{aiInspection.photoRequests.length} requested close-up(s) remain unconfirmed for staff review.</p>}{aiInspection.obviousProblems.length>0&&<p className="mt-1 text-amber-200">{aiInspection.obviousProblems.length} visible issue(s) will be included for staff review.</p>}</div>}</div>}
      <label className="text-xs font-semibold text-neutral-300">Make and model<input required maxLength={120} value={form.make_model} onChange={e=>setForm({...form,make_model:e.target.value})} placeholder={aiInspection?'Review or correct AI suggestion':'e.g. Shimano XT rear derailleur'} className="mt-1.5 w-full rounded-xl border border-white/10 bg-neutral-950 px-3 py-3 text-sm text-white outline-none focus:border-emerald-400/60"/><span className="mt-1 block font-normal text-neutral-500">{aiInspection?'This is editable. Your correction is saved alongside the original AI assessment.':'Enter the make and model, or the part/accessory name.'}</span></label>
      {form.category==='bicycle'&&<label className="text-xs font-semibold text-neutral-300">Bicycle category<select value={form.subcategory} onChange={e=>setForm({...form,subcategory:e.target.value as NonNullable<Listing['subcategory']>})} className="mt-1.5 w-full rounded-xl border border-white/10 bg-neutral-950 px-3 py-3 text-sm text-white"><option value="commuter">Commuter / hybrid</option><option value="hardtail_mtb">Hardtail mountain bike</option><option value="road">Road / gravel</option><option value="other">Other bicycle</option></select></label>}
      {!['parts','accessories'].includes(form.category)&&<><label className="text-xs font-semibold text-neutral-300 sm:col-span-2">Frame serial number<input required minLength={4} maxLength={60} value={frameSerial} onChange={e=>setFrameSerial(e.target.value)} placeholder="Enter the number stamped into the frame" autoComplete="off" className="mt-1.5 w-full rounded-xl border border-white/10 bg-neutral-950 px-3 py-3 font-mono text-sm uppercase text-white outline-none focus:border-emerald-400/60"/><span className="mt-1 block font-normal text-neutral-500">Bike Index checks this number; it stays private.</span></label>
      <label className="text-xs font-semibold text-neutral-300 sm:col-span-2">Clear frame-number photo<input required={!existingSerialPath} type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>setSerialPhoto(e.target.files?.[0]||null)} className="mt-1.5 block w-full text-xs text-neutral-400 file:mr-3 file:rounded-lg file:border-0 file:bg-emerald-400/15 file:px-3 file:py-2 file:text-emerald-200"/><span className="mt-1 block font-normal text-neutral-500">{existingSerialPath?'Current stamped-number photo stays attached unless you choose a replacement.':'Show the stamped number clearly. Close matches are held for staff review.'}</span></label></>}
      <label className="text-xs font-semibold text-neutral-300">Condition<select value={form.condition} onChange={e=>setForm({...form,condition:e.target.value})} className="mt-1.5 w-full rounded-xl border border-white/10 bg-neutral-950 px-3 py-3 text-sm text-white"><option value="new">New</option><option value="excellent">Excellent</option><option value="good">Good</option><option value="fair">Fair</option><option value="spares">For spares or repair</option></select></label>
      <label className="text-xs font-semibold text-neutral-300">{saleMode==='auction'?'Opening bid (£)':'Asking price (£)'}<input required type="number" min="1" max="50000" step="0.01" inputMode="decimal" value={form.asking_price} onChange={e=>setForm({...form,asking_price:e.target.value})} placeholder="0.00" className="mt-1.5 w-full rounded-xl border border-white/10 bg-neutral-950 px-3 py-3 text-sm text-white outline-none focus:border-emerald-400/60"/></label>
      {existingImagePaths.length>0&&<div className="sm:col-span-2"><p className="mb-2 text-xs font-semibold text-neutral-300">Current photos · remove any you want to replace</p><div className="flex flex-wrap gap-2">{existingImagePaths.map((path,index)=><div key={path} className="relative h-20 w-24 overflow-hidden rounded-lg border border-white/10">{editingListing?.images[index]&&<img src={editingListing.images[index]} alt={`Current listing photo ${index+1}`} className="h-full w-full object-cover"/>}<button type="button" aria-label={`Remove current photo ${index+1}`} onClick={()=>setExistingImagePaths(current=>current.filter(item=>item!==path))} className="absolute right-1 top-1 rounded bg-black/80 px-2 py-1 text-xs text-white">Remove</button></div>)}</div></div>}
      <label className="text-xs font-semibold text-neutral-300 sm:col-span-2">{existingImagePaths.length?'Add photos (up to 5 total)':'Photos (1–5)'}<input required={existingImagePaths.length===0} type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={e=>setFiles(Array.from(e.target.files||[]).slice(0,5-existingImagePaths.length))} className="mt-1.5 block w-full text-xs text-neutral-400 file:mr-3 file:rounded-lg file:border-0 file:bg-emerald-400/15 file:px-3 file:py-2 file:text-emerald-200"/><span className="mt-1 block font-normal text-neutral-500">JPG, PNG or WebP; each photo under 8 MB.</span></label>
      <label className="text-xs font-semibold text-neutral-300 sm:col-span-2">Description<textarea maxLength={2000} rows={4} value={form.description} onChange={e=>setForm({...form,description:e.target.value})} placeholder={form.category==='parts'?'Part name, compatible bikes, condition and anything included':form.category==='accessories'?'Brand, size, compatibility, condition and anything included':'Size, service history, included accessories and any known faults'} className="mt-1.5 w-full rounded-xl border border-white/10 bg-neutral-950 px-3 py-3 text-sm text-white outline-none focus:border-emerald-400/60"/></label>
      <div className="sm:col-span-2 flex flex-col gap-3 rounded-xl border border-amber-400/20 bg-amber-950/20 p-3 text-xs leading-5 text-amber-100/80"><span className="flex items-start gap-2"><CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-300"/>{['parts','accessories'].includes(form.category)?'Parts and accessories go to staff review before publishing. Include compatibility, condition and known faults.':'Bike Index is an additional check, not proof of ownership or a complete UK stolen-bike search. Exact stolen matches are blocked; close matches are held for staff review.'} Every new or edited listing needs staff approval. Do not include private contact details.</span><button disabled={busy||(!['parts','accessories'].includes(form.category)&&!serialPhoto&&!existingSerialPath)} className="inline-flex min-h-11 items-center justify-center gap-2 self-start rounded-xl bg-[#39FF14] px-5 py-2.5 font-bold text-neutral-950 disabled:opacity-60">{busy&&<LoaderCircle className="h-4 w-4 animate-spin"/>}{editingListing?'Save changes for review':form.category==='parts'?'Submit part for review':form.category==='accessories'?'Submit accessory for review':saleMode==='auction'?'Check serial and submit auction':'Check serial and submit'}</button></div>
    </form>}
    {!staff&&userId&&showAiInspector&&<AiBikeIdentifier user={currentUser} isOpen={showAiInspector} mode="marketplace" onClose={()=>setShowAiInspector(false)} onIdentified={(result:any)=>{const inspection=marketplaceInspectionFromResult(result);const category:Listing['category']=result.type==='electric_scooter'?'escooter':result.type==='ebike'?'ebike':'bicycle';const makeModel=[inspection.make,inspection.model].filter(Boolean).join(' ');setAiInspection(inspection);setForm(current=>({...current,category,subcategory:category==='bicycle'?'other':current.subcategory,make_model:makeModel,title:current.title.trim()||makeModel}));toast.success('AI inspection attached to this listing.');}}/>}

    {(staff || view==='browse' || view==='auctions' || (view==='selling'&&Boolean(userId))) && <>
    <div className="flex items-center justify-between gap-3"><h2 className="text-lg font-bold text-white">{staff?'Listings to review':'Available locally'}</h2><button onClick={()=>void load()} type="button" aria-label="Refresh listings" className="rounded-lg border border-white/10 p-2 text-neutral-400 hover:text-white"><RefreshCw className="h-4 w-4"/></button></div>
    <label className="block text-xs font-semibold text-neutral-300">Search listings<input aria-label="Search marketplace listings" value={searchText} onChange={e=>setSearchText(e.target.value)} placeholder="Search make, model, part or listing title" className="mt-1.5 min-h-11 w-full rounded-xl border border-white/10 bg-[#121212] px-4 text-sm text-white outline-none focus:border-[#39FF14]/50"/></label>
    {!loading && !loadError && <nav aria-label="Filter marketplace by vehicle category" className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-8">{categoryOptions.map(option=>{
      const count = option.id === 'all' ? workspaceListings.length : categoryCounts[option.id] || 0;
      const selected = categoryFilter === option.id;
      return <button key={option.id} type="button" onClick={()=>setCategoryFilter(option.id)} aria-pressed={selected} className={`group min-h-[76px] rounded-2xl border px-3 py-3 text-left transition-colors ${selected?'border-[#39FF14]/60 bg-[#39FF14]/10 shadow-[0_0_24px_-14px_rgba(57,255,20,.8)]':'border-white/10 bg-[#121212] hover:border-[#39FF14]/35 hover:bg-neutral-900'}`}><span className="flex items-center justify-between gap-2"><span className={`text-sm font-bold ${selected?'text-[#39FF14]':'text-white'}`}>{option.label}</span><span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-bold text-neutral-300">{count}</span></span><span className="mt-1 block text-[11px] text-neutral-500">{option.hint}</span></button>;
    })}</nav>}
    {loading ? <div className="flex justify-center py-12 text-[#39FF14]"><LoaderCircle className="h-6 w-6 animate-spin"/></div> : loadError ? null : workspaceListings.length===0 ? <div className="rounded-2xl border border-dashed border-white/10 px-5 py-12 text-center"><Bike className="mx-auto h-8 w-8 text-neutral-600"/><p className="mt-3 font-semibold text-white">{staff?'Nothing waiting for review':view==='auctions'?'No auctions yet':view==='selling'?'You have not listed anything yet':'No approved listings yet'}</p><p className="mt-1 text-sm text-neutral-500">{staff?'New seller listings will appear here.':'Check back soon, or list your ride to get started.'}</p></div> : visibleListings.length===0 ? <div className="rounded-2xl border border-dashed border-white/10 px-5 py-10 text-center"><Bike className="mx-auto h-8 w-8 text-neutral-600"/><p className="mt-3 font-semibold text-white">No {categoryOptions.find(option=>option.id===categoryFilter)?.label.toLowerCase()} to show</p><p className="mt-1 text-sm text-neutral-500">Choose another category to browse the other listings.</p></div> : <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{visibleListings.map(item=><article key={item.id} className="overflow-hidden rounded-2xl border border-white/10 bg-[#121212]">
      <button type="button" onClick={()=>{setDetailListing(item);setDetailPhotoIndex(0);}} aria-label={`View details for ${item.title}`} className="relative block aspect-[4/3] w-full bg-neutral-950 text-left">{item.images?.[0]?<img src={item.images[0]} alt={item.title} loading="lazy" className="h-full w-full object-cover transition-transform duration-300 hover:scale-[1.02]"/>:<div className="flex h-full items-center justify-center"><Bike className="h-12 w-12 text-neutral-700"/></div>}<span className="absolute left-3 top-3 rounded-full border border-white/10 bg-black/70 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-[#39FF14]">{item.status==='active'?'Shop approved':STATUS[item.status]||item.status}</span>{item.status==='active'&&<span className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 rounded-full border border-[#39FF14]/45 bg-black/80 px-2.5 py-1 text-[10px] font-bold text-[#39FF14]"><ShieldCheck className="h-3.5 w-3.5"/>Shop reviewed</span>}</button>
      <div className="space-y-3 p-4"><div className="flex items-start justify-between gap-2"><div><h3 className="font-bold text-white">{item.title}</h3><p className="mt-0.5 text-xs capitalize text-neutral-400">{item.make_model} · {listingCategoryLabel(item)} · {item.condition}</p></div><strong className="shrink-0 font-mono text-lg text-[#39FF14]">{money(Number(auctions[item.id]?.highest_bid || auctions[item.id]?.start_price || item.asking_price))}</strong></div>{item.description&&<p className="line-clamp-3 whitespace-pre-wrap text-sm leading-5 text-neutral-400">{item.description}</p>}
        {auctionWidget(item,true)}
        {staff&&item.serialCheck&&<div className={`space-y-2 rounded-xl border p-3 text-xs ${item.serialCheck.check_status==='review_required'?'border-amber-400/30 bg-amber-950/20':'border-emerald-400/20 bg-emerald-950/10'}`}><p className="font-semibold text-white">{item.serialCheck.check_status==='review_required'?'Possible stolen-record match — inspect before approval':'Bike Index check returned no stolen match'}</p><p className="font-mono text-neutral-300">Frame serial: {item.serialCheck.frame_serial_number}</p><p className="text-neutral-400">Checked {new Date(item.serialCheck.checked_at).toLocaleString()} · {item.serialCheck.matched_stolen_records} stolen result(s) · response SHA-256 {item.serialCheck.response_sha256.slice(0,16)}…</p>{item.serialCheck.serial_number_photo_path&&<a href={item.serialCheck.serial_number_photo_path} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-emerald-200 underline">View stamped serial photo</a>}</div>}
        {staff?<div className="flex flex-wrap gap-2 border-t border-white/5 pt-3">{item.status==='pending_approval'&&<><button onClick={()=>void moderate(item,'active')} className="min-h-10 rounded-lg bg-emerald-400 px-3 text-xs font-bold text-neutral-950">Approve listing</button><button onClick={()=>void moderate(item,'rejected')} className="min-h-10 rounded-lg border border-amber-400/30 px-3 text-xs font-bold text-amber-200">Request changes</button></>}{item.status==='pending_review'&&<><button onClick={()=>void moderate(item,'pending_approval')} className="min-h-10 rounded-lg bg-amber-300 px-3 text-xs font-bold text-neutral-950">Move to standard approval</button><button onClick={()=>void moderate(item,'rejected')} className="min-h-10 rounded-lg border border-rose-400/30 px-3 text-xs font-bold text-rose-200">Reject listing</button></>}{item.status==='active'&&!auctions[item.id]&&<button onClick={()=>setManualSaleListing(item)} className="min-h-10 rounded-lg border border-white/10 px-3 text-xs font-bold text-neutral-200">Mark sold</button>}{item.status==='active'&&auctions[item.id]?.status==='live'&&<button onClick={()=>{if(window.confirm('Cancel this auction and close bidding?'))void moderate(item,'cancelled');}} className="min-h-10 rounded-lg border border-rose-400/30 px-3 text-xs font-bold text-rose-200">Cancel auction</button>}{item.status==='cancelled'&&!auctions[item.id]&&<button onClick={()=>void moderate(item,'pending_approval')} className="min-h-10 rounded-lg border border-emerald-400/30 px-3 text-xs font-bold text-emerald-200">Restore for review</button>}<span className="inline-flex items-center gap-1 text-[11px] text-neutral-500"><Clock3 className="h-3.5 w-3.5"/>{new Date(item.created_at).toLocaleDateString()}</span></div>:Boolean(userId)&&item.seller_id===userId&&['pending_approval','pending_review','active','rejected'].includes(item.status)?<div className="space-y-2 border-t border-white/5 pt-3"><p className="text-xs text-neutral-400">{STATUS[item.status]||item.status} · {auctions[item.id]?'Auction prices are fixed while bidding. Contact the workshop for changes.':item.status==='active'?'Live to buyers. Editing sends it back for staff review.':'The next step is staff review.'}</p>{!auctions[item.id]&&<button type="button" onClick={()=>editListing(item)} aria-label={`Edit listing ${item.title}`} className="min-h-10 w-full rounded-lg border border-emerald-400/30 px-3 text-xs font-bold text-emerald-200">Edit listing</button>}</div>:item.status==='active'&&!auctions[item.id]&&(!userId || item.seller_id!==userId)?<div className="space-y-2 border-t border-white/5 pt-3">{userId ? <button disabled={chatBusy} onClick={()=>void startConversation(item)} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-emerald-400 px-3 text-sm font-bold text-neutral-950 disabled:opacity-60"><MessageCircle className="h-4 w-4"/>Message seller and agree sale</button> : <button onClick={()=>setAppNotice(true)} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-emerald-400 px-3 text-sm font-bold text-neutral-950"><MessageCircle className="h-4 w-4"/>Sign in to message seller</button>}<p className="text-[11px] leading-4 text-neutral-500">Agree a price and safe meeting point with the seller. The agreed price is what the buyer pays; Stakey’s takes no per-sale commission.</p></div>:<div className="border-t border-white/5 pt-3 text-xs leading-5 text-neutral-400"><CheckCircle2 className="mr-1 inline h-4 w-4 text-emerald-400"/>{item.status==='cancelled'?'Archived':item.status==='active'&&auctions[item.id]?'Auction bidding':item.seller_id===userId?'Your listing':'Sale completed'}</div>}
      </div></article>)}</div>}
    </>}
    {detailListing && <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/80 p-0 backdrop-blur-sm sm:items-center sm:p-4" onMouseDown={event=>{if(event.target===event.currentTarget)setDetailListing(null);}}>
      <section role="dialog" aria-modal="true" aria-labelledby="marketplace-detail-title" className="max-h-[94vh] w-full max-w-3xl overflow-y-auto rounded-t-3xl border border-[#39FF14]/20 bg-[#121212] shadow-2xl sm:rounded-3xl">
        <div className="flex items-center justify-between gap-3 border-b border-white/10 px-5 py-4"><div><p className="text-[10px] font-bold uppercase tracking-[.2em] text-[#39FF14]">Listing detail · seller supplied</p><h2 id="marketplace-detail-title" className="mt-1 text-lg font-bold text-white">{detailListing.title}</h2></div><button type="button" onClick={()=>setDetailListing(null)} aria-label="Close listing details" className="rounded-xl border border-white/10 p-2 text-neutral-300 hover:text-white"><X className="h-4 w-4"/></button></div>
        <div className="grid gap-5 p-4 sm:p-6 md:grid-cols-[1.1fr_.9fr]">
          <div className="space-y-2"><div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-neutral-950">{detailListing.images?.[detailPhotoIndex]?<img src={detailListing.images[detailPhotoIndex]} alt={`${detailListing.title}, photo ${detailPhotoIndex+1}`} className="h-full w-full object-cover"/>:<div className="flex h-full items-center justify-center"><Bike className="h-16 w-16 text-neutral-700"/></div>}{detailListing.images.length>1&&<><button type="button" aria-label="Previous photo" onClick={()=>advanceDetailPhoto(-1)} className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full border border-white/20 bg-black/70 px-3 py-2 text-xl text-white">‹</button><button type="button" aria-label="Next photo" onClick={()=>advanceDetailPhoto(1)} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full border border-white/20 bg-black/70 px-3 py-2 text-xl text-white">›</button><span className="absolute bottom-3 right-3 rounded-full bg-black/70 px-2.5 py-1 text-[11px] text-white">{detailPhotoIndex+1} / {detailListing.images.length}</span></>}</div><p className="text-xs text-neutral-500">Seller photos · {detailListing.images.length} uploaded</p></div>
          <div className="space-y-4"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">{auctions[detailListing.id]?'Opening bid':'Asking price'}</p><p className="mt-1 font-mono text-2xl font-bold text-[#39FF14]">{money(Number(detailListing.asking_price))}</p></div><span className={`rounded-full border px-3 py-1.5 text-[11px] font-bold ${detailListing.status==='active'?'border-[#39FF14]/30 bg-[#39FF14]/10 text-[#39FF14]':'border-amber-300/30 bg-amber-300/10 text-amber-200'}`}><ShieldCheck className="mr-1 inline h-3.5 w-3.5"/>{detailListing.status==='active'?'Shop approved':STATUS[detailListing.status]||detailListing.status}</span></div>
            <div className="grid grid-cols-2 gap-2"><div className="rounded-xl border border-white/10 bg-neutral-950/70 p-3"><p className="text-[10px] font-bold uppercase tracking-wide text-neutral-500">Make / model</p><p className="mt-1 text-sm font-semibold text-white">{detailListing.make_model||'Not provided'}</p></div><div className="rounded-xl border border-white/10 bg-neutral-950/70 p-3"><p className="text-[10px] font-bold uppercase tracking-wide text-neutral-500">Category</p><p className="mt-1 text-sm font-semibold text-white">{listingCategoryLabel(detailListing)}</p></div><div className="rounded-xl border border-white/10 bg-neutral-950/70 p-3"><p className="text-[10px] font-bold uppercase tracking-wide text-neutral-500">Seller stated condition</p><p className="mt-1 text-sm font-semibold capitalize text-white">{detailListing.condition}</p></div><div className="rounded-xl border border-white/10 bg-neutral-950/70 p-3"><p className="text-[10px] font-bold uppercase tracking-wide text-neutral-500">Listing status</p><p className="mt-1 text-sm font-semibold text-white">{STATUS[detailListing.status]||detailListing.status}</p></div></div>
            <div className="rounded-xl border border-white/10 bg-neutral-950/70 p-3"><p className="text-[10px] font-bold uppercase tracking-wide text-neutral-500">Seller notes</p><p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-neutral-300">{detailListing.description||'No description supplied.'}</p></div>
            {auctionWidget(detailListing)}
            {detailListing.ai_inspection&&<div className="space-y-3 rounded-xl border border-[#39FF14]/20 bg-emerald-950/10 p-3"><div><p className="text-xs font-bold uppercase tracking-wide text-[#39FF14]">AI photo assessment</p><p className="mt-1 text-[11px] text-neutral-400">{detailListing.ai_inspection.coverage}% spec coverage · {Math.round(detailListing.ai_inspection.confidence*100)}% identity confidence · staff must verify before approval</p>{detailListing.ai_inspection.summary&&<p className="mt-2 text-sm leading-5 text-neutral-300">{detailListing.ai_inspection.summary}</p>}</div>{detailListing.ai_inspection.mainSpecs.length>0&&<div className="grid gap-2 sm:grid-cols-2">{detailListing.ai_inspection.mainSpecs.map((spec:any,index:number)=><div key={`${spec.componentName||'spec'}-${index}`} className="rounded-lg border border-white/10 bg-neutral-950/70 p-2.5"><p className="text-xs font-semibold text-white">{spec.componentName||'Component'}</p><p className="mt-0.5 text-xs text-neutral-300">{spec.currentPart||'Not identified'}</p>{(spec.brand||spec.model||spec.specValue)&&<p className="mt-1 text-[10px] text-emerald-200">{[spec.brand,spec.model,spec.specValue].filter(Boolean).join(' · ')}</p>}{spec.condition&&<p className="mt-1 text-[10px] capitalize text-neutral-400">AI condition: {String(spec.condition).replace('_',' ')}</p>}{spec.stockComparisonNote&&<p className="mt-1 text-[10px] text-amber-200">{spec.stockComparisonNote}</p>}</div>)}</div>}{detailListing.ai_inspection.obviousProblems.length>0&&<div className="rounded-lg border border-amber-400/20 bg-amber-950/15 p-2.5"><p className="text-xs font-semibold text-amber-200">Visible issues noted for review</p><ul className="mt-1 list-disc space-y-1 pl-4 text-xs text-neutral-300">{detailListing.ai_inspection.obviousProblems.map((issue:any,index:number)=><li key={index}>{issue.issue}{issue.severity?` · ${issue.severity}`:''}</li>)}</ul></div>}{detailListing.ai_inspection.photoRequests.length>0&&<p className="text-[11px] text-amber-200">{detailListing.ai_inspection.photoRequests.length} specifications still need close-up confirmation.</p>}</div>}
            <p className="text-[11px] leading-5 text-neutral-500">Shop listing review is not an independent condition inspection or a BikeRegister/HPI certificate. Specifications and condition shown here come from the seller; inspect the bike before agreeing to buy.</p>
            {!staff&&!auctions[detailListing.id]&&detailListing.status==='active'&&detailListing.seller_id!==userId&&<button type="button" onClick={()=>{const item=detailListing;setDetailListing(null);if(userId)void startConversation(item);else setAppNotice(true);}} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#39FF14] px-4 text-sm font-bold text-neutral-950 hover:bg-[#72ff55]"><MessageCircle className="h-4 w-4"/>{userId?'Message seller':'Sign in to negotiate'}</button>}
          </div>
        </div>
      </section>
    </div>}
    {!staff&&<p className="text-center text-[11px] leading-5 text-neutral-500">Peer-to-peer listings are supplied by private sellers. The shop checks listing submissions but does not certify condition or ownership. Sale terms and disputes remain between buyer and seller; Stakey’s provides the marketplace without taking a per-sale commission. Please send feedback and feature requests at any time.</p>}
  </section>;
};

export default MarketplacePanel;
