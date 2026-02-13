import {useCallback, useEffect, useRef, useState} from 'react'
import type {EvtxParseResult, ParsedEventRecord} from '@/parser'
import {disposeWorker, parseFileBuffer} from './useEvtxParserHelpers'

export type ParseState =
	| {status: 'idle'}
	| {status: 'reading'}
	| {status: 'parsing'; progress: number; recordCount: number}
	| {
			fileName: string
			fileSize: number
			parseTime: number
			result: EvtxParseResult
			status: 'done'
	  }
	| {error: string; status: 'error'}

const EVTX_EXT_RE = /\.evtx$/i
const EMPTY: ParsedEventRecord[] = []
const THROTTLE_MS = 120

export function useEvtxParser() {
	const [state, setState] = useState<ParseState>({status: 'idle'})
	const disposed = useRef(false)
	const streamRecords = useRef<ParsedEventRecord[]>(EMPTY)

	useEffect(
		() => () => {
			disposed.current = true
			disposeWorker()
		},
		[]
	)

	const parseFile = useCallback(async (file: File) => {
		if (!file.name.toLowerCase().endsWith('.evtx')) {
			setState({status: 'error', error: 'Please select an .evtx file'})
			return
		}
		setState({status: 'reading'})
		streamRecords.current = []

		try {
			const buffer = await file.arrayBuffer()
			const fileSize = buffer.byteLength
			const fileName = file.name.replace(EVTX_EXT_RE, '')

			setState({status: 'parsing', progress: 0, recordCount: 0})

			let lastUpdate = 0

			const {result, parseTime} = await parseFileBuffer(buffer, {
				onRecords: (batch, progress) => {
					for (const r of batch) streamRecords.current.push(r)
					const now = performance.now()
					if (now - lastUpdate > THROTTLE_MS) {
						lastUpdate = now
						if (!disposed.current) {
							setState({
								status: 'parsing',
								progress,
								recordCount: streamRecords.current.length
							})
						}
					}
				}
			})

			if (!disposed.current) {
				streamRecords.current = EMPTY
				setState({status: 'done', result, fileName, fileSize, parseTime})
			}
		} catch (e) {
			if (!disposed.current) {
				streamRecords.current = EMPTY
				setState({
					status: 'error',
					error: e instanceof Error ? e.message : String(e)
				})
			}
		}
	}, [])

	const reset = useCallback(() => {
		streamRecords.current = EMPTY
		setState({status: 'idle'})
	}, [])

	const records =
		state.status === 'done'
			? state.result.records
			: state.status === 'parsing'
				? streamRecords.current
				: EMPTY

	const recordCount =
		state.status === 'done'
			? state.result.records.length
			: state.status === 'parsing'
				? state.recordCount
				: 0

	return {state, records, recordCount, parseFile, reset}
}
