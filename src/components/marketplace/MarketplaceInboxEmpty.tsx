import { MessageCircle, Send } from 'lucide-react';
export function MarketplaceInboxEmpty() {
  return <div className="marketplace-glass flex min-h-80 flex-col rounded-xl border border-white/10 bg-neutral-900/60 p-5">
    <p className="font-bold text-white">No conversation selected</p>
    <div className="my-4 grid grid-cols-3 gap-2 text-center text-xs text-neutral-500">{['Price agreement','Meeting point','Handover plan'].map(label=><div key={label} className="rounded-lg border border-dashed border-white/15 p-3">{label}<span className="mt-1 block">Not started</span></div>)}</div>
    <div className="flex flex-1 flex-col items-center justify-center gap-3 py-6 text-center text-sm text-neutral-400"><MessageCircle className="h-8 w-8 text-emerald-400/60"/><p>Open a listing and message its seller.<br/>Your questions, offers and replies stay together here.</p></div>
    <div className="flex gap-2"><input disabled aria-label="Message composer: select a conversation first" placeholder="Select a conversation to write a message" className="min-h-11 min-w-0 flex-1 rounded-xl border border-white/10 bg-neutral-950 px-3 text-sm text-neutral-500"/><span className="grid w-11 place-items-center rounded-xl bg-neutral-800 text-neutral-600"><Send className="h-4 w-4"/></span></div>
  </div>;
}
