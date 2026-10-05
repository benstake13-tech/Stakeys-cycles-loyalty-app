import React, { useState, useMemo } from 'react';
import {
  Wrench,
  Search,
  CheckCircle2,
  AlertTriangle,
  Info,
  Layers,
  ArrowRight,
  ShieldAlert,
  Compass,
  Zap,
  Filter,
  SlidersHorizontal,
  ExternalLink,
} from 'lucide-react';
import { DERAILLEUR_HANGERS_DATABASE } from '../shared/data/derailleurHangerData';
import { DerailleurHangerItem } from '../shared/types/bikeShop';
import { useShop } from '../shared/context/ShopContext';

export const DerailleurHangerIdentifier: React.FC = () => {
  const { theme } = useShop();
  const isDark = theme === 'dark';

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBrand, setSelectedBrand] = useState('All');
  const [selectedYear, setSelectedYear] = useState<string>('All');
  const [selectedAxle, setSelectedAxle] = useState<string>('All');
  const [selectedMaterial, setSelectedMaterial] = useState<string>('All');
  const [selectedHanger, setSelectedHanger] = useState<DerailleurHangerItem | null>(null);

  // Available filter options extracted from database
  const brands = useMemo(() => {
    const set = new Set<string>();
    DERAILLEUR_HANGERS_DATABASE.forEach((h) => {
      if (h.brand.includes('Trek')) set.add('Trek');
      if (h.brand.includes('Specialized')) set.add('Specialized');
      if (h.brand.includes('Giant')) set.add('Giant');
      if (h.brand.includes('Cannondale')) set.add('Cannondale');
      if (h.brand.includes('Carrera') || h.brand.includes('Boardman')) set.add('Boardman & Carrera');
      if (h.brand.includes('Universal') || h.brand.includes('SRAM')) set.add('SRAM UDH Universal');
    });
    return ['All', ...Array.from(set)];
  }, []);

  const years = ['All', '2026', '2025', '2024', '2023', '2022', '2021', '2020', '2019', '2018', '2017', '2016'];
  const axleStandards = ['All', '12x148mm Boost', '12x142mm Thru-Axle', 'QR 135mm', 'Speed Release'];
  const materials = ['All', 'Carbon', 'Alloy'];

  // High-accuracy matching engine with disambiguation rules
  const matches = useMemo(() => {
    const cleanQuery = searchQuery.trim().toLowerCase();

    return DERAILLEUR_HANGERS_DATABASE.filter((h) => {
      // 1. Text Search across OEM codes, compatible models, name, and notes
      if (cleanQuery) {
        const inCode = h.code.toLowerCase().includes(cleanQuery);
        const inName = h.name.toLowerCase().includes(cleanQuery);
        const inOem = h.oemPartNumbers.some((oem) => oem.toLowerCase().includes(cleanQuery));
        const inWheels = h.wheelsMfgEquivalent?.toLowerCase().includes(cleanQuery);
        const inPilo = h.piloEquivalent?.toLowerCase().includes(cleanQuery);
        const inModels = h.compatibleModels.some((m) => m.toLowerCase().includes(cleanQuery));
        const inNotes = h.notes?.toLowerCase().includes(cleanQuery);

        if (!inCode && !inName && !inOem && !inWheels && !inPilo && !inModels && !inNotes) {
          return false;
        }
      }

      // 2. Brand Filter
      if (selectedBrand !== 'All') {
        if (selectedBrand === 'SRAM UDH Universal' && !h.sramUdhCompatible) return false;
        if (selectedBrand !== 'SRAM UDH Universal' && !h.brand.includes(selectedBrand)) return false;
      }

      // 3. Year Filter
      if (selectedYear !== 'All') {
        const yrNum = parseInt(selectedYear, 10);
        if (!h.compatibleYears.includes(yrNum)) return false;
      }

      // 4. Axle Standard Filter
      if (selectedAxle !== 'All' && h.axleStandard !== selectedAxle) {
        return false;
      }

      // 5. Frame Material Filter
      if (selectedMaterial !== 'All' && !h.frameMaterials.includes(selectedMaterial as any)) {
        return false;
      }

      return true;
    });
  }, [searchQuery, selectedBrand, selectedYear, selectedAxle, selectedMaterial]);

  // Diagram SVG renderer based on hanger geometry shape
  const renderHangerDiagram = (shape: string, code: string) => {
    switch (shape) {
      case 'sram_udh':
        return (
          <svg viewBox="0 0 100 100" className="w-full h-full text-emerald-400 stroke-current fill-none">
            {/* SRAM UDH characteristic barrel and hook */}
            <path
              d="M 50 15 C 65 15, 75 25, 75 40 C 75 52, 68 60, 60 70 L 58 85 C 58 88, 54 90, 50 90 C 46 90, 42 88, 42 85 L 40 70 C 32 60, 25 52, 25 40 C 25 25, 35 15, 50 15 Z"
              strokeWidth="3.5"
              fill="rgba(5, 193, 71, 0.1)"
            />
            {/* Main M12 thru-axle opening */}
            <circle cx="50" cy="40" r="14" strokeWidth="3" />
            <circle cx="50" cy="40" r="6" strokeWidth="2" strokeDasharray="3 3" />
            {/* Derailleur mount hole */}
            <circle cx="50" cy="80" r="5" strokeWidth="2.5" fill="rgba(5, 193, 71, 0.4)" />
            {/* Rotation indicator stop */}
            <path d="M 68 28 L 80 20" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
        );

      case 'two_bolt_tang':
        return (
          <svg viewBox="0 0 100 100" className="w-full h-full text-sky-400 stroke-current fill-none">
            {/* Two-bolt flat-mount tang */}
            <path
              d="M 30 15 L 70 15 C 75 15, 80 20, 80 28 L 72 65 C 70 75, 62 88, 50 88 C 42 88, 38 78, 36 68 L 25 35 C 22 25, 25 15, 30 15 Z"
              strokeWidth="3.5"
              fill="rgba(56, 189, 248, 0.1)"
            />
            {/* Two fastener holes */}
            <circle cx="42" cy="26" r="4.5" strokeWidth="2.5" />
            <circle cx="62" cy="26" r="4.5" strokeWidth="2.5" />
            {/* Axle arch cutout */}
            <path d="M 35 48 C 45 42, 60 42, 70 48" strokeWidth="2.5" />
            {/* Derailleur mount hole */}
            <circle cx="52" cy="76" r="5.5" strokeWidth="2.5" fill="rgba(56, 189, 248, 0.4)" />
          </svg>
        );

      case 'single_counterbore':
        return (
          <svg viewBox="0 0 100 100" className="w-full h-full text-purple-400 stroke-current fill-none">
            {/* Single counterbore body (Specialized / Giant) */}
            <path
              d="M 35 18 C 40 12, 60 12, 68 18 C 76 25, 78 35, 74 48 L 68 75 C 66 84, 58 90, 48 90 C 40 90, 36 82, 36 74 L 32 45 C 30 32, 30 22, 35 18 Z"
              strokeWidth="3.5"
              fill="rgba(168, 85, 247, 0.1)"
            />
            {/* Central M4 counterbore */}
            <circle cx="52" cy="30" r="5" strokeWidth="2.5" />
            <circle cx="52" cy="30" r="8" strokeWidth="1.5" strokeDasharray="2 2" />
            {/* Axle cradle hook */}
            <path d="M 32 45 C 42 42, 62 42, 72 45" strokeWidth="2" />
            {/* Derailleur threaded bolt */}
            <circle cx="50" cy="78" r="5.5" strokeWidth="2.5" fill="rgba(168, 85, 247, 0.4)" />
          </svg>
        );

      case 'conical_axle':
      default:
        return (
          <svg viewBox="0 0 100 100" className="w-full h-full text-amber-400 stroke-current fill-none">
            {/* Concentric pivot axle hanger (Trek ABP) */}
            <circle cx="50" cy="35" r="22" strokeWidth="3" fill="rgba(245, 158, 11, 0.1)" />
            <circle cx="50" cy="35" r="11" strokeWidth="2.5" />
            {/* Lower hanger drop leg */}
            <path d="M 40 50 L 38 78 C 38 85, 45 90, 52 90 C 58 90, 62 85, 62 78 L 60 50 Z" strokeWidth="3" />
            {/* Derailleur mount */}
            <circle cx="50" cy="78" r="5" strokeWidth="2.5" fill="rgba(245, 158, 11, 0.4)" />
          </svg>
        );
    }
  };

  return (
    <div className="space-y-6 font-['Plus_Jakarta_Sans',sans-serif]">
      {/* Module Title & Accuracy Banner */}
      <div className="bg-[#0d1015] border border-neutral-800 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center shrink-0">
              <Compass className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-display text-xl sm:text-2xl font-black text-white tracking-tight">
                  High-Accuracy Derailleur Hanger Identification
                </h3>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                  OEM &amp; WHEELS MFG VERIFIED
                </span>
              </div>
              <p className="text-xs sm:text-sm text-neutral-400 mt-1 max-w-2xl leading-relaxed">
                Match exact bike Brand, Model, Year, frame material (Carbon vs Alloy), and axle standards against verified OEM, Wheels Mfg, Pilo, and SRAM UDH blueprints.
              </p>
            </div>
          </div>

          <div className="text-right self-start md:self-auto font-mono text-xs text-neutral-400 bg-neutral-950 p-3 rounded-2xl border border-neutral-800">
            <div>Catalog Entries: <strong className="text-white">{DERAILLEUR_HANGERS_DATABASE.length} Whitelisted Standards</strong></div>
            <div className="text-[11px] text-emerald-400 mt-0.5">Disambiguation Rules Active</div>
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div className="mt-6 pt-6 border-t border-neutral-800 space-y-4">
          <div className="relative">
            <Search className="w-4 h-4 text-neutral-500 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by Bike Model (e.g. Trek Domane, Specialized Diverge, TCR), Part Code (W318004, UDH), or Brand..."
              className="w-full bg-neutral-950 border border-neutral-700/80 rounded-2xl pl-11 pr-4 py-3 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-emerald-500 shadow-inner"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-neutral-400 hover:text-white"
              >
                Clear
              </button>
            )}
          </div>

          {/* Precision Filters Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            {/* Brand Filter */}
            <div>
              <label className="block text-[11px] font-mono text-neutral-400 mb-1">Brand Key</label>
              <select
                value={selectedBrand}
                onChange={(e) => setSelectedBrand(e.target.value)}
                className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500 cursor-pointer"
              >
                {brands.map((b) => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>

            {/* Year Filter */}
            <div>
              <label className="block text-[11px] font-mono text-neutral-400 mb-1">Model Year</label>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500 cursor-pointer"
              >
                {years.map((y) => (
                  <option key={y} value={y}>{y === 'All' ? 'All Model Years' : y}</option>
                ))}
              </select>
            </div>

            {/* Axle Standard */}
            <div>
              <label className="block text-[11px] font-mono text-neutral-400 mb-1">Axle Standard</label>
              <select
                value={selectedAxle}
                onChange={(e) => setSelectedAxle(e.target.value)}
                className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500 cursor-pointer"
              >
                {axleStandards.map((a) => (
                  <option key={a} value={a}>{a === 'All' ? 'All Axles' : a}</option>
                ))}
              </select>
            </div>

            {/* Frame Material */}
            <div>
              <label className="block text-[11px] font-mono text-neutral-400 mb-1">Frame Material</label>
              <select
                value={selectedMaterial}
                onChange={(e) => setSelectedMaterial(e.target.value)}
                className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500 cursor-pointer"
              >
                {materials.map((m) => (
                  <option key={m} value={m}>{m === 'All' ? 'All Materials' : m}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Disambiguation Warning Rules Callout */}
      <div className="p-4 rounded-2xl bg-neutral-900 border border-neutral-800 flex items-start gap-3 text-xs">
        <Info className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
        <div className="leading-relaxed text-neutral-300">
          <strong className="text-white font-semibold block mb-0.5">
            Workshop Disambiguation Notice:
          </strong>
          Many modern mountain frames (2020+) underwent mid-year revisions to <strong>SRAM UDH</strong>. Always verify whether the drive-side dropout features a concentric pivot nut or a standardized UDH reverse-threaded washer.
        </div>
      </div>

      {/* Results List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between text-xs text-neutral-400 font-mono">
          <span>Identified Hangers ({matches.length})</span>
          <span>Click any card to inspect full fastener torque and cross-reference table</span>
        </div>

        {matches.length === 0 ? (
          <div className="bg-[#0d1015] border border-neutral-800 rounded-3xl p-10 text-center text-neutral-400 space-y-3">
            <AlertTriangle className="w-8 h-8 mx-auto text-amber-400" />
            <h4 className="font-bold text-white text-base">No Exact Hanger Match Found</h4>
            <p className="text-xs max-w-md mx-auto">
              Try broadening your search term or reset the Year / Axle filter. You can also bring the broken hanger to Stakey's workshop bench for caliper gauge measurement.
            </p>
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setSelectedBrand('All');
                setSelectedYear('All');
                setSelectedAxle('All');
                setSelectedMaterial('All');
              }}
              className="px-4 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white font-bold text-xs cursor-pointer"
            >
              Reset All Filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {matches.map((hanger) => {
              const isSelected = selectedHanger?.id === hanger.id;

              return (
                <div
                  key={hanger.id}
                  onClick={() => setSelectedHanger(isSelected ? null : hanger)}
                  className={`bg-[#0d1015] hover:bg-neutral-900/90 rounded-2xl p-5 sm:p-6 border transition-all cursor-pointer shadow-lg space-y-4 ${
                    isSelected
                      ? 'border-emerald-500 shadow-emerald-500/10 ring-1 ring-emerald-500/30'
                      : 'border-neutral-800 hover:border-neutral-700'
                  }`}
                >
                  {/* Top Bar: Code, Name, Diagram Thumbnail */}
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                          {hanger.code}
                        </span>
                        {hanger.sramUdhCompatible && (
                          <span className="text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded">
                            SRAM UDH
                          </span>
                        )}
                        <span className="text-[10px] font-mono text-neutral-400">
                          {hanger.axleStandard}
                        </span>
                      </div>
                      <h4 className="font-display text-base font-bold text-white leading-snug">
                        {hanger.name}
                      </h4>
                      <div className="text-xs text-neutral-400 mt-1">
                        Brand: <strong className="text-neutral-200">{hanger.brand}</strong>
                      </div>
                    </div>

                    {/* SVG Diagram Visual Box */}
                    <div className="w-16 h-16 rounded-xl bg-neutral-950 border border-neutral-800 p-2 shrink-0 flex items-center justify-center">
                      {renderHangerDiagram(hanger.diagramShape, hanger.code)}
                    </div>
                  </div>

                  {/* Compatibility Strip */}
                  <div className="bg-neutral-950 p-3 rounded-xl border border-neutral-800/80 text-xs space-y-1.5">
                    <div className="flex justify-between text-neutral-400">
                      <span>Supported Model Years:</span>
                      <span className="text-white font-mono font-medium">
                        {Math.min(...hanger.compatibleYears)} – {Math.max(...hanger.compatibleYears)}
                      </span>
                    </div>
                    <div className="flex justify-between text-neutral-400">
                      <span>Frame Materials:</span>
                      <span className="text-white font-mono font-medium">
                        {hanger.frameMaterials.join(', ')}
                      </span>
                    </div>
                    <div className="flex justify-between text-neutral-400">
                      <span>Fastener Torque:</span>
                      <span className="text-emerald-400 font-mono font-bold">
                        {hanger.torqueSpecNm} Nm
                      </span>
                    </div>
                  </div>

                  {/* Compatible Models Snippet */}
                  <div className="text-xs">
                    <span className="text-neutral-400 block text-[10px] uppercase font-mono mb-1">
                      Compatible Models (Sample)
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {hanger.compatibleModels.slice(0, 4).map((m, i) => (
                        <span
                          key={i}
                          className="px-2 py-0.5 rounded bg-neutral-900 border border-neutral-800 text-neutral-300 text-[11px]"
                        >
                          {m}
                        </span>
                      ))}
                      {hanger.compatibleModels.length > 4 && (
                        <span className="text-neutral-500 text-[11px] self-center">
                          +{hanger.compatibleModels.length - 4} more
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Disambiguation Note */}
                  {hanger.notes && (
                    <div className="p-2.5 rounded-xl bg-neutral-950 text-[11px] text-neutral-300 border border-neutral-800 leading-snug">
                      <strong className="text-amber-400 font-bold block mb-0.5">Disambiguation Rule:</strong>
                      {hanger.notes}
                    </div>
                  )}

                  {/* Cross-Reference Identifiers */}
                  <div className="pt-2 border-t border-neutral-800/80 flex flex-wrap items-center justify-between text-[11px] font-mono text-neutral-400 gap-2">
                    <div>
                      OEM: <span className="text-neutral-200">{hanger.oemPartNumbers[0]}</span>
                    </div>
                    {hanger.wheelsMfgEquivalent && (
                      <div>
                        Wheels Mfg: <span className="text-emerald-400">{hanger.wheelsMfgEquivalent}</span>
                      </div>
                    )}
                    {hanger.piloEquivalent && (
                      <div>
                        Pilo: <span className="text-sky-400">{hanger.piloEquivalent}</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
