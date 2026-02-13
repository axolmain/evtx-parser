import {HEX, TOKEN, TOKEN_NAMES} from './constants'
import type {ParsePosition} from './types'

// Shared decoder — never re-allocated
const utf16 = new TextDecoder('utf-16le')

// Pad helpers for manual ISO date formatting
function pad2(n: number): string {
	return n < 10 ? '0' + n : '' + n
}

function pad4(n: number): string {
	if (n < 10) return '000' + n
	if (n < 100) return '00' + n
	if (n < 1000) return '0' + n
	return '' + n
}

// civil_from_days: convert days since Unix epoch to {year, month, day}
// Based on Howard Hinnant's date algorithms
function civilFromDays(z: number): [number, number, number] {
	z += 719468
	const era = Math.floor((z >= 0 ? z : z - 146096) / 146097)
	const doe = z - era * 146097
	const yoe = Math.floor((doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365)
	const y = yoe + era * 400
	const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100))
	const mp = Math.floor((5 * doy + 2) / 153)
	const d = doy - Math.floor((153 * mp + 2) / 5) + 1
	const m = mp + (mp < 10 ? 3 : -9)
	return [y + (m <= 2 ? 1 : 0), m, d]
}

/**
 * Convert FILETIME (two 32-bit LE reads) to ISO 8601 with 100ns precision.
 * Avoids BigInt entirely — uses Number math which is safe for the ms range.
 *
 * Decomposition:
 *   ticks = hi * 2^32 + lo
 *   ms = floor(ticks / 10000) - 11644473600000
 *      = hi * 429496 + floor((hi * 7296 + lo) / 10000) - 11644473600000
 *   subSecTicks = ticks % 10000000  (for 7-digit fractional seconds)
 */
export function filetimeToIso(dv: DataView, offset: number): string {
	const lo = dv.getUint32(offset, true)
	const hi = dv.getUint32(offset + 4, true)
	if (lo === 0 && hi === 0) return ''

	// Milliseconds since Unix epoch (safe: result < 2^42 for dates through year 2100+)
	const ms = hi * 429496 + Math.floor((hi * 7296 + lo) / 10000) - 11644473600000
	if (ms !== ms) return '' // NaN check

	// Sub-second 100ns ticks: (hi * 4294967296 + lo) % 10000000
	// Decomposed to avoid exceeding Number.MAX_SAFE_INTEGER:
	// (hi % 10000000) * (4294967296 % 10000000) = (hi % 10000000) * 4967296
	const subSecTicks = (((hi % 10000000) * 4967296) % 10000000 + lo % 10000000) % 10000000

	// Manual date formatting (avoids new Date() + toISOString() allocation)
	const totalDays = Math.floor(ms / 86400000)
	const dayMs = ms - totalDays * 86400000
	const [yr, mo, dy] = civilFromDays(totalDays)
	const hours = Math.floor(dayMs / 3600000)
	const minutes = Math.floor((dayMs % 3600000) / 60000)
	const seconds = Math.floor((dayMs % 60000) / 1000)

	return pad4(yr) + '-' + pad2(mo) + '-' + pad2(dy) + 'T' +
		pad2(hours) + ':' + pad2(minutes) + ':' + pad2(seconds) + '.' +
		String(subSecTicks).padStart(7, '0') + 'Z'
}

/**
 * Render FILETIME from lo/hi uint32 values (used by binxml.ts renderSubstitutionValue).
 * Same algorithm as filetimeToIso but takes raw uint32 values instead of DataView+offset.
 */
export function filetimeLoHiToIso(lo: number, hi: number): string {
	if (lo === 0 && hi === 0) return ''
	const ms = hi * 429496 + Math.floor((hi * 7296 + lo) / 10000) - 11644473600000
	if (ms !== ms) return '' // NaN check
	const subSecTicks = (((hi % 10000000) * 4967296) % 10000000 + lo % 10000000) % 10000000
	const totalDays = Math.floor(ms / 86400000)
	const dayMs = ms - totalDays * 86400000
	const [yr, mo, dy] = civilFromDays(totalDays)
	const hours = Math.floor(dayMs / 3600000)
	const minutes = Math.floor((dayMs % 3600000) / 60000)
	const seconds = Math.floor((dayMs % 60000) / 1000)
	return pad4(yr) + '-' + pad2(mo) + '-' + pad2(dy) + 'T' +
		pad2(hours) + ':' + pad2(minutes) + ':' + pad2(seconds) + '.' +
		String(subSecTicks).padStart(7, '0') + 'Z'
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
