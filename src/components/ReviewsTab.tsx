import React, { useMemo, useState } from 'react';
import {
  MessageSquare,
  Star,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  X,
  Save,
} from 'lucide-react';
import { useShop } from '../context/ShopContext';
import { CustomerReview } from '../types/bikeShop';

const STATUS_META: Record<CustomerReview['status'], { label: string; className: string }> = {
  published: { label: 'Published', className: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' },
  pending: { label: 'Pending', className: 'bg-amber-500/20 text-amber-300 border border-amber-500/30' },
  hidden: { label: 'Hidden', className: 'bg-neutral-800 text-neutral-400 border border-neutral-700' },
};

const Stars: React.FC<{ rating: number; className?: string }> = ({ rating, className = '' }) => (
  <span className={`inline-flex items-center gap-0.5 ${className}`} aria-label={`${rating} out of 5 stars`}>
    {[1, 2, 3, 4, 5].map((n) => (
      <Star
        key={n}
        className={`w-3.5 h-3.5 ${n <= rating ? 'text-amber-400 fill-amber-400' : 'text-neutral-700'}`}
      />
    ))}
  </span>
);

export const ReviewsTab: React.FC = () => {
  const { reviews = [], addReview, updateReview, deleteReview } = useShop();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | CustomerReview['status']>('all');
  const [formData, setFormData] = useState({
    customerName: '',
    membershipNumber: '',
    rating: 5,
    title: '',
    comment: '',
    status: 'published' as CustomerReview['status'],
    source: 'in_store' as CustomerReview['source'],
  });

  const stats = useMemo(() => {
    const published = reviews.filter((r) => r.status === 'published');
    const avg = published.length
      ? published.reduce((n, r) => n + r.rating, 0) / published.length
      : 0;
    return {
      total: reviews.length,
      pending: reviews.filter((r) => r.status === 'pending').length,
      average: avg,
    };
  }, [reviews]);

  const visible = filter === 'all' ? reviews : reviews.filter((r) => r.status === filter);

  const openAdd = () => {
    setFormData({
      customerName: '',
      membershipNumber: '',
      rating: 5,
      title: '',
      comment: '',
      status: 'published',
      source: 'in_store',
    });
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!formData.customerName.trim()) {
      setFormError('A customer name is required.');
      return;
    }
    if (!formData.comment.trim()) {
      setFormError('The review text cannot be empty.');
      return;
    }
    await addReview({
      customerName: formData.customerName.trim(),
      membershipNumber: formData.membershipNumber.trim() || undefined,
      rating: Math.min(5, Math.max(1, formData.rating)),
      title: formData.title.trim() || undefined,
      comment: formData.comment.trim(),
      status: formData.status,
      source: formData.source,
    });
    setIsModalOpen(false);
  };

  const toggleStatus = (review: CustomerReview) => {
    updateReview(review.id, { status: review.status === 'published' ? 'hidden' : 'published' });
  };

  return (
    <div className="space-y-6 font-['Plus_Jakarta_Sans',sans-serif]">
      <div className="bg-[#0d1015] border border-neutral-800 rounded-3xl p-6 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h3 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-emerald-400" />
            Customer Reviews &amp; Feedback
          </h3>
          <p className="text-xs text-neutral-400 mt-1">
            Collect reviews from the website and in store, then publish the ones you want shown on the marketing surfaces.
          </p>
          <div className="flex items-center gap-4 mt-3 text-xs text-neutral-300">
            <span className="flex items-center gap-1.5">
              <span className="font-mono font-bold text-white">{stats.total}</span> total
            </span>
            <span className="flex items-center gap-1.5">
              <Stars rating={Math.round(stats.average)} />
              <span className="font-mono font-bold text-white">{stats.average.toFixed(1)}</span> avg
            </span>
            {stats.pending > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                {stats.pending} pending
              </span>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={openAdd}
          data-testid="review-new"
          className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-bold text-xs flex items-center gap-2 transition-all cursor-pointer shadow-md shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Add Review</span>
        </button>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        {(['all', 'published', 'pending', 'hidden'] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold capitalize transition-colors cursor-pointer ${
              filter === f
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                : 'bg-neutral-900 text-neutral-400 border border-neutral-800 hover:text-white'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {visible.length === 0 && (
          <div className="bg-[#0d1015] border border-dashed border-neutral-800 rounded-2xl p-8 text-center text-neutral-500 text-xs">
            No reviews here yet.
          </div>
        )}
        {visible.map((r) => {
          const meta = STATUS_META[r.status];
          return (
            <div
              key={r.id}
              data-testid={`review-row-${r.id}`}
              className="bg-[#0d1015] border border-neutral-800 hover:border-neutral-700 rounded-2xl p-5 shadow-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-4 transition-all"
            >
              <div className="space-y-1.5 flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase ${meta.className}`}>
                    {meta.label}
                  </span>
                  <Stars rating={r.rating} />
                  <span className="font-semibold text-white text-sm">{r.customerName}</span>
                  {r.membershipNumber && (
                    <span className="font-mono text-[11px] text-neutral-500">{r.membershipNumber}</span>
                  )}
                  <span className="text-[10px] font-mono uppercase text-neutral-600">{r.source}</span>
                </div>
                {r.title && <div className="text-sm font-semibold text-neutral-200">{r.title}</div>}
                <p className="text-xs text-neutral-400 leading-relaxed">{r.comment}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => toggleStatus(r)}
                  title={r.status === 'published' ? 'Hide review' : 'Publish review'}
                  className="p-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 transition-colors cursor-pointer"
                >
                  {r.status === 'published' ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
                <button
                  type="button"
                  onClick={() => deleteReview(r.id)}
                  title="Delete review"
                  className="p-2 rounded-lg bg-rose-950/50 hover:bg-rose-900/60 text-rose-400 transition-colors cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
          <div className="w-full max-w-lg bg-[#0d1015] border border-neutral-800 rounded-3xl p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-black text-white">Add a review</h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="mb-4 p-3 rounded-xl bg-rose-950/60 border border-rose-500/50 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <label className="text-xs text-neutral-400 space-y-1">
                  <span>Customer name</span>
                  <input
                    value={formData.customerName}
                    onChange={(e) => setFormData((f) => ({ ...f, customerName: e.target.value }))}
                    className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-emerald-500"
                  />
                </label>
                <label className="text-xs text-neutral-400 space-y-1">
                  <span>Membership no. (optional)</span>
                  <input
                    value={formData.membershipNumber}
                    onChange={(e) => setFormData((f) => ({ ...f, membershipNumber: e.target.value }))}
                    className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-emerald-500"
                  />
                </label>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-xs text-neutral-400">Rating</span>
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setFormData((f) => ({ ...f, rating: n }))}
                      className="cursor-pointer"
                    >
                      <Star
                        className={`w-5 h-5 ${n <= formData.rating ? 'text-amber-400 fill-amber-400' : 'text-neutral-700'}`}
                      />
                    </button>
                  ))}
                </div>
              </div>

              <label className="text-xs text-neutral-400 space-y-1 block">
                <span>Title (optional)</span>
                <input
                  value={formData.title}
                  onChange={(e) => setFormData((f) => ({ ...f, title: e.target.value }))}
                  className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-emerald-500"
                />
              </label>

              <label className="text-xs text-neutral-400 space-y-1 block">
                <span>Review</span>
                <textarea
                  value={formData.comment}
                  onChange={(e) => setFormData((f) => ({ ...f, comment: e.target.value }))}
                  rows={3}
                  className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-emerald-500 resize-none"
                />
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="text-xs text-neutral-400 space-y-1">
                  <span>Status</span>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData((f) => ({ ...f, status: e.target.value as CustomerReview['status'] }))}
                    className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-emerald-500"
                  >
                    <option value="published">Published</option>
                    <option value="pending">Pending</option>
                    <option value="hidden">Hidden</option>
                  </select>
                </label>
                <label className="text-xs text-neutral-400 space-y-1">
                  <span>Source</span>
                  <select
                    value={formData.source}
                    onChange={(e) => setFormData((f) => ({ ...f, source: e.target.value as CustomerReview['source'] }))}
                    className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-emerald-500"
                  >
                    <option value="in_store">In store</option>
                    <option value="website">Website</option>
                    <option value="app">App</option>
                  </select>
                </label>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 mt-5">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-neutral-950 text-xs font-bold flex items-center gap-2 cursor-pointer"
              >
                <Save className="w-4 h-4" />
                Save review
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
