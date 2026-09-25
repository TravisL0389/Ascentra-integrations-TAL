import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 550,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('/three/')) return 'three';
          if (id.includes('/@supabase/') || id.includes('/ws/')) return 'supabase';
          if (id.includes('/react/') || id.includes('/react-dom/')) return 'react';
          if (id.includes('/lucide-react/')) return 'icons';
          return 'vendor';
        },
      },
    },
  },
  server: {
    host: '127.0.0.1',
  },
  preview: {
    host: '127.0.0.1',
  },
});
