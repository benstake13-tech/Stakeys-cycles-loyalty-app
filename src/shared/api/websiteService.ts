/**
 * Read/write access to the website's shop + gallery tables from the terminal.
 *
 * The website (`Stakeys-cycles`) writes `orders`/`order_items` and reads
 * published `products`/`gallery_items`. Staff do the reverse here: read the
 * orders, and own the catalogue and gallery.
 */

import { getSupabaseClient } from '../supabase';
import {
  asFulfilment,
  asOrderStatus,
  GALLERY_BUCKET,
  PRODUCT_IMAGES_BUCKET,
  WEBSITE_SETUP_SQL,
  type GalleryItem,
  type GalleryItemRow,
  type ShopOrder,
  type ShopOrderItem,
  type ShopOrderItemRow,
  type ShopOrderRow,
  type ShopProduct,
  type ShopProductRow,
  type OrderStatus,
} from '../data/websiteCatalog';

const PRODUCTS = 'products';
const ORDERS = 'orders';
const ORDER_ITEMS = 'order_items';
const GALLERY = 'gallery_items';

function num(value: number | string | null | undefined): number {
  if (value === null || value === undefined) return 0;
  const n = typeof value === 'string' ? Number.parseFloat(value) : value;
  return Number.isFinite(n) ? n : 0;
}

/** The website's tables may not exist until its setup SQL has been run. */
export function isMissingTable(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  const message = error.message ?? '';
  return (
    error.code === 'PGRST205' ||
    error.code === '42P01' ||
    message.includes('schema cache') ||
    message.includes('does not exist')
  );
}

function requireClient() {
  const client = getSupabaseClient();
  if (!client) throw new Error('Supabase is not configured in this app.');
  return client;
}

function toProduct(row: ShopProductRow): ShopProduct {
  return {
    id: row.id,
    name: row.name ?? '',
    description: row.description ?? '',
    category: row.category ?? 'Other',
    price: num(row.price),
    wasPrice:
      row.was_price === null || row.was_price === undefined ? undefined : num(row.was_price),
    stock: row.stock ?? 0,
    imageUrl: row.image_url ?? '',
    condition: row.condition ?? 'Used',
    sku: row.sku ?? '',
    published: row.published ?? false,
    sortOrder: row.sort_order ?? 0,
    createdAt: row.created_at ?? undefined,
  };
}

function toOrderItem(row: ShopOrderItemRow): ShopOrderItem {
  return {
    id: row.id,
    orderId: row.order_id,
    productId: row.product_id ?? '',
    name: row.name ?? '',
    unitPrice: num(row.unit_price),
    quantity: row.quantity ?? 1,
  };
}

function toOrder(row: ShopOrderRow, items: ShopOrderItem[]): ShopOrder {
  return {
    id: row.id,
    customerName: row.customer_name ?? '',
    customerPhone: row.customer_phone ?? '',
    customerEmail: row.customer_email ?? '',
    fulfilment: asFulfilment(row.fulfilment),
    address: row.address ?? '',
    postcode: row.postcode ?? '',
    notes: row.notes ?? '',
    subtotal: num(row.subtotal),
    status: asOrderStatus(row.status),
    paymentMethod: row.payment_method ?? 'payment_link',
    paymentReference: row.payment_reference ?? '',
    createdAt: row.created_at ?? '',
    items,
  };
}

function toGalleryItem(row: GalleryItemRow): GalleryItem {
  return {
    id: row.id,
    imageUrl: row.image_url ?? '',
    title: row.title ?? '',
    caption: row.caption ?? '',
    vehicleType: row.vehicle_type ?? '',
    sortOrder: row.sort_order ?? 0,
    published: row.published ?? true,
    createdAt: row.created_at ?? '',
  };
}

/** Run the website schema. Returns a plain error message when the database refuses. */
export async function provisionWebsiteSchema(): Promise<void> {
  const client = requireClient();
  const { error } = await client.rpc('exec_sql', { sql: WEBSITE_SETUP_SQL });
  if (!error) return;

  // exec_sql is not installed on this project, which is the normal case. The
  // SQL is idempotent and shown in the modal for a one-time paste instead.
  if (isMissingTable(error) || /function|schema cache|does not exist/i.test(error.message)) {
    throw new Error('SQL_RPC_UNAVAILABLE');
  }
  throw new Error(error.message);
}

export interface WebsiteTableStatus {
  products: boolean;
  orders: boolean;
  gallery: boolean;
}

/**
 * Which of the website's tables exist in the live project. The website's setup
 * SQL may never have been run, in which case the terminal offers to provision
 * it rather than showing a silent empty state.
 */
export async function checkWebsiteTables(): Promise<WebsiteTableStatus> {
  const client = getSupabaseClient();
  if (!client) return { products: false, orders: false, gallery: false };

  const probe = async (table: string): Promise<boolean> => {
    const { error } = await client.from(table).select('id').limit(1);
    return !isMissingTable(error);
  };

  const [products, orders, gallery] = await Promise.all([
    probe(PRODUCTS),
    probe(ORDERS),
    probe(GALLERY),
  ]);
  return { products, orders, gallery };
}

// ------------------------------------------------------------------ products --

export async function fetchWebsiteProducts(): Promise<ShopProduct[]> {
  const { data, error } = await requireClient()
    .from(PRODUCTS)
    .select('*')
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false });
  if (error) {
    if (isMissingTable(error)) return [];
    throw new Error(error.message);
  }
  return (data ?? []).map((row) => toProduct(row as ShopProductRow));
}

