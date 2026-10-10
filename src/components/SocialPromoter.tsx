import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Facebook,
  Instagram,
  Send,
  Loader2,
  CheckCircle2,
  TriangleAlert,
  ExternalLink,
  Megaphone,
  Clock,
  ImageIcon,
} from 'lucide-react';
import { useShop } from '../context/ShopContext';
import {
  composePromotionPost,
  publishToMeta,
  fetchPostHistory,
  PostHistoryEntry,
  SocialTarget,
} from '../utils/metaPublishing';
import { promotionOfferText } from '../utils/performanceInsights';

const cardCls = 'bg-[#0e1217] border border-neutral-800 rounded-3xl p-5 shadow-xl';

interface TargetState {
  publishing: boolean;
  ok: boolean;
  error: string | null;
  id?: string;
}

const emptyTarget: TargetState = { publishing: false, ok: false, error: null };

/**
 * Promote to Social — turn a live shop promotion into a Facebook/Instagram post
 * and publish it. The caption is composed deterministically so staff always see
 * exactly what will be posted before they send it.
 */
export const SocialPromoter: React.FC = () => {
  const { promotions } = useShop();

  const candidates = useMemo(
    () => promotions.filter((p) => p.status === 'active' || p.status === 'upcoming'),
    [promotions]
  );

  const [selectedId, setSelectedId] = useState<string>('');
  const selected = useMemo(
    () => candidates.find((p) => p.id === selectedId) || candidates[0],
    [candidates, selectedId]
  );

  const [draft, setDraft] = useState('');
  const [targets, setTargets] = useState<Record<SocialTarget, TargetState>>({
    facebook: { ...emptyTarget },
    instagram: { ...emptyTarget },
  });
  const [history, setHistory] = useState<PostHistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const origin = typeof window !== 'undefined' ? window.location.origin : '';

  // Recompose the caption whenever the chosen promotion changes; staff can still
  // hand-edit it afterwards.
  useEffect(() => {
    if (!selected) {
      setDraft('');
      return;
    }
    setDraft(composePromotionPost(selected, { origin }).message);
    setTargets({ facebook: { ...emptyTarget }, instagram: { ...emptyTarget } });
  }, [selected, origin]);

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    setHistory(await fetchPostHistory());
    setHistoryLoading(false);
  }, []);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  const patchTarget = (target: SocialTarget, next: Partial<TargetState>) =>
    setTargets((prev) => ({ ...prev, [target]: { ...prev[target], ...next } }));

  const publish = async (target: SocialTarget) => {
    patchTarget(target, { publishing: true, error: null, ok: false });
    const result = await publishToMeta(target, {
      message: draft,
      hashtags: [],
      imageUrl: selected?.imageUrl,
    });
    if (result.ok) {
      patchTarget(target, { publishing: false, ok: true, id: result.id });
      void loadHistory();
    } else {
      patchTarget(target, { publishing: false, ok: false, error: result.error || 'Publish failed' });
    }
  };

  const targetButton = (target: SocialTarget, label: string, Icon: React.FC<any>) => {
    const state = targets[target];
    return (
      <button
        type="button"
        disabled={state.publishing || !draft.trim()}
        onClick={() => publish(target)}
        className="pressable px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-400 text-neutral-950 text-xs font-bold flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {state.publishing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Icon className="w-4 h-4" />}
        {state.ok ? `Posted to ${label}` : `Post to ${label}`}
      </button>
    );
  };

  return (
    <div className="space-y-6">
      <div className={cardCls}>
        <div className="flex items-start gap-3 pb-4 border-b border-neutral-800">
          <Megaphone className="w-6 h-6 text-emerald-500 shrink-0" />
          <div>
            <h3 className="text-lg font-bold text-white">Promote to Social</h3>
            <p className="text-xs text-neutral-400 mt-0.5 max-w-2xl">
              Pick a promotion, review the caption, and publish it to your Facebook Page and
              Instagram in one tap. Posts go out from the server-side Meta token — no login needed.
            </p>
          </div>
        </div>

        {candidates.length === 0 ? (
          <p className="text-xs text-neutral-500 mt-4 italic">
            No active or upcoming promotions. Create one in Promotions first.
          </p>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mt-5">
            {/* Composer */}
            <div className="space-y-4">
              <div>
                <label className="text-[11px] uppercase tracking-wider text-neutral-400 font-semibold">
                  Promotion
                </label>
                <select
                  value={selected?.id || ''}
                  onChange={(e) => setSelectedId(e.target.value)}
                  className="mt-1.5 w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2.5 text-sm text-white focus:border-emerald-500 outline-none"
                >
                  {candidates.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title} — {promotionOfferText(p)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[11px] uppercase tracking-wider text-neutral-400 font-semibold">
                  Caption (editable)
                </label>
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  rows={12}
                  className="mt-1.5 w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2.5 text-xs text-white font-mono leading-relaxed focus:border-emerald-500 outline-none resize-y"
                />
                <p className="text-[11px] text-neutral-500 mt-1">{draft.length} characters</p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {targetButton('facebook', 'Facebook', Facebook)}
                {targetButton('instagram', 'Instagram', Instagram)}
              </div>

              {!selected?.imageUrl && (
                <p className="text-[11px] text-amber-300/90 flex items-center gap-1.5">
                  <TriangleAlert className="w-3.5 h-3.5" />
                  This promotion has no image. Instagram requires a public image URL — add one on the
                  promotion to enable Instagram posting.
                </p>
              )}

              {(['facebook', 'instagram'] as SocialTarget[]).map((t) =>
                targets[t].ok ? (
                  <p key={t} className="text-[11px] text-emerald-300 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Published to {t} (id {targets[t].id}).
                  </p>
                ) : targets[t].error ? (
                  <p key={t} className="text-[11px] text-rose-400 flex items-start gap-1.5">
                    <TriangleAlert className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                    <span>
                      <span className="capitalize font-semibold">{t}:</span> {targets[t].error}
                    </span>
                  </p>
                ) : null
              )}
            </div>

            {/* Preview */}
            <div>
              <label className="text-[11px] uppercase tracking-wider text-neutral-400 font-semibold">
                Preview
              </label>
              <div className="mt-1.5 bg-neutral-950 border border-neutral-800 rounded-xl overflow-hidden">
                <div className="flex items-center gap-2 px-3 py-2.5 border-b border-neutral-800">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center text-neutral-950 font-black text-xs">
                    S
                  </div>
                  <div>
                    <p className="text-xs font-bold text-white">Stakey's Cycles</p>
                    <p className="text-[10px] text-neutral-500 flex items-center gap-1">
                      <Clock className="w-3 h-3" /> Just now
                    </p>
                  </div>
                </div>
                {selected?.imageUrl ? (
                  <img src={selected.imageUrl} alt="" className="w-full max-h-64 object-cover" />
                ) : (
                  <div className="w-full h-32 bg-neutral-900 flex flex-col items-center justify-center text-neutral-600 gap-1">
                    <ImageIcon className="w-6 h-6" />
                    <span className="text-[10px]">No image</span>
                  </div>
                )}
                <p className="px-3 py-3 text-xs text-neutral-200 whitespace-pre-wrap leading-relaxed">
                  {draft}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* History */}
      <div className={cardCls}>
        <div className="flex items-center justify-between gap-3 mb-4">
          <h3 className="text-sm font-bold text-neutral-200 flex items-center gap-2">
            <Clock className="w-4 h-4 text-neutral-400" />
            Recent posts
          </h3>
          <button
            type="button"
            onClick={() => loadHistory()}
            className="text-neutral-400 hover:text-white transition-colors"
            title="Refresh"
          >
            {historyLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Clock className="w-4 h-4" />}
          </button>
        </div>
        {history.length === 0 ? (
          <p className="text-xs text-neutral-500 italic">
            No posts yet. Publish a promotion above to see it here.
          </p>
        ) : (
          <div className="space-y-2">
            {history.map((post) => (
              <div
                key={post.id}
                className="bg-neutral-950 border border-neutral-800 rounded-xl p-3 flex items-start justify-between gap-3"
              >
                <div className="min-w-0">
                  <p className="text-xs text-neutral-200 line-clamp-2 whitespace-pre-wrap">
                    {post.message || '(no text)'}
                  </p>
                  <p className="text-[10px] text-neutral-500 mt-1">
                    {post.createdAt ? new Date(post.createdAt).toLocaleString('en-GB') : ''}
                  </p>
                </div>
                {post.permalink && (
                  <a
                    href={post.permalink}
                    target="_blank"
                    rel="noreferrer"
                    className="shrink-0 inline-flex items-center gap-1 text-[11px] text-emerald-400 hover:text-emerald-300"
                  >
                    View <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default SocialPromoter;
