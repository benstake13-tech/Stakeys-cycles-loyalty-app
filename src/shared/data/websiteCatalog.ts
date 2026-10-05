/**
 * The website shop + gallery, as the staff terminal sees it.
 *
 * The marketing site (repo `Stakeys-cycles`) owns these four tables:
 *
 *   products      catalogue shown on /shop
 *   orders        a customer's basket, submitted at checkout
 *   order_items   the lines inside one order
 *   gallery_items job photos shown on /gallery ("Our work")
 *
 * Customers write orders; staff read them here, arrange payment and move the
 * order along. Staff own products and gallery_items — the website only reads
 * published rows.
 *
 * The tables are created by the website's own setup SQL
 * (`supabase_shop_setup.sql` / `supabase_gallery_setup.sql`). `WEBSITE_SETUP_SQL`
 * below is the same schema, idempotent, so the terminal can provision the
 * backend from the Shop Manager when the website has not been set up yet.
 */

export type FulfilmentMethod = 'collection' | 'delivery' | 'postage';

export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'paid'
  | 'ready'
  | 'completed'
  | 'cancelled';

export interface ShopProduct {
  id: string;
  name: string;
  description: string;
  category: string;
  price: number;
  wasPrice?: number;
  stock: number;
  imageUrl: string;
  condition: string;
  sku: string;
  published: boolean;
  sortOrder: number;
  createdAt?: string;
}

export interface ShopProductRow {
  id: string;
  name: string | null;
  description: string | null;
  category: string | null;
  price: number | string | null;
  was_price: number | string | null;
  stock: number | null;
  image_url: string | null;
  condition: string | null;
  sku: string | null;
  published: boolean | null;
  sort_order: number | null;
  created_at: string | null;
}

export interface ShopOrder {
  id: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  fulfilment: FulfilmentMethod;
  address: string;
  postcode: string;
  notes: string;
  subtotal: number;
  status: OrderStatus;
  paymentMethod: string;
  paymentReference: string;
  createdAt: string;
  items: ShopOrderItem[];
}

export interface ShopOrderRow {
  id: string;
  customer_name: string | null;
  customer_phone: string | null;
  customer_email: string | null;
  fulfilment: string | null;
  address: string | null;
  postcode: string | null;
  notes: string | null;
  subtotal: number | string | null;
  status: string | null;
  payment_method: string | null;
  payment_reference: string | null;
  created_at: string | null;
}

export interface ShopOrderItem {
  id: string;
  orderId: string;
  productId: string;
  name: string;
  unitPrice: number;
  quantity: number;
}

export interface ShopOrderItemRow {
  id: string;
  order_id: string;
  product_id: string | null;
  name: string | null;
  unit_price: number | string | null;
  quantity: number | null;
}

export interface GalleryItem {
  id: string;
  imageUrl: string;
  title: string;
  caption: string;
  vehicleType: string;
  sortOrder: number;
  published: boolean;
  createdAt: string;
}

export interface GalleryItemRow {
  id: string;
  image_url: string | null;
  title: string | null;
  caption: string | null;
  vehicle_type: string | null;
  sort_order: number | null;
  published: boolean | null;
  created_at: string | null;
}

export const PRODUCT_IMAGES_BUCKET = 'product-images';
export const GALLERY_BUCKET = 'gallery';

export const PRODUCT_CONDITIONS = ['New', 'Used', 'Refurbished'] as const;

export const ORDER_STATUSES: OrderStatus[] = [
  'pending',
  'confirmed',
  'paid',
  'ready',
  'completed',
  'cancelled',
];

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending: 'New order',
  confirmed: 'Confirmed',
  paid: 'Paid',
  ready: 'Ready to collect',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

export const FULFILMENT_LABELS: Record<FulfilmentMethod, string> = {
  collection: 'Collection from Salford',
  delivery: 'Local delivery (Salford area)',
  postage: 'UK postage',
};

export function asFulfilment(value: string | null | undefined): FulfilmentMethod {
  return value === 'delivery' || value === 'postage' ? value : 'collection';
}

export function asOrderStatus(value: string | null | undefined): OrderStatus {
  return (ORDER_STATUSES as string[]).includes(value ?? '')
    ? (value as OrderStatus)
    : 'pending';
}

/**
 * Order fulfilment stages staff advance through, in order. Cancelling is a
 * separate action rather than a step.
 */
export const ORDER_PROGRESS: OrderStatus[] = [
  'pending',
  'confirmed',
  'paid',
  'ready',
  'completed',
];

