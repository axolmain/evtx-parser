import {parseEvtx} from '@/parser'

self.onmessage = async (e: MessageEvent<ArrayBuffer>) => {
	try {
		const result = parseEvtx(e.data, (records, progress) => {
			self.postMessage({type: 'records', records, progress})
		})
		self.postMessage({
			type: 'done',
			tplStats: result.tplStats,
			warnings: result.warnings,
			totalRecords: result.totalRecords,
			numChunks: result.numChunks
		})
	} catch (err) {
		self.postMessage({
			type: 'error',
			message: err instanceof Error ? err.message : String(err)
		})
	}
}
