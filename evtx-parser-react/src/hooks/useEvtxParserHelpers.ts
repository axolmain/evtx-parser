import type {EvtxParseResult} from '@/parser'
import {discoverChunkOffsets, parseEvtx, parseFileHeader} from '@/parser'
import {mergeChunkResults} from '@/worker/merge'
import {isSharedArrayBufferSupported} from '@/worker/shared-buffer'
import {ChunkWorkerPool} from '@/worker/worker-pool'

interface ParseTimedResult {
	parseTime: number
	result: EvtxParseResult
}

export function createPool(): ChunkWorkerPool | null {
	try {
		const cores =
			typeof navigator !== 'undefined' && navigator.hardwareConcurrency
				? navigator.hardwareConcurrency
				: 4
		const size = Math.max(1, cores - 1)
		return new ChunkWorkerPool(size)
	} catch {
		return null
	}
}

async function parseWithWorkers(
	buffer: ArrayBuffer,
	pool: ChunkWorkerPool
): Promise<ParseTimedResult> {
	const dv = new DataView(buffer)
	const fileHeader = parseFileHeader(buffer, dv)
	const chunkOffsets = discoverChunkOffsets(buffer, fileHeader)

	// Optimize for SharedArrayBuffer mode:
	// - If supported: Pass full buffer reference (no slicing)
	// - If not supported: Slice chunks as before (fallback mode)
	const useSharedBuffer = isSharedArrayBufferSupported()

	const chunks = chunkOffsets.map((offset, i) => ({
		buffer: useSharedBuffer ? buffer : buffer.slice(offset, offset + 65_536),
		fileOffset: offset,
		index: i
	}))

	const t0 = performance.now()
	const results = await pool.parseChunks(chunks)
	const t1 = performance.now()

	return {
		result: mergeChunkResults(results, fileHeader, chunkOffsets.length),
		parseTime: t1 - t0
	}
}

function parseOnMainThread(buffer: ArrayBuffer): ParseTimedResult {
	const t0 = performance.now()
	const result = parseEvtx(buffer)
	const t1 = performance.now()
	return {result, parseTime: t1 - t0}
}

export function parseBuffer(
	buffer: ArrayBuffer,
	pool: ChunkWorkerPool | null
): Promise<ParseTimedResult> {
	if (pool?.isAvailable()) {
		return parseWithWorkers(buffer, pool)
	}
	return Promise.resolve(parseOnMainThread(buffer))
}
