import fs from 'node:fs'
import path from 'node:path'
import { parseEvtx } from '../src/parser/index.ts'

const file = process.argv[2]
if (!file) {
	console.error('Usage: node --import tsx scripts/bench-cli.ts <file.evtx>')
	process.exit(1)
}

const buf = fs.readFileSync(path.resolve(file)).buffer as ArrayBuffer
const result = parseEvtx(buf)
console.log(`${result.totalRecords} records, ${result.numChunks} chunks`)
