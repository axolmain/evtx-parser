import {useCallback, useEffect, useRef, useState} from 'react'
import type {EvtxParseResult} from '@/parser'
import type {ChunkWorkerPool} from '@/worker/worker-pool'
import * as dbService from '@/db/service'
import {
	createPool,
	parseBuffer,
	parseBufferStreaming,
	type StreamingProgress
} from './useEvtxParserHelpers'

type ParseState =
	| {status: 'idle'}
	| {status: 'reading'}
	| {status: 'parsing'}
	| {
			fileName: string
			fileSize: number
			result: EvtxParseResult
			status: 'parsing-streaming'
			progress: StreamingProgress
	  }
	| {
			fileName: string
			fileSize: number
			parseTime: number
			result: EvtxParseResult
			status: 'done'
	  }
	| {error: string; status: 'error'}

const EVTX_EXT_RE = /\.evtx$/i

function isCancellation(e: unknown): boolean {
	return e instanceof Error && e.message === 'Cancelled'
}

export function useEvtxParser() {
	const [state, setState] = useState<ParseState>({status: 'idle'})
	const poolRef = useRef<ChunkWorkerPool | null | undefined>(undefined)

	const getPool = useCallback((): ChunkWorkerPool | null => {
		if (poolRef.current === undefined) {
			poolRef.current = createPool()
		}
		return poolRef.current
	}, [])

	useEffect(
		() => () => {
			poolRef.current?.dispose()
			poolRef.current = null
		},
		[]
	)

	const parseFile = useCallback(
		async (file: File, progressive = false) => {
			if (!file.name.toLowerCase().endsWith('.evtx')) {
				setState({status: 'error', error: 'Please select an .evtx file'})
				return
			}
			setState({status: 'reading'})
			try {
				const buffer = await file.arrayBuffer()
				const fileSize = buffer.byteLength
				const fileName = file.name.replace(EVTX_EXT_RE, '')

				const pool = getPool()

				if (progressive && pool) {
					// Progressive parsing mode for standalone files
					// Use file name + size as unique ID for caching
					const fileId = `standalone_${fileName}_${fileSize}`

					// Load cached chunks
					const cachedChunks = await dbService.loadCachedChunks(fileId)

					setState({status: 'parsing'})

					const {result, parseTime} = await parseBufferStreaming(
						buffer,
						pool,
						progressUpdate => {
							// Cache newly parsed chunk (non-blocking)
							if (progressUpdate.chunkResult) {
								dbService
									.cacheChunk(
										fileId,
										progressUpdate.chunkResult.chunkIndex,
										progressUpdate.chunkResult
									)
									.catch(_err => {
										// Non-blocking - ignore cache errors
									})
							}

							// Update state with progressive records
							if (progressUpdate.displayRecords.length > 0) {
								setState({
									status: 'parsing-streaming',
									fileName,
									fileSize,
									result: {
										numChunks: progressUpdate.totalChunks,
										recordOutputs: [],
										records: progressUpdate.displayRecords,
										summary: `Parsing... ${progressUpdate.parsedChunks}/${progressUpdate.totalChunks} chunks`,
										totalRecords: progressUpdate.actualRecords,
										tplStats: {
											currentRecordId: 0,
											defsByOffset: {},
											definitionCount: 0,
											definitions: {},
											missingCount: 0,
											missingRefs: [],
											parseErrors: [],
											referenceCount: 0,
											references: []
										},
										warnings: [],
										xml: ''
									},
									progress: progressUpdate
								})
							}
						},
						cachedChunks
					)

					setState({status: 'done', result, fileName, fileSize, parseTime})
				} else {
					// Standard batch parsing
					setState({status: 'parsing'})
					await new Promise<void>(r => {
						setTimeout(r, 10)
					})
					const {result, parseTime} = await parseBuffer(buffer, pool)
					setState({status: 'done', result, fileName, fileSize, parseTime})
				}
			} catch (e) {
				if (isCancellation(e)) return
				setState({
					status: 'error',
					error: e instanceof Error ? e.message : String(e)
				})
			}
		},
		[getPool]
	)

	const reset = useCallback(() => {
		const pool = poolRef.current
		if (pool) pool.cancel()
		setState({status: 'idle'})
	}, [])

	return {state, parseFile, reset}
}
