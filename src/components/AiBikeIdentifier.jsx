import React, { useCallback, useRef, useState } from 'react';
import {
  Camera,
  Sparkles,
  Loader2,
  Check,
  X,
  Zap,
  AlertTriangle,
  Gauge,
  Ruler,
  Wrench,
  Battery,
  Bike,
  RotateCcw,
  Plus,
  CircleAlert,
  Clock,
} from 'lucide-react';
import { useShop } from '../context/ShopContext';
import { identifyBikeFromImage, isBikeVisionConfigured } from '../api/visionService';
import { classifyVisionError } from '../api/visionErrors';

const SEVERITY_STYLES = {
  high: 'border-rose-500/40 bg-rose-950/40 text-rose-200',
  medium: 'border-amber-500/40 bg-amber-950/40 text-amber-200',
  low: 'border-sky-500/40 bg-sky-950/40 text-sky-200',
};

const CONDITION_STYLES = {
  excellent: 'text-emerald-300',
  good: 'text-emerald-300',
  worn: 'text-amber-300',
  needs_attention: 'text-rose-300',
};

const TYPE_LABELS = {
  cycle: 'Bicycle',
  ebike: 'Electric Bicycle',
  electric_scooter: 'Electric Scooter',
  cargo: 'Cargo / Kids Bike',
};

const toCategory = (type) =>
  type === 'electric_scooter' || type === 'ebike' || type === 'cargo' ? type : 'cycle';