export async function saveWebsiteProduct(product: ShopProduct): Promise<void> {
  const { error } = await requireClient().from(PRODUCTS).upsert({
    id: product.id,
    name: product.name,
    description: product.description,
    category: product.category,
    price: product.price,
    was_price: product.wasPrice ?? null,
    stock: product.stock,
    image_url: product.imageUrl,
    condition: product.condition,
    sku: product.sku,
    published: product.published,
    sort_order: product.sortOrder,
    updated_at: new Date().toISOString(),
  });
  if (error) throw new Error(error.message);
}

export async function deleteWebsiteProduct(id: string): Promise<void> {
  const { error } = await requireClient().from(PRODUCTS).delete().eq('id', id);
  if (error) throw new Error(error.message);
}

export async function setWebsiteProductPublished(id: string, published: boolean): Promise<void> {
  const { error } = await requireClient()
    .from(PRODUCTS)
    .update({ published, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw new Error(error.message);
}

// -------------------------------------------------------------------- orders --

export async function fetchWebsiteOrders(): Promise<ShopOrder[]> {
  const client = requireClient();
  const { data, error } = await client
    .from(ORDERS)
    .select('*')
    .order('created_at', { ascending: false });
  if (error) {
    if (isMissingTable(error)) return [];
    throw new Error(error.message);
  }

  const orders = (data ?? []) as ShopOrderRow[];
  if (orders.length === 0) return [];

  const { data: itemRows, error: itemsError } = await client
    .from(ORDER_ITEMS)
    .select('*')
    .in(
      'order_id',
      orders.map((o) => o.id)
    );
  if (itemsError && !isMissingTable(itemsError)) throw new Error(itemsError.message);

  const byOrder = new Map<string, ShopOrderItem[]>();
  for (const row of (itemRows ?? []) as ShopOrderItemRow[]) {
    const list = byOrder.get(row.order_id) ?? [];
    list.push(toOrderItem(row));
    byOrder.set(row.order_id, list);
  }

  return orders.map((row) => toOrder(row, byOrder.get(row.id) ?? []));
}

export async function updateWebsiteOrderStatus(id: string, status: OrderStatus): Promise<void> {
  const { error } = await requireClient().from(ORDERS).update({ status }).eq('id', id);
  if (error) throw new Error(error.message);
}

export async function updateWebsiteOrderPaymentReference(
  id: string,
  reference: string
): Promise<void> {
  const { error } = await requireClient()
    .from(ORDERS)
    .update({ payment_reference: reference })
    .eq('id', id);
  if (error) throw new Error(error.message);
}

export async function deleteWebsiteOrder(id: string): Promise<void> {
  const client = requireClient();
  // order_items has ON DELETE CASCADE, but remove them explicitly so the
  // delete still succeeds if that constraint is missing on an older schema.
  await client.from(ORDER_ITEMS).delete().eq('order_id', id);
  const { error } = await client.from(ORDERS).delete().eq('id', id);
  if (error) throw new Error(error.message);
}

// ------------------------------------------------------------------- gallery --

export async function fetchGalleryItems(): Promise<GalleryItem[]> {
  const { data, error } = await requireClient()
    .from(GALLERY)
    .select('*')
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false });
  if (error) {
    if (isMissingTable(error)) return [];
    throw new Error(error.message);
  }
  return (data ?? []).map((row) => toGalleryItem(row as GalleryItemRow));
}

export async function saveGalleryItem(item: GalleryItem): Promise<void> {
  const { error } = await requireClient().from(GALLERY).upsert({
    id: item.id,
    image_url: item.imageUrl,
    title: item.title,
    caption: item.caption,
    vehicle_type: item.vehicleType,
    sort_order: item.sortOrder,
    published: item.published,
  });
  if (error) throw new Error(error.message);
}

export async function deleteGalleryItem(id: string): Promise<void> {
  const { error } = await requireClient().from(GALLERY).delete().eq('id', id);
  if (error) throw new Error(error.message);
}

// ------------------------------------------------------------------- uploads --

const EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/avif': 'avif',
};

/**
 * Upload a product or job photo to a public bucket and return its URL.
 * Files are namespaced by timestamp so an upload never overwrites another.
 */
export async function uploadWebsiteImage(
  bucket: typeof PRODUCT_IMAGES_BUCKET | typeof GALLERY_BUCKET,
  file: File
): Promise<string> {
  const client = requireClient();
  const ext =
    EXTENSIONS[file.type] ??
    (file.name.includes('.') ? file.name.split('.').pop()!.toLowerCase() : 'jpg');
  const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const { error } = await client.storage.from(bucket).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type || undefined,
  });
  if (error) throw new Error(error.message);

  const { data } = client.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

// ------------------------------------------------------------------ realtime --

/** Fires whenever the website writes an order or staff change the catalogue. */
export function subscribeToWebsiteShop(onChange: () => void): () => void {
  const client = getSupabaseClient();
  if (!client) return () => {};
  const channel = client
    .channel('website_shop_changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: ORDERS }, () => onChange())
    .on('postgres_changes', { event: '*', schema: 'public', table: PRODUCTS }, () => onChange())
    .on('postgres_changes', { event: '*', schema: 'public', table: GALLERY }, () => onChange())
    .subscribe();
  return () => {
    client.removeChannel(channel);
  };
}

// ------------------------------------------------------------------- helpers --

export function formatMoney(value: number): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: value % 1 === 0 ? 0 : 2,
  }).format(value);
}

/** Order lines collapsed into a one-line summary for list rows. */
export function summariseOrderItems(order: ShopOrder): string {
  if (order.items.length === 0) return 'No items recorded';
  return order.items.map((i) => `${i.quantity}× ${i.name}`).join(', ');
}

export function orderItemCount(order: ShopOrder): number {
  return order.items.reduce((n, i) => n + i.quantity, 0);
}
