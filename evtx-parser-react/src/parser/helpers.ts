import {HEX, TOKEN, TOKEN_NAMES} from './constants'
import type {ParsePosition} from './types'

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
	return new TextDecoder('utf-16le').decode(strBytes)
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
	return new TextDecoder('utf-16le').decode(strBytes)
}

export function tokenName(byte: number): string {
	const base = byte & ~TOKEN.HAS_MORE_DATA_FLAG
	let name = TOKEN_NAMES[base] ?? `Unknown_0x${HEX[byte] ?? '??'}`
	if (byte & TOKEN.HAS_MORE_DATA_FLAG) name += '+MoreData'
	return name
}

export function formatGuid(guidBytes: Uint8Array): string {
	const dv = new DataView(guidBytes.buffer, guidBytes.byteOffset, 16)
	const d1 = dv.getUint32(0, true).toString(16).padStart(8, '0')
	const d2 = dv.getUint16(4, true).toString(16).padStart(4, '0')
	const d3 = dv.getUint16(6, true).toString(16).padStart(4, '0')
	let d4 = ''
	for (let i = 8; i < 16; i++) {
		d4 += HEX[guidBytes[i] ?? 0] ?? '??'
	}
	return `{${d1}-${d2}-${d3}-${d4.slice(0, 4)}-${d4.slice(4)}}`
}
