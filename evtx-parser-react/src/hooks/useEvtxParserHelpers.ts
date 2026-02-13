import type {EvtxParseResult, ParsedEventRecord, TemplateStatsSummary} from '@/parser'

type WorkerMessage =
	| {type: 'records'; records: ParsedEventRecord[]; progress: number}
	| {type: 'done'; tplStats: TemplateStatsSummary; warnings: string[]; totalRecords: number; numChunks: number}
	| {type: 'error'; message: string}

export interface ParseTimedResult {
	parseTime: number
	result: EvtxParseResult
}

export interface StreamCallbacks {
	onRecords?: (records: ParsedEventRecord[], progress: number) => void
}

let worker: Worker | null = null

function getWorker(): Worker {
	if (!worker) {
		worker = new Worker(new URL('@/worker/parse-worker.ts', import.meta.url), {
			type: 'module'
		})
	}
	return worker
}

export function parseFileBuffer(
	buffer: ArrayBuffer,
	callbacks?: StreamCallbacks
): Promise<ParseTimedResult> {
	return new Promise((resolve, reject) => {
		const w = getWorker()
		const t0 = performance.now()
		const allRecords: ParsedEventRecord[] = []

		w.onmessage = (e: MessageEvent<WorkerMessage>) => {
			const msg = e.data
			switch (msg.type) {
				case 'records':
					for (const r of msg.records) allRecords.push(r)
					callbacks?.onRecords?.(msg.records, msg.progress)
					break
				case 'done':
					resolve({
						result: {
							records: allRecords,
							totalRecords: msg.totalRecords,
							numChunks: msg.numChunks,
							tplStats: msg.tplStats,
							warnings: msg.warnings
						},
						parseTime: performance.now() - t0
					})
					break
				case 'error':
					reject(new Error(msg.message))
					break
			}
		}
		w.onerror = (e) => reject(new Error(e.message))
		w.postMessage(buffer, [buffer])
	})
}

export function disposeWorker(): void {
	worker?.terminate()
	worker = null
}
