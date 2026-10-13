import React, { useState } from 'react';
import { Search, Package, ChevronRight } from 'lucide-react';
import { useWebsiteContent } from '../../context/WebsiteContentStore';

export function StaffStockTab({ onManage }: { onManage: () => void }) {
  const { products } = useWebsiteContent();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All');
  const categories = ['All', ...new Set(products.map(product => product.category))];
  const visible = products.filter(product => (category === 'All' || product.category === category) && `${product.name} ${product.category}`.toLowerCase().includes(query.toLowerCase()));
  return <section className="stakeys-stock-screen" aria-label="Stock and products">
    <div className="flex items-center justify-between gap-3"><h2 className="text-xl font-bold">Stock &amp; Products</h2><button type="button" onClick={onManage} className="stakeys-action">Manage stock</button></div>
    <label className="stakeys-search"><Search size={18} /><input type="search" aria-label="Search stock" placeholder="Search stock…" value={query} onChange={event => setQuery(event.target.value)} /></label>
    <div className="stakeys-category-row" aria-label="Stock categories">{categories.map(value => <button key={value} type="button" aria-pressed={value === category} onClick={() => setCategory(value)}>{value}</button>)}</div>
    <div className="stakeys-stock-list">{visible.map(product => <button key={product.id} type="button" className="stakeys-stock-row" onClick={onManage} aria-label={`Manage ${product.name}`}>
      {product.image ? <img src={product.image} alt="" loading="lazy" /> : <Package size={32} />}
      <span className="stakeys-stock-copy"><strong>{product.name}</strong><span>£{product.price.toFixed(2)}</span></span>
      <span className={product.stock > 0 ? 'text-emerald-300 text-xs' : 'text-amber-300 text-xs'}>{product.stock > 0 ? `In stock: ${product.stock}` : 'Out of stock'}</span><ChevronRight size={18} />
    </button>)}</div>
    {visible.length === 0 && <p className="surface-panel p-6 text-sm text-neutral-400">{products.length ? 'No products match your search.' : 'Add your products using Manage stock to see your inventory here.'}</p>}
  </section>;
}
