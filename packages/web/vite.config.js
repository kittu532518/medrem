import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: '0.0.0.0',         // listen on all interfaces (LAN + ngrok)
    port: 5173,
    allowedHosts: ['*.loca.lt', 'medrem-dev.ngrok-free.app', 'localhost', '127.0.0.1'],     // allow localtunnel / ngrok / cloudflare tunnel
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3001',
        changeOrigin: true,  // rewrites Host header so API doesn't see ngrok domain
        secure: false,
      },
      '/uploads': {
        target: 'http://127.0.0.1:3001',
        changeOrigin: true,
        secure: false,
      },
    },
    // HMR over ngrok: use wss on port 443 so the browser can reach the websocket
    hmr: {
      protocol: 'wss',
      clientPort: 443,
    },
    // Skip ngrok interstitial warning page by sending the header
    middlewares: [
      (req, res, next) => {
        res.setHeader('ngrok-skip-browser-warning', 'true');
        next();
      },
    ],
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        manualChunks: {
          react:  ['react', 'react-dom', 'react-router-dom'],
          vendor: ['axios', 'i18next', 'react-i18next'],
        },
      },
    },
  },
});
