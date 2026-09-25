import React, { useState } from 'react';
import {
  Bike,
  Search,
  Sparkles,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Wrench,
  TrendingUp,
  Tag,
  DollarSign,
  ShieldCheck,
  Zap,
  Info,
  Layers,
  Save,
  RefreshCw,
  Sliders,
  Check,
  ArrowRight,
} from 'lucide-react';
import { useShop } from '../context/ShopContext';
import { VehicleCategory, BikeComponentSpec, BikeScrapeResult, UserProfile } from '../types/bikeShop';
import { scrapeBikeStockSpecs, analyzeUpgrade, KNOWN_BIKE_DATABASE } from '../utils/bikeScraperService';

interface BikeScraperTabProps {
  initialCustomer?: UserProfile | null;
}

export const BikeScraperTab: React.FC<BikeScraperTabProps> = ({ initialCustomer }) => {
  const { users, currentUser, saveBikeScrapedSpecs } = useShop();

  // Selected customer
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>(
    initialCustomer?.uid || ''
  );
  const [selectedBikeId, setSelectedBikeId] = useState<string>('');

  // Scraper query inputs
  const [brand, setBrand] = useState('Trek');
  const [model, setModel] = useState('Marlin 7');
  const [year, setYear] = useState('2023');
  const [category, setCategory] = useState<VehicleCategory>('cycle');

  // Loading & Results
  const [isScraping, setIsScraping] = useState(false);
  const [scrapeResult, setScrapeResult] = useState<BikeScrapeResult | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Edit component modal / inline state
  const [editingComponentId, setEditingComponentId] = useState<string | null>(null);
  const [editPartName, setEditPartName] = useState('');
  const [editPartNotes, setEditPartNotes] = useState('');

  const selectedCustomer = users.find((u) => u.uid === selectedCustomerId);
  const customerBikes = selectedCustomer?.bikes || [];

  // When customer is picked, auto-populate bike if they have one
  const handleSelectCustomer = (customerId: string) => {
    setSelectedCustomerId(customerId);
    const cust = users.find((u) => u.uid === customerId);
    if (cust && cust.bikes && cust.bikes.length > 0) {
      const firstBike = cust.bikes[0];
      setSelectedBikeId(firstBike.id);
      setBrand(firstBike.brand);
      setModel(firstBike.model);
      setCategory(firstBike.category);
      if (firstBike.scrapedData) {
        setScrapeResult(firstBike.scrapedData);
      }
    }
  };

  const handleSelectCustomerBike = (bikeId: string) => {
    setSelectedBikeId(bikeId);
    const b = customerBikes.find((item) => item.id === bikeId);
    if (b) {
      setBrand(b.brand);
      setModel(b.model);
      setCategory(b.category);
      if (b.scrapedData) {
        setScrapeResult(b.scrapedData);
      }
    }
  };

  const handleRunScraper = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!brand.trim() || !model.trim()) return;

    setIsScraping(true);
    setSaveSuccess(false);
    try {
      const result = await scrapeBikeStockSpecs(brand, model, year, category);
      setScrapeResult(result);
    } finally {
      setIsScraping(false);
    }
  };

  const handlePresetSelect = (presetBrand: string, presetModel: string, presetCategory: VehicleCategory = 'cycle') => {
    setBrand(presetBrand);
    setModel(presetModel);
    setCategory(presetCategory);
    setIsScraping(true);
    setSaveSuccess(false);
    scrapeBikeStockSpecs(presetBrand, presetModel, '2023', presetCategory).then((res) => {
      setScrapeResult(res);
      setIsScraping(false);
    });
  };

  const handleToggleUpgrade = (componentId: string) => {
    if (!scrapeResult) return;
    const updated = scrapeResult.components.map((comp) => {
      if (comp.id !== componentId) return comp;
      const willBeUpgraded = !comp.isUpgraded;
      return {
        ...comp,
        isUpgraded: willBeUpgraded,
        estimatedUpgradeValue: willBeUpgraded ? comp.estimatedUpgradeValue || 95 : 0,
      };
    });

    const upgradedCount = updated.filter((c) => c.isUpgraded).length;
    const totalVal = updated
      .filter((c) => c.isUpgraded)
      .reduce((sum, c) => sum + (c.estimatedUpgradeValue || 0), 0);

    setScrapeResult({
      ...scrapeResult,
      components: updated,
      detectedUpgradesCount: upgradedCount,
      totalEstimatedUpgradeValue: totalVal,
    });
  };

  const handleSaveCustomPart = (componentId: string) => {
    if (!scrapeResult) return;
    const updated = scrapeResult.components.map((comp) => {
      if (comp.id !== componentId) return comp;
      const analysis = analyzeUpgrade(comp.stockOEM, editPartName);
      return {
        ...comp,
        currentPart: editPartName || comp.stockOEM,
        isUpgraded: analysis.isUpgraded,
        estimatedUpgradeValue: analysis.estimatedValue,
        mechanicNotes: editPartNotes.trim() || comp.mechanicNotes,
      };
    });

    const upgradedCount = updated.filter((c) => c.isUpgraded).length;
    const totalVal = updated
      .filter((c) => c.isUpgraded)
      .reduce((sum, c) => sum + (c.estimatedUpgradeValue || 0), 0);

    setScrapeResult({
      ...scrapeResult,
      components: updated,
      detectedUpgradesCount: upgradedCount,
      totalEstimatedUpgradeValue: totalVal,
    });
    setEditingComponentId(null);
  };

  const handleSaveToCustomerBike = async () => {
    if (!selectedCustomerId || !selectedBikeId || !scrapeResult) return;
    await saveBikeScrapedSpecs(selectedCustomerId, selectedBikeId, scrapeResult);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3500);
  };

  return (
    <div className="space-y-6 font-['Plus_Jakarta_Sans',sans-serif]">
      {/* Header Banner */}
      <div className="bg-[#0e1217] border border-neutral-800 rounded-2xl p-6 sm:p-7 shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-mono text-emerald-400 mb-1">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Workshop Intelligence &amp; OEM Parts Verification</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              Customer Bike OEM Stock Scraper &amp; Upgrade Detector
            </h2>
            <p className="text-xs text-neutral-400 mt-1 max-w-2xl">
              Instantly fetch factory OEM components when a customer checks in their bike. Compare against currently installed parts to automatically identify upgrades, spot aftermarket modifications, and maintain verified workshop specs.
            </p>
          </div>

          {/* Customer Garage Selector */}
          <div className="bg-neutral-950 p-3 rounded-xl border border-neutral-800 text-xs min-w-[280px]">
            <label className="block text-[11px] font-semibold text-neutral-400 mb-1">
              Link to Customer Garage (Optional):
            </label>
            <select
              value={selectedCustomerId}
              onChange={(e) => handleSelectCustomer(e.target.value)}
              className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
            >
              <option value="">-- Manual Model Query --</option>
              {users
                .filter((u) => u.role === 'customer')
                .map((cust) => (
                  <option key={cust.uid} value={cust.uid}>
                    {cust.displayName} ({cust.membershipNumber}) - {cust.bikes?.length || 0} bikes
                  </option>
                ))}
            </select>

            {customerBikes.length > 0 && (
              <div className="mt-2">
                <label className="block text-[10px] font-semibold text-neutral-400 mb-1">
                  Select Customer's Bike:
                </label>
                <select
                  value={selectedBikeId}
                  onChange={(e) => handleSelectCustomerBike(e.target.value)}
                  className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-2.5 py-1.5 text-xs text-emerald-400 font-medium focus:outline-none focus:border-emerald-500"
                >
                  <option value="">-- Choose bike from garage --</option>
                  {customerBikes.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.brand} {b.model} {b.colour ? `(${b.colour})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Scraper Query Form & Presets */}
      <div className="bg-[#0e1217] border border-neutral-800 rounded-2xl p-6 shadow-xl space-y-4">
        <form onSubmit={handleRunScraper} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
          <div>
            <label className="block text-xs font-semibold text-neutral-400 mb-1">Brand</label>
            <input
              type="text"
              required
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
              placeholder="e.g. Trek, Specialized, Giant..."
              className="w-full bg-neutral-950 border border-neutral-700 rounded-xl px-3 py-2 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-400 mb-1">Model Name</label>
            <input
              type="text"
              required
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="e.g. Marlin 7, Stumpjumper, Escape 3..."
              className="w-full bg-neutral-950 border border-neutral-700 rounded-xl px-3 py-2 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-400 mb-1">Year / Series</label>
            <input
              type="text"
              value={year}
              onChange={(e) => setYear(e.target.value)}
              placeholder="e.g. 2023"
              className="w-full bg-neutral-950 border border-neutral-700 rounded-xl px-3 py-2 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-400 mb-1">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as VehicleCategory)}
              className="w-full bg-neutral-950 border border-neutral-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
            >
              <option value="cycle">Bicycle / Gravel / Road</option>
              <option value="ebike">E-Bike / Pedelec</option>
              <option value="electric_scooter">Electric Scooter</option>
              <option value="cargo">Cargo Bike</option>
            </select>
          </div>

          <div className="flex items-end">
            <button
              type="submit"
              disabled={isScraping}
              className="w-full py-2.5 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-md shadow-emerald-500/20 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
            >
              {isScraping ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Scraping...</span>
                </>
              ) : (
                <>
                  <Search className="w-3.5 h-3.5" />
                  <span>Scrape OEM Specs</span>
                </>
              )}
            </button>
          </div>
        </form>

        {/* Quick Test Presets */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-neutral-800/80 text-xs">
          <span className="text-neutral-500 text-[11px] font-mono">Popular Workshop Presets:</span>
          <button
            type="button"
            onClick={() => handlePresetSelect('Trek', 'Marlin 7', 'cycle')}
            className="px-2.5 py-1 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-white border border-neutral-800 text-[11px] cursor-pointer"
          >
            Trek Marlin 7
          </button>
          <button
            type="button"
            onClick={() => handlePresetSelect('Specialized', 'Stumpjumper EVO', 'cycle')}
            className="px-2.5 py-1 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-white border border-neutral-800 text-[11px] cursor-pointer"
          >
            Specialized Stumpjumper EVO
          </button>
          <button
            type="button"
            onClick={() => handlePresetSelect('Specialized', 'Sirrus X 3.0', 'cycle')}
            className="px-2.5 py-1 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-white border border-neutral-800 text-[11px] cursor-pointer"
          >
            Specialized Sirrus X 3.0
          </button>
          <button
            type="button"
            onClick={() => handlePresetSelect('Cannondale', 'Topstone 2', 'cycle')}
            className="px-2.5 py-1 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-white border border-neutral-800 text-[11px] cursor-pointer"
          >
            Cannondale Topstone 2
          </button>
          <button
            type="button"
            onClick={() => handlePresetSelect('Giant', 'Escape 3', 'cycle')}
            className="px-2.5 py-1 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-white border border-neutral-800 text-[11px] cursor-pointer"
          >
            Giant Escape 3
          </button>
          <button
            type="button"
            onClick={() => handlePresetSelect('Brompton', 'C Line Explore', 'cycle')}
            className="px-2.5 py-1 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-white border border-neutral-800 text-[11px] cursor-pointer"
          >
            Brompton C Line
          </button>
          <button
            type="button"
            onClick={() => handlePresetSelect('Xiaomi', 'Mi Pro 2', 'electric_scooter')}
            className="px-2.5 py-1 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-white border border-neutral-800 text-[11px] cursor-pointer"
          >
            Xiaomi Pro 2 Scooter
          </button>
        </div>
      </div>

      {/* Scraper Results & Spec Comparison Table */}
      {scrapeResult && (
        <div className="bg-[#0e1217] border border-neutral-800 rounded-2xl p-6 shadow-xl space-y-6 animate-fade-in">
          {/* Result Summary Bar */}
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-4 border-b border-neutral-800">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-white">
                  {scrapeResult.brand} {scrapeResult.model} ({scrapeResult.year})
                </h3>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  OEM Specs Verified
                </span>
              </div>
              <p className="text-xs text-neutral-400 mt-0.5 font-mono">
                Frame: {scrapeResult.frameMaterial} • Original MSRP: {scrapeResult.msrpOriginal || 'N/A'}
              </p>
            </div>

            {/* Upgrade Metrics Summary */}
            <div className="flex items-center gap-3">
              <div className="px-3.5 py-2 rounded-xl bg-neutral-950 border border-neutral-800 text-right">
                <span className="text-[10px] uppercase font-bold text-neutral-400 block">
                  Upgrades Detected
                </span>
                <span className="text-base font-black text-amber-400">
                  {scrapeResult.detectedUpgradesCount}{' '}
                  <span className="text-xs text-neutral-500 font-normal">
                    / {scrapeResult.components.length} parts
                  </span>
                </span>
              </div>

              {scrapeResult.totalEstimatedUpgradeValue > 0 && (
                <div className="px-3.5 py-2 rounded-xl bg-neutral-950 border border-emerald-500/30 text-right">
                  <span className="text-[10px] uppercase font-bold text-emerald-400 block">
                    Estimated Added Value
                  </span>
                  <span className="text-base font-black text-emerald-300">
                    +£{scrapeResult.totalEstimatedUpgradeValue}
                  </span>
                </div>
              )}

              {selectedCustomerId && selectedBikeId && (
                <button
                  type="button"
                  onClick={handleSaveToCustomerBike}
                  className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 shadow-md cursor-pointer transition-all shrink-0"
                >
                  <Save className="w-4 h-4" />
                  <span>{saveSuccess ? 'Saved to Garage!' : 'Save Specs to Bike'}</span>
                </button>
              )}
            </div>
          </div>

          {/* Component Comparison Table */}
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs font-semibold text-neutral-400 px-1">
              <span>Factory OEM Assembly vs. Inspected / Customer Parts:</span>
              <span className="text-[11px] text-neutral-500">
                Click any part to edit or toggle upgrade state
              </span>
            </div>

            <div className="divide-y divide-neutral-800/80 rounded-xl border border-neutral-800 overflow-hidden bg-neutral-950">
              {scrapeResult.components.map((comp) => {
                const isEditing = editingComponentId === comp.id;

                return (
                  <div
                    key={comp.id}
                    className="p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 hover:bg-neutral-900/40 transition-colors"
                  >
                    <div className="space-y-1 flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-neutral-900 text-neutral-300 border border-neutral-800 font-mono">
                          {comp.category}
                        </span>
                        <span className="font-bold text-sm text-white">{comp.componentName}</span>
                        {comp.isUpgraded ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                            <TrendingUp className="w-3 h-3" />
                            Upgraded (+£{comp.estimatedUpgradeValue || 0})
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
                            Stock OEM
                          </span>
                        )}
                      </div>

                      {/* Stock vs Current */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 text-xs">
                        <div className="text-neutral-400">
                          <span className="font-semibold text-neutral-500 text-[11px] block">
                            Factory Stock (OEM):
                          </span>
                          <span className="text-neutral-300 font-mono">{comp.stockOEM}</span>
                        </div>

                        <div>
                          <span className="font-semibold text-neutral-500 text-[11px] block">
                            Currently Installed on Bike:
                          </span>
                          <span
                            className={`font-mono font-medium ${
                              comp.isUpgraded ? 'text-amber-300' : 'text-neutral-300'
                            }`}
                          >
                            {comp.currentPart}
                          </span>
                          {comp.mechanicNotes && (
                            <p className="text-[11px] text-neutral-400 italic mt-0.5">
                              Note: {comp.mechanicNotes}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleToggleUpgrade(comp.id)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                          comp.isUpgraded
                            ? 'bg-amber-500/10 text-amber-300 border-amber-500/30 hover:bg-amber-500/20'
                            : 'bg-neutral-900 text-neutral-400 border-neutral-800 hover:text-white hover:bg-neutral-800'
                        }`}
                      >
                        {comp.isUpgraded ? 'Mark as Stock' : 'Mark as Upgraded'}
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setEditingComponentId(isEditing ? null : comp.id);
                          setEditPartName(comp.currentPart);
                          setEditPartNotes(comp.mechanicNotes || '');
                        }}
                        className="px-3 py-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-white border border-neutral-800 text-xs font-medium cursor-pointer"
                      >
                        {isEditing ? 'Cancel' : 'Edit Installed Part'}
                      </button>
                    </div>

                    {/* Inline Editor Form */}
                    {isEditing && (
                      <div className="w-full pt-3 mt-2 border-t border-neutral-800/80 flex flex-col sm:flex-row items-center gap-2 animate-fade-in">
                        <input
                          type="text"
                          value={editPartName}
                          onChange={(e) => setEditPartName(e.target.value)}
                          placeholder="Type installed aftermarket part model..."
                          className="flex-1 bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-emerald-500"
                        />
                        <input
                          type="text"
                          value={editPartNotes}
                          onChange={(e) => setEditPartNotes(e.target.value)}
                          placeholder="Mechanic inspection notes..."
                          className="flex-1 bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-emerald-500"
                        />
                        <button
                          type="button"
                          onClick={() => handleSaveCustomPart(comp.id)}
                          className="px-4 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-bold text-xs uppercase cursor-pointer"
                        >
                          Apply
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
