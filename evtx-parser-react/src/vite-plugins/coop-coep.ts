import type {Plugin} from 'vite'

/**
 * Vite plugin that injects Cross-Origin-Opener-Policy and Cross-Origin-Embedder-Policy
 * headers required for SharedArrayBuffer support in development and preview servers.
 *
 * These headers enable cross-origin isolation, which is a security requirement for
 * using SharedArrayBuffer in modern browsers.
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/SharedArrayBuffer
 * @see https://web.dev/coop-coep/
 */
export function coopCoepPlugin(): Plugin {
	return {
		name: 'coop-coep-headers',
		configureServer(server) {
			server.middlewares.use((_req, res, next) => {
				res.setHeader('Cross-Origin-Opener-Policy', 'same-origin')
				res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp')
				next()
			})
		},
		configurePreviewServer(server) {
			server.middlewares.use((_req, res, next) => {
				res.setHeader('Cross-Origin-Opener-Policy', 'same-origin')
				res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp')
				next()
			})
		}
	}
}
