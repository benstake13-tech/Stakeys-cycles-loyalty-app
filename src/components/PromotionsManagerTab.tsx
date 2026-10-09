import React, { useState } from 'react';
import {
  Tag,
  Plus,
  Edit2,
  Trash2,
  Calendar,
  CheckCircle2,
  AlertCircle,
  RotateCw,
  Sparkles,
  Percent,
  X,
  Save,
  Check,
} from 'lucide-react';
import { useShop } from '../context/ShopContext';
import { ShopPromotion, VehicleCategory } from '../types/bikeShop';
import { DriveImagePicker } from './DriveImagePicker';
import { PromotionsPlanner } from './PromotionsPlanner';

export const PromotionsManagerTab: React.FC = () => {
  const { promotions, addPromotion, updatePromotion, deletePromotion, refreshPromotionsExpiry } = useShop();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPromoId, setEditingPromoId] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [showDrivePicker, setShowDrivePicker] = useState(false);

  const [formData, setFormData] = useState<{
    title: string;
    subtitle: string;
    code: string;
    discountPercentage?: number;
    discountAmount?: number;
    badgeText: string;
    status: 'active' | 'upcoming' | 'expired';
    startDate: string;
    endDate: string;
    termsText: string;
    eligibleCategories: VehicleCategory[];
    bgGradient: string;
    imageUrl?: string;
  }>({
    title: '',
    subtitle: '',
    code: '',
    discountPercentage: 15,
    discountAmount: 0,
    badgeText: 'Active Now',
    status: 'active',
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString().split('T')[0],
    termsText: 'Valid for in-store and online bookings.\nLabour only; replacement parts charged separately.\nCannot combine with other offers.',
    eligibleCategories: ['cycle', 'ebike'],
    bgGradient: 'from-emerald-950/80 via-[#0e1713] to-neutral-900',
    imageUrl: '',
  });

  const handleOpenAdd = () => {
    setEditingPromoId(null);
    setFormData({
      title: '',
      subtitle: '',
      code: `STK-${Math.floor(1000 + Math.random() * 9000)}`,
      discountPercentage: 15,
      discountAmount: 0,
      badgeText: 'Active Now',
      status: 'active',
      startDate: new Date().toISOString().split('T')[0],
      endDate: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString().split('T')[0],
      termsText: 'Valid for in-store and online bookings.\nLabour only; replacement parts charged separately.\nCannot combine with other offers.',
      eligibleCategories: ['cycle', 'ebike'],
      bgGradient: 'from-emerald-950/80 via-[#0e1713] to-neutral-900',
      imageUrl: '',
    });
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (promo: ShopPromotion) => {
    setEditingPromoId(promo.id);
    setFormData({
      title: promo.title,
      subtitle: promo.subtitle,
      code: promo.code,
      discountPercentage: promo.discountPercentage || 0,
      discountAmount: promo.discountAmount || 0,
      badgeText: promo.badgeText,
      status: promo.status,
      startDate: promo.startDate,
      endDate: promo.endDate,
      termsText: promo.termsAndConditions.join('\n'),
      eligibleCategories: promo.eligibleCategories || ['cycle'],
      bgGradient: promo.bgGradient || 'from-emerald-950/80 via-[#0e1713] to-neutral-900',
      imageUrl: promo.imageUrl || '',
    });
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!formData.title.trim()) {
      setFormError('Please enter a promotion title.');
      return;
    }
    if (!formData.code.trim()) {
      setFormError('Please provide a coupon code.');
      return;
    }
    if (formData.endDate < formData.startDate) {
      setFormError('End date cannot precede the start date.');
      return;
    }

    const termsArray = formData.termsText
      .split('\n')
      .map((t) => t.trim())
      .filter(Boolean);

    try {
      const payload: Omit<ShopPromotion, 'id'> = {
        title: formData.title.trim(),
        subtitle: formData.subtitle.trim(),
        code: formData.code.trim().toUpperCase(),
        discountPercentage: formData.discountPercentage ? Number(formData.discountPercentage) : undefined,
        discountAmount: formData.discountAmount ? Number(formData.discountAmount) : undefined,
        badgeText: formData.badgeText.trim() || 'Active',
        status: formData.status,
        startDate: formData.startDate,
        endDate: formData.endDate,
        termsAndConditions: termsArray.length > 0 ? termsArray : ['Standard workshop service conditions apply.'],
        eligibleCategories: formData.eligibleCategories,
        bgGradient: formData.bgGradient,
        imageUrl: formData.imageUrl ? formData.imageUrl.trim() : undefined,
      };

      if (editingPromoId) {
        await updatePromotion(editingPromoId, payload);
        setActionSuccess(`Promotion "${payload.title}" updated.`);
      } else {
        await addPromotion(payload);
        setActionSuccess(`Promotion "${payload.title}" published.`);
      }
      refreshPromotionsExpiry();
      setIsModalOpen(false);
      setTimeout(() => setActionSuccess(null), 3000);
    } catch (err: any) {
      setFormError(err.message || 'Failed to save promotion.');
    }
  };

  const handleDelete = async (id: string, title: string) => {
    if (confirm(`Delete promotion "${title}"?`)) {
      await deletePromotion(id);
      setActionSuccess(`Promotion removed.`);
      setTimeout(() => setActionSuccess(null), 3000);
    }
  };

  return (
    <div className="space-y-6 font-['Plus_Jakarta_Sans',sans-serif]">
      {/* Top Banner */}
      <div className="bg-[#0d1015] border border-neutral-800 rounded-3xl p-6 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
              <Tag className="w-5 h-5 text-emerald-400" />
              Promotions &amp; Seasonal Campaigns Manager
            </h3>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
              DATE-BOUND CRUD
            </span>
          </div>
          <p className="text-xs text-neutral-400 mt-1">
            Create, edit, and schedule workshop discounts and seasonal campaigns. The automated background engine monitors start and end dates in real time.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={refreshPromotionsExpiry}
            className="px-3 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Force run background expiration check"
          >
            <RotateCw className="w-3.5 h-3.5 text-emerald-400" />
            <span>Sync Expiry</span>
          </button>

          <button
            type="button"
            onClick={handleOpenAdd}
            className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-bold text-xs flex items-center gap-2 transition-all cursor-pointer shadow-md"
          >
            <Plus className="w-4 h-4" />
            <span>New Promotion</span>
          </button>
        </div>
      </div>

      {actionSuccess && (
        <div className="p-3.5 rounded-2xl bg-emerald-950/60 border border-emerald-500/50 text-emerald-300 text-xs flex items-center gap-2.5 animate-fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {/* Promotions Planner — schedule before publishing */}
      <PromotionsPlanner />

      {/* Promotions List */}
      <div className="space-y-4">
        {promotions.map((p) => {
          const isExpired = p.status === 'expired';
          const isUpcoming = p.status === 'upcoming';

          return (
            <div
              key={p.id}
              className="bg-[#0d1015] border border-neutral-800 hover:border-neutral-700 rounded-2xl p-5 shadow-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-4 transition-all"
            >
              <div className="space-y-1.5 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase ${
                      isExpired
                        ? 'bg-neutral-800 text-neutral-400'
                        : isUpcoming
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    }`}
                  >
                    {p.badgeText || p.status.toUpperCase()}
                  </span>
                  <span className="font-mono text-xs font-bold text-white bg-neutral-900 px-2 py-0.5 rounded border border-neutral-800">
                    {p.code}
                  </span>
                  {p.discountPercentage && (
                    <span className="text-xs font-bold text-emerald-400">
                      {p.discountPercentage}% Discount
                    </span>
                  )}
                  {p.discountAmount && (
                    <span className="text-xs font-bold text-emerald-400">
                      £{p.discountAmount} Credit
                    </span>
                  )}
                </div>

                <h4 className="text-base font-bold text-white leading-snug">{p.title}</h4>
                <p className="text-xs text-neutral-400">{p.subtitle}</p>

                <div className="text-[11px] font-mono text-neutral-400 flex items-center gap-3 pt-1">
                  <span>Start: <strong className="text-neutral-200">{p.startDate}</strong></span>
                  <span>End: <strong className="text-neutral-200">{p.endDate}</strong></span>
                  <span>Categories: <strong className="text-emerald-400">{p.eligibleCategories.join(', ')}</strong></span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 self-end md:self-auto shrink-0">
                <button
                  type="button"
                  onClick={() => handleOpenEdit(p)}
                  className="px-3 py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  <span>Edit</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleDelete(p.id, p.title)}
                  className="p-2 rounded-xl bg-rose-950/60 hover:bg-rose-900 border border-rose-800 text-rose-300 transition-colors cursor-pointer"
                  title="Delete promotion"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Edit / Create Promotion Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#0d1015] border border-neutral-800 rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl relative space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
              <h3 className="font-display text-lg font-bold text-white flex items-center gap-2">
                <Tag className="w-4 h-4 text-emerald-400" />
                <span>{editingPromoId ? 'Edit Promotion Campaign' : 'Create New Promotion'}</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="p-3 rounded-xl bg-rose-950/70 border border-rose-800 text-rose-200 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-neutral-300 font-medium mb-1">Campaign Title</label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="e.g. Spring Season Drivetrain Overhaul"
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-neutral-300 font-medium mb-1">Headline Subtitle</label>
                <input
                  type="text"
                  value={formData.subtitle}
                  onChange={(e) => setFormData({ ...formData, subtitle: e.target.value })}
                  placeholder="e.g. Free ultrasonic degrease with any full service"
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-neutral-300 font-medium mb-1">Coupon Code</label>
                  <input
                    type="text"
                    required
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    placeholder="SPRING26"
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-white font-mono uppercase focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-neutral-300 font-medium mb-1">Status Badge Text</label>
                  <input
                    type="text"
                    value={formData.badgeText}
                    onChange={(e) => setFormData({ ...formData, badgeText: e.target.value })}
                    placeholder="Active Now / Popular"
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-neutral-300 font-medium mb-1">Discount % (Optional)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={formData.discountPercentage || ''}
                    onChange={(e) => setFormData({ ...formData, discountPercentage: Number(e.target.value) || 0 })}
                    placeholder="e.g. 20"
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-neutral-300 font-medium mb-1">Fixed £ Credit (Optional)</label>
                  <input
                    type="number"
                    min="0"
                    value={formData.discountAmount || ''}
                    onChange={(e) => setFormData({ ...formData, discountAmount: Number(e.target.value) || 0 })}
                    placeholder="e.g. 15"
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-neutral-300 font-medium mb-1">Start Date</label>
                  <input
                    type="date"
                    required
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-neutral-300 font-medium mb-1">End Date</label>
                  <input
                    type="date"
                    required
                    value={formData.endDate}
                    onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-neutral-300 font-medium mb-1">Terms &amp; Conditions (One per line)</label>
                <textarea
                  rows={3}
                  value={formData.termsText}
                  onChange={(e) => setFormData({ ...formData, termsText: e.target.value })}
                  placeholder="Enter specific rules, eligible services, and exclusions..."
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-emerald-500 resize-none"
                />
              </div>

              <div>
                <label className="block text-neutral-300 font-medium mb-1">Promotion Card Image</label>
                <div className="flex items-center gap-3">
                  <input
                    type="text"
                    value={formData.imageUrl || ''}
                    onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                    placeholder="e.g. data:image/png;base64,... or https://example.com/image.jpg"
                    className="flex-1 bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500 font-mono"
                  />
                  {formData.imageUrl && (
                    <div className="shrink-0 w-10 h-10 rounded-lg overflow-hidden border border-neutral-800 bg-neutral-900">
                      <img src={formData.imageUrl} alt="Promo preview" className="w-full h-full object-cover" />
                    </div>
                  )}
                  <label className="shrink-0 px-3.5 py-2 rounded-xl border border-neutral-700 bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-white transition-all font-bold cursor-pointer">
                    <span>Upload</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onloadend = () => {
                            if (typeof reader.result === 'string') {
                              setFormData({ ...formData, imageUrl: reader.result });
                            }
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowDrivePicker(true)}
                    className="shrink-0 px-3.5 py-2 rounded-xl border border-emerald-800 bg-emerald-950/30 hover:bg-emerald-950/60 text-emerald-400 transition-all font-bold cursor-pointer"
                  >
                    Drive
                  </button>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-bold flex items-center gap-1.5 cursor-pointer shadow-md"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{editingPromoId ? 'Update Promotion' : 'Publish Promotion'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showDrivePicker && (
        <DriveImagePicker
          folder="promo"
          onClose={() => setShowDrivePicker(false)}
          onPick={(url) => {
            setFormData((prev) => ({ ...prev, imageUrl: url }));
            setShowDrivePicker(false);
          }}
        />
      )}
    </div>
  );
};
