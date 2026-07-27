import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import http from 'node:http';
import path from 'path';
import {defineConfig} from 'vite';
import {VitePWA} from 'vite-plugin-pwa';

const probeApiTarget = (port: number): Promise<string | null> => {
  return new Promise((resolve) => {
    const req = http.request(
      {
        host: '127.0.0.1',
        port,
        path: '/api/v1/health',
        method: 'GET',
        timeout: 800,
      },
      (res) => {
        res.resume();
        resolve(res.statusCode && res.statusCode < 500 ? `http://127.0.0.1:${port}` : null);
      }
    );

    req.on('timeout', () => {
      req.destroy();
      resolve(null);
    });

    req.on('error', () => resolve(null));
    req.end();
  });
};

export default defineConfig(async () => {
  const configuredTarget = process.env.VITE_API_URL?.trim();
  const apiTarget = configuredTarget || (await (async () => {
    for (const port of [3000, 3001, 3002, 3003]) {
      const target = await probeApiTarget(port);
      if (target) return target;
    }
    return 'http://127.0.0.1:3000';
  })());

  return {
    plugins: [
      react(), 
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        manifest: {
          name: 'Ojanuan',
          short_name: 'Ojanuan',
          description: 'Web App de saúde mental para vínculo terapêutico e gestão operacional',
          theme_color: '#F9F8F4',
          background_color: '#F9F8F4',
          display: 'standalone',
          icons: [
            {
              src: 'pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png'
            },
            {
              src: 'pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png'
            }
          ]
        }
      })
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâ€”file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
      port: 5173,
      proxy: {
        '/api': {
          target: apiTarget,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, '/api/v1'),
        },
      },
    },
  };
});
