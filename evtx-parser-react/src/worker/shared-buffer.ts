/**
 * SharedArrayBuffer utilities for zero-copy parallel chunk parsing.
 *
 * SharedArrayBuffer allows multiple Web Workers to access the same memory
 * without copying, eliminating the overhead of transferring ArrayBuffers
 * between workers.
 *
 * Requirements:
 * - SharedArrayBuffer constructor must exist
 * - Cross-origin isolation must be enabled (crossOriginIsolated === true)
 * - COOP/COEP headers must be set:
 *   - Cross-Origin-Opener-Policy: same-origin
 *   - Cross-Origin-Embedder-Policy: require-corp
 */

/**
 * Check if SharedArrayBuffer is supported and cross-origin isolation is enabled.
 *
 * @returns true if SharedArrayBuffer can be used safely
 */
export function isSharedArrayBufferSupported(): boolean {
	// Check if SharedArrayBuffer constructor exists
	if (typeof SharedArrayBuffer === 'undefined') {
		return false
	}

	// Check if cross-origin isolation is enabled
	// This requires COOP/COEP headers to be set
	if (typeof crossOriginIsolated === 'undefined' || !crossOriginIsolated) {
		return false
	}

	return true
}

/**
 * Copy an ArrayBuffer to a SharedArrayBuffer.
 *
 * This is necessary because file.arrayBuffer() returns ArrayBuffer,
 * not SharedArrayBuffer. We need one copy to convert to shared memory.
 *
 * @param buffer - Source ArrayBuffer to copy
 * @returns SharedArrayBuffer containing the same data
 */
export function toSharedArrayBuffer(buffer: ArrayBuffer): SharedArrayBuffer {
	const shared = new SharedArrayBuffer(buffer.byteLength)
	const sourceView = new Uint8Array(buffer)
	const targetView = new Uint8Array(shared)
	targetView.set(sourceView)
	return shared
}

/**
 * Create a DataView for a specific region of a SharedArrayBuffer.
 *
 * Useful for creating chunk-specific views without copying data.
 *
 * @param buffer - The SharedArrayBuffer to create a view of
 * @param offset - Byte offset into the buffer
 * @param length - Number of bytes in the view
 * @returns DataView for the specified region
 */
export function createSharedView(
	buffer: SharedArrayBuffer,
	offset: number,
	length: number
): DataView {
	return new DataView(buffer, offset, length)
}

/**
 * Create a Uint8Array view for a specific region of a SharedArrayBuffer.
 *
 * @param buffer - The SharedArrayBuffer to create a view of
 * @param offset - Byte offset into the buffer
 * @param length - Number of bytes in the view
 * @returns Uint8Array for the specified region
 */
export function createSharedUint8View(
	buffer: SharedArrayBuffer,
	offset: number,
	length: number
): Uint8Array {
	return new Uint8Array(buffer, offset, length)
}
