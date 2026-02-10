import {useCallback, useState} from 'react'
import type {EvtxParseResult} from '@/parser'
import {parseEvtx} from '@/parser'

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

export function useEvtxParser() {
	const [state, setState] = useState<ParseState>({status: 'idle'})

	const parseFile = useCallback(async (file: File) => {
		if (!file.name.toLowerCase().endsWith('.evtx')) {
			setState({status: 'error', error: 'Please select an .evtx file'})
			return
		}

		setState({status: 'reading'})

		try {
			const buffer = await file.arrayBuffer()
			setState({status: 'parsing'})

			// Yield to UI before heavy parse
			await new Promise<void>(r => {
				setTimeout(r, 10)
			})

			const t0 = performance.now()
			const result = parseEvtx(buffer)
			const t1 = performance.now()

			setState({
				status: 'done',
				result,
				fileName: file.name.replace(EVTX_EXT_RE, ''),
				fileSize: buffer.byteLength,
				parseTime: t1 - t0
			})
		} catch (e) {
			setState({
				status: 'error',
				error: e instanceof Error ? e.message : String(e)
			})
		}
	}, [])

	const reset = useCallback(() => {
		setState({status: 'idle'})
	}, [])

	return {state, parseFile, reset}
}
