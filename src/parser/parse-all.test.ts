import fs from 'node:fs'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {describe, expect, it} from 'vitest'
import {parseEvtx} from './evtx-parser'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_DIR = path.resolve(__dirname, '../../tests/data')

const evtxFiles = fs
	.readdirSync(DATA_DIR)
	.filter((f) => f.endsWith('.evtx'))
	.sort()

describe('parseEvtx smoke tests', () => {
	it.each(evtxFiles)('%s parses without throwing', (filename) => {
		const buffer = fs.readFileSync(path.join(DATA_DIR, filename))
		const ab = buffer.buffer.slice(
			buffer.byteOffset,
			buffer.byteOffset + buffer.byteLength
		)

		const result = parseEvtx(ab)

		expect(result.numChunks).toBeGreaterThan(0)
		expect(result.totalRecords).toBeGreaterThan(0)
		expect(result.records.length).toBe(result.totalRecords)
	})
})
