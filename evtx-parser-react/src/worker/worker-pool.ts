import type {
	ChunkParseRequest,
	ChunkParseSuccess,
	WorkerResponse
} from './protocol'
import {
	isSharedArrayBufferSupported,
	toSharedArrayBuffer
} from './shared-buffer'

interface PendingBatch {
	expected: number
	id: number
	reject: (reason: Error) => void
	resolve: (results: ChunkParseSuccess[]) => void
	results: ChunkParseSuccess[]
	settled: number
}

export class ChunkWorkerPool {
	private batch: PendingBatch | null = null
	private currentId = 0
	private workers: Worker[]
	private readonly useSharedBuffer: boolean

	constructor(size: number) {
		this.workers = []
		this.useSharedBuffer = isSharedArrayBufferSupported()

		if (this.useSharedBuffer) {
		} else {
		}

		for (let i = 0; i < size; i++) {
			try {
				const w = new Worker(new URL('./chunk-worker.ts', import.meta.url), {
					type: 'module'
				})
				w.onmessage = (e: MessageEvent<WorkerResponse>) => {
					this.handleResponse(e.data)
				}
				w.onerror = (e: ErrorEvent) => {
					this.handleWorkerError(e.message)
				}
				this.workers.push(w)
			} catch {
				// Worker creation failed — continue with fewer workers
			}
		}
	}

	isAvailable(): boolean {
		return this.workers.length > 0
	}

	parseChunks(
		chunks: {buffer: ArrayBuffer; fileOffset: number; index: number}[]
	): Promise<ChunkParseSuccess[]> {
		// Cancel any existing batch
		this.cancelPending()

		const id = ++this.currentId

		return new Promise<ChunkParseSuccess[]>((resolve, reject) => {
			if (chunks.length === 0) {
				resolve([])
				return
			}

			this.batch = {
				id,
				expected: chunks.length,
				settled: 0,
				results: [],
				resolve,
				reject
			}

			if (this.useSharedBuffer) {
				// SharedArrayBuffer mode: One copy, zero transfers
				this.parseChunksShared(chunks, id)
			} else {
				// Fallback mode: Transfer ArrayBuffers to workers
				this.parseChunksTransfer(chunks, id)
			}
		})
	}

	/**
	 * SharedArrayBuffer mode: Copy all chunk data into one shared buffer,
	 * then send references to workers (no transfers needed).
	 */
	private parseChunksShared(
		chunks: {buffer: ArrayBuffer; fileOffset: number; index: number}[],
		id: number
	): void {
		// Calculate total size needed
		const totalSize = chunks.reduce(
			(sum, chunk) => sum + chunk.buffer.byteLength,
			0
		)

		// Create one SharedArrayBuffer for all chunks
		const combinedBuffer = new ArrayBuffer(totalSize)
		const combinedView = new Uint8Array(combinedBuffer)

		// Copy all chunks into the combined buffer
		let currentOffset = 0
		const chunkMetadata: {offset: number; length: number}[] = []

		for (const chunk of chunks) {
			const sourceView = new Uint8Array(chunk.buffer)
			combinedView.set(sourceView, currentOffset)
			chunkMetadata.push({
				offset: currentOffset,
				length: chunk.buffer.byteLength
			})
			currentOffset += chunk.buffer.byteLength
		}

		// Convert to SharedArrayBuffer
		const sharedBuffer = toSharedArrayBuffer(combinedBuffer)

		// Send shared reference to workers (no transfer)
		for (let i = 0; i < chunks.length; i++) {
			const chunk = chunks[i]!
			const metadata = chunkMetadata[i]!
			const worker = this.workers[i % this.workers.length]!

			const msg: ChunkParseRequest = {
				type: 'parse-chunk',
				id,
				chunkIndex: chunk.index,
				chunkFileOffset: chunk.fileOffset,
				sharedBuffer,
				chunkOffset: metadata.offset,
				chunkLength: metadata.length
			}

			// No transferable array - SharedArrayBuffer is shared by reference
			worker.postMessage(msg)
		}
	}

	/**
	 * Fallback mode: Transfer ArrayBuffers to workers (current behavior).
	 */
	private parseChunksTransfer(
		chunks: {buffer: ArrayBuffer; fileOffset: number; index: number}[],
		id: number
	): void {
		// Round-robin assignment: distribute chunks across workers
		for (let i = 0; i < chunks.length; i++) {
			const chunk = chunks[i]!
			const worker = this.workers[i % this.workers.length]!

			const msg: ChunkParseRequest = {
				type: 'parse-chunk',
				id,
				chunkIndex: chunk.index,
				chunkFileOffset: chunk.fileOffset,
				chunkBuffer: chunk.buffer,
				chunkOffset: 0,
				chunkLength: chunk.buffer.byteLength
			}

			// Transfer ownership of the ArrayBuffer to the worker
			worker.postMessage(msg, [chunk.buffer])
		}
	}

	cancel(): void {
		this.cancelPending()
	}

	dispose(): void {
		this.cancelPending()
		for (const w of this.workers) {
			w.terminate()
		}
		this.workers = []
	}

	private cancelPending(): void {
		if (this.batch) {
			this.batch.reject(new Error('Cancelled'))
			this.batch = null
		}
	}

	private handleResponse(resp: WorkerResponse): void {
		const batch = this.batch
		if (!batch || resp.id !== batch.id) return // stale

		if (resp.type === 'chunk-error') {
			this.batch = null
			batch.reject(new Error(`Chunk ${resp.chunkIndex}: ${resp.error}`))
			return
		}

		batch.results.push(resp)
		batch.settled++

		if (batch.settled === batch.expected) {
			this.batch = null
			// Sort by chunkIndex to maintain order
			batch.results.sort((a, b) => a.chunkIndex - b.chunkIndex)
			batch.resolve(batch.results)
		}
	}

	private handleWorkerError(message: string): void {
		const batch = this.batch
		if (batch) {
			this.batch = null
			batch.reject(new Error(`Worker error: ${message}`))
		}
	}
}
