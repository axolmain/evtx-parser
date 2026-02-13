import fs from 'node:fs'
import path from 'node:path'
import { afterAll, bench, describe } from 'vitest'
import { BinXmlParser, discoverChunkOffsets, parseChunk, parseEventRecord, parseEvtx, parseFileHeader, preloadTemplateDefinitions } from './index'
import type { TemplateStats } from './index'
import { parseEventXml } from './xml-helper'

const DATA_DIR = path.resolve(__dirname, '../../tests/data')
const RESULTS_FILE = path.resolve(DATA_DIR, '../benchmark-results.md')

interface FileInfo {
	name: string
	buffer: ArrayBuffer
	sizeBytes: number
	records: number
	chunks: number
}

const evtxFiles: FileInfo[] = fs.existsSync(DATA_DIR)
	? fs
			.readdirSync(DATA_DIR)
			.filter(f => f.toLowerCase().endsWith('.evtx'))
			.map(f => {
				const buf = fs.readFileSync(path.join(DATA_DIR, f)).buffer as ArrayBuffer
				const result = parseEvtx(buf)
				return {
					name: f,
					buffer: buf,
					sizeBytes: buf.byteLength,
					records: result.totalRecords,
					chunks: result.numChunks
				}
			})
	: []

// Collect timing results ourselves since vitest bench doesn't have JSON reporter
const timings: Record<string, Record<string, number[]>> = {}

function timed(group: string, label: string, fn: () => void) {
	if (!timings[group]) timings[group] = {}
	if (!timings[group][label]) timings[group][label] = []
	const t0 = performance.now()
	fn()
	timings[group][label].push(performance.now() - t0)
}

function writeMarkdown() {
	const version = JSON.parse(
		fs.readFileSync(path.resolve(__dirname, '../../package.json'), 'utf8')
	).version as string
	const date = new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC'

	let md = '# Parser Benchmark Results\n\n'
	md += '| Field | Value |\n'
	md += '|-------|-------|\n'
	md += `| **Version** | ${version} |\n`
	md += `| **Date** | ${date} |\n`
	md += `| **Node** | ${process.version} |\n`
	md += `| **Platform** | ${process.platform} ${process.arch} |\n`

	md += '\n## Test Files\n\n'
	md += '| File | Size | Records | Chunks |\n'
	md += '|------|------|---------|--------|\n'
	for (const f of evtxFiles) {
		const sizeMB = (f.sizeBytes / (1024 * 1024)).toFixed(2)
		md += `| ${f.name} | ${sizeMB} MB | ${f.records.toLocaleString()} | ${f.chunks} |\n`
	}

	md += '\n## Results\n\n'

	for (const [group, benches] of Object.entries(timings)) {
		md += `### ${group}\n\n`
		md += '| Benchmark | runs | avg (ms) | min (ms) | max (ms) | median (ms) |\n'
		md += '|-----------|------|----------|----------|----------|-------------|\n'
		for (const [label, samples] of Object.entries(benches)) {
			const sorted = [...samples].sort((a, b) => a - b)
			const avg = sorted.reduce((s, v) => s + v, 0) / sorted.length
			const min = sorted[0]!
			const max = sorted[sorted.length - 1]!
			const median = sorted[Math.floor(sorted.length / 2)]!
			md += `| ${label} | ${sorted.length} | ${avg.toFixed(2)} | ${min.toFixed(2)} | ${max.toFixed(2)} | ${median.toFixed(2)} |\n`
		}
		md += '\n'
	}

	fs.writeFileSync(RESULTS_FILE, md)
	console.log(`\nBenchmark results written to ${RESULTS_FILE}`)
}

