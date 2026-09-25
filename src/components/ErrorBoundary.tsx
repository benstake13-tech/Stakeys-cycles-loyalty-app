import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RotateCcw, Wrench, Phone, Mail } from 'lucide-react';
import { StakeysLogo } from './StakeysLogo';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error in Stakeys Cycles app:', error, errorInfo);
  }

  private handleReset = () => {
    try {
      localStorage.clear();
    } catch {
      // ignore
    }
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-neutral-950 text-neutral-100 flex items-center justify-center p-4 font-['Plus_Jakarta_Sans',sans-serif]">
          <div className="max-w-md w-full bg-neutral-900 border border-neutral-800 rounded-3xl p-6 sm:p-8 text-center shadow-2xl space-y-5">
            <div className="inline-flex p-3 rounded-2xl bg-neutral-950 border border-amber-500/40 shadow-lg">
              <StakeysLogo className="w-12 h-12" />
            </div>

            <div>
              <h2 className="text-xl font-black text-white">Stakey's Cycles &amp; Scooter</h2>
              <p className="text-xs text-neutral-400 mt-1">Application Recovery</p>
            </div>

            <div className="p-4 rounded-2xl bg-amber-950/40 border border-amber-600/30 text-amber-200 text-xs text-left">
              <div className="flex items-center gap-2 font-bold mb-1 text-amber-400">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>An unexpected issue occurred:</span>
              </div>
              <p className="font-mono text-[11px] text-neutral-300 break-words">
                {this.state.error?.message || 'Unknown render error'}
              </p>
            </div>

            <div className="flex flex-col gap-2.5">
              <button
                type="button"
                onClick={this.handleReset}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-[#05C147] to-emerald-500 text-neutral-950 font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 active:scale-95 transition-all cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Reset Cache &amp; Reload Application</span>
              </button>

              <button
                type="button"
                onClick={() => window.location.reload()}
                className="w-full py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white font-semibold text-xs transition-colors cursor-pointer"
              >
                Try Simple Refresh
              </button>
            </div>

            <div className="pt-4 border-t border-neutral-800 text-[11px] text-neutral-400 space-y-1">
              <div className="font-semibold text-neutral-300">Workshop &amp; Owner Contact:</div>
              <div className="flex items-center justify-center gap-4 text-emerald-400 font-mono">
                <a href="tel:07388209102" className="hover:underline flex items-center gap-1">
                  <Phone className="w-3 h-3" />
                  07388209102
                </a>
                <a href="mailto:contact@stakeyscycles.com" className="hover:underline flex items-center gap-1">
                  <Mail className="w-3 h-3" />
                  contact@stakeyscycles.com
                </a>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
