import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: './',
  server:{proxy:{'/api':'http://127.0.0.1:8787'}},
  preview:{proxy:{'/api':'http://127.0.0.1:8787'}},
  plugins: [VitePWA({
    registerType: 'prompt',
    includeAssets: ['icon.svg','icon-192.png','icon-512.png','apple-touch-icon.png','fonts/DejaVuSans.ttf','fonts/DejaVu-LICENSE.txt','questions.json'],
    manifest: {
      name: 'GYS · Şube Müdürü (Teknik)', short_name: 'GYS 85+', lang: 'tr',
      description: 'Kaynağa dayalı sınav hazırlığı · Hazırlık sürümü',
      start_url: './', scope: './', display: 'standalone',
      background_color: '#111c27', theme_color: '#111c27',
      icons: [{src:'icon-192.png',sizes:'192x192',type:'image/png',purpose:'any'},{src:'icon-512.png',sizes:'512x512',type:'image/png',purpose:'any'},{ src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }]
    },
    workbox: { globPatterns: ['**/*.{js,css,html,json,svg,png,ttf,txt}'], cleanupOutdatedCaches: true }
  })]
});
