import {BinXmlParser} from './binxml'
import {HEX} from './constants'
import {filetimeToIso} from './helpers'
import type {
	ChunkHeader,
	EvtxRecord,
	ParsedEventRecord,
	TemplateStats
} from './types'
import {parseEventXml} from './xml-helper'

const LEVEL_NAMES: Record<number, string> = {
	1: 'Critical',
	2: 'Error',
	3: 'Warning',
	4: 'Information',
	5: 'Verbose'
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

export function parseEventRecord(
	r: EvtxRecord,
	chunkDv: DataView,
	header: ChunkHeader,
	tplStats: TemplateStats,
	chunkIndex: number,
	parser?: BinXmlParser
): {xml: string; record: ParsedEventRecord} {
	const binxmlChunkBase = r.chunkOffset + 24
	const p = parser ?? new BinXmlParser(chunkDv, header, tplStats)

	let parsedXml = ''
	try {
		parsedXml = p.parseDocument(r.binxmlBytes, binxmlChunkBase)
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