if (evtxFiles.length === 0) {
	describe('parser benchmarks', () => {
		bench('no .evtx files found in tests/data/', () => {})
	})
} else {
	afterAll(() => {
		writeMarkdown()
	})

	for (const file of evtxFiles) {
		const sizeMB = (file.sizeBytes / (1024 * 1024)).toFixed(2)
		const group = `${file.name} (${sizeMB} MB, ${file.records.toLocaleString()} records, ${file.chunks} chunks)`

		describe(group, () => {
			bench('parseEvtx (full pipeline)', () => {
				timed(group, 'parseEvtx (full pipeline)', () => {
					parseEvtx(file.buffer)
				})
			}, { warmupIterations: 3, iterations: 20 })

			bench('parseFileHeader', () => {
				timed(group, 'parseFileHeader', () => {
					parseFileHeader(file.buffer, undefined)
				})
			})

			bench('discoverChunkOffsets', () => {
				timed(group, 'discoverChunkOffsets', () => {
					const dv = new DataView(file.buffer)
					const header = parseFileHeader(file.buffer, dv)
					discoverChunkOffsets(dv, header.headerBlockSize)
				})
			})

			bench('parseChunk (all chunks)', () => {
				timed(group, 'parseChunk (all chunks)', () => {
					const dv = new DataView(file.buffer)
					const header = parseFileHeader(file.buffer, dv)
					const offsets = discoverChunkOffsets(dv, header.headerBlockSize)
					for (const off of offsets) {
						parseChunk(file.buffer, dv, off)
					}
				})
			}, { warmupIterations: 3, iterations: 20 })

			bench('parseEventRecord (all records)', () => {
				timed(group, 'parseEventRecord (all records)', () => {
					const dv = new DataView(file.buffer)
					const header = parseFileHeader(file.buffer, dv)
					const offsets = discoverChunkOffsets(dv, header.headerBlockSize)
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
					for (let ci = 0; ci < offsets.length; ci++) {
						const chunkOffset = offsets[ci]!
						tplStats.defsByOffset = {}
						const chunk = parseChunk(file.buffer, dv, chunkOffset)
						const chunkDv = new DataView(file.buffer, chunkOffset, 65_536)
						preloadTemplateDefinitions(chunkDv, chunk.header, tplStats)
						for (const r of chunk.records) {
							tplStats.currentRecordId = r.recordId
							parseEventRecord(r, chunkDv, chunk.header, tplStats, ci)
						}
					}
				})
			}, { warmupIterations: 3, iterations: 20 })

			// --- Granular breakdowns of parseEventRecord ---

			bench('preloadTemplateDefinitions (all chunks)', () => {
				timed(group, 'preloadTemplateDefinitions (all chunks)', () => {
					const dv = new DataView(file.buffer)
					const header = parseFileHeader(file.buffer, dv)
					const offsets = discoverChunkOffsets(dv, header.headerBlockSize)
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
					for (const chunkOffset of offsets) {
						tplStats.defsByOffset = {}
						const chunk = parseChunk(file.buffer, dv, chunkOffset)
						const chunkDv = new DataView(file.buffer, chunkOffset, 65_536)
						preloadTemplateDefinitions(chunkDv, chunk.header, tplStats)
					}
				})
			}, { warmupIterations: 3, iterations: 20 })

			bench('BinXmlParser.parseDocument (all records)', () => {
				timed(group, 'BinXmlParser.parseDocument (all records)', () => {
					const dv = new DataView(file.buffer)
					const header = parseFileHeader(file.buffer, dv)
					const offsets = discoverChunkOffsets(dv, header.headerBlockSize)
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
					for (const chunkOffset of offsets) {
						tplStats.defsByOffset = {}
						const chunk = parseChunk(file.buffer, dv, chunkOffset)
						const chunkDv = new DataView(file.buffer, chunkOffset, 65_536)
						preloadTemplateDefinitions(chunkDv, chunk.header, tplStats)
						const parser = new BinXmlParser(chunkDv, chunk.header, tplStats)
						for (const r of chunk.records) {
							tplStats.currentRecordId = r.recordId
							const binxmlChunkBase = r.chunkOffset + 24
							parser.parseDocument(r.binxmlBytes, binxmlChunkBase)
						}
					}
				})
			}, { warmupIterations: 3, iterations: 20 })

			// Pre-parse all XML strings once so parseEventXml bench only measures field extraction
			const precomputedXml: string[] = (() => {
				const dv = new DataView(file.buffer)
				const header = parseFileHeader(file.buffer, dv)
				const offsets = discoverChunkOffsets(dv, header.headerBlockSize)
				const xmlStrings: string[] = []
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
				for (const chunkOffset of offsets) {
					tplStats.defsByOffset = {}
					const chunk = parseChunk(file.buffer, dv, chunkOffset)
					const chunkDv = new DataView(file.buffer, chunkOffset, 65_536)
					preloadTemplateDefinitions(chunkDv, chunk.header, tplStats)
					const parser = new BinXmlParser(chunkDv, chunk.header, tplStats)
					for (const r of chunk.records) {
						tplStats.currentRecordId = r.recordId
						const binxmlChunkBase = r.chunkOffset + 24
						try {
							xmlStrings.push(parser.parseDocument(r.binxmlBytes, binxmlChunkBase))
						} catch {
							xmlStrings.push('')
						}
					}
				}
				return xmlStrings
			})()

			bench('parseEventXml (all records)', () => {
				timed(group, 'parseEventXml (all records)', () => {
					for (const xml of precomputedXml) {
						if (xml) parseEventXml(xml)
					}
				})
			}, { warmupIterations: 3, iterations: 20 })
		})
	}
}
