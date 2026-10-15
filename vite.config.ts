import { hostedSurfaceForBranch } from './src/config/surfaceRouting';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import {defineConfig, loadEnv} from 'vite';
import { DEFAULT_SUPABASE_URL, DEFAULT_SUPABASE_ANON_KEY } from './src/config/supabaseDefaults.ts';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_");
  const guideConfig = JSON.stringify({ url: env.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL, anonKey: env.VITE_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY });
  const hostedSurface = hostedSurfaceForBranch(process.env.VERCEL_GIT_COMMIT_REF);
  return {
    define: hostedSurface ? { 'import.meta.env.VITE_SURFACE': JSON.stringify(hostedSurface) } : {},
    plugins: [react(), tailwindcss(), {
      name: 'guide-public-supabase-config',
      generateBundle() {
        this.emitFile({ type: 'asset', fileName: 'guide/gemini-config.json', source: guideConfig });
      },
      configureServer(server) {
        server.middlewares.use('/guide/gemini-config.json', (_req, res) => {
          res.setHeader('Content-Type', 'application/json');
          res.end(guideConfig);
        });
      },
    }],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('.', import.meta.url)),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
      allowedHosts: true as true,
    },
  };
});
