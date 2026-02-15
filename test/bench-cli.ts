import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import {parseEvtx} from '../evtx-parser-react/src/parser/evtx-parser'

const file = process.argv[2]
if (!file) {
	process.exit(1)
}

const buf = fs.readFileSync(path.resolve(file)).buffer as ArrayBuffer
const result = parseEvtx(buf)
process.stdout.write(JSON.stringify(result))
