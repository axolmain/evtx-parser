import { BinXmlParser } from './binxml'
import { HEX } from './constants'
// import {formatChunkHeaderComment, formatRecordComment} from './format'
import { formatGuid } from './helpers'
import type {
	ChunkHeader,
	EvtxParseResult,
	EvtxRecord,
	FileHeader,
	ParsedChunk,
	ParsedEventRecord,
	TemplateStats
} from './types'
import { parseEventXml } from './xml-helper'

const LEVEL_NAMES: Record<number, string> = {
	1: 'Critical',
	2: 'Error',
	3: 'Warning',
	4: 'Information',
	5: 'Verbose'
}


function filetimeToIso(dv: DataView, offset: number): string {
	const ft = dv.getBigUint64(offset, true)
	if (ft === 0n) return ''
	const ms = Number(ft / 10000n - 11644473600000n)
	const d = new Date(ms)
	if (Number.isNaN(d.getTime())) return ''
	return `${d.toISOString().slice(0, 19)}.${String(Number(ft % 10000000n)).padStart(7, '0')}Z`
}

export function parseFileHeader(
    buffer: ArrayBuffer | SharedArrayBuffer,
	dv: DataView | undefined
): FileHeader {
    // Single DataView instead of 3 typed array allocations
    dv ??= new DataView(buffer, 0, 124);

    // "ElfFile" magic in 3 comparisons instead of 7:
    // Big-endian reads so bytes compare in natural order
    if (
        dv.getUint32(0, false) !== 0x456C6646 || // "ElfF"
        dv.getUint16(4, false) !== 0x696C ||      // "il"
        dv.getUint8(6) !== 0x65                    // "e"
    ) throw new Error('Not a valid EVTX file');

    // locations found @ https://github.com/libyal/libevtx/blob/main/documentation/Windows%20XML%20Event%20Log%20(EVTX).asciidoc#2-file-header
    const headerBlockSize = dv.getUint16(40, true);
    const flags = dv.getUint32(120, true);

    return {
        headerBlockSize,
        flags,
        isDirty: (flags & 0x01) !== 0,
        isFull: (flags & 0x02) !== 0
    };
}

export function parseChunkHeader(
	_buffer: ArrayBuffer | SharedArrayBuffer,
	dv: DataView,
	chunkStart: number
): ChunkHeader {
	const commonStrings = new Uint32Array(64)
	for (let i = 0; i < 64; i++) {
		commonStrings[i] = dv.getUint32(chunkStart + 128 + i * 4, true)
	}

	const templatePtrs = new Uint32Array(32)
	for (let i = 0; i < 32; i++) {
		templatePtrs[i] = dv.getUint32(chunkStart + 384 + i * 4, true)
	}

	return {
		chunkStart,
		firstEventRecordNumber: Number(dv.getBigUint64(chunkStart + 8, true)),
		lastEventRecordNumber: Number(dv.getBigUint64(chunkStart + 16, true)),
		firstEventRecordId: Number(dv.getBigUint64(chunkStart + 24, true)),
		lastEventRecordId: Number(dv.getBigUint64(chunkStart + 32, true)),
		headerSize: dv.getUint32(chunkStart + 40, true),
		lastEventRecordOffset: chunkStart + dv.getUint32(chunkStart + 44, true),
		freeSpaceOffset: chunkStart + dv.getUint32(chunkStart + 48, true),
		eventRecordsChecksum: dv.getUint32(chunkStart + 52, true),
		flags: dv.getUint32(chunkStart + 120, true),
		headerChecksum: dv.getUint32(chunkStart + 124, true),
		commonStringOffsets: commonStrings,
		templatePointers: templatePtrs,
		recordsStart: chunkStart + 512,
		chunkEnd: chunkStart + 65_536
	}
}

export function parseRecord(
	buffer: ArrayBuffer | SharedArrayBuffer,
	dv: DataView,
	recOff: number,
	chunkStart: number,
	chunkEnd: number
): EvtxRecord | null {
	if (recOff + 28 > chunkEnd) return null

	const sig = dv.getUint32(recOff, true)
	if (sig !== 0x00_00_2a_2a) return null

	const size = dv.getUint32(recOff + 4, true)
	if (size < 28 || recOff + size > chunkEnd) return null

	const sizeCopy = dv.getUint32(recOff + size - 4, true)

	return {
		fileOffset: recOff,
		chunkOffset: recOff - chunkStart,
		recordId: Number(dv.getBigUint64(recOff + 8, true)),
		timestamp: filetimeToIso(dv, recOff + 16),
		size,
		sizeCopy,
		sizeMatch: size === sizeCopy,
		binxmlLength: size - 28,
		binxmlBytes: new Uint8Array(buffer, recOff + 24, size - 28),
		binxmlFirstByte: size > 28 ? dv.getUint8(recOff + 24) : null,
		recordSize: size
	}
}

