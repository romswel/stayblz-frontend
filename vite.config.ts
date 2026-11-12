import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';

// The version shown next to the logo comes from package.json; the build id from Vercel's commit.
const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));
const build = (process.env.VERCEL_GIT_COMMIT_SHA ?? 'local').slice(0, 7);

export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __APP_BUILD__: JSON.stringify(build),
  },
  // Keep the browser support of the existing Vite 5 build.
  build: { target: ['chrome87', 'edge88', 'firefox78', 'safari14'] },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true
      }
    }
  }
});
