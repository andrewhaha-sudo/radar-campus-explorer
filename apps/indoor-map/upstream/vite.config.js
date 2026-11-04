import { defineConfig } from 'vite';
import sirv from 'sirv';

export default defineConfig({
  appType: 'mpa',
  root: '.',
  publicDir: false,
  server: {
    port: 3000,
    open: true
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets'
  },
  optimizeDeps: {
    exclude: ['lightningcss']
  },
  plugins: [
    {
      name: 'serve-data',
      configureServer(server) {
        server.middlewares.use('/data', sirv('data', { dev: true }));
      }
    }
  ]
});