export function validateChunk(
	ci: number,
	header: ChunkHeader,
	records: EvtxRecord[]
): string[] {
	const warnings: string[] = []

	if (header.flags & 0x01) {
		warnings.push(
			`Chunk ${ci}: has dirty/corrupted flag (0x01) — often benign, e.g. unclean shutdown`
		)
	}

	const expectedCount = header.lastEventRecordId - header.firstEventRecordId + 1
	if (records.length !== expectedCount) {
		warnings.push(
			`Chunk ${ci}: expected ${expectedCount} records (IDs ${header.firstEventRecordId}..${header.lastEventRecordId}), found ${records.length}`
		)
	}

	for (let i = 1; i < records.length; i++) {
		const curr = records[i]
		const prev = records[i - 1]
		if (curr && prev && curr.recordId !== prev.recordId + 1) {
			warnings.push(
				`Chunk ${ci}, record ${curr.recordId}: non-sequential ID (previous was ${prev.recordId})`
			)
		}
	}

	for (let i = 0; i < records.length; i++) {
		const r = records[i]
		if (!r) continue

		if (!r.sizeMatch) {
			warnings.push(
				`Record ${r.recordId}: size mismatch — header says ${r.size}, trailing copy says ${r.sizeCopy}`
			)
		}

		if (r.binxmlFirstByte !== null && r.binxmlFirstByte !== 0x0f) {
			warnings.push(
				`Record ${r.recordId}: BinXml starts with 0x${HEX[r.binxmlFirstByte] ?? '??'} instead of 0x0F (FragmentHeader)`
			)
		}

		if (r.binxmlLength === 0) {
			warnings.push(`Record ${r.recordId}: empty BinXml payload (0 bytes)`)
		}

		if (r.binxmlLength > 0 && r.binxmlLength < 4) {
			warnings.push(
				`Record ${r.recordId}: BinXml payload suspiciously small (${r.binxmlLength} bytes)`
			)
		}

		if (!r.timestamp) {
			warnings.push(`Record ${r.recordId}: missing or zero timestamp`)
		}
	}

	return warnings
}

export function parseChunk(
	buffer: ArrayBuffer | SharedArrayBuffer,
	dv: DataView,
	chunkStart: number
): ParsedChunk {
	const header = parseChunkHeader(buffer, dv, chunkStart)
	const records: EvtxRecord[] = []
	let recOff = header.recordsStart

	while (recOff < header.freeSpaceOffset) {
		const rec = parseRecord(buffer, dv, recOff, chunkStart, header.chunkEnd)
		if (!rec) break
		records.push(rec)
		recOff += rec.recordSize
	}

	return {header, records}
}

export function discoverChunkOffsets(
	dv: DataView,
	fileHeaderBlockSize: number
): number[] {
	const offsets: number[] = []
	let off = fileHeaderBlockSize
	while (off + 65_536 <= dv.byteLength) {
		// "ElfChnk" magic in 3 comparisons instead of 7
		if (
			dv.getUint32(off, false) === 0x456C6643 && // "ElfC"
			dv.getUint16(off + 4, false) === 0x686E && // "hn"
			dv.getUint8(off + 6) === 0x6B              // "k"
		) {
			offsets.push(off)
		}
		off += 65_536
	}
	return offsets
}

/**
 * Pre-load template definitions from a chunk header's template pointer table.
 * The 32-entry table is a hash table with chaining — each entry is the head
 * of a linked list. The first 4 bytes of each template definition hold the
 * "next" pointer to the next definition in the same bucket.
 */
export function preloadTemplateDefinitions(
	chunkDv: DataView,
	header: ChunkHeader,
	tplStats: TemplateStats
): void {
	for (let i = 0; i < header.templatePointers.length; i++) {
		let tplOffset = header.templatePointers[i]
		// Follow the chain for this hash bucket
		while (tplOffset !== 0 && tplOffset !== undefined) {
			if (tplStats.defsByOffset[tplOffset]) break // already cached
			try {
				if (tplOffset + 24 > 65_536) break
				const nextOffset = chunkDv.getUint32(tplOffset, true)
				const guidBytes = new Uint8Array(
					chunkDv.buffer,
					chunkDv.byteOffset + tplOffset + 4,
					16
				)
				const guid = formatGuid(guidBytes)
				const dataSize = chunkDv.getUint32(tplOffset + 20, true)

				tplStats.defsByOffset[tplOffset] = {
					guid,
					defDataOffset: tplOffset,
					dataSize,
					firstSeenRecord: 0
				}

				if (!tplStats.definitions[guid]) {
					tplStats.definitions[guid] = tplStats.defsByOffset[tplOffset]!
					tplStats.definitionCount++
				}

				tplOffset = nextOffset
			} catch {
				break
			}
		}
	}
}

export function parseEventRecord(
	r: EvtxRecord,
	chunkDv: DataView,
	chunkOffset: number,
	header: ChunkHeader,
	tplStats: TemplateStats,
	chunkIndex: number,
	parser?: BinXmlParser
): { xml: string; record: ParsedEventRecord } {
	const binxmlChunkBase = r.chunkOffset + 24
	const p = parser ?? new BinXmlParser(chunkDv, header, tplStats)

	let parsedXml = ''
	try {
		parsedXml = p.parseDocument(
			r.binxmlBytes,
			chunkOffset,
			binxmlChunkBase
		)
	} catch (e) {
		parsedXml = `<!-- BinXml parse error: ${e instanceof Error ? e.message : String(e)} -->\n`
		tplStats.parseErrors.push({
			recordId: r.recordId,
			error: e instanceof Error ? e.message : String(e)
		})
	}

	const parsed = parseEventXml(parsedXml)
	return {
		xml: parsedXml,
		record: {
			recordId: r.recordId,
			timestamp: r.timestamp,
			xml: parsedXml,
			chunkIndex,
			...parsed,
			levelText: LEVEL_NAMES[parsed.level] || `Level ${parsed.level}`
		}
	}
}

