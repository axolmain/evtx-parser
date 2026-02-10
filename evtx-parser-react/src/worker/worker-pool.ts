import type {
	ChunkParseRequest,
	ChunkParseSuccess,
	WorkerResponse
} from './protocol'

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

	constructor(size: number) {
		this.workers = []
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

			// Round-robin assignment: distribute chunks across workers
			for (let i = 0; i < chunks.length; i++) {
				const chunk = chunks[i]!
				const worker = this.workers[i % this.workers.length]!
				const msg: ChunkParseRequest = {
					type: 'parse-chunk',
					id,
					chunkBuffer: chunk.buffer,
					chunkFileOffset: chunk.fileOffset,
					chunkIndex: chunk.index
				}
				worker.postMessage(msg, [chunk.buffer])
			}
		})
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
