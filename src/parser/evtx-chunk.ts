import {HEX} from './constants'
import {formatGuid} from './helpers'
import type {
	ChunkHeader,
	EvtxRecord,
	ParsedChunk,
	TemplateStats
} from './types'
import {parseRecord} from './evtx-record'

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