export function parseEvtx(buffer: ArrayBuffer): EvtxParseResult {
	const dv = new DataView(buffer)
	const fileHeader: FileHeader = parseFileHeader(buffer, dv)
	const chunkOffsets: number[] = discoverChunkOffsets(dv, fileHeader.headerBlockSize)

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

	let totalRecords = 0
	const allChunkWarnings: string[] = []
	const recordOutputs: string[] = []
	const parsedRecords: ParsedEventRecord[] = []

	// parse the chunks
	for (let ci = 0; ci < chunkOffsets.length; ci++) {
		const chunkOffset = chunkOffsets[ci]!
		tplStats.defsByOffset = {}
		const chunk = parseChunk(buffer, dv, chunkOffset)

		const chunkWarnings = validateChunk(ci, chunk.header, chunk.records)
		for (const w of chunkWarnings) {
			allChunkWarnings.push(w)
		}

		// const chunkHeaderText = `${formatChunkHeaderComment(ci, chunk.header)}\n\n`

		const chunkDv = new DataView(buffer, chunkOffset, 65_536)

		preloadTemplateDefinitions(chunkDv, chunk.header, tplStats)

		const parser = new BinXmlParser(chunkDv, chunk.header, tplStats)

		// parse the records
		for (let ri = 0; ri < chunk.records.length; ri++) {
			const r = chunk.records[ri]!
			tplStats.currentRecordId = r.recordId

			const { xml, record } = parseEventRecord(
				r, chunkDv, chunkOffset, chunk.header, tplStats, ci, parser
			)
			recordOutputs.push(xml)
			parsedRecords.push(record)
		}

		totalRecords += chunk.records.length
	}

	// Build summary
	const summary: string[] = []
	summary.push('<?xml version="1.0" encoding="utf-8"?>')
	// summary.push('<!-- ═══════════════════════════════════════════')
	// summary.push('   EVTX Parse Summary')
	// const fileFlags: string[] = []
	// if (fileHeader.isDirty) fileFlags.push('DIRTY')
	// if (fileHeader.isFull) fileFlags.push('FULL')
	// summary.push(
	// 	`   File flags:          ${hex32(fileHeader.flags)}${fileFlags.length > 0 ? ` (${fileFlags.join(', ')})` : ' (clean)'}`
	// )
	// summary.push(`   Chunks:              ${chunkOffsets.length}`)
	// summary.push(`   Total records:       ${totalRecords}`)
	// summary.push(`   Template definitions: ${tplStats.definitionCount}`)
	// summary.push(`   Template references:  ${tplStats.referenceCount}`)
	// summary.push(`   Missing templates:    ${tplStats.missingCount}`)
	// summary.push(`   Parse errors:         ${tplStats.parseErrors.length}`)

	// if (tplStats.definitionCount > 0) {
	// 	summary.push('')
	// 	summary.push('   Defined templates:')
	// 	const guids = Object.keys(tplStats.definitions)
	// 	for (const guid of guids) {
	// 		const d = tplStats.definitions[guid]
	// 		if (!d) continue
	// 		let refCount = 0
	// 		for (const ref of tplStats.references) {
	// 			if (ref.guid === guid) refCount++
	// 		}
	// 		summary.push(
	// 			`     ${d.guid}  offset=${hex32(d.defDataOffset)}  size=${d.dataSize}  refs=${refCount}  first=record ${d.firstSeenRecord}`
	// 		)
	// 	}
	// }

	// if (tplStats.missingCount > 0) {
	// 	summary.push('')
	// 	summary.push('   Missing template references:')
	// 	for (const m of tplStats.missingRefs) {
	// 		summary.push(
	// 			`     record ${m.recordId}: guid=${m.guid}  defOffset=${hex32(m.defDataOffset)}`
	// 		)
	// 	}
	// }

	// if (tplStats.parseErrors.length > 0) {
	// 	summary.push('')
	// 	summary.push('   Parse errors:')
	// 	for (const e of tplStats.parseErrors) {
	// 		summary.push(`     record ${e.recordId}: ${e.error}`)
	// 	}
	// }

	// summary.push('   ═══════════════════════════════════════════ -->')
	summary.push('<Events>\n')

	const summaryText = summary.join('\n')
	return {
		summary: summaryText,
		recordOutputs,
		records: parsedRecords,
		xml: `${summaryText}${recordOutputs.join('\n\n')}\n\n</Events>`,
		totalRecords,
		numChunks: chunkOffsets.length,
		warnings: allChunkWarnings,
		tplStats
	}
}
