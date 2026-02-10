/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

import type DetachedWindowApi from 'happy-dom/lib/window/DetachedWindowAPI.js'

declare global {
	interface Window {
		happyDOM?: DetachedWindowApi
	}
}
