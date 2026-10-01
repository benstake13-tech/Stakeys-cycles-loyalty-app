import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { SeasonalThemeCanvas } from './SeasonalThemeCanvas';

export const SeasonalThemeWrapper = ({ children }) => {
  const [theme, setTheme] = useState('none');

  useEffect(() => {
    const fetchTheme = async () => {
      const { data } = await supabase.from('app_theme_config').select('theme').eq('id', 1).single();
      if (data) setTheme(data.theme);
    };
    fetchTheme();

    const channel = supabase.channel('theme_changes')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'app_theme_config', filter: 'id=eq.1' }, 
        (payload) => setTheme(payload.new.theme))
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  return (
    <>
      <SeasonalThemeCanvas theme={theme} />
      <div className="relative z-10">{children}</div>
    </>
  );
};
