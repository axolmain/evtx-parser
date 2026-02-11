import {parseBinXmlDocument} from '@/parser/binxml'
import {
	parseChunk,
	preloadTemplateDefinitions,
	validateChunk
} from '@/parser/evtx'
import {formatChunkHeaderComment, formatRecordComment} from '@/parser/format'
import {hex32} from '@/parser/helpers'
import {parseEventXml} from '@/parser/xml-helper'
import type {ChunkHeader, EvtxRecord, ParsedEventRecord, TemplateStats} from '@/parser/types'
import type {
	ChunkParseError,
	ChunkParseRequest,
	ChunkParseSuccess
} from './protocol'

const LEVEL_NAMES: Record<number, string> = {
	1: 'Critical',
	2: 'Error',
	3: 'Warning',
	4: 'Information',
	5: 'Verbose'
}

function extractEventFields(xmlString: string): Omit<ParsedEventRecord, 'recordId' | 'timestamp' | 'xml' | 'chunkIndex'> {
	const parsed = parseEventXml(xmlString)

	return {
		...parsed,
		levelText: LEVEL_NAMES[parsed.level] || `Level ${parsed.level}`
	}
}

/**
 * Adjust a chunk header's absolute offsets from chunkStart=0 to the real
 * file offset so that formatted comments match the main-thread path.
 */
function adjustHeader(h: ChunkHeader, fileOffset: number): ChunkHeader {
	return {
		...h,
		chunkStart: fileOffset,
		lastEventRecordOffset: h.lastEventRecordOffset + fileOffset,
		freeSpaceOffset: h.freeSpaceOffset + fileOffset,
		recordsStart: h.recordsStart + fileOffset,
		chunkEnd: h.chunkEnd + fileOffset
	}
}

/** Adjust a record's fileOffset from chunk-relative to file-absolute. */
function adjustRecord(r: EvtxRecord, fileOffset: number): EvtxRecord {
	return {...r, fileOffset: r.fileOffset + fileOffset}
}

function handleChunk(
	msg: ChunkParseRequest
): ChunkParseError | ChunkParseSuccess {
	const {chunkFileOffset, chunkIndex, id, sharedBuffer, chunkBuffer, chunkOffset, chunkLength} = msg

	try {
		// Determine buffer mode and create appropriate DataView
		let buffer: ArrayBuffer | SharedArrayBuffer
		let dv: DataView
		let chunkStart: number

		if (sharedBuffer) {
			// SharedArrayBuffer mode: Use shared buffer with offset/length
			buffer = sharedBuffer
			dv = new DataView(sharedBuffer, chunkOffset, chunkLength)
			chunkStart = chunkOffset
		} else if (chunkBuffer) {
			// Fallback mode: Use transferred ArrayBuffer
			buffer = chunkBuffer
			dv = new DataView(chunkBuffer, 0, chunkLength)
			chunkStart = 0
		} else {
			throw new Error('No buffer provided (neither sharedBuffer nor chunkBuffer)')
		}

		const tplStats: TemplateStats = {
			definitions: {},
			defsByOffset: {},
			definitionCount: 0,
			references: [],
			referenceCount: 0,
			missingRefs: [],
			missingCount: 0,
			currentRecordId: 0,
			parseErrors: []
		}

		const chunk = parseChunk(buffer, dv, chunkStart)

		// Use adjusted header/records for validation and formatting
		const adjHeader = adjustHeader(chunk.header, chunkFileOffset)
		const adjRecords = chunk.records.map(r => adjustRecord(r, chunkFileOffset))
		const warnings = validateChunk(chunkIndex, adjHeader, adjRecords)

		const chunkDv = new DataView(buffer, 0, Math.min(65_536, buffer.byteLength))

		preloadTemplateDefinitions(chunkDv, chunk.header, tplStats)

		const chunkHeaderText = `${formatChunkHeaderComment(chunkIndex, adjHeader)}\n\n`
		const recordOutputs: string[] = []
		const parsedRecords: ParsedEventRecord[] = []

		for (let ri = 0; ri < chunk.records.length; ri++) {
			const r = chunk.records[ri]!
			tplStats.currentRecordId = r.recordId
			const refsBefore = tplStats.referenceCount
			const binxmlChunkBase = r.chunkOffset + 24

			let parsedXml = ''
			try {
				parsedXml = parseBinXmlDocument(
					r.binxmlBytes,
					chunkDv,
					chunkStart,
					chunk.header,
					tplStats,
					binxmlChunkBase
				)
			} catch (e) {
				parsedXml = `<!-- BinXml parse error: ${e instanceof Error ? e.message : String(e)} -->\n`
				tplStats.parseErrors.push({
					recordId: r.recordId,
					error: e instanceof Error ? e.message : String(e)
				})
			}

			let tplComment = ''
			const refsForRecord = tplStats.references.slice(refsBefore)
			if (refsForRecord.length > 0) {
				const ref = refsForRecord[0]!
				const def = tplStats.defsByOffset[ref.defDataOffset]
				tplComment = `<!-- template: guid=${ref.guid || '(back-ref)'} defOffset=${hex32(ref.defDataOffset)} dataSize=${ref.dataSize}${ref.isInline ? ' (INLINE definition)' : ` (back-reference${def ? `, defined in record ${def.firstSeenRecord}` : ''})`} -->\n`
			}

			// Use adjusted record for comment formatting (correct file offset)
			const adjR = adjRecords[ri]!
			let recOut = ''
			if (ri === 0) recOut += chunkHeaderText
			recOut += `${formatRecordComment(adjR, chunkIndex)}\n`
			if (tplComment) recOut += tplComment
			recOut += parsedXml
			recordOutputs.push(recOut)

			// Store structured record data for table view
			const extracted = extractEventFields(parsedXml)
			parsedRecords.push({
				recordId: r.recordId,
				timestamp: r.timestamp,
				xml: parsedXml,
				chunkIndex,
				...extracted
			})
		}

		return {
			type: 'chunk-success',
			id,
			chunkIndex,
			recordOutputs,
			records: parsedRecords,
			warnings,
			recordCount: chunk.records.length,
			partialStats: {
				definitions: tplStats.definitions,
				definitionCount: tplStats.definitionCount,
				references: tplStats.references,
				referenceCount: tplStats.referenceCount,
				missingRefs: tplStats.missingRefs,
				missingCount: tplStats.missingCount,
				parseErrors: tplStats.parseErrors
			}
		}
	} catch (e) {
		return {
			type: 'chunk-error',
			id,
			chunkIndex,
			error: e instanceof Error ? e.message : String(e)
		}
	}
}

self.onmessage = (e: MessageEvent<ChunkParseRequest>) => {
	const result = handleChunk(e.data)
	self.postMessage(result)
}
