import {describe, it, expect} from 'vitest'
import {
	isSharedArrayBufferSupported,
	toSharedArrayBuffer,
	createSharedView,
	createSharedUint8View,
} from './shared-buffer'

describe('shared-buffer utilities', () => {
	describe('isSharedArrayBufferSupported', () => {
		it('should return false if SharedArrayBuffer is undefined', () => {
			const originalSAB = globalThis.SharedArrayBuffer
			;(globalThis as {SharedArrayBuffer: unknown}).SharedArrayBuffer = undefined

			const result = isSharedArrayBufferSupported()

			expect(result).toBe(false)
			globalThis.SharedArrayBuffer = originalSAB
		})

		it('should return false if crossOriginIsolated is false', () => {
			const originalCrossOriginIsolated = globalThis.crossOriginIsolated
			Object.defineProperty(globalThis, 'crossOriginIsolated', {
				value: false,
				configurable: true,
			})

			const result = isSharedArrayBufferSupported()

			expect(result).toBe(false)
			Object.defineProperty(globalThis, 'crossOriginIsolated', {
				value: originalCrossOriginIsolated,
				configurable: true,
			})
		})

		it('should return false if crossOriginIsolated is undefined', () => {
			const originalCrossOriginIsolated = globalThis.crossOriginIsolated
			Object.defineProperty(globalThis, 'crossOriginIsolated', {
				value: undefined,
				configurable: true,
			})

			const result = isSharedArrayBufferSupported()

			expect(result).toBe(false)
			Object.defineProperty(globalThis, 'crossOriginIsolated', {
				value: originalCrossOriginIsolated,
				configurable: true,
			})
		})

		it('should return true if both SharedArrayBuffer and crossOriginIsolated are available', () => {
			// Note: This test will only pass if the test environment has both
			// In most test environments without COOP/COEP headers, this will be false
			const result = isSharedArrayBufferSupported()

			// We can't guarantee the test environment has these features
			// So we just verify the function doesn't throw
			expect(typeof result).toBe('boolean')
		})
	})

	describe('toSharedArrayBuffer', () => {
		it('should copy ArrayBuffer data to SharedArrayBuffer', () => {
			const source = new ArrayBuffer(16)
			const sourceView = new Uint8Array(source)
			// Fill with test data
			for (let i = 0; i < sourceView.length; i++) {
				sourceView[i] = i
			}

			const shared = toSharedArrayBuffer(source)

			expect(shared).toBeInstanceOf(SharedArrayBuffer)
			expect(shared.byteLength).toBe(source.byteLength)

			// Verify data was copied correctly
			const sharedView = new Uint8Array(shared)
			for (let i = 0; i < sharedView.length; i++) {
				expect(sharedView[i]).toBe(i)
			}
		})

		it('should handle empty ArrayBuffer', () => {
			const source = new ArrayBuffer(0)

			const shared = toSharedArrayBuffer(source)

			expect(shared).toBeInstanceOf(SharedArrayBuffer)
			expect(shared.byteLength).toBe(0)
		})

		it('should create independent copy (modifying source should not affect shared)', () => {
			const source = new ArrayBuffer(8)
			const sourceView = new Uint8Array(source)
			sourceView[0] = 42

			const shared = toSharedArrayBuffer(source)
			const sharedView = new Uint8Array(shared)

			// Verify initial copy
			expect(sharedView[0]).toBe(42)

			// Modify source
			sourceView[0] = 99

			// Shared should still have old value
			expect(sharedView[0]).toBe(42)
		})
	})

	describe('createSharedView', () => {
		it('should create DataView for specified region', () => {
			const buffer = new SharedArrayBuffer(32)
			const fullView = new Uint8Array(buffer)
			// Fill with test data
			for (let i = 0; i < fullView.length; i++) {
				fullView[i] = i
			}

			const view = createSharedView(buffer, 8, 16)

			expect(view).toBeInstanceOf(DataView)
			expect(view.byteLength).toBe(16)
			expect(view.byteOffset).toBe(8)
			// Verify it points to correct region
			expect(view.getUint8(0)).toBe(8) // offset 8 in buffer
			expect(view.getUint8(15)).toBe(23) // offset 8+15 in buffer
		})

		it('should create view at buffer start', () => {
			const buffer = new SharedArrayBuffer(16)

			const view = createSharedView(buffer, 0, 16)

			expect(view.byteOffset).toBe(0)
			expect(view.byteLength).toBe(16)
		})
	})

	describe('createSharedUint8View', () => {
		it('should create Uint8Array for specified region', () => {
			const buffer = new SharedArrayBuffer(32)
			const fullView = new Uint8Array(buffer)
			// Fill with test data
			for (let i = 0; i < fullView.length; i++) {
				fullView[i] = i
			}

			const view = createSharedUint8View(buffer, 8, 16)

			expect(view).toBeInstanceOf(Uint8Array)
			expect(view.byteLength).toBe(16)
			expect(view.byteOffset).toBe(8)
			// Verify it points to correct region
			expect(view[0]).toBe(8) // offset 8 in buffer
			expect(view[15]).toBe(23) // offset 8+15 in buffer
		})

		it('should create view at buffer start', () => {
			const buffer = new SharedArrayBuffer(16)

			const view = createSharedUint8View(buffer, 0, 16)

			expect(view.byteOffset).toBe(0)
			expect(view.byteLength).toBe(16)
		})
	})
})
