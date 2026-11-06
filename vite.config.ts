import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: './',
  plugins: [VitePWA({
    registerType: 'prompt',
    includeAssets: ['icon.svg', 'questions.json'],
    manifest: {
      name: 'GYS · Şube Müdürü (Teknik)', short_name: 'GYS 85+', lang: 'tr',
      description: 'Kaynağa dayalı sınav hazırlığı · Hazırlık sürümü',
      start_url: './', scope: './', display: 'standalone',
      background_color: '#111c27', theme_color: '#111c27',
      icons: [{ src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }]
    },
    workbox: { globPatterns: ['**/*.{js,css,html,json,svg}'], cleanupOutdatedCaches: true }
  })]
});
