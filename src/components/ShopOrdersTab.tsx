import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ShoppingBag,
  RefreshCw,
  CheckCircle,
  X,
  Copy,
  Trash2,
  Phone,
  Mail,
  MapPin,
  Truck,
  Package,
  AlertCircle,
  ArrowRight,
  MessageCircle,
  PoundSterling,
} from 'lucide-react';
import {
  ORDER_STATUSES,
  ORDER_STATUS_LABELS,
  FULFILMENT_LABELS,
  nextOrderStatus,
  type OrderStatus,
  type ShopOrder,
} from '../shared/data/websiteCatalog';
import {
  checkWebsiteTables,
  deleteWebsiteOrder,
  fetchWebsiteOrders,
  formatMoney,
  isMissingTable,
  orderItemCount,
  summariseOrderItems,
  subscribeToWebsiteShop,
  updateWebsiteOrderPaymentReference,
  updateWebsiteOrderStatus,
  type WebsiteTableStatus,
} from '../shared/api/websiteService';
import { buildWhatsAppUrl } from '../shared/utils/whatsapp';

function statusTone(status: OrderStatus): string {
  switch (status) {
    case 'pending':
      return 'bg-amber-950/60 text-amber-300 border-amber-800';
    case 'confirmed':
      return 'bg-sky-950/60 text-sky-300 border-sky-800';
    case 'paid':
      return 'bg-emerald-950/60 text-emerald-300 border-emerald-800';
    case 'ready':
      return 'bg-violet-950/60 text-violet-300 border-violet-800';
    case 'completed':
      return 'bg-neutral-800 text-neutral-300 border-neutral-700';
    case 'cancelled':
      return 'bg-rose-950/60 text-rose-300 border-rose-900';
  }
}

const FILTERS: { id: 'open' | 'all' | OrderStatus; label: string }[] = [
  { id: 'open', label: 'Needs action' },
  { id: 'all', label: 'All' },
  { id: 'pending', label: 'New' },
  { id: 'confirmed', label: 'Confirmed' },
  { id: 'paid', label: 'Paid' },
  { id: 'ready', label: 'Ready' },
  { id: 'completed', label: 'Completed' },
  { id: 'cancelled', label: 'Cancelled' },
];

const OPEN_STATUSES: OrderStatus[] = ['pending', 'confirmed', 'paid', 'ready'];

interface Props {
  onCountChange?: (count: number) => void;
}

