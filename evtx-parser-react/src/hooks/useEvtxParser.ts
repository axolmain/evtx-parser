import {useCallback, useEffect, useRef, useState} from 'react'
import type {EvtxParseResult} from '@/parser'
import type {ChunkWorkerPool} from '@/worker/worker-pool'
import {createPool, parseBuffer} from './useEvtxParserHelpers'

type ParseState =
	| {status: 'idle'}
	| {status: 'reading'}
	| {status: 'parsing'}
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
		async (file: File) => {
			if (!file.name.toLowerCase().endsWith('.evtx')) {
				setState({status: 'error', error: 'Please select an .evtx file'})
				return
			}
			setState({status: 'reading'})
			try {
				const buffer = await file.arrayBuffer()
				const fileSize = buffer.byteLength
				const fileName = file.name.replace(EVTX_EXT_RE, '')
				setState({status: 'parsing'})
				await new Promise<void>(r => {
					setTimeout(r, 10)
				})
				const {result, parseTime} = await parseBuffer(buffer, getPool())
				setState({status: 'done', result, fileName, fileSize, parseTime})
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