export function AiBikeIdentifier({ user, isOpen, onClose, onAdded, addBike }) {
  const { addCustomerBike } = useShop();
  const fileRef = useRef(null);
  const persistBike = addBike || addCustomerBike;

  const [imageData, setImageData] = useState(null);
  const [mimeType, setMimeType] = useState('image/jpeg');
  const [analyzing, setAnalyzing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [errorInfo, setErrorInfo] = useState(null);
  const [savedBike, setSavedBike] = useState(null);

  const configured = isBikeVisionConfigured();

  const reset = useCallback(() => {
    setImageData(null);
    setResult(null);
    setError('');
    setErrorInfo(null);
    setSavedBike(null);
    setAnalyzing(false);
    setSaving(false);
  }, []);

  const handleClose = () => {
    reset();
    onClose?.();
  };

  const runAnalysis = useCallback(async (dataUrl, mime) => {
    setAnalyzing(true);
    setError('');
    setErrorInfo(null);
    setResult(null);
    try {
      const analysis = await identifyBikeFromImage(dataUrl, mime);
      setResult(analysis);
    } catch (err) {
      // Never surface raw upstream JSON — map it to a friendly, structured alert.
      const info = classifyVisionError(err);
      setErrorInfo(info);
      setError(info.message);
    } finally {
      // Always release the spinner, even on failure, so Re-analyse is tappable.
      setAnalyzing(false);
    }
  }, []);

  const handleFile = (file) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Please choose an image file.');
      return;
    }
    const mime = file.type || 'image/jpeg';
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result;
      setImageData(dataUrl);
      setMimeType(mime);
      runAnalysis(dataUrl, mime);
    };
    reader.readAsDataURL(file);
  };

  /** Retry the current photo after a transient failure. */
  const reanalyse = () => {
    if (imageData) runAnalysis(imageData, mimeType);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    handleFile(e.dataTransfer.files?.[0]);
  };

  const handleSave = async () => {
    if (!result || !user?.uid) return;
    setSaving(true);
    setError('');
    try {
      const problems = result.obviousProblems || [];
      const hasSeriousProblem = problems.some((p) => p.severity === 'high' || p.severity === 'medium');
      const isElectric = Boolean(result.electricKit?.isElectric);

      const components = (result.mainSpecs || []).map((spec, index) => ({
        id: `ai-spec-${index}`,
        category: spec.category,
        componentName: spec.componentName,
        stockOEM: 'Factory / unknown',
        currentPart: spec.currentPart,
        isUpgraded: false,
        condition: spec.condition,
        mechanicNotes: spec.notes,
      }));

      const scrapedData = {
        brand: result.make,
        model: result.model,
        year: result.year,
        category: toCategory(result.type),
        frameMaterial: result.frameMaterial,
        components,
        detectedUpgradesCount: result.electricKit?.isAftermarketConversion ? 1 : 0,
        totalEstimatedUpgradeValue: 0,
        sourceUrl: 'AI photo identification',
        scrapedAt: new Date().toISOString(),
        aiIdentification: result,
      };

      const created = await persistBike({
        category: toCategory(result.type),
        categoryLabel: result.categoryLabel || TYPE_LABELS[result.type] || 'Bicycle',
        brand: result.make || 'Unknown',
        model: result.model || 'Unidentified',
        year: result.year || undefined,
        colour: result.colour || undefined,
        frameSizeOrNotes: result.positioning?.frameSizeEstimate
          ? `AI: ${result.positioning.frameSizeEstimate}${isElectric ? ' · E-bike' : ''}`
          : isElectric
          ? 'AI: Electric'
          : undefined,
        healthStatus: hasSeriousProblem ? 'due_service' : 'healthy',
        stockSpecsScraped: true,
        scrapedData,
      });

      setSavedBike(created);
      onAdded?.(created, result);
    } catch (err) {
      setError(err?.message || 'Could not save this bike to your garage.');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  const ekit = result?.electricKit;
  const confidencePct = result ? Math.round((result.confidence || 0) * 100) : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/80 p-4 backdrop-blur-sm animate-fade-in">
      <div className="relative my-auto w-full max-w-3xl rounded-3xl border border-neutral-800 bg-gradient-to-b from-[#0e1217] to-[#090b0e] p-5 text-white shadow-2xl sm:p-7 max-h-[92vh] overflow-y-auto">
        <button
          type="button"
          onClick={handleClose}
          aria-label="Close"
          className="pressable absolute right-4 top-4 rounded-full bg-neutral-800 p-2 text-neutral-400 hover:text-white cursor-pointer"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Header */}
        <div className="mb-5 flex items-start gap-3">
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-2.5 text-emerald-400">
            <Sparkles className="h-6 w-6" />
          </div>
          <div>
            <h3 className="font-display text-xl font-black">AI Bike Identifier</h3>
            <p className="text-xs text-neutral-400">
              Snap a photo and Stakey's AI will identify the bike, read its positioning, spot any electric kit, list the main specs and flag obvious problems — then add it to your garage.
            </p>
          </div>
        </div>

        {!configured && (
          <div className="mb-4 flex items-center gap-2 rounded-xl border border-amber-500/40 bg-amber-950/40 px-3 py-2.5 text-xs text-amber-200">
            <CircleAlert className="h-4 w-4 shrink-0" />
            <span>AI vision isn't configured on this build. Add a VITE_GEMINI_API_KEY to enable photo identification.</span>
          </div>
        )}

        {error && (
          <div
            role="alert"
            data-testid="ai-bike-error"
            className={`mb-4 flex items-start gap-2.5 rounded-xl border px-3 py-2.5 text-xs ${
              errorInfo?.transient
                ? 'border-amber-600/60 bg-amber-950/40 text-amber-100'
                : 'border-rose-700 bg-rose-950/60 text-rose-200'
            }`}
          >
            {errorInfo?.transient ? (
              <Clock className="mt-0.5 h-4 w-4 shrink-0" />
            ) : (
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            )}
            <div className="min-w-0 flex-1">
              <span className="block">{error}</span>
              {imageData && (errorInfo?.retryable ?? true) && (
                <button
                  type="button"
                  onClick={reanalyse}
                  disabled={analyzing}
                  className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-current px-2.5 py-1 text-[11px] font-bold opacity-90 hover:bg-white/5 disabled:opacity-50"
                >
                  <RotateCcw className="h-3 w-3" />
                  {analyzing ? 'Re-analysing…' : 'Re-analyse'}
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={() => { setError(''); setErrorInfo(null); }}
              aria-label="Dismiss error"
              className="shrink-0 rounded-lg p-0.5 hover:bg-white/10"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        <div className="grid gap-5 sm:grid-cols-2">
          {/* Capture column */}
          <div className="space-y-3">
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              className={`relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed ${
                imageData ? 'border-neutral-700' : 'border-neutral-700/80 bg-neutral-950/60'
              }`}
            >
              {imageData ? (
                <>
                  <img src={imageData} alt="Bike to identify" className="h-full w-full object-cover" />
                  {analyzing && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/60 backdrop-blur-sm">
                      <Loader2 className="h-8 w-8 animate-spin text-emerald-400" />
                      <span className="text-xs font-semibold text-emerald-300">Stakey is inspecting your bike…</span>
                    </div>
                  )}
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="flex cursor-pointer flex-col items-center gap-3 p-6 text-center"
                >
                  <Camera className="h-10 w-10 text-emerald-400" />
                  <span className="text-sm font-bold text-white">Take or upload a photo</span>
                  <span className="text-[11px] text-neutral-500">
                    A clear side-on shot in good light works best. Drag &amp; drop also works.
                  </span>
                  <span className="pressable mt-1 rounded-xl bg-emerald-500 px-4 py-2 text-xs font-bold uppercase tracking-wider text-neutral-950">
                    Choose photo
                  </span>
                </button>
              )}
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="pressable flex flex-1 items-center justify-center gap-2 rounded-xl border border-neutral-700 bg-neutral-900 px-3 py-2 text-xs font-semibold text-neutral-300 hover:text-white cursor-pointer"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>{imageData ? 'Retake' : 'Upload'}</span>
              </button>
              {imageData && (
                <button
                  type="button"
                  onClick={() => runAnalysis(imageData, mimeType)}
                  disabled={analyzing}
                  className="pressable flex flex-1 items-center justify-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/15 px-3 py-2 text-xs font-semibold text-emerald-300 disabled:opacity-50 cursor-pointer"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>Re-analyse</span>
                </button>
              )}
            </div>
            {/* Hidden file input, triggered by the capture button */}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => handleFile(e.target.files?.[0])}
            />
          </div>

          {/* Results column */}
          <div className="space-y-3">
            {!result && !analyzing && (
              <div className="flex h-full flex-col items-center justify-center rounded-2xl border border-neutral-800 bg-neutral-950/40 p-6 text-center">
                <Bike className="h-10 w-10 text-neutral-600" />
                <p className="mt-3 text-xs text-neutral-500">
                  Your bike's details will appear here for you to review before adding it to your garage.
                </p>
              </div>
            )}

            {analyzing && !result && (
              <div className="flex h-full flex-col items-center justify-center rounded-2xl border border-neutral-800 bg-neutral-950/40 p-6 text-center">
                <Loader2 className="h-8 w-8 animate-spin text-emerald-400" />
                <p className="mt-3 text-xs text-neutral-400">Reading frame, components and any electric kit…</p>
              </div>
            )}

            {result && (
              <div className="space-y-3 animate-fade-in">
                {/* Identification */}
                <div className="rounded-2xl border border-neutral-800 bg-[#0b0e13] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                        {TYPE_LABELS[result.type] || result.type}
                      </div>
                      <div className="mt-0.5 text-lg font-black leading-tight">
                        {result.make} <span className="text-neutral-300">{result.model}</span>
                      </div>
                      {result.summary && <p className="mt-1 text-[11px] text-neutral-400">{result.summary}</p>}
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="font-mono text-lg font-bold text-emerald-400">{confidencePct}%</div>
                      <div className="text-[10px] text-neutral-500">confidence</div>
                    </div>
                  </div>
                  <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-neutral-800">
                    <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-300" style={{ width: `${confidencePct}%` }} />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {result.frameMaterial && <Chip>{result.frameMaterial}</Chip>}
                    {result.positioning?.wheelSize && <Chip>{result.positioning.wheelSize}</Chip>}
                    {result.positioning?.frameSizeEstimate && <Chip>{result.positioning.frameSizeEstimate}</Chip>}
                    {result.colour && <Chip>{result.colour}</Chip>}
                  </div>
                </div>

                {/* Electric kit */}
                {ekit?.isElectric ? (
                  <div className="rounded-2xl border border-amber-500/40 bg-amber-950/30 p-4">
                    <div className="flex items-center gap-2 text-xs font-bold text-amber-300">
                      <Zap className="h-4 w-4" />
                      <span>Electric kit detected</span>
                      {ekit.isAftermarketConversion && (
                        <span className="rounded-full border border-amber-500/50 bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold uppercase">
                          Aftermarket conversion
                        </span>
                      )}
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px]">
                      {ekit.systemType && <Field label="System" value={ekit.systemType} />}
                      {ekit.motorBrand && <Field label="Motor" value={ekit.motorBrand} />}
                      {ekit.motorPosition && <Field label="Motor pos." value={ekit.motorPosition} />}
                      {ekit.motorWatts && <Field label="Watts" value={ekit.motorWatts} />}
                      {ekit.batteryBrand && <Field label="Battery" value={ekit.batteryBrand} />}
                      {ekit.batteryLocation && <Field label="Battery pos." value={ekit.batteryLocation} />}
                      {ekit.batteryVolts && <Field label="Volts" value={ekit.batteryVolts} />}
                    </div>
                    {ekit.notes && <p className="mt-2 text-[11px] text-amber-200/80">{ekit.notes}</p>}
                  </div>
                ) : (
                  <div className="flex items-center gap-2 rounded-2xl border border-neutral-800 bg-[#0b0e13] px-4 py-3 text-[11px] text-neutral-400">
                    <Zap className="h-4 w-4 text-neutral-600" />
                    <span>No electric kit detected — this looks like a pedal-powered bike.</span>
                  </div>
                )}

                {/* Positioning */}
                {result.positioning && (
                  <div className="rounded-2xl border border-neutral-800 bg-[#0b0e13] p-4">
                    <div className="flex items-center gap-2 text-xs font-bold text-white">
                      <Ruler className="h-4 w-4 text-emerald-400" />
                      <span>Positioning &amp; fit</span>
                    </div>
                    <div className="mt-2 space-y-1.5 text-[11px]">
                      {result.positioning.ridingStyle && <Field label="Riding style" value={result.positioning.ridingStyle} />}
                      {result.positioning.riderFit && <Field label="Rider fit" value={result.positioning.riderFit} />}
                      {result.positioning.cockpitSetup && <Field label="Cockpit" value={result.positioning.cockpitSetup} />}
                      {result.positioning.saddleSetup && <Field label="Saddle" value={result.positioning.saddleSetup} />}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Full-width detail sections */}
        {result && (
          <div className="mt-5 space-y-3">
            {/* Main specs */}
            {result.mainSpecs?.length > 0 && (
              <div className="rounded-2xl border border-neutral-800 bg-[#0b0e13] p-4">
                <div className="flex items-center gap-2 text-xs font-bold text-white">
                  <Wrench className="h-4 w-4 text-emerald-400" />
                  <span>Main specs detected ({result.mainSpecs.length})</span>
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {result.mainSpecs.map((spec, i) => (
                    <div key={i} className="rounded-xl border border-neutral-800 bg-neutral-950/60 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                          {spec.category}
                        </span>
                        {spec.condition && (
                          <span className={`text-[10px] font-semibold capitalize ${CONDITION_STYLES[spec.condition] || 'text-neutral-400'}`}>
                            {spec.condition.replace('_', ' ')}
                          </span>
                        )}
                      </div>
                      <div className="mt-1 text-xs font-semibold text-white">{spec.componentName}</div>
                      <div className="text-[11px] text-neutral-400">{spec.currentPart}</div>
                      {spec.notes && <div className="mt-0.5 text-[10px] text-neutral-500">{spec.notes}</div>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Obvious problems */}
            <div className="rounded-2xl border border-neutral-800 bg-[#0b0e13] p-4">
              <div className="flex items-center gap-2 text-xs font-bold text-white">
                <AlertTriangle className="h-4 w-4 text-amber-400" />
                <span>Obvious problems</span>
                <span className="rounded-full border border-neutral-700 bg-neutral-900 px-2 py-0.5 text-[10px] font-bold text-neutral-300">
                  {result.obviousProblems?.length || 0}
                </span>
              </div>
              {result.obviousProblems?.length ? (
                <div className="mt-3 space-y-2">
                  {result.obviousProblems.map((p, i) => (
                    <div key={i} className={`rounded-xl border p-3 ${SEVERITY_STYLES[p.severity] || SEVERITY_STYLES.low}`}>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold">{p.issue}</span>
                        <span className="shrink-0 rounded-full border border-current px-2 py-0.5 text-[10px] font-bold uppercase">
                          {p.severity}
                        </span>
                      </div>
                      {(p.location || p.recommendation) && (
                        <div className="mt-1 text-[11px] opacity-80">
                          {p.location && <span>Location: {p.location}. </span>}
                          {p.recommendation && <span>{p.recommendation}</span>}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-[11px] text-emerald-300">No obvious problems spotted — the bike looks sound from this photo.</p>
              )}
            </div>

            {!savedBike && (
              <p className="text-center text-[10px] text-neutral-500">
                AI identification is a guide. Our mechanics will confirm the details at workshop intake.
              </p>
            )}
          </div>
        )}

        {/* Footer actions */}
        <div className="mt-5 flex flex-col gap-2 border-t border-neutral-800 pt-4 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={handleClose}
            className="pressable rounded-xl border border-neutral-700 bg-neutral-900 px-4 py-2.5 text-xs font-semibold text-neutral-300 hover:text-white cursor-pointer"
          >
            {savedBike ? 'Done' : 'Cancel'}
          </button>
          {result && !savedBike && (
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || !user?.uid}
              className="pressable flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-neutral-950 hover:bg-emerald-400 disabled:opacity-50 cursor-pointer"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              <span>{saving ? 'Adding to garage…' : 'Add to my garage'}</span>
            </button>
          )}
          {savedBike && (
            <div className="flex items-center justify-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/15 px-5 py-2.5 text-xs font-bold text-emerald-300">
              <Check className="h-4 w-4" />
              <span>Added to your garage</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const Chip = ({ children }) => (
  <span className="rounded-full border border-neutral-700 bg-neutral-900 px-2 py-0.5 text-[10px] font-semibold text-neutral-300">
    {children}
  </span>
);

const Field = ({ label, value }) => (
  <div className="flex items-baseline gap-1.5">
    <span className="shrink-0 text-neutral-500">{label}:</span>
    <span className="text-neutral-200">{value}</span>
  </div>
);

export default AiBikeIdentifier;