export const ShopOrdersTab: React.FC<Props> = ({ onCountChange }) => {
  const [orders, setOrders] = useState<ShopOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tables, setTables] = useState<WebsiteTableStatus | null>(null);
  const [filter, setFilter] = useState<'open' | 'all' | OrderStatus>('open');
  const [flash, setFlash] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [status, rows] = await Promise.all([checkWebsiteTables(), fetchWebsiteOrders()]);
      setTables(status);
      setOrders(rows);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load website orders.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const unsubscribe = subscribeToWebsiteShop(load);
    const tick = setInterval(load, 60_000);
    return () => {
      unsubscribe();
      clearInterval(tick);
    };
  }, [load]);

  const openCount = useMemo(
    () => orders.filter((o) => OPEN_STATUSES.includes(o.status)).length,
    [orders]
  );

  useEffect(() => {
    onCountChange?.(openCount);
  }, [openCount, onCountChange]);

  const visible = useMemo(() => {
    if (filter === 'all') return orders;
    if (filter === 'open') return orders.filter((o) => OPEN_STATUSES.includes(o.status));
    return orders.filter((o) => o.status === filter);
  }, [orders, filter]);

  const advance = async (order: ShopOrder) => {
    const next = nextOrderStatus(order.status);
    if (!next) return;
    setBusyId(order.id);
    try {
      await updateWebsiteOrderStatus(order.id, next);
      setFlash(`Order ${order.id} moved to ${ORDER_STATUS_LABELS[next]}.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update the order.');
    } finally {
      setBusyId(null);
    }
  };

  const setStatus = async (order: ShopOrder, status: OrderStatus) => {
    setBusyId(order.id);
    try {
      await updateWebsiteOrderStatus(order.id, status);
      setFlash(`Order ${order.id} set to ${ORDER_STATUS_LABELS[status]}.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update the order.');
    } finally {
      setBusyId(null);
    }
  };

  const saveReference = async (order: ShopOrder, reference: string) => {
    try {
      await updateWebsiteOrderPaymentReference(order.id, reference);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the payment reference.');
    }
  };

  const remove = async (order: ShopOrder) => {
    if (!window.confirm(`Delete order ${order.id}? This cannot be undone.`)) return;
    setBusyId(order.id);
    try {
      await deleteWebsiteOrder(order.id);
      setFlash(`Order ${order.id} deleted.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete the order.');
    } finally {
      setBusyId(null);
    }
  };

  const copy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setFlash(`${label} copied.`);
    } catch {
      setError('Could not copy to the clipboard.');
    }
  };

  const paymentMessage = (order: ShopOrder) =>
    `Hi ${order.customerName.split(' ')[0] || 'there'}, thanks for your order ${order.id} with Stakey's Cycles. ` +
    `Your total is ${formatMoney(order.subtotal)} for ${summariseOrderItems(order)}. ` +
    `How would you like to pay — card payment link or bank transfer?`;

  const missing = tables && !tables.orders;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-black text-white flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-emerald-400" /> Website Orders
          </h2>
          <p className="text-xs text-neutral-400 mt-0.5">
            Shop orders customers submit on the website. Arrange payment, then move each order
            through to collection or delivery.
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          className="pressable flex items-center gap-2 rounded-xl border border-neutral-800 px-3.5 py-2 text-xs font-bold text-neutral-300 hover:bg-neutral-900"
        >
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {flash && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-800 bg-emerald-950/50 px-3 py-2 text-xs text-emerald-300">
          <CheckCircle className="w-4 h-4" /> {flash}
        </div>
      )}
      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-rose-900 bg-rose-950/50 px-3 py-2 text-xs text-rose-300">
          <AlertCircle className="w-4 h-4" /> {error}
        </div>
      )}

      {missing ? (
        <div className="rounded-2xl border border-dashed border-neutral-800 bg-neutral-950/60 p-8 text-center">
          <Package className="w-8 h-8 text-neutral-700 mx-auto" />
          <p className="mt-2 text-sm text-neutral-300">The website shop tables are not set up yet.</p>
          <p className="mt-1 text-xs text-neutral-500">
            Open <span className="font-semibold text-neutral-400">Shop Manager</span> and run the
            one-time website setup. Orders will appear here as soon as customers check out.
          </p>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap gap-1.5">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFilter(f.id)}
                className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition ${
                  filter === f.id
                    ? 'bg-emerald-600 text-white'
                    : 'bg-neutral-900 text-neutral-400 hover:text-neutral-200'
                }`}
              >
                {f.label}
                {f.id === 'open' && openCount > 0 ? ` (${openCount})` : ''}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="rounded-2xl border border-neutral-800 bg-neutral-950 p-8 text-center text-sm text-neutral-500">
              Loading orders…
            </div>
          ) : visible.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-neutral-800 bg-neutral-950/60 p-8 text-center">
              <ShoppingBag className="w-8 h-8 text-neutral-700 mx-auto" />
              <p className="mt-2 text-sm text-neutral-400">
                {filter === 'open' ? 'No orders need action right now.' : 'No orders in this view.'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {visible.map((order) => {
                const next = nextOrderStatus(order.status);
                const expanded = expandedId === order.id;
                return (
                  <div
                    key={order.id}
                    className="rounded-2xl border border-neutral-800 bg-neutral-950 p-4 space-y-3"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm font-black text-white">{order.id}</span>
                          <span
                            className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${statusTone(order.status)}`}
                          >
                            {ORDER_STATUS_LABELS[order.status]}
                          </span>
                        </div>
                        <div className="mt-1 text-sm font-semibold text-neutral-200">
                          {order.customerName}
                        </div>
                        <div className="text-xs text-neutral-500">
                          {new Date(order.createdAt).toLocaleString('en-GB')} ·{' '}
                          {orderItemCount(order)} item{orderItemCount(order) === 1 ? '' : 's'}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-black text-emerald-400">
                          {formatMoney(order.subtotal)}
                        </div>
                        <div className="text-[11px] text-neutral-500 flex items-center justify-end gap-1">
                          {order.fulfilment === 'collection' ? (
                            <Package className="w-3 h-3" />
                          ) : (
                            <Truck className="w-3 h-3" />
                          )}
                          {FULFILMENT_LABELS[order.fulfilment]}
                        </div>
                      </div>
                    </div>

                    <div className="rounded-xl bg-neutral-900/60 px-3 py-2 text-xs text-neutral-300">
                      {summariseOrderItems(order)}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {next && order.status !== 'cancelled' && (
                        <button
                          type="button"
                          disabled={busyId === order.id}
                          onClick={() => advance(order)}
                          className="pressable flex items-center gap-1.5 rounded-lg bg-emerald-600 px-2.5 py-1.5 text-[11px] font-bold text-white hover:bg-emerald-500 disabled:opacity-50"
                        >
                          <ArrowRight className="w-3.5 h-3.5" />
                          Mark {ORDER_STATUS_LABELS[next]}
                        </button>
                      )}
                      <a
                        href={buildWhatsAppUrl(paymentMessage(order))}
                        target="_blank"
                        rel="noreferrer"
                        className="pressable flex items-center gap-1.5 rounded-lg bg-[#25D366] px-2.5 py-1.5 text-[11px] font-bold text-neutral-950 hover:brightness-110"
                      >
                        <MessageCircle className="w-3.5 h-3.5" /> Payment request
                      </a>
                      <a
                        href={`tel:${order.customerPhone}`}
                        className="pressable flex items-center gap-1.5 rounded-lg border border-neutral-800 px-2.5 py-1.5 text-[11px] font-semibold text-neutral-300 hover:bg-neutral-900"
                      >
                        <Phone className="w-3.5 h-3.5" /> Call
                      </a>
                      {order.customerEmail && (
                        <a
                          href={`mailto:${order.customerEmail}?subject=${encodeURIComponent(
                            `Your Stakey's Cycles order ${order.id}`
                          )}`}
                          className="pressable flex items-center gap-1.5 rounded-lg border border-neutral-800 px-2.5 py-1.5 text-[11px] font-semibold text-neutral-300 hover:bg-neutral-900"
                        >
                          <Mail className="w-3.5 h-3.5" /> Email
                        </a>
                      )}
                      <button
                        type="button"
                        onClick={() => setExpandedId(expanded ? null : order.id)}
                        className="pressable ml-auto rounded-lg border border-neutral-800 px-2.5 py-1.5 text-[11px] font-semibold text-neutral-400 hover:bg-neutral-900"
                      >
                        {expanded ? 'Hide details' : 'Details'}
                      </button>
                    </div>

                    {expanded && (
                      <div className="space-y-3 border-t border-neutral-900 pt-3">
                        <div className="grid gap-2 text-xs text-neutral-300 sm:grid-cols-2">
                          <div className="flex items-center gap-2">
                            <Phone className="w-3.5 h-3.5 text-neutral-500" />
                            <a href={`tel:${order.customerPhone}`} className="hover:text-white">
                              {order.customerPhone}
                            </a>
                          </div>
                          {order.customerEmail && (
                            <div className="flex items-center gap-2">
                              <Mail className="w-3.5 h-3.5 text-neutral-500" />
                              <a
                                href={`mailto:${order.customerEmail}`}
                                className="truncate hover:text-white"
                              >
                                {order.customerEmail}
                              </a>
                            </div>
                          )}
                          {(order.address || order.postcode) && (
                            <div className="flex items-center gap-2 sm:col-span-2">
                              <MapPin className="w-3.5 h-3.5 text-neutral-500" />
                              <span>
                                {order.address} {order.postcode}
                              </span>
                            </div>
                          )}
                        </div>

                        {order.notes && (
                          <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 px-3 py-2 text-xs text-neutral-300">
                            <span className="font-semibold text-neutral-400">Notes: </span>
                            {order.notes}
                          </div>
                        )}

                        <div className="overflow-hidden rounded-xl border border-neutral-800">
                          <table className="w-full text-left text-xs">
                            <thead className="bg-neutral-900/60 text-neutral-400">
                              <tr>
                                <th className="px-3 py-1.5 font-semibold">Item</th>
                                <th className="px-3 py-1.5 text-center font-semibold">Qty</th>
                                <th className="px-3 py-1.5 text-right font-semibold">Price</th>
                                <th className="px-3 py-1.5 text-right font-semibold">Line</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-neutral-900">
                              {order.items.map((item) => (
                                <tr key={item.id}>
                                  <td className="px-3 py-1.5 text-neutral-200">{item.name}</td>
                                  <td className="px-3 py-1.5 text-center text-neutral-400">
                                    {item.quantity}
                                  </td>
                                  <td className="px-3 py-1.5 text-right text-neutral-400">
                                    {formatMoney(item.unitPrice)}
                                  </td>
                                  <td className="px-3 py-1.5 text-right font-semibold text-neutral-200">
                                    {formatMoney(item.unitPrice * item.quantity)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                            <tfoot className="bg-neutral-900/60">
                              <tr>
                                <td className="px-3 py-1.5 font-bold text-neutral-300" colSpan={3}>
                                  Subtotal
                                </td>
                                <td className="px-3 py-1.5 text-right font-black text-emerald-400">
                                  {formatMoney(order.subtotal)}
                                </td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>

                        <div className="flex flex-wrap items-end gap-2">
                          <label className="flex-1 min-w-[180px] text-[11px] text-neutral-400">
                            Payment reference
                            <div className="mt-1 flex items-center gap-1.5">
                              <PoundSterling className="w-3.5 h-3.5 text-neutral-600" />
                              <input
                                defaultValue={order.paymentReference}
                                onBlur={(e) => saveReference(order, e.target.value.trim())}
                                placeholder="e.g. bank ref or link id"
                                className="w-full rounded-lg border border-neutral-800 bg-neutral-900 px-2.5 py-1.5 text-xs text-neutral-200 outline-none focus:border-emerald-700"
                              />
                            </div>
                          </label>
                          <button
                            type="button"
                            onClick={() =>
                              copy(`${order.id} — ${formatMoney(order.subtotal)}`, 'Order summary')
                            }
                            className="pressable flex items-center gap-1.5 rounded-lg border border-neutral-800 px-2.5 py-1.5 text-[11px] font-semibold text-neutral-300 hover:bg-neutral-900"
                          >
                            <Copy className="w-3.5 h-3.5" /> Copy summary
                          </button>
                          <button
                            type="button"
                            disabled={busyId === order.id}
                            onClick={() => setStatus(order, 'cancelled')}
                            className="pressable flex items-center gap-1.5 rounded-lg border border-rose-900 px-2.5 py-1.5 text-[11px] font-semibold text-rose-400 hover:bg-rose-950/60 disabled:opacity-50"
                          >
                            <X className="w-3.5 h-3.5" /> Cancel order
                          </button>
                          <button
                            type="button"
                            disabled={busyId === order.id}
                            onClick={() => remove(order)}
                            className="pressable flex items-center gap-1.5 rounded-lg border border-neutral-800 px-2.5 py-1.5 text-[11px] font-semibold text-neutral-500 hover:bg-neutral-900 hover:text-rose-400 disabled:opacity-50"
                          >
                            <Trash2 className="w-3.5 h-3.5" /> Delete
                          </button>
                        </div>

                        <div className="flex flex-wrap gap-1.5">
                          <span className="text-[10px] uppercase tracking-wide text-neutral-600">
                            Set status:
                          </span>
                          {ORDER_STATUSES.map((s) => (
                            <button
                              key={s}
                              type="button"
                              disabled={busyId === order.id || s === order.status}
                              onClick={() => setStatus(order, s)}
                              className={`rounded-md px-2 py-0.5 text-[10px] font-semibold ${
                                s === order.status
                                  ? 'bg-neutral-800 text-neutral-200'
                                  : 'bg-neutral-900 text-neutral-500 hover:text-neutral-200'
                              } disabled:cursor-default`}
                            >
                              {ORDER_STATUS_LABELS[s]}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ShopOrdersTab;
