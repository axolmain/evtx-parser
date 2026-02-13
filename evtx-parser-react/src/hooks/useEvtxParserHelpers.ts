import type {EvtxParseResult} from '@/parser'

export interface ParseTimedResult {
	parseTime: number
	result: EvtxParseResult
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

export function parseBuffer(buffer: ArrayBuffer): Promise<ParseTimedResult> {
	return new Promise((resolve, reject) => {
		const w = getWorker()
		const t0 = performance.now()

		w.onmessage = (e: MessageEvent<EvtxParseResult>) => {
			resolve({result: e.data, parseTime: performance.now() - t0})
		}
		w.onerror = (e) => {
			reject(new Error(e.message))
		}

		w.postMessage(buffer, [buffer])
	})
}

export function disposeWorker(): void {
	worker?.terminate()
	worker = null
}
