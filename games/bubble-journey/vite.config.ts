import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: {
    target: 'es2022',
    rolldownOptions: { output: { manualChunks: (id) => id.includes('node_modules/phaser') ? 'phaser' : undefined } },
    chunkSizeWarningLimit: 1600,
  },
  server: { port: 5173, strictPort: true },
  preview: { port: 4173, strictPort: true },
});
