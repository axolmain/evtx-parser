import {parseBinXmlDocument} from './binxml'
import {HEX} from './constants'
import {formatChunkHeaderComment, formatRecordComment} from './format'
import {formatGuid, hex32} from './helpers'
import type {
	ChunkHeader,
	EvtxParseResult,
	EvtxRecord,
	FileHeader,
	ParsedChunk,
	TemplateStats
} from './types'

function filetimeToIso(dv: DataView, offset: number): string {
	const ft = dv.getBigUint64(offset, true)
	if (ft === 0n) return ''
	const ms = Number(ft / 10000n - 11644473600000n)
	const d = new Date(ms)
	if (Number.isNaN(d.getTime())) return ''
	return `${d.toISOString().slice(0, 19)}.${String(Number(ft % 10000000n)).padStart(7, '0')}Z`
}

export function parseFileHeader(buffer: ArrayBuffer, dv: DataView): FileHeader {
	const sig = new TextDecoder().decode(new Uint8Array(buffer, 0, 8))
	if (!sig.startsWith('ElfFile')) throw new Error('Not a valid EVTX file')
	const flags = dv.getUint32(120, true)
	return {
		headerBlockSize: dv.getUint16(40, true),
		flags,
		isDirty: Boolean(flags & 0x01),
		isFull: Boolean(flags & 0x02)
	}
}

export function parseChunkHeader(
	_buffer: ArrayBuffer,
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
	buffer: ArrayBuffer,
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
	buffer: ArrayBuffer,
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
	buffer: ArrayBuffer,
	fileHeader: FileHeader
): number[] {
	const offsets: number[] = []
	let off = fileHeader.headerBlockSize
	while (off + 65_536 <= buffer.byteLength) {
		const csig = new TextDecoder().decode(new Uint8Array(buffer, off, 8))
		if (csig.startsWith('ElfChnk')) offsets.push(off)
		off += 65_536
	}
	return offsets
}

export function parseEvtx(buffer: ArrayBuffer): EvtxParseResult {
	const dv = new DataView(buffer)
	const fileHeader = parseFileHeader(buffer, dv)
	const chunkOffsets = discoverChunkOffsets(buffer, fileHeader)

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
	const allWarnings: string[] = []
	const recordOutputs: string[] = []

	for (let ci = 0; ci < chunkOffsets.length; ci++) {
		const chunkOffset = chunkOffsets[ci]!
		tplStats.defsByOffset = {}
		const chunk = parseChunk(buffer, dv, chunkOffset)

		const chunkWarnings = validateChunk(ci, chunk.header, chunk.records)
		for (const w of chunkWarnings) {
			allWarnings.push(w)
		}

		const chunkHeaderText = `${formatChunkHeaderComment(ci, chunk.header)}\n\n`

		const chunkDv = new DataView(buffer, chunkOffset, 65_536)

		// Pre-load template definitions from chunk header's template pointer table
		for (let i = 0; i < chunk.header.templatePointers.length; i++) {
			const tplOffset = chunk.header.templatePointers[i]
			if (tplOffset !== 0 && !tplStats.defsByOffset[tplOffset]) {
				try {
					// Verify offset is within chunk bounds
					if (tplOffset + 24 > 65_536) continue

					// Read 24-byte template definition header
					// [0-3]   next template def offset
					// [4-19]  GUID
					// [20-23] dataSize
					const guidBytes = new Uint8Array(
						chunkDv.buffer,
						chunkDv.byteOffset + tplOffset + 4,
						16
					)
					const guid = formatGuid(guidBytes)
					const dataSize = chunkDv.getUint32(tplOffset + 20, true)

					// Register the template definition
					tplStats.defsByOffset[tplOffset] = {
						guid,
						defDataOffset: tplOffset,
						dataSize,
						firstSeenRecord: 0 // pre-loaded from chunk header
					}

					// Track unique definitions by GUID
					if (!tplStats.definitions[guid]) {
						tplStats.definitions[guid] = tplStats.defsByOffset[tplOffset]!
						tplStats.definitionCount++
					}
				} catch {
					// Invalid template pointer, skip
				}
			}
		}

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
					chunkOffset,
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

			let recOut = ''
			if (ri === 0) recOut += chunkHeaderText
			recOut += `${formatRecordComment(r, ci)}\n`
			if (tplComment) recOut += tplComment
			recOut += parsedXml
			recordOutputs.push(recOut)
		}

		totalRecords += chunk.records.length
	}

	// Build summary
	const summary: string[] = []
	summary.push('<?xml version="1.0" encoding="utf-8"?>')
	summary.push('<!-- ═══════════════════════════════════════════')
	summary.push('   EVTX Parse Summary')
	const fileFlags: string[] = []
	if (fileHeader.isDirty) fileFlags.push('DIRTY')
	if (fileHeader.isFull) fileFlags.push('FULL')
	summary.push(
		`   File flags:          ${hex32(fileHeader.flags)}${fileFlags.length > 0 ? ` (${fileFlags.join(', ')})` : ' (clean)'}`
	)
	summary.push(`   Chunks:              ${chunkOffsets.length}`)
	summary.push(`   Total records:       ${totalRecords}`)
	summary.push(`   Template definitions: ${tplStats.definitionCount}`)
	summary.push(`   Template references:  ${tplStats.referenceCount}`)
	summary.push(`   Missing templates:    ${tplStats.missingCount}`)
	summary.push(`   Parse errors:         ${tplStats.parseErrors.length}`)

	if (tplStats.definitionCount > 0) {
		summary.push('')
		summary.push('   Defined templates:')
		const guids = Object.keys(tplStats.definitions)
		for (const guid of guids) {
			const d = tplStats.definitions[guid]
			if (!d) continue
			let refCount = 0
			for (const ref of tplStats.references) {
				if (ref.guid === guid) refCount++
			}
			summary.push(
				`     ${d.guid}  offset=${hex32(d.defDataOffset)}  size=${d.dataSize}  refs=${refCount}  first=record ${d.firstSeenRecord}`
			)
		}
	}

	if (tplStats.missingCount > 0) {
		summary.push('')
		summary.push('   Missing template references:')
		for (const m of tplStats.missingRefs) {
			summary.push(
				`     record ${m.recordId}: guid=${m.guid}  defOffset=${hex32(m.defDataOffset)}`
			)
		}
	}

	if (tplStats.parseErrors.length > 0) {
		summary.push('')
		summary.push('   Parse errors:')
		for (const e of tplStats.parseErrors) {
			summary.push(`     record ${e.recordId}: ${e.error}`)
		}
	}

	summary.push('   ═══════════════════════════════════════════ -->')
	summary.push('<Events>\n')

	const summaryText = summary.join('\n')
	return {
		summary: summaryText,
		recordOutputs,
		xml: `${summaryText}${recordOutputs.join('\n\n')}\n\n</Events>`,
		totalRecords,
		numChunks: chunkOffsets.length,
		warnings: allWarnings,
		tplStats
	}
}