export function nextOrderStatus(status: OrderStatus): OrderStatus | null {
  const i = ORDER_PROGRESS.indexOf(status);
  if (i === -1 || i === ORDER_PROGRESS.length - 1) return null;
  return ORDER_PROGRESS[i + 1];
}

/**
 * Idempotent schema for the four website tables, the two public storage
 * buckets and their policies. Mirrors the website's setup SQL exactly so the
 * two never disagree.
 */
export const WEBSITE_SETUP_SQL = `-- Stakey's Cycles — website shop + gallery schema (idempotent)
-- Safe to re-run. Mirrors supabase_shop_setup.sql / supabase_gallery_setup.sql.

create table if not exists public.products (
  id            text primary key,
  name          text not null,
  description   text,
  category      text,
  price         numeric(10, 2) not null default 0,
  was_price     numeric(10, 2),
  stock         integer not null default 0,
  image_url     text,
  condition     text default 'Used',
  sku           text,
  published     boolean not null default false,
  sort_order    integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table if not exists public.orders (
  id                text primary key,
  customer_name     text not null,
  customer_phone    text not null,
  customer_email    text,
  fulfilment        text not null default 'collection',
  address           text,
  postcode          text,
  notes             text,
  subtotal          numeric(10, 2) not null default 0,
  status            text not null default 'pending',
  payment_method    text not null default 'payment_link',
  payment_reference text,
  created_at        timestamptz not null default now()
);

create table if not exists public.order_items (
  id         text primary key,
  order_id   text not null references public.orders (id) on delete cascade,
  product_id text,
  name       text not null,
  unit_price numeric(10, 2) not null default 0,
  quantity   integer not null default 1,
  created_at timestamptz not null default now()
);

create table if not exists public.gallery_items (
  id            text primary key,
  image_url     text not null,
  title         text,
  caption       text,
  vehicle_type  text,
  sort_order    integer default 0,
  published     boolean default true,
  created_at    timestamptz default now()
);

create index if not exists products_published_idx
  on public.products (published, sort_order, created_at desc);
create index if not exists orders_created_idx on public.orders (created_at desc);
create index if not exists orders_status_idx on public.orders (status);
create index if not exists order_items_order_idx on public.order_items (order_id);
create index if not exists gallery_items_published_idx
  on public.gallery_items (published, sort_order, created_at desc);

alter table public.products      enable row level security;
alter table public.orders        enable row level security;
alter table public.order_items   enable row level security;
alter table public.gallery_items enable row level security;

drop policy if exists "Allow all on products" on public.products;
drop policy if exists "Allow all on orders" on public.orders;
drop policy if exists "Allow all on order_items" on public.order_items;
drop policy if exists "Allow all on gallery_items" on public.gallery_items;
create policy "Allow all on products"      on public.products      for all using (true) with check (true);
create policy "Allow all on orders"        on public.orders        for all using (true) with check (true);
create policy "Allow all on order_items"   on public.order_items   for all using (true) with check (true);
create policy "Allow all on gallery_items" on public.gallery_items for all using (true) with check (true);

insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do update set public = true;

insert into storage.buckets (id, name, public)
values ('gallery', 'gallery', true)
on conflict (id) do update set public = true;

drop policy if exists "Product images public read"  on storage.objects;
drop policy if exists "Product images staff upload" on storage.objects;
drop policy if exists "Product images staff update" on storage.objects;
drop policy if exists "Product images staff delete" on storage.objects;
create policy "Product images public read"  on storage.objects for select using (bucket_id = 'product-images');
create policy "Product images staff upload" on storage.objects for insert with check (bucket_id = 'product-images');
create policy "Product images staff update" on storage.objects for update using (bucket_id = 'product-images');
create policy "Product images staff delete" on storage.objects for delete using (bucket_id = 'product-images');

drop policy if exists "Gallery images public read"  on storage.objects;
drop policy if exists "Gallery images staff upload" on storage.objects;
drop policy if exists "Gallery images staff update" on storage.objects;
drop policy if exists "Gallery images staff delete" on storage.objects;
create policy "Gallery images public read"  on storage.objects for select using (bucket_id = 'gallery');
create policy "Gallery images staff upload" on storage.objects for insert with check (bucket_id = 'gallery');
create policy "Gallery images staff update" on storage.objects for update using (bucket_id = 'gallery');
create policy "Gallery images staff delete" on storage.objects for delete using (bucket_id = 'gallery');
`;
