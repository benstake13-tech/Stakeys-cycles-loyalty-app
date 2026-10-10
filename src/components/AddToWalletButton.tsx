import React, { useEffect, useState } from 'react';
import { Wallet } from 'lucide-react';
import { UserProfile } from '../types/bikeShop';

interface AddToWalletButtonProps {
  user: UserProfile;
}

interface WalletConfig {
  apple: { configured: boolean; passTypeId?: string | null };
  google: { configured: boolean; issuerId?: string | null };
}

/**
 * "Add to Wallet" control for the membership pass.
 *
 * The buttons only appear when the matching provider is configured on the
 * deployment (checked via `/api/wallet/config`); when nothing is configured the
 * control renders nothing, so no dead button is ever shown. Signing happens
 * server-side — the client never sees a certificate or key.
 */
export const AddToWalletButton: React.FC<AddToWalletButtonProps> = ({ user }) => {
  const [config, setConfig] = useState<WalletConfig | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/wallet/config')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && data) setConfig(data);
      })
      .catch(() => {
        // Unconfigured (offline / static preview) — simply show nothing.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!config || (!config.apple.configured && !config.google.configured)) return null;

  const addGoogle = async () => {
    setBusy(true);
    try {
      const res = await fetch('/api/wallet/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          member: {
            membershipNumber: user.membershipNumber,
            displayName: user.displayName,
            stamps: user.stamps || 0,
          },
        }),
      });
      const data = await res.json();
      if (res.ok && data.url) {
        window.open(data.url, '_blank', 'noopener');
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2" data-testid="add-to-wallet">
      {config.apple.configured && (
        <a
          href={`/api/wallet/apple?membership=${encodeURIComponent(user.membershipNumber)}&name=${encodeURIComponent(user.displayName)}&stamps=${user.stamps || 0}&points=${user.points || 0}`}
          className="inline-flex items-center gap-2 rounded-lg bg-neutral-950 px-3.5 py-2 text-xs font-bold text-white hover:bg-neutral-800"
        >
          <Wallet className="w-4 h-4" /> Add to Apple Wallet
        </a>
      )}
      {config.google.configured && (
        <button
          type="button"
          onClick={addGoogle}
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-lg bg-neutral-950 px-3.5 py-2 text-xs font-bold text-white hover:bg-neutral-800 disabled:opacity-50 cursor-pointer"
        >
          <Wallet className="w-4 h-4" /> Add to Google Wallet
        </button>
      )}
    </div>
  );
};

export default AddToWalletButton;
