import {parseEvtx} from '@/parser'
import {parseEvtxWasm} from '@/parser/dotnet-wasm'

export type ParseEngine = 'js' | 'wasm'

interface ParseMessage {
	type: 'parse'
	buffer: ArrayBuffer
	engine: ParseEngine
}

self.onmessage = async (e: MessageEvent<ArrayBuffer | ParseMessage>) => {
	try {
		// Support both legacy (raw ArrayBuffer) and new format
		const isLegacy = e.data instanceof ArrayBuffer
		const buffer = isLegacy ? e.data : e.data.buffer
		const engine: ParseEngine = isLegacy ? 'js' : e.data.engine

		if (engine === 'wasm') {
			const result = await parseEvtxWasm(buffer, (records, progress) => {
				self.postMessage({type: 'records', records, progress})
			})
			self.postMessage({
				type: 'done',
				tplStats: result.tplStats,
				warnings: result.warnings,
				totalRecords: result.totalRecords,
				numChunks: result.numChunks
			})
		} else {
			const result = parseEvtx(buffer, (records, progress) => {
				self.postMessage({type: 'records', records, progress})
			})
			self.postMessage({
				type: 'done',
				tplStats: result.tplStats,
				warnings: result.warnings,
				totalRecords: result.totalRecords,
				numChunks: result.numChunks
			})
		}
	} catch (err) {
		self.postMessage({
			type: 'error',
			message: err instanceof Error ? err.message : String(err)
		})
	}
}
