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

interface StreamingBatch {
	expected: number
	id: number
	onChunkComplete: (
		result: ChunkParseSuccess,
		progress: {
			parsedChunks: number
			totalChunks: number
			actualRecords: number
		}
	) => void
	reject: (reason: Error) => void
	resolve: () => void
	settled: number
	totalRecords: number
}

export class ChunkWorkerPool {
	private batch: PendingBatch | null = null
	private streamingBatch: StreamingBatch | null = null
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
	 * Parse chunks in streaming mode - calls onChunkComplete as each chunk finishes.
	 * Priority chunks are parsed first (e.g., first 3 chunks for immediate display).
	 */
	parseChunksStreaming(
		chunks: {buffer: ArrayBuffer; fileOffset: number; index: number}[],
		onChunkComplete: (
			result: ChunkParseSuccess,
			progress: {
				parsedChunks: number
				totalChunks: number
				actualRecords: number
			}
		) => void,
		priorityIndexes?: number[]
	): Promise<void> {
		// Cancel any existing batch
		this.cancelPending()

		const id = ++this.currentId

		return new Promise<void>((resolve, reject) => {
			if (chunks.length === 0) {
				resolve()
				return
			}

			this.streamingBatch = {
				id,
				expected: chunks.length,
				settled: 0,
				totalRecords: 0,
				onChunkComplete,
				resolve,
				reject
			}

			// Sort chunks into priority and non-priority
			const prioritySet = new Set(priorityIndexes || [])
			const priorityChunks = chunks.filter(c => prioritySet.has(c.index))
			const regularChunks = chunks.filter(c => !prioritySet.has(c.index))

			// Parse priority chunks first, then regular chunks
			const orderedChunks = [...priorityChunks, ...regularChunks]

			if (this.useSharedBuffer) {
				this.parseChunksShared(orderedChunks, id)
			} else {
				this.parseChunksTransfer(orderedChunks, id)
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
		if (this.streamingBatch) {
			this.streamingBatch.reject(new Error('Cancelled'))
			this.streamingBatch = null
		}
	}

	private handleResponse(resp: WorkerResponse): void {
		// Handle batch mode
		const batch = this.batch
		if (batch && resp.id === batch.id) {
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
			return
		}

		// Handle streaming mode
		const streamingBatch = this.streamingBatch
		if (streamingBatch && resp.id === streamingBatch.id) {
			if (resp.type === 'chunk-error') {
				this.streamingBatch = null
				streamingBatch.reject(
					new Error(`Chunk ${resp.chunkIndex}: ${resp.error}`)
				)
				return
			}

			streamingBatch.settled++
			streamingBatch.totalRecords += resp.recordCount

			// Call progress callback immediately
			streamingBatch.onChunkComplete(resp, {
				parsedChunks: streamingBatch.settled,
				totalChunks: streamingBatch.expected,
				actualRecords: streamingBatch.totalRecords
			})

			if (streamingBatch.settled === streamingBatch.expected) {
				this.streamingBatch = null
				streamingBatch.resolve()
			}
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
