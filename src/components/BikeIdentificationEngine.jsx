import React, { useState } from 'react';
import { analyzeBikeImage } from '../api/visionService';
import { supabase } from '../lib/supabase';
import { Camera } from 'lucide-react';

export const BikeIdentificationEngine = ({ userId, onAnalysisComplete }) => {
  const [loading, setLoading] = useState(false);

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setLoading(true);
    const reader = new FileReader();
    reader.onloadend = async () => {
      try {
        // Send image to AI for analysis
        const analysis = await analyzeBikeImage(reader.result);
        
        // Ensure analysis does not contain the base64 image before saving
        const { identified_bike, visually_broken_parts, common_model_faults, recommended_solutions } = analysis;
        const cleanedAnalysis = { identified_bike, visually_broken_parts, common_model_faults, recommended_solutions };

        // Persist only the identification data to Supabase
        await supabase.from('customer_bikes').insert({
          customer_id: userId,
          brand: cleanedAnalysis.identified_bike.make,
          model: cleanedAnalysis.identified_bike.model,
          category: cleanedAnalysis.identified_bike.type,
          scraped_data: cleanedAnalysis
        });
        
        onAnalysisComplete(cleanedAnalysis);
      } catch (err) {
        console.error("AI Scan Failed:", err);
      } finally {
        setLoading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="flex flex-col gap-2">
      <label className="flex items-center gap-2 px-4 py-3 bg-neutral-900 border border-neutral-700 rounded-xl cursor-pointer hover:border-emerald-500 transition-all text-sm text-neutral-300">
        {loading ? (
          <span className="animate-pulse text-emerald-400">Stakey is scanning...</span>
        ) : (
          <>
            <Camera className="w-5 h-5" />
            <span>Let Stakey's Identify Your Bike</span>
            <input 
              type="file" 
              accept="image/*" 
              capture="environment" 
              onChange={handleFileChange} 
              disabled={loading} 
              className="hidden" 
            />
          </>
        )}
      </label>
    </div>
  );
};
