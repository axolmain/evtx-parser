import {BinXmlParser} from './binxml'
import type {
	EvtxParseResult,
	ParsedEventRecord,
	TemplateStats
} from './types'
import {parseFileHeader} from './evtx-file-header'
import {parseChunk, validateChunk, preloadTemplateDefinitions} from './evtx-chunk'
import {parseEventRecord} from './evtx-record'

export function discoverChunkOffsets(
	dv: DataView,
	fileHeaderBlockSize: number
): number[] {
	const offsets: number[] = []
	let off = fileHeaderBlockSize
	while (off + 65_536 <= dv.byteLength) {
		// "ElfChnk" magic in 3 comparisons instead of 7
		if (
			dv.getUint32(off, false) === 0x45_6c_66_43 && // "ElfC"
			dv.getUint16(off + 4, false) === 0x68_6e && // "hn"
			dv.getUint8(off + 6) === 0x6b // "k"
		) {
			offsets.push(off)
		}
		off += 65_536
	}
	return offsets
}

export function parseEvtx(
	buffer: ArrayBuffer,
	onBatch?: (records: ParsedEventRecord[], progress: number) => void
): EvtxParseResult {
	const dv = new DataView(buffer)
	const fileHeader = parseFileHeader(buffer, dv)
	const chunkOffsets = discoverChunkOffsets(
		dv,
		fileHeader.headerBlockSize
	)

	const tplStats: TemplateStats = {
		compiled: new Map(),
		definitions: {},
		defsByOffset: {},
		definitionCount: 0,
		referenceCount: 0,
		missingRefs: [],
		missingCount: 0,
		currentRecordId: 0,
		parseErrors: []
	}

	let totalRecords = 0
	const allChunkWarnings: string[] = []
	const parsedRecords: ParsedEventRecord[] = []
	let batch: ParsedEventRecord[] = []

	// parse the chunks
	for (let ci = 0; ci < chunkOffsets.length; ci++) {
		const chunkOffset = chunkOffsets[ci]!
		tplStats.defsByOffset = {}
		const chunk = parseChunk(buffer, dv, chunkOffset)

		const chunkWarnings = validateChunk(ci, chunk.header, chunk.records)
		for (const w of chunkWarnings) {
			allChunkWarnings.push(w)
		}

		const chunkDv = new DataView(buffer, chunkOffset, 65_536)

		preloadTemplateDefinitions(chunkDv, chunk.header, tplStats)

		const parser = new BinXmlParser(chunkDv, chunk.header, tplStats)

		// parse the records
		for (let ri = 0; ri < chunk.records.length; ri++) {
			const r = chunk.records[ri]!
			tplStats.currentRecordId = r.recordId

			const {record} = parseEventRecord(
				r,
				chunkDv,
				chunk.header,
				tplStats,
				ci,
				parser
			)
			parsedRecords.push(record)
			if (onBatch) batch.push(record)
		}

		totalRecords += chunk.records.length

		if (onBatch && batch.length >= 500) {
			onBatch(batch, (ci + 1) / chunkOffsets.length)
			batch = []
		}
	}

	if (onBatch && batch.length > 0) {
		onBatch(batch, 1)
	}

	return {
		records: parsedRecords,
		totalRecords,
		numChunks: chunkOffsets.length,
		warnings: allChunkWarnings,
		tplStats: {
			definitionCount: tplStats.definitionCount,
			referenceCount: tplStats.referenceCount,
			missingCount: tplStats.missingCount,
			parseErrorCount: tplStats.parseErrors.length
		}
	}
}
