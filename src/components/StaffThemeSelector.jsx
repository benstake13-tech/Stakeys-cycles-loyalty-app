import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export const StaffThemeSelector = () => {
  const themes = ['none', 'halloween', 'christmas', 'easter', 'cny', 'valentines'];
  const [currentTheme, setCurrentTheme] = useState('none');

  useEffect(() => {
    const fetchTheme = async () => {
      const { data } = await supabase.from('app_theme_config').select('theme').eq('id', 1).single();
      if (data) setCurrentTheme(data.theme);
    };
    fetchTheme();
  }, []);

  const cycleTheme = async () => {
    const currentIndex = themes.indexOf(currentTheme);
    const nextIndex = (currentIndex + 1) % themes.length;
    const nextTheme = themes[nextIndex];
    
    await supabase.from('app_theme_config').update({ theme: nextTheme }).eq('id', 1);
    setCurrentTheme(nextTheme);
  };

  return (
    <button 
      onClick={cycleTheme}
      className="px-4 py-2 bg-emerald-600 text-white rounded text-sm font-semibold hover:bg-emerald-700 transition cursor-pointer"
    >
      Theme: {currentTheme.toUpperCase()} (Cycle)
    </button>
  );
};
