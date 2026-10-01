import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

function apiDevPlugin() {
  return {
    name: 'api-dev-middleware',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url || !req.url.startsWith('/api/')) return next();

        const [urlPath, queryString] = req.url.split('?');
        const query = {};
        if (queryString) {
          const params = new URLSearchParams(queryString);
          for (const [k, v] of params) query[k] = v;
        }

        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', async () => {
          try {
            req.body = body ? JSON.parse(body) : {};
          } catch {
            req.body = {};
          }
          req.query = query;

          if (!res.status) {
            res.status = (code) => {
              res.statusCode = code;
              return res;
            };
          }
          if (!res.json) {
            res.json = (obj) => {
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify(obj));
              return res;
            };
          }

          try {
            if (urlPath === '/api/auth/login') {
              const { default: handler } = await server.ssrLoadModule('/api/auth/login.js');
              return await handler(req, res);
            }
            if (urlPath === '/api/auth/verify') {
              const { default: handler } = await server.ssrLoadModule('/api/auth/verify.js');
              return await handler(req, res);
            }
            if (urlPath === '/api/auth/logout') {
              const { default: handler } = await server.ssrLoadModule('/api/auth/logout.js');
              return await handler(req, res);
            }
            if (urlPath === '/api/quotations') {
              const { default: handler } = await server.ssrLoadModule('/api/quotations.js');
              return await handler(req, res);
            }
          } catch (err) {
            console.error('[Vite dev API error]:', err);
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: err.message }));
            return;
          }

          next();
        });
      });
    }
  };
}

export default defineConfig({
  plugins: [
    react(),
    apiDevPlugin(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        globPatterns: ['**/*.{css,html,ico,png,svg,woff,woff2}', '**/index*.js'],
        runtimeCaching: [
          {
            urlPattern: /\.(?:js|mjs)$/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'sunvine-dynamic-chunks',
              networkTimeoutSeconds: 3,
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24
              }
            }
          },
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-stylesheets',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-webfonts',
              expiration: {
                maxEntries: 30,
                maxAgeSeconds: 60 * 60 * 24 * 365
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          }
        ]
      },
      includeAssets: [
        'favicon.ico',
        'sunvine-logo.png',
        'sunvine-logo-darkmode.png',
        'sunvine_logo_transparent.png',
        'sunvine_logo_white.png',
        'pwa-192x192.png',
        'pwa-512x512.png',
        'fonts/material-symbols-outlined.woff2'
      ],
      manifest: {
        name: 'Sunvine Solar EPC Dealer Portal',
        short_name: 'Sunvine EPC',
        description: 'Sunvine Renewable Energy - Solar EPC Dealer & Admin Quotation Portal',
        theme_color: '#0F1B2E',
        background_color: '#0F1B2E',
        display: 'standalone',
        orientation: 'portrait-primary',
        start_url: '/',
        id: '/',
        scope: '/',
        icons: [
          {
            src: '/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: '/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'maskable'
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          }
        ]
      }
    })
  ],
  server: {
    port: 5173,
    host: true
  },
  build: {
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-three': ['three'],
          'vendor-ocr': ['tesseract.js'],
          'vendor-pdf': ['html2pdf.js'],
          'vendor-lucide': ['lucide-react']
        }
      }
    }
  }
});
