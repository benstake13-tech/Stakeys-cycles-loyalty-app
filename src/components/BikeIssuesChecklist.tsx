import React, { useState, useMemo } from 'react';
import {
  CheckSquare,
  Square,
  Search,
  ChevronDown,
  ChevronUp,
  Disc,
  Cog,
  CircleDot,
  Volume2,
  Wrench,
  Zap,
  Sparkles,
  AlertCircle,
  X,
} from 'lucide-react';
import {
  BIKE_ISSUES_CATEGORIES,
  BikeIssueCategory,
  BikeIssueItem,
  ALL_BIKE_ISSUES_MAP,
} from '../data/bikeIssuesCatalog';

interface BikeIssuesChecklistProps {
  selectedIssueIds: string[];
  onChange: (issueIds: string[]) => void;
  otherNotes: string;
  onOtherNotesChange: (notes: string) => void;
  vehicleCategory?: string;
}

export const BikeIssuesChecklist: React.FC<BikeIssuesChecklistProps> = ({
  selectedIssueIds,
  onChange,
  otherNotes,
  onOtherNotesChange,
  vehicleCategory = 'cycle',
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  
  // Track open/collapsed state of categories (open by default as in <details open>)
  const [openCategories, setOpenCategories] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    BIKE_ISSUES_CATEGORIES.forEach((cat) => {
      // Open all by default (<details open>), except E-Bike only if not e-bike vehicle
      if (cat.id === 'cat-ebike') {
        initial[cat.id] = vehicleCategory === 'ebike' || vehicleCategory === 'electric_scooter';
      } else {
        initial[cat.id] = true;
      }
    });
    return initial;
  });

  const toggleCategory = (categoryId: string, nextState?: boolean) => {
    setOpenCategories((prev) => ({
      ...prev,
      [categoryId]: nextState !== undefined ? nextState : !prev[categoryId],
    }));
  };

  const handleToggleIssue = (issueId: string) => {
    if (selectedIssueIds.includes(issueId)) {
      onChange(selectedIssueIds.filter((id) => id !== issueId));
    } else {
      onChange([...selectedIssueIds, issueId]);
    }
  };

  const handleSelectAllInCategory = (cat: BikeIssueCategory) => {
    const catItemIds = cat.items.map((i) => i.id);
    const allSelected = catItemIds.every((id) => selectedIssueIds.includes(id));
    if (allSelected) {
      // Remove all items in category
      onChange(selectedIssueIds.filter((id) => !catItemIds.includes(id)));
    } else {
      // Add all missing items in category
      const merged = Array.from(new Set([...selectedIssueIds, ...catItemIds]));
      onChange(merged);
    }
  };

  const handleClearAll = () => {
    onChange([]);
  };

  // Filter items if searching
  const filteredCategories = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return BIKE_ISSUES_CATEGORIES;

    return BIKE_ISSUES_CATEGORIES.map((cat) => {
      const matchingItems = cat.items.filter(
        (item) =>
          item.label.toLowerCase().includes(q) ||
          cat.title.toLowerCase().includes(q) ||
          (cat.description && cat.description.toLowerCase().includes(q))
      );
      return {
        ...cat,
        items: matchingItems,
      };
    }).filter((cat) => cat.items.length > 0);
  }, [searchQuery]);

  const getCategoryIcon = (key: string) => {
    switch (key) {
      case 'brakes':
        return <Disc className="w-4 h-4 text-rose-400" />;
      case 'drivetrain':
        return <Cog className="w-4 h-4 text-amber-400" />;
      case 'wheels':
        return <CircleDot className="w-4 h-4 text-sky-400" />;
      case 'noise':
        return <Volume2 className="w-4 h-4 text-purple-400" />;
      case 'frame':
        return <Wrench className="w-4 h-4 text-emerald-400" />;
      case 'ebike':
        return <Zap className="w-4 h-4 text-yellow-400" />;
      case 'general':
      default:
        return <Sparkles className="w-4 h-4 text-teal-400" />;
    }
  };

  return (
    <fieldset className="problem-checklist space-y-5 border-0 p-0 m-0 font-['Plus_Jakarta_Sans',sans-serif]">
      {/* Legend & Header (Multi-Select Checkbox Setup) */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-neutral-800">
        <div>
          <legend className="font-display text-base sm:text-lg font-bold text-white flex items-center gap-2">
            <span>Select all problems that apply:</span>
            <span className="text-xs font-normal text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded-full">
              Choose all that apply
            </span>
          </legend>
          <p className="text-xs text-neutral-400 mt-0.5">
            Check every symptom or issue you’re experiencing. Our workshop certified mechanics will inspect each one during workshop intake.
          </p>
        </div>

        {/* Selected Counter & Clear Action */}
        {selectedIssueIds.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded-xl bg-[#05C147]/20 border border-[#05C147]/40 text-[#05C147] font-mono text-xs font-bold">
              {selectedIssueIds.length} Issue{selectedIssueIds.length > 1 ? 's' : ''} Selected
            </span>
            <button
              type="button"
              onClick={handleClearAll}
              className="text-neutral-400 hover:text-white text-xs underline cursor-pointer"
            >
              Clear All
            </button>
          </div>
        )}
      </div>

      {/* Quick Search Symptom Input */}
      <div className="relative">
        <Search className="w-4 h-4 text-neutral-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search symptoms (e.g. squeak, gears, flat tire, chain, rubbing, rattle)..."
          className="w-full bg-[#090b0e] border border-neutral-800 rounded-xl pl-10 pr-9 py-2.5 text-xs sm:text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-emerald-500 transition-colors"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-neutral-400 hover:text-white cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Selected Items Tray (Quick Overview & 1-Click Removal) */}
      {selectedIssueIds.length > 0 && (
        <div className="p-3.5 rounded-2xl bg-neutral-950/80 border border-emerald-500/30 space-y-2 animate-fade-in">
          <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-400 flex items-center justify-between">
            <span>Reported Workshop Symptoms ({selectedIssueIds.length}):</span>
            <span className="text-[10px] text-neutral-400 normal-case font-normal">Click × to deselect</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {selectedIssueIds.map((id) => {
              const item = ALL_BIKE_ISSUES_MAP.get(id);
              if (!item) return null;
              return (
                <span
                  key={id}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-neutral-900 border border-neutral-700 text-xs text-neutral-200"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-[#05C147]" />
                  <span>{item.label}</span>
                  <button
                    type="button"
                    onClick={() => handleToggleIssue(id)}
                    className="text-neutral-400 hover:text-rose-400 p-0.5 cursor-pointer ml-0.5 transition-colors"
                    title={`Remove ${item.label}`}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* Structured Category Sections with <details open> */}
      <div className="space-y-3">
        {filteredCategories.length === 0 ? (
          <div className="p-6 rounded-2xl bg-neutral-950 border border-neutral-800 text-center text-neutral-400 text-xs">
            <AlertCircle className="w-5 h-5 mx-auto mb-1.5 text-neutral-500" />
            No symptoms matched "{searchQuery}". You can describe your specific problem in the "Other issues" box below.
          </div>
        ) : (
          filteredCategories.map((cat) => {
            const isOpen = openCategories[cat.id] ?? true;
            const categorySelectedCount = cat.items.filter((item) =>
              selectedIssueIds.includes(item.id)
            ).length;
            const allCatSelected = cat.items.length > 0 && categorySelectedCount === cat.items.length;

            return (
              <details
                key={cat.id}
                open={isOpen}
                onToggle={(e) => {
                  toggleCategory(cat.id, e.currentTarget.open);
                }}
                className="group rounded-2xl bg-[#0a0d12] border border-neutral-800/80 overflow-hidden transition-all duration-200"
              >
                {/* Summary / Category Header */}
                <summary
                  className="px-4 sm:px-5 py-3.5 bg-neutral-900/60 hover:bg-neutral-800/50 flex items-center justify-between gap-3 cursor-pointer select-none transition-colors border-b border-transparent group-open:border-neutral-800/60 list-none [&::-webkit-details-marker]:hidden"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-xl bg-neutral-950 border border-neutral-800 flex items-center justify-center shrink-0">
                      {getCategoryIcon(cat.categoryKey)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <strong className="text-sm font-bold text-white tracking-tight">
                          {cat.title}
                        </strong>
                        {categorySelectedCount > 0 && (
                          <span className="px-1.5 py-0.2 rounded-md bg-[#05C147] text-neutral-950 font-mono text-[10px] font-black">
                            {categorySelectedCount} selected
                          </span>
                        )}
                        {cat.isEbikeOnly && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] bg-yellow-500/20 text-yellow-300 border border-yellow-500/30">
                            E-Bike
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-neutral-400 line-clamp-1">
                        {cat.description}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        handleSelectAllInCategory(cat);
                      }}
                      className="hidden sm:inline-block px-2 py-0.5 rounded text-[10px] font-medium bg-neutral-800/80 hover:bg-neutral-700 text-neutral-300 transition-colors cursor-pointer"
                    >
                      {allCatSelected ? 'Deselect all' : 'Select all'}
                    </button>
                    <div className="text-neutral-400 p-1">
                      {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </div>
                  </div>
                </summary>

                {/* Items Checkbox Grid */}
                {isOpen && (
                  <div className="p-4 sm:p-5 grid grid-cols-1 md:grid-cols-2 gap-2.5 bg-neutral-950/40 animate-fade-in">
                    {cat.items.map((item) => {
                      const isChecked = selectedIssueIds.includes(item.id);
                      return (
                        <label
                          key={item.id}
                          className={`flex items-start gap-3 p-3 rounded-xl border text-left cursor-pointer transition-all duration-150 ${
                            isChecked
                              ? 'bg-emerald-950/40 border-emerald-500/60 text-white shadow-sm'
                              : 'bg-neutral-900/40 border-neutral-800/80 hover:bg-neutral-900 hover:border-neutral-700 text-neutral-300'
                          }`}
                        >
                          <input
                            type="checkbox"
                            name="problems[]"
                            value={item.id}
                            checked={isChecked}
                            onChange={() => handleToggleIssue(item.id)}
                            className="mt-0.5 w-4 h-4 rounded text-[#05C147] focus:ring-emerald-500 bg-neutral-950 border-neutral-700 cursor-pointer accent-[#05C147] shrink-0"
                          />
                          <span className={`text-xs sm:text-[13px] leading-snug select-none ${
                            isChecked ? 'font-semibold text-white' : 'font-normal text-neutral-300'
                          }`}>
                            {item.label}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </details>
            );
          })
        )}
      </div>

      {/* Freeform "Other issues (optional)" Note Area */}
      <div style={{ marginTop: '15px' }} className="pt-2">
        <label htmlFor="other-notes" className="block text-xs font-semibold text-neutral-300 mb-1.5 flex items-center justify-between">
          <span><strong>Other issues (optional):</strong></span>
          <span className="text-[11px] text-neutral-500 font-normal">Any specific noises, gear combinations, or history</span>
        </label>
        <textarea
          id="other-notes"
          name="other_notes"
          rows={3}
          value={otherNotes}
          onChange={(e) => onOtherNotesChange(e.target.value)}
          placeholder="Describe any other issue..."
          className="w-full bg-[#090b0e] border border-neutral-800 rounded-xl px-4 py-3 text-xs sm:text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-emerald-500 transition-colors"
        />
      </div>
    </fieldset>
  );
};
