import { useCallback, useEffect, useRef, useState } from 'react'
import type { EvtxParseResult } from '@/parser'
import { disposeWorker, parseFileBuffer } from './useEvtxParserHelpers'

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
	const disposed = useRef(false)

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
		try {
			const buffer = await file.arrayBuffer()
			const fileSize = buffer.byteLength
			const fileName = file.name.replace(EVTX_EXT_RE, '')

			setState({status: 'parsing'})
			const {result, parseTime} = await parseFileBuffer(buffer)

			if (!disposed.current) {
				setState({status: 'done', result, fileName, fileSize, parseTime})
			}
		} catch (e) {
			if (!disposed.current) {
				setState({
					status: 'error',
					error: e instanceof Error ? e.message : String(e)
				})
			}
		}
	}, [])

	const reset = useCallback(() => {
		setState({status: 'idle'})
	}, [])

	return {state, parseFile, reset}
}
