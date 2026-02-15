import {HEX} from './constants'
import {hex32} from './helpers'
import type {ChunkHeader, EvtxRecord} from './types'

export function formatChunkHeaderComment(ci: number, h: ChunkHeader): string {
	const lines: string[] = []
	lines.push(`<!-- ═══ Chunk ${ci} ═══`)
	lines.push(`  fileOffset:    ${hex32(h.chunkStart)}`)
	lines.push(
		`  records:       ${h.firstEventRecordId} .. ${h.lastEventRecordId}`
	)
	lines.push(
		`  recordNumbers: ${h.firstEventRecordNumber} .. ${h.lastEventRecordNumber}`
	)
	lines.push(`  headerSize:    ${h.headerSize}`)
	lines.push(`  lastRecOff:    ${hex32(h.lastEventRecordOffset)}`)
	lines.push(`  freeSpaceOff:  ${hex32(h.freeSpaceOffset)}`)
	lines.push(`  evtRecCRC32:   ${hex32(h.eventRecordsChecksum)}`)
	lines.push(`  hdrCRC32:      ${hex32(h.headerChecksum)}`)

	const flagLabels: string[] = []
	if (h.flags & 0x01) flagLabels.push('CORRUPTED')
	lines.push(
		`  flags:         ${hex32(h.flags)}${flagLabels.length > 0 ? ` (${flagLabels.join(', ')})` : ''}`
	)

	const csUsed: string[] = []
	for (let i = 0; i < 64; i++) {
		if (h.commonStringOffsets[i] !== 0) {
			csUsed.push(`[${i}]=${hex32(h.commonStringOffsets[i] ?? 0)}`)
		}
	}
	if (csUsed.length > 0) {
		lines.push(`  commonStrings (${csUsed.length} used):`)
		for (let i = 0; i < csUsed.length; i += 4) {
			lines.push(`    ${csUsed.slice(i, i + 4).join('  ')}`)
		}
	} else {
		lines.push('  commonStrings: (none)')
	}

	const tpUsed: string[] = []
	for (let i = 0; i < 32; i++) {
		if (h.templatePointers[i] !== 0) {
			tpUsed.push(`[${i}]=${hex32(h.templatePointers[i] ?? 0)}`)
		}
	}
	if (tpUsed.length > 0) {
		lines.push(`  templatePtrs (${tpUsed.length} used):`)
		for (let i = 0; i < tpUsed.length; i += 4) {
			lines.push(`    ${tpUsed.slice(i, i + 4).join('  ')}`)
		}
	} else {
		lines.push('  templatePtrs: (none)')
	}

	lines.push('-->')
	return lines.join('\n')
}

export function formatRecordComment(r: EvtxRecord, ci: number): string {
	const lines: string[] = []
	lines.push(`<!-- record=${r.recordId}`)
	lines.push(`  timestamp:     ${r.timestamp}`)
	lines.push(`  chunk:         ${ci}`)
	lines.push(`  fileOffset:    ${hex32(r.fileOffset)}`)
	lines.push(`  chunkOffset:   ${hex32(r.chunkOffset)}`)
	lines.push(`  size:          ${r.size} bytes`)
	lines.push(
		`  sizeCopy:      ${r.sizeCopy}${r.sizeMatch ? ' (match)' : ' (MISMATCH!)'}`
	)
	lines.push(`  binxml:        length=${r.binxmlLength} bytes`)
	if (r.binxmlFirstByte !== null) {
		lines.push(
			`  binxmlStart:   0x${HEX[r.binxmlFirstByte] ?? '??'}${r.binxmlFirstByte === 0x0f ? ' (FragmentHeader)' : ' (UNEXPECTED!)'}`
		)
	}
	lines.push('-->')
	return lines.join('\n')
}
