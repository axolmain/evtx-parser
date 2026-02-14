import {HEX, TOKEN, VALUE_TYPE} from './constants'
import {filetimeLoHiToIso, formatGuid, hex32, tokenName, xmlEscape} from './helpers'
import type {ChunkHeader, ParsePosition, SubstitutionValue, TemplateStats} from './types'

const EMPTY_BYTES = new Uint8Array(0)

export class BinXmlParser {
	static utf16 = new TextDecoder('utf-16le')
	static ascii = new TextDecoder('ascii')

	chunkDv: DataView
	chunkHeader: ChunkHeader | null
	tplStats: TemplateStats

	constructor(chunkDv: DataView, chunkHeader: ChunkHeader | null, tplStats: TemplateStats) {
		this.chunkDv = chunkDv
		this.chunkHeader = chunkHeader
		this.tplStats = tplStats
	}

	private readName(off: number): string {
		const n = this.chunkDv.getUint16(off + 6, true)
		return BinXmlParser.utf16.decode(new Uint8Array(this.chunkDv.buffer, this.chunkDv.byteOffset + off + 8, n * 2))
	}

	private readUtf16(bytes: Uint8Array, pos: ParsePosition, bias: number): string {
		const n = this.chunkDv.getUint16(bias + pos.offset, true)
		pos.offset += 2
		const s = BinXmlParser.utf16.decode(new Uint8Array(bytes.buffer, bytes.byteOffset + pos.offset, n * 2))
		pos.offset += n * 2
		return s
	}

	private toHex(bytes: Uint8Array): string {
		let h = ''
		for (let i = 0; i < bytes.length; i++) h += HEX[bytes[i]!]!
		return h
	}

	private renderValue(vb: Uint8Array, vt: number): string {
		if (vb.length === 0) return ''

		// Array types
		if (vt & 0x80) {
			const base = vt & 0x7f
			if (base === VALUE_TYPE.STRING) {
				return xmlEscape(BinXmlParser.utf16.decode(vb).split('\0').filter(Boolean).join(', '))
			}
			const sizes: Record<number, number> = {
				[VALUE_TYPE.INT8]: 1,
				[VALUE_TYPE.UINT8]: 1,
				[VALUE_TYPE.INT16]: 2,
				[VALUE_TYPE.UINT16]: 2,
				[VALUE_TYPE.INT32]: 4,
				[VALUE_TYPE.UINT32]: 4,
				[VALUE_TYPE.FLOAT]: 4,
				[VALUE_TYPE.HEX32]: 4,
				[VALUE_TYPE.INT64]: 8,
				[VALUE_TYPE.UINT64]: 8,
				[VALUE_TYPE.DOUBLE]: 8,
				[VALUE_TYPE.FILETIME]: 8,
				[VALUE_TYPE.HEX64]: 8,
				[VALUE_TYPE.GUID]: 16,
				[VALUE_TYPE.SYSTEMTIME]: 16,
			}
			const es = sizes[base]
			if (es && vb.length >= es) {
				const r: string[] = []
				for (let i = 0; i + es <= vb.length; i += es)
					r.push(this.renderValue(new Uint8Array(vb.buffer, vb.byteOffset + i, es), base))
				return r.join(', ')
			}
			return this.toHex(vb)
		}

		const o = vb.byteOffset - this.chunkDv.byteOffset
		const dv = this.chunkDv

		switch (vt) {
			case VALUE_TYPE.NULL:
				return ''
			case VALUE_TYPE.STRING: {
				let s = BinXmlParser.utf16.decode(vb)
				return xmlEscape(s.endsWith('\0') ? s.slice(0, -1) : s)
			}
			case VALUE_TYPE.ANSI_STRING: {
				let s = BinXmlParser.ascii.decode(vb)
				return xmlEscape(s.endsWith('\0') ? s.slice(0, -1) : s)
			}
			case VALUE_TYPE.INT8:
				return String(dv.getInt8(o))
			case VALUE_TYPE.UINT8:
				return String(dv.getUint8(o))
			case VALUE_TYPE.INT16:
				return String(dv.getInt16(o, true))
			case VALUE_TYPE.UINT16:
				return String(dv.getUint16(o, true))
			case VALUE_TYPE.INT32:
				return String(dv.getInt32(o, true))
			case VALUE_TYPE.UINT32:
				return String(dv.getUint32(o, true))
			case VALUE_TYPE.INT64:
				return String(dv.getBigInt64(o, true))
			case VALUE_TYPE.UINT64:
				return String(dv.getBigUint64(o, true))
			case VALUE_TYPE.FLOAT:
				return String(dv.getFloat32(o, true))
			case VALUE_TYPE.DOUBLE:
				return String(dv.getFloat64(o, true))
			case VALUE_TYPE.BOOL:
				return dv.getUint32(o, true) ? 'true' : 'false'
			case VALUE_TYPE.BINARY:
				return this.toHex(vb)
			case VALUE_TYPE.HEX32:
				return `0x${dv.getUint32(o, true).toString(16).padStart(8, '0')}`
			case VALUE_TYPE.HEX64:
				return `0x${dv.getBigUint64(o, true).toString(16).padStart(16, '0')}`
			case VALUE_TYPE.SIZE:
				return vb.length === 8
					? `0x${dv.getBigUint64(o, true).toString(16).padStart(16, '0')}`
					: `0x${dv.getUint32(o, true).toString(16).padStart(8, '0')}`
			case VALUE_TYPE.FILETIME:
				return vb.length < 8 ? '' : filetimeLoHiToIso(dv.getUint32(o, true), dv.getUint32(o + 4, true))
			case VALUE_TYPE.SYSTEMTIME: {
				if (vb.length < 16) return ''
				const g = (off: number) => dv.getUint16(o + off, true)
				const p = (v: number, n: number) => String(v).padStart(n, '0')
				return `${g(0)}-${p(g(2), 2)}-${p(g(6), 2)}T${p(g(8), 2)}:${p(g(10), 2)}:${p(g(12), 2)}.${p(g(14), 3)}Z`
			}
			case VALUE_TYPE.GUID: {
				if (vb.length < 16) return ''
				const d1 = dv.getUint32(o, true).toString(16).padStart(8, '0')
				const d2 = dv.getUint16(o + 4, true).toString(16).padStart(4, '0')
				const d3 = dv.getUint16(o + 6, true).toString(16).padStart(4, '0')
				let tail = ''
				for (let i = 8; i < 16; i++) tail += HEX[vb[i]!]!
				return `{${d1}-${d2}-${d3}-${tail.slice(0, 4)}-${tail.slice(4)}}`
			}
			case VALUE_TYPE.SID: {
				if (vb.length < 8) return ''
				let auth = 0
				for (let i = 2; i < 8; i++) auth = auth * 256 + vb[i]!
				let sid = `S-${vb[0]}-${auth}`
				for (let i = 0; i < vb[1]! && 8 + i * 4 + 4 <= vb.length; i++)
					sid += `-${dv.getUint32(o + 8 + i * 4, true)}`
				return sid
			}
			case VALUE_TYPE.BINXML:
				return this.parseDocument(vb, vb.byteOffset - this.chunkDv.byteOffset)
			default:
				return `<!-- unknown type 0x${HEX[vt] ?? '??'} -->${this.toHex(vb)}`
		}
	}

