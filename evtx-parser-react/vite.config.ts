/// <reference types="vitest/config" />

import path from 'node:path'
import tanstackRouter from '@tanstack/router-plugin/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig(() => ({
	base: '/evtx-parser/',
	plugins: [
		tanstackRouter(),
		react(),
		VitePWA({
			registerType: 'autoUpdate',
			includeAssets: ['favicon.png'],
			manifest: {
				name: 'EVTX Parser - Windows Event Log Viewer',
				short_name: 'EVTX Parser',
				description: 'Parse and analyze Windows Event Log (EVTX) files offline',
				theme_color: '#1a1b1e',
				background_color: '#1a1b1e',
				display: 'standalone',
				start_url: '/evtx-parser/',
				scope: '/evtx-parser/',
				icons: [
					{
						src: '/evtx-parser/favicon.png',
						sizes: '192x192',
						type: 'image/png',
					},
					{
						src: '/evtx-parser/favicon.png',
						sizes: '512x512',
						type: 'image/png',
					},
				],
			},
			workbox: {
				globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
				runtimeCaching: [
					{
						urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
						handler: 'CacheFirst',
						options: {
							cacheName: 'google-fonts-cache',
							expiration: {
								maxEntries: 10,
								maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
							},
							cacheableResponse: {
								statuses: [0, 200],
							},
						},
					},
				],
				// Increase maximum file size to 5MB to handle large bundles
				maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
			},
		}),
	],
	resolve: {
		alias: {
			'@': path.resolve(__dirname, './src')
		}
	},
	test: {
		bail: 1,
		clearMocks: true,
		coverage: {
			enabled: true,
			exclude: ['src/main.tsx'],
			include: ['src/**/*'],
			reporter: ['text', 'lcov'],
			reportsDirectory: 'coverage',
			thresholds: {
				'100': true
			}
		},
		css: false,
		environment: 'happy-dom',
		globals: true,
		include: ['src/**/*.test.ts?(x)'],
		setupFiles: 'src/test-setup.ts'
	}
}))
