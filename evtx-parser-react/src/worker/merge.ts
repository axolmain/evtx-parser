import {hex32} from '@/parser/helpers'
import type {EvtxParseResult, FileHeader, TemplateStats} from '@/parser/types'
import type {ChunkParseSuccess} from './protocol'

export function mergeChunkResults(
	results: ChunkParseSuccess[],
	fileHeader: FileHeader,
	numChunks: number
): EvtxParseResult {
	// Merge all record outputs, warnings, and stats in chunk order
	const recordOutputs: string[] = []
	const allWarnings: string[] = []
	let totalRecords = 0

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

	for (const r of results) {
		for (const o of r.recordOutputs) recordOutputs.push(o)
		for (const w of r.warnings) allWarnings.push(w)
		totalRecords += r.recordCount

		const ps = r.partialStats
		// Merge definitions by GUID (first-seen wins)
		for (const guid of Object.keys(ps.definitions)) {
			if (!tplStats.definitions[guid]) {
				tplStats.definitions[guid] = ps.definitions[guid]!
				tplStats.definitionCount++
			}
		}
		for (const ref of ps.references) tplStats.references.push(ref)
		tplStats.referenceCount += ps.referenceCount
		for (const m of ps.missingRefs) tplStats.missingRefs.push(m)
		tplStats.missingCount += ps.missingCount
		for (const e of ps.parseErrors) tplStats.parseErrors.push(e)
	}

	// Build summary — same format as parseEvtx
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
	summary.push(`   Chunks:              ${numChunks}`)
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
		numChunks,
		warnings: allWarnings,
		tplStats
	}
}
