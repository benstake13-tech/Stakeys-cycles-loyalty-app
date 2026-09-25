import React, { useState } from 'react';
import {
  Code,
  Shield,
  Database,
  Layers,
  Copy,
  Check,
  FileCode,
  Lock,
  Server,
  Terminal,
} from 'lucide-react';
import { useShop } from '../context/ShopContext';
import { POCKETBASE_URL } from '../pocketbase';

export const DeliverablesViewer: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'rules' | 'service' | 'schema' | 'guide'>('rules');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const { users, prizeWheels, draws, stampLogs } = useShop();

  const handleCopy = (key: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const pocketbaseRulesGuide = `// POCKETBASE API ACCESS RULES (Enforced at http://127.0.0.1:8080)

1. "users" Collection (Auth type)
   - listRule:   @request.auth.id = id || @request.auth.role = 'staff' || @request.auth.role = 'admin'
   - viewRule:   @request.auth.id = id || @request.auth.role = 'staff' || @request.auth.role = 'admin'
   - createRule: "" (Public registration allowed for new customers)
   - updateRule: @request.auth.role = 'staff' || @request.auth.role = 'admin' || (@request.auth.id = id && @request.data.role:isset = false && @request.data.stamps:isset = false && @request.data.tickets:isset = false && @request.data.membershipNumber:isset = false)
   - deleteRule: @request.auth.role = 'admin'
   * Note: Customers CANNOT tamper with their own stamps, tickets, membershipNumber, or role!

2. "prize_wheels" Collection (Base type)
   - listRule:   @request.auth.id != "" && (active = true || @request.auth.role = 'staff' || @request.auth.role = 'admin')
   - viewRule:   @request.auth.id != "" && (active = true || @request.auth.role = 'staff' || @request.auth.role = 'admin')
   - createRule: @request.auth.role = 'staff' || @request.auth.role = 'admin'
   - updateRule: @request.auth.role = 'staff' || @request.auth.role = 'admin'
   - deleteRule: @request.auth.role = 'admin'

3. "draws" Collection (Base type)
   - listRule:   @request.auth.id != ""
   - viewRule:   @request.auth.id != ""
   - createRule: @request.auth.role = 'staff' || @request.auth.role = 'admin'
   - updateRule: @request.auth.role = 'staff' || @request.auth.role = 'admin'
   - deleteRule: @request.auth.role = 'admin'

4. "stamp_logs" Collection (Base type - Immutable Audit Trail)
   - listRule:   customerId = @request.auth.id || @request.auth.role = 'staff' || @request.auth.role = 'admin'
   - viewRule:   customerId = @request.auth.id || @request.auth.role = 'staff' || @request.auth.role = 'admin'
   - createRule: @request.auth.role = 'staff' || @request.auth.role = 'admin'
   - updateRule: null (Locked / Immutable audit records)
   - deleteRule: null (Locked / Immutable audit records)`;

  const pocketbaseClientServiceCode = `/**
 * PocketBase Modular Service for Stakey's Cycles
 * Server: http://127.0.0.1:8080
 */
import PocketBase from 'pocketbase';

export const pb = new PocketBase('http://127.0.0.1:8080');

// 1. Authenticate with Email & Password
export async function loginCustomer(email, password) {
  const authData = await pb.collection('users').authWithPassword(email, password);
  return authData.record;
}

// 2. Register Customer with generated membership number
export async function registerCustomer(email, password, name) {
  const randomSixDigits = Math.floor(100000 + Math.random() * 900000);
  const membershipNumber = \`STK-\${randomSixDigits}\`;

  const record = await pb.collection('users').create({
    email,
    password,
    passwordConfirm: password,
    name,
    membershipNumber,
    role: 'customer',
    stamps: 0,
    tickets: 0,
  });

  return record;
}

// 3. Add Stamp to Customer (with daily rate-limiting & 10-stamp rewards)
export async function addStampToCustomer(customerId, staffId, bypassRateLimit = false) {
  const customer = await pb.collection('users').getOne(customerId);

  // 1-visit-per-day rate limit
  if (!bypassRateLimit && customer.lastStampedAt) {
    const lastStamped = new Date(customer.lastStampedAt);
    const now = new Date();
    if (
      lastStamped.getFullYear() === now.getFullYear() &&
      lastStamped.getMonth() === now.getMonth() &&
      lastStamped.getDate() === now.getDate()
    ) {
      throw new Error('Daily Rate Limit: 1 stamp per day allowed.');
    }
  }

  const currentStamps = Number(customer.stamps || 0);
  const currentTickets = Number(customer.tickets || 0);

  let nextStamps = currentStamps + 1;
  let nextTickets = currentTickets;
  let cardCompleted = false;

  // 10th Stamp milestone
  if (nextStamps >= 10) {
    nextStamps = 0; // Reset card
    nextTickets += 1; // Award +1 Prize Draw ticket
    cardCompleted = true;
  }

  // Update customer record
  await pb.collection('users').update(customerId, {
    stamps: nextStamps,
    tickets: nextTickets,
    lastStampedAt: new Date().toISOString(),
  });

  // Write immutable audit log to stamp_logs
  await pb.collection('stamp_logs').create({
    customerId,
    customerName: customer.name,
    membershipNumber: customer.membershipNumber,
    staffId,
    action: 'add_stamp',
    stampsBefore: currentStamps,
    stampsAfter: nextStamps,
    ticketsAwarded: cardCompleted ? 1 : 0,
    note: cardCompleted ? 'Completed 10-stamp card (+1 Ticket)' : 'Visit stamp added',
  });

  return { success: true, nextStamps, nextTickets, cardCompleted };
}

// 4. Run Periodic Prize Draw
export async function runPrizeDraw(drawId) {
  const draw = await pb.collection('draws').getOne(drawId);
  const ticketHolders = await pb.collection('users').getFullList({
    filter: "role = 'customer' && tickets > 0",
  });

  if (ticketHolders.length === 0) {
    throw new Error('No eligible customers with tickets > 0 found.');
  }

  // Create weighted ticket pool
  const pool = [];
  ticketHolders.forEach((user) => {
    const count = Math.max(1, user.tickets || 1);
    for (let i = 0; i < count; i++) pool.push(user);
  });

  const winner = pool[Math.floor(Math.random() * pool.length)];

  await pb.collection('draws').update(drawId, {
    status: 'completed',
    winnerId: winner.id,
    winnerName: winner.name,
    winnerMembershipNumber: winner.membershipNumber,
  });

  return { drawId, winner, totalEntries: pool.length };
}`;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-400">
            <Server className="w-4 h-4 text-emerald-500" />
            PocketBase Deliverables & Architecture
          </div>
          <h2 className="text-2xl font-black text-white mt-1">PocketBase Exclusively (127.0.0.1:8080)</h2>
          <p className="text-xs text-neutral-400 mt-0.5">
            Target backend: <code className="text-emerald-400 font-mono">{POCKETBASE_URL}</code> • API Rules, pb_schema.json, and SDK client.
          </p>
        </div>

        {/* Tab Selector */}
        <div className="flex flex-wrap items-center gap-1.5 bg-neutral-950 p-1.5 rounded-2xl border border-neutral-800 text-xs">
          <button
            onClick={() => setActiveTab('rules')}
            className={`px-3 py-1.5 rounded-xl font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'rules'
                ? 'bg-emerald-500 text-neutral-950 shadow-md shadow-emerald-500/20'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            PocketBase API Rules
          </button>

          <button
            onClick={() => setActiveTab('service')}
            className={`px-3 py-1.5 rounded-xl font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'service'
                ? 'bg-emerald-500 text-neutral-950 shadow-md shadow-emerald-500/20'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <Code className="w-3.5 h-3.5" />
            pocketbaseService.ts
          </button>

          <button
            onClick={() => setActiveTab('schema')}
            className={`px-3 py-1.5 rounded-xl font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'schema'
                ? 'bg-emerald-500 text-neutral-950 shadow-md shadow-emerald-500/20'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            pb_schema.json
          </button>

          <button
            onClick={() => setActiveTab('guide')}
            className={`px-3 py-1.5 rounded-xl font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'guide'
                ? 'bg-emerald-500 text-neutral-950 shadow-md shadow-emerald-500/20'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            PocketBase Setup Guide
          </button>
        </div>
      </div>

      {/* Tab 1: PocketBase API Rules */}
      {activeTab === 'rules' && (
        <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Lock className="w-4 h-4 text-emerald-400" />
                PocketBase Declarative API Rules
              </h3>
              <p className="text-xs text-neutral-400 mt-0.5">
                Customers can ONLY see their own personal user doc & audit records. Stamp modifications strictly restricted to staff/admin.
              </p>
            </div>
            <button
              onClick={() => handleCopy('rules', pocketbaseRulesGuide)}
              className="px-3 py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-xs font-semibold text-neutral-200 flex items-center gap-1.5 transition-all cursor-pointer"
            >
              {copiedKey === 'rules' ? (
                <Check className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
              <span>{copiedKey === 'rules' ? 'Copied' : 'Copy Rules'}</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs mb-2">
            <div className="p-3 rounded-2xl bg-neutral-950 border border-neutral-800">
              <span className="font-bold text-emerald-400 block mb-1">users</span>
              <p className="text-neutral-400">
                <code>@request.auth.id = id || @request.auth.role = 'staff'</code>
                <br />
                Customers only see their own profile.
              </p>
            </div>
            <div className="p-3 rounded-2xl bg-neutral-950 border border-neutral-800">
              <span className="font-bold text-emerald-400 block mb-1">prize_wheels</span>
              <p className="text-neutral-400">
                <code>active = true || @request.auth.role = 'staff'</code>
                <br />
                Customers read active wheels; staff manage.
              </p>
            </div>
            <div className="p-3 rounded-2xl bg-neutral-950 border border-neutral-800">
              <span className="font-bold text-sky-400 block mb-1">draws</span>
              <p className="text-neutral-400">
                <code>@request.auth.id != ""</code>
                <br />
                Upcoming and completed draws viewable by members.
              </p>
            </div>
            <div className="p-3 rounded-2xl bg-neutral-950 border border-neutral-800">
              <span className="font-bold text-purple-400 block mb-1">stamp_logs</span>
              <p className="text-neutral-400">
                <code>customerId = @request.auth.id</code>
                <br />
                Immutable audit trail. Customers see only their own visits.
              </p>
            </div>
          </div>

          <pre className="p-4 rounded-2xl bg-neutral-950 border border-neutral-800 font-mono text-xs text-neutral-200 overflow-x-auto leading-relaxed">
            {pocketbaseRulesGuide}
          </pre>
        </div>
      )}

      {/* Tab 2: pocketbaseService.ts */}
      {activeTab === 'service' && (
        <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Code className="w-4 h-4 text-emerald-400" />
                PocketBase Service API (`src/api/pocketbaseService.ts`)
              </h3>
              <p className="text-xs text-neutral-400 mt-0.5">
                Official PocketBase JavaScript SDK client configured for http://127.0.0.1:8080.
              </p>
            </div>
            <button
              onClick={() => handleCopy('service', pocketbaseClientServiceCode)}
              className="px-3 py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-xs font-semibold text-neutral-200 flex items-center gap-1.5 transition-all cursor-pointer"
            >
              {copiedKey === 'service' ? (
                <Check className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
              <span>{copiedKey === 'service' ? 'Copied' : 'Copy Service Code'}</span>
            </button>
          </div>

          <pre className="p-4 rounded-2xl bg-neutral-950 border border-neutral-800 font-mono text-xs text-neutral-200 overflow-x-auto leading-relaxed">
            {pocketbaseClientServiceCode}
          </pre>
        </div>
      )}

      {/* Tab 3: pb_schema.json */}
      {activeTab === 'schema' && (
        <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Database className="w-4 h-4 text-sky-400" />
                PocketBase Schema File (`pb_schema.json`)
              </h3>
              <p className="text-xs text-neutral-400 mt-0.5">
                Can be imported directly into PocketBase Admin UI under Settings → Import collections.
              </p>
            </div>
            <button
              onClick={() =>
                handleCopy(
                  'schema',
                  JSON.stringify(
                    [
                      { name: 'users', type: 'auth' },
                      { name: 'prize_wheels', type: 'base' },
                      { name: 'draws', type: 'base' },
                      { name: 'stamp_logs', type: 'base' },
                    ],
                    null,
                    2
                  )
                )
              }
              className="px-3 py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-xs font-semibold text-neutral-200 flex items-center gap-1.5 transition-all cursor-pointer"
            >
              {copiedKey === 'schema' ? (
                <Check className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
              <span>{copiedKey === 'schema' ? 'Copied' : 'Copy Schema'}</span>
            </button>
          </div>

          <div className="p-4 rounded-2xl bg-neutral-950 border border-neutral-800 space-y-3 text-xs">
            <div className="font-semibold text-emerald-400">Collections Defined in pb_schema.json:</div>
            <ul className="list-disc list-inside space-y-1.5 text-neutral-300">
              <li>
                <strong className="text-white font-mono">users (Auth)</strong>: `name`, `membershipNumber` (unique), `role` ('customer'|'staff'|'admin'), `stamps` (0-10), `tickets`, `lastStampedAt`
              </li>
              <li>
                <strong className="text-white font-mono">prize_wheels (Base)</strong>: `title`, `active`, `segments` (JSON)
              </li>
              <li>
                <strong className="text-white font-mono">draws (Base)</strong>: `title`, `prizeDescription`, `drawDate`, `status`, `winnerId`, `winnerName`, `winnerMembershipNumber`
              </li>
              <li>
                <strong className="text-white font-mono">stamp_logs (Base)</strong>: `customerId`, `customerName`, `membershipNumber`, `staffId`, `staffName`, `action`, `stampsBefore`, `stampsAfter`, `ticketsAwarded`, `note`
              </li>
            </ul>
          </div>
        </div>
      )}

      {/* Tab 4: Setup Guide */}
      {activeTab === 'guide' && (
        <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6 shadow-xl space-y-4">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Terminal className="w-4 h-4 text-emerald-400" />
            Quick Setup: Running PocketBase at http://127.0.0.1:8080
          </h3>

          <div className="space-y-4 text-xs text-neutral-300 leading-relaxed">
            <div className="p-4 rounded-2xl bg-neutral-950 border border-neutral-800 space-y-2">
              <div className="font-bold text-white">Step 1: Download & Run PocketBase</div>
              <p className="text-neutral-400">
                Download the single binary from{' '}
                <a
                  href="https://pocketbase.io/docs/"
                  target="_blank"
                  rel="noreferrer"
                  className="text-emerald-400 underline"
                >
                  pocketbase.io
                </a>{' '}
                and launch it on port 8080:
              </p>
              <pre className="p-2.5 bg-neutral-900 rounded-lg text-emerald-400 font-mono text-[11px]">
                ./pocketbase serve --http="127.0.0.1:8080"
              </pre>
            </div>

            <div className="p-4 rounded-2xl bg-neutral-950 border border-neutral-800 space-y-2">
              <div className="font-bold text-white">Step 2: Import Collections Schema</div>
              <p className="text-neutral-400">
                Open <code className="text-emerald-400 font-mono">http://127.0.0.1:8080/_/</code> in your browser, create your admin account, go to <strong>Settings → Import collections</strong>, and paste the contents of <code className="text-white font-mono">pb_schema.json</code>.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-neutral-950 border border-neutral-800 space-y-2">
              <div className="font-bold text-white">Step 3: Instant Live Sync</div>
              <p className="text-neutral-400">
                This app will immediately connect to <code className="text-emerald-400 font-mono">http://127.0.0.1:8080</code> via the official PocketBase SDK. All customers, stamps, prize wheels, and periodic prize draws are synchronized in real time!
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
