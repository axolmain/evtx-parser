import type { EvtxParseResult, ParsedEventRecord } from '@/parser'
import { discoverChunkOffsets, parseEvtx, parseFileHeader } from '@/parser'
import type { ChunkParseSuccess } from '@/worker/protocol'
import { mergeChunkResults } from '@/worker/merge'
import { isSharedArrayBufferSupported } from '@/worker/shared-buffer'
import { ChunkWorkerPool } from '@/worker/worker-pool'

interface ParseTimedResult {
	parseTime: number
	result: EvtxParseResult
}

export interface StreamingProgress {
	parsedChunks: number
	totalChunks: number
	actualRecords: number
	displayRecords: ParsedEventRecord[]
	isComplete: boolean
	chunkResult?: ChunkParseSuccess
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
	const chunkOffsets = discoverChunkOffsets(dv, fileHeader.headerBlockSize)

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

/**
 * Parse with progressive updates - calls onProgress for each completed chunk.
 * Priority chunks (first 3) are parsed first for fast initial display.
 */
export async function parseBufferStreaming(
	buffer: ArrayBuffer,
	pool: ChunkWorkerPool,
	onProgress: (progress: StreamingProgress) => void,
	cachedChunks?: Map<number, ChunkParseSuccess>
): Promise<ParseTimedResult> {
	const dv = new DataView(buffer)
	const fileHeader = parseFileHeader(buffer, dv)
	const chunkOffsets = discoverChunkOffsets(dv, fileHeader.headerBlockSize)

	const useSharedBuffer = isSharedArrayBufferSupported()

	// Track all results (from cache and new parses)
	const allResults = new Map<number, ChunkParseSuccess>()
	const displayRecords: ParsedEventRecord[] = []

	// Load cached chunks first
	if (cachedChunks) {
		for (const [index, result] of cachedChunks) {
			allResults.set(index, result)
			displayRecords.push(...result.records)
		}

		// If we have cached data, send initial progress
		if (cachedChunks.size > 0) {
			onProgress({
				parsedChunks: cachedChunks.size,
				totalChunks: chunkOffsets.length,
				actualRecords: displayRecords.length,
				displayRecords: [...displayRecords],
				isComplete: cachedChunks.size === chunkOffsets.length
			})
		}
	}

	// If all chunks are cached, we're done
	if (allResults.size === chunkOffsets.length) {
		const sortedResults = Array.from(allResults.values()).sort(
			(a, b) => a.chunkIndex - b.chunkIndex
		)
		return {
			result: mergeChunkResults(sortedResults, fileHeader, chunkOffsets.length),
			parseTime: 0
		}
	}

	// Determine which chunks need parsing
	const chunksToParse = chunkOffsets
		.map((offset, i) => ({
			buffer: useSharedBuffer ? buffer : buffer.slice(offset, offset + 65_536),
			fileOffset: offset,
			index: i
		}))
		.filter(chunk => !allResults.has(chunk.index))

	const t0 = performance.now()

	// Parse chunks with streaming callbacks
	await pool.parseChunksStreaming(
		chunksToParse,
		(result, progress) => {
			allResults.set(result.chunkIndex, result)
			displayRecords.push(...result.records)

			// Sort records by recordId for display
			displayRecords.sort((a, b) => a.recordId - b.recordId)

			onProgress({
				parsedChunks: allResults.size,
				totalChunks: chunkOffsets.length,
				actualRecords: progress.actualRecords,
				displayRecords: [...displayRecords],
				isComplete: allResults.size === chunkOffsets.length,
				chunkResult: result
			})
		},
		[0, 1, 2] // Priority: First 3 chunks
	)

	const t1 = performance.now()

	// Merge all results (sorted by chunk index)
	const sortedResults = Array.from(allResults.values()).sort(
		(a, b) => a.chunkIndex - b.chunkIndex
	)

	return {
		result: mergeChunkResults(sortedResults, fileHeader, chunkOffsets.length),
		parseTime: t1 - t0
	}
}
