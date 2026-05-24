/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'node:path';
export default defineConfig({
    base: process.env.VITE_BASE_PATH ?? '/',
    plugins: [
        react(),
        VitePWA({
            registerType: 'autoUpdate',
            includeAssets: ['favicon.svg'],
            manifest: {
                name: 'HomeKitten',
                short_name: 'HomeKitten',
                description: 'Home kitchen ordering, on WhatsApp rails.',
                theme_color: '#f97316',
                background_color: '#ffffff',
                display: 'standalone',
                start_url: process.env.VITE_BASE_PATH ?? '/',
                icons: [
                    { src: '/icons/icon.svg', sizes: 'any', type: 'image/svg+xml' },
                    { src: '/icons/icon-maskable.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' }
                ]
            },
            workbox: {
                globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest}'],
                navigateFallback: '/index.html'
            }
        })
    ],
    resolve: {
        alias: { '@': path.resolve(__dirname, 'src') }
    },
    server: { port: 5173 },
    test: {
        globals: true,
        environment: 'node',
        include: ['tests/**/*.test.ts']
    }
});
