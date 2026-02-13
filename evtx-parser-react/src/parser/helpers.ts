import {HEX, TOKEN, TOKEN_NAMES} from './constants'
import type {ParsePosition} from './types'

// Shared decoder — never re-allocated
const utf16 = new TextDecoder('utf-16le')

export function filetimeToIso(dv: DataView, offset: number): string {
	const ft = dv.getBigUint64(offset, true)
	if (ft === 0n) return ''
	const ms = Number(ft / 10000n - 11644473600000n)
	const d = new Date(ms)
	if (Number.isNaN(d.getTime())) return ''
	return `${d.toISOString().slice(0, 19)}.${String(Number(ft % 10000000n)).padStart(7, '0')}Z`
}

export function hexDump(uint8arr: Uint8Array): string {
	const parts: string[] = []
	for (let i = 0; i < uint8arr.length; i++) {
		const byte = uint8arr[i]
		if (byte !== undefined) parts.push(HEX[byte] ?? '??')
	}
	return parts.join(' ')
}

export function hex32(v: number): string {
	return `0x${v.toString(16).padStart(8, '0')}`
}

export function xmlEscape(str: string): string {
	if (str.indexOf('&') === -1 && str.indexOf('<') === -1 &&
		str.indexOf('>') === -1 && str.indexOf('"') === -1 &&
		str.indexOf("'") === -1) return str
	return str
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&apos;')
}

export function readName(chunkDv: DataView, chunkRelOffset: number): string {
	const numChars = chunkDv.getUint16(chunkRelOffset + 6, true)
	const strBytes = new Uint8Array(
		chunkDv.buffer,
		chunkDv.byteOffset + chunkRelOffset + 8,
		numChars * 2
	)
	return utf16.decode(strBytes)
}

export function readUnicodeTextString(
	dv: DataView,
	bytes: Uint8Array,
	pos: ParsePosition
): string {
	const numChars = dv.getUint16(pos.offset, true)
	pos.offset += 2
	const strBytes = new Uint8Array(
		bytes.buffer,
		bytes.byteOffset + pos.offset,
		numChars * 2
	)
	pos.offset += numChars * 2
	return utf16.decode(strBytes)
}

export function tokenName(byte: number): string {
	const base = byte & ~TOKEN.HAS_MORE_DATA_FLAG
	let name = TOKEN_NAMES[base] ?? `Unknown_0x${HEX[byte] ?? '??'}`
	if (byte & TOKEN.HAS_MORE_DATA_FLAG) name += '+MoreData'
	return name
}

export function formatGuid(b: Uint8Array): string {
	// Read LE integers from bytes directly — no DataView allocation
	const d1 = ((b[3]! << 24) | (b[2]! << 16) | (b[1]! << 8) | b[0]!) >>> 0
	const d2 = (b[5]! << 8) | b[4]!
	const d3 = (b[7]! << 8) | b[6]!
	return '{' + d1.toString(16).padStart(8, '0') + '-' +
		d2.toString(16).padStart(4, '0') + '-' +
		d3.toString(16).padStart(4, '0') + '-' +
		HEX[b[8]!]! + HEX[b[9]!]! + HEX[b[10]!]! + HEX[b[11]!]! + '-' +
		HEX[b[12]!]! + HEX[b[13]!]! + HEX[b[14]!]! + HEX[b[15]!]! + '}'
}