	private resolveSub(subs: SubstitutionValue[] | null, id: number, optional: boolean): string {
		if (!subs || id >= subs.length) return ''
		const sub = subs[id]!
		if (optional && (sub.type === VALUE_TYPE.NULL || sub.size === 0)) return ''
		if (sub.rendered === null) sub.rendered = this.renderValue(sub.bytes, sub.type)
		return sub.rendered
	}

	// Skip past an inline name definition if the offset points to current position
	private skipInlineName(bytes: Uint8Array, pos: ParsePosition, nameOff: number, chunkBase: number, bias: number) {
		if (nameOff === chunkBase + pos.offset) {
			const chars = this.chunkDv.getUint16(bias + pos.offset + 6, true)
			pos.offset += 10 + chars * 2
		}
	}

	private parseContent(bytes: Uint8Array, pos: ParsePosition, subs: SubstitutionValue[] | null, chunkBase: number): string {
		const bias = bytes.byteOffset - this.chunkDv.byteOffset
		let xml = ''

		while (pos.offset < bytes.length) {
			const tok = bytes[pos.offset]!
			const base = tok & ~TOKEN.HAS_MORE_DATA_FLAG

			if (base === TOKEN.EOF || base === TOKEN.CLOSE_START_ELEMENT ||
				base === TOKEN.CLOSE_EMPTY_ELEMENT || base === TOKEN.END_ELEMENT ||
				base === TOKEN.ATTRIBUTE) break

			switch (base) {
				case TOKEN.OPEN_START_ELEMENT:
					xml += this.parseElement(bytes, pos, subs, chunkBase)
					break
				case TOKEN.VALUE:
					pos.offset += 2 // token + type
					xml += xmlEscape(this.readUtf16(bytes, pos, bias))
					break
				case TOKEN.NORMAL_SUBSTITUTION: {
					pos.offset++
					const id = this.chunkDv.getUint16(bias + pos.offset, true)
					pos.offset += 3 // id + type
					xml += this.resolveSub(subs, id, false)
					break
				}
				case TOKEN.OPTIONAL_SUBSTITUTION: {
					pos.offset++
					const id = this.chunkDv.getUint16(bias + pos.offset, true)
					pos.offset += 3
					xml += this.resolveSub(subs, id, true)
					break
				}
				case TOKEN.CHAR_REF: {
					pos.offset++
					xml += `&#${this.chunkDv.getUint16(bias + pos.offset, true)};`
					pos.offset += 2
					break
				}
				case TOKEN.ENTITY_REF: {
					pos.offset++
					const off = this.chunkDv.getUint32(bias + pos.offset, true)
					pos.offset += 4
					xml += `&${this.readName(off)};`
					break
				}
				case TOKEN.CDATA_SECTION:
					pos.offset++
					xml += `<![CDATA[${this.readUtf16(bytes, pos, bias)}]]>`
					break
				case TOKEN.TEMPLATE_INSTANCE:
					xml += this.parseTemplateInstance(bytes, pos, chunkBase)
					break
				case TOKEN.FRAGMENT_HEADER:
					xml += this.parseFragment(bytes, pos, chunkBase)
					break
				default:
					xml += `<!-- UNEXPECTED token 0x${HEX[tok] ?? '??'} (${tokenName(tok)}) at ${pos.offset} -->`
					pos.offset++
			}
		}
		return xml
	}

