import { defineConfig } from 'vite';
export default defineConfig({
  base: './',
  build: { target: 'es2022', chunkSizeWarningLimit: 800 },
  server: { port: 5174, strictPort: true, watch: { ignored: ['**/.qa/**','**/release/**','**/docs/**','**/tests/**'] } },
});
