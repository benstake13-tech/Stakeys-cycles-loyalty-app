import React, { useState, useEffect } from 'react';
import { Building2, MessageSquare, Star, MapPin } from 'lucide-react';

export const GoogleBusinessTab = () => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch('/api/google-business');
        if (response.ok) {
          const json = await response.json();
          setData(json);
        }
      } catch (error) {
        console.error('Failed to fetch Google Business data:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) return <div className="text-white p-6">Loading Business Insights...</div>;

  return (
    <div className="bg-[#0e1217] border border-neutral-800 rounded-3xl p-6 shadow-xl space-y-6">
      <div className="flex items-center gap-3 pb-4 border-b border-neutral-800">
        <Building2 className="w-6 h-6 text-emerald-500" />
        <h3 className="text-xl font-bold text-white">Google Business Profile</h3>
      </div>
      
      {data ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-neutral-950 p-4 rounded-xl border border-neutral-800">
            <div className="text-neutral-400 text-xs font-semibold uppercase">Average Rating</div>
            <div className="text-3xl font-black text-white mt-1">{data.rating || 'N/A'} <Star className="w-6 h-6 text-amber-400 inline" /></div>
          </div>
          <div className="bg-neutral-950 p-4 rounded-xl border border-neutral-800">
            <div className="text-neutral-400 text-xs font-semibold uppercase">Total Reviews</div>
            <div className="text-3xl font-black text-white mt-1">{data.totalReviews || 0} <MessageSquare className="w-6 h-6 text-emerald-400 inline" /></div>
          </div>
          <div className="bg-neutral-950 p-4 rounded-xl border border-neutral-800">
            <div className="text-neutral-400 text-xs font-semibold uppercase">Location</div>
            <div className="text-sm font-semibold text-white mt-2 truncate">{data.address || 'Check profile'} <MapPin className="w-4 h-4 text-emerald-400 inline" /></div>
          </div>
        </div>
      ) : (
        <p className="text-neutral-400">No profile data connected. Ensure your backend proxy is configured.</p>
      )}
    </div>
  );
};