	private parseElement(bytes: Uint8Array, pos: ParsePosition, subs: SubstitutionValue[] | null, chunkBase: number): string {
		const bias = bytes.byteOffset - this.chunkDv.byteOffset
		const hasAttrs = Boolean(bytes[pos.offset]! & TOKEN.HAS_MORE_DATA_FLAG)
		pos.offset += 7 // token + depId(2) + dataSize(4)

		const nameOff = this.chunkDv.getUint32(bias + pos.offset, true)
		pos.offset += 4
		this.skipInlineName(bytes, pos, nameOff, chunkBase, bias)
		const name = this.readName(nameOff)

		let xml = `<${name}`

		if (hasAttrs) {
			const listSize = this.chunkDv.getUint32(bias + pos.offset, true)
			pos.offset += 4
			const end = pos.offset + listSize
			while (pos.offset < end) {
				if ((bytes[pos.offset]! & ~TOKEN.HAS_MORE_DATA_FLAG) !== TOKEN.ATTRIBUTE) break
				pos.offset++
				const aOff = this.chunkDv.getUint32(bias + pos.offset, true)
				pos.offset += 4
				this.skipInlineName(bytes, pos, aOff, chunkBase, bias)
				xml += ` ${this.readName(aOff)}="${this.parseContent(bytes, pos, subs, chunkBase)}"`
			}
		}

		if (pos.offset >= bytes.length) return `${xml}/>`

		const close = bytes[pos.offset]!
		if (close === TOKEN.CLOSE_EMPTY_ELEMENT) {
			pos.offset++;
			return `${xml}/>`
		}
		if (close === TOKEN.CLOSE_START_ELEMENT) {
			pos.offset++
			xml += `>${this.parseContent(bytes, pos, subs, chunkBase)}`
			if (pos.offset < bytes.length && bytes[pos.offset] === TOKEN.END_ELEMENT) pos.offset++
			return `${xml}</${name}>`
		}
		return `${xml}><!-- BAD close 0x${HEX[close] ?? '??'} --></${name}>`
	}

	private parseTemplateInstance(bytes: Uint8Array, pos: ParsePosition, chunkBase: number): string {
		const bias = bytes.byteOffset - this.chunkDv.byteOffset
		pos.offset += 6 // token(1) + unknown1(1) + unknown2(4)
		const defOff = this.chunkDv.getUint32(bias + pos.offset, true)
		pos.offset += 4

		const isInline = defOff === chunkBase + pos.offset
		let guid = '', dataSize = 0

		if (isInline) {
			pos.offset += 4 // next def offset
			guid = formatGuid(new Uint8Array(bytes.buffer, bytes.byteOffset + pos.offset, 16))
			pos.offset += 16
			dataSize = this.chunkDv.getUint32(bias + pos.offset, true)
			pos.offset += 4 + dataSize
		} else if (this.tplStats.defsByOffset[defOff]) {
			guid = this.tplStats.defsByOffset[defOff]!.guid
			dataSize = this.tplStats.defsByOffset[defOff]!.dataSize
		} else if (defOff + 24 <= this.chunkDv.byteLength) {
			guid = formatGuid(new Uint8Array(this.chunkDv.buffer, this.chunkDv.byteOffset + defOff + 4, 16))
			dataSize = this.chunkDv.getUint32(defOff + 20, true)
		}

		// Cache definition
		if (guid && !this.tplStats.defsByOffset[defOff]) {
			const def = {guid, defDataOffset: defOff, dataSize, firstSeenRecord: this.tplStats.currentRecordId}
			this.tplStats.defsByOffset[defOff] = def
			if (!this.tplStats.definitions[guid]) {
				this.tplStats.definitions[guid] = def
				this.tplStats.definitionCount++
			}
		}
		this.tplStats.referenceCount++

		// Read substitution values
		const numValues = this.chunkDv.getUint32(bias + pos.offset, true)
		pos.offset += 4
		const descStart = pos.offset
		pos.offset += numValues * 4

		const subs: SubstitutionValue[] = []
		for (let i = 0; i < numValues; i++) {
			const dOff = descStart + i * 4
			const size = this.chunkDv.getUint16(bias + dOff, true)
			const type = bytes[dOff + 2] ?? 0
			const vb = size > 0 && pos.offset + size <= bytes.length
				? new Uint8Array(bytes.buffer, bytes.byteOffset + pos.offset, size)
				: EMPTY_BYTES
			pos.offset += size
			subs.push({type, size, bytes: vb, rendered: null})
		}

		// Parse template body
		if (dataSize === 0 || defOff + 24 + dataSize > this.chunkDv.byteLength) {
			this.tplStats.missingRefs.push({
				recordId: this.tplStats.currentRecordId,
				guid: guid || '(unknown)',
				defDataOffset: defOff
			})
			this.tplStats.missingCount++
			return `<!-- missing template def at ${hex32(defOff)} -->`
		}

		const bodyStart = defOff + 24
		const tplBytes = new Uint8Array(this.chunkDv.buffer, this.chunkDv.byteOffset + bodyStart, dataSize)
		const tplPos: ParsePosition = {offset: 0}
		if (tplBytes.length >= 4 && tplBytes[0] === TOKEN.FRAGMENT_HEADER) tplPos.offset += 4

		return this.parseContent(tplBytes, tplPos, subs, bodyStart)
	}

	parseDocument(binxml: Uint8Array, chunkBase: number): string {
		const pos: ParsePosition = {offset: 0}
		const bias = binxml.byteOffset - this.chunkDv.byteOffset
		let xml = ''

		while (pos.offset < binxml.length) {
			const tok = binxml[pos.offset]!
			const base = tok & ~TOKEN.HAS_MORE_DATA_FLAG
			if (base === TOKEN.EOF) break

			if (base === TOKEN.FRAGMENT_HEADER) {
				xml += this.parseFragment(binxml, pos, chunkBase)
			} else if (base === TOKEN.PI_TARGET) {
				pos.offset++
				const name = this.readName(this.chunkDv.getUint32(bias + pos.offset, true))
				pos.offset += 4
				let pi = `<?${name}`
				if (pos.offset < binxml.length && binxml[pos.offset] === TOKEN.PI_DATA) {
					pos.offset++
					pi += ` ${this.readUtf16(binxml, pos, bias)}`
				}
				xml += `${pi}?>`
			} else {
				xml += `<!-- UNEXPECTED doc token 0x${HEX[tok] ?? '??'} (${tokenName(tok)}) at ${pos.offset} -->`
				break
			}
		}
		return xml
	}

	private parseFragment(binxml: Uint8Array, pos: ParsePosition, chunkBase: number): string {
		if (pos.offset + 4 > binxml.length) return `<!-- TRUNCATED fragment at ${pos.offset} -->`
		pos.offset += 4
		if (pos.offset >= binxml.length) return '<!-- TRUNCATED after fragment header -->'

		const base = binxml[pos.offset]! & ~TOKEN.HAS_MORE_DATA_FLAG
		if (base === TOKEN.TEMPLATE_INSTANCE) return this.parseTemplateInstance(binxml, pos, chunkBase)
		if (base === TOKEN.OPEN_START_ELEMENT) return this.parseElement(binxml, pos, null, chunkBase)
		return `<!-- UNEXPECTED post-fragment 0x${HEX[binxml[pos.offset]!] ?? '??'} at ${pos.offset} -->`
	}
}