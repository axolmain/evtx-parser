import {HEX, TOKEN, VALUE_TYPE} from './constants'
import {filetimeLoHiToIso, formatGuid, hex32, tokenName, xmlEscape} from './helpers'
import type {ChunkHeader, CompiledTemplate, ParsePosition, SubstitutionValue, TemplateStats} from './types'

// Shared empty bytes — reused for all zero-size substitution values
const EMPTY_BYTES = new Uint8Array(0)

interface CompileBuilder {
	parts: string[]
	subIds: number[]
	isOptional: boolean[]
	bail: boolean
}

export class BinXmlParser {
	// Cached decoders — shared across ALL instances, never re-allocated
	static utf16 = new TextDecoder('utf-16le')
	static ascii = new TextDecoder('ascii')

	// Instance fields — set once per chunk, constant during parse
	chunkDv: DataView
	chunkHeader: ChunkHeader | null
	tplStats: TemplateStats
	constructor(
		chunkDv: DataView,
		chunkHeader: ChunkHeader | null,
		tplStats: TemplateStats
	) {
		this.chunkDv = chunkDv
		this.chunkHeader = chunkHeader
		this.tplStats = tplStats
	}

	private readName(chunkRelOffset: number): string {
		const numChars = this.chunkDv.getUint16(chunkRelOffset + 6, true)
		const strBytes = new Uint8Array(
			this.chunkDv.buffer,
			this.chunkDv.byteOffset + chunkRelOffset + 8,
			numChars * 2
		)
		return BinXmlParser.utf16.decode(strBytes)
	}

	// Uses this.chunkDv with bias computed from bytes.byteOffset — no local DataView needed
	private readUnicodeTextString(
		bytes: Uint8Array,
		pos: ParsePosition,
		dvBias: number
	): string {
		const numChars = this.chunkDv.getUint16(dvBias + pos.offset, true)
		pos.offset += 2
		const strBytes = new Uint8Array(
			bytes.buffer,
			bytes.byteOffset + pos.offset,
			numChars * 2
		)
		pos.offset += numChars * 2
		return BinXmlParser.utf16.decode(strBytes)
	}

	private renderSubstitutionValue(
		valueBytes: Uint8Array,
		valueType: number
	): string {
		if (valueBytes.length === 0) return ''

		// Array flag: bit 0x80 means array of base type
		if (valueType & 0x80) {
			const baseType = valueType & 0x7f
			// Array of strings: null-terminated UTF-16LE strings concatenated
			if (baseType === VALUE_TYPE.STRING) {
				const s = BinXmlParser.utf16.decode(valueBytes)
				const parts = s.split('\0').filter(p => p.length > 0)
				return xmlEscape(parts.join(', '))
			}
			// Fixed-size array types
			let elemSize = 0
			if (baseType === VALUE_TYPE.INT8 || baseType === VALUE_TYPE.UINT8) {
				elemSize = 1
			} else if (
				baseType === VALUE_TYPE.INT16 ||
				baseType === VALUE_TYPE.UINT16
			) {
				elemSize = 2
			} else if (
				baseType === VALUE_TYPE.INT32 ||
				baseType === VALUE_TYPE.UINT32 ||
				baseType === VALUE_TYPE.FLOAT ||
				baseType === VALUE_TYPE.HEX32
			) {
				elemSize = 4
			} else if (
				baseType === VALUE_TYPE.INT64 ||
				baseType === VALUE_TYPE.UINT64 ||
				baseType === VALUE_TYPE.DOUBLE ||
				baseType === VALUE_TYPE.FILETIME ||
				baseType === VALUE_TYPE.HEX64
			) {
				elemSize = 8
			} else if (
				baseType === VALUE_TYPE.GUID ||
				baseType === VALUE_TYPE.SYSTEMTIME
			) {
				elemSize = 16
			}
			if (elemSize > 0 && valueBytes.length >= elemSize) {
				const results: string[] = []
				for (let i = 0; i + elemSize <= valueBytes.length; i += elemSize) {
					const elem = new Uint8Array(
						valueBytes.buffer,
						valueBytes.byteOffset + i,
						elemSize
					)
					results.push(this.renderSubstitutionValue(elem, baseType))
				}
				return results.join(', ')
			}
			// Fallback: render as hex (string concat instead of array+join)
			let hex = ''
			for (let i = 0; i < valueBytes.length; i++) {
				hex += HEX[valueBytes[i]!]!
			}
			return hex
		}

		// Scalar types — use this.chunkDv with offset instead of allocating a new DataView
		const vOff = valueBytes.byteOffset - this.chunkDv.byteOffset

		switch (valueType) {
			case VALUE_TYPE.NULL:
				return ''
			case VALUE_TYPE.STRING: {
				let s = BinXmlParser.utf16.decode(valueBytes)
				if (s.endsWith('\0')) s = s.slice(0, -1)
				return xmlEscape(s)
			}
			case VALUE_TYPE.ANSI_STRING: {
				let s = BinXmlParser.ascii.decode(valueBytes)
				if (s.endsWith('\0')) s = s.slice(0, -1)
				return xmlEscape(s)
			}
			case VALUE_TYPE.INT8:
				return String(this.chunkDv.getInt8(vOff))
			case VALUE_TYPE.UINT8:
				return String(this.chunkDv.getUint8(vOff))
			case VALUE_TYPE.INT16:
				return String(this.chunkDv.getInt16(vOff, true))
			case VALUE_TYPE.UINT16:
				return String(this.chunkDv.getUint16(vOff, true))
			case VALUE_TYPE.INT32:
				return String(this.chunkDv.getInt32(vOff, true))
			case VALUE_TYPE.UINT32:
				return String(this.chunkDv.getUint32(vOff, true))
			case VALUE_TYPE.INT64:
				return String(this.chunkDv.getBigInt64(vOff, true))
			case VALUE_TYPE.UINT64:
				return String(this.chunkDv.getBigUint64(vOff, true))
			case VALUE_TYPE.FLOAT:
				return String(this.chunkDv.getFloat32(vOff, true))
			case VALUE_TYPE.DOUBLE:
				return String(this.chunkDv.getFloat64(vOff, true))
			case VALUE_TYPE.BOOL:
				return this.chunkDv.getUint32(vOff, true) ? 'true' : 'false'
			case VALUE_TYPE.BINARY: {
				let hex = ''
				for (let i = 0; i < valueBytes.length; i++) {
					hex += HEX[valueBytes[i]!]!
				}
				return hex
			}
			case VALUE_TYPE.GUID: {
				if (valueBytes.length < 16) return ''
				const d1 = this.chunkDv
					.getUint32(vOff, true)
					.toString(16)
					.padStart(8, '0')
				const d2 = this.chunkDv
					.getUint16(vOff + 4, true)
					.toString(16)
					.padStart(4, '0')
				const d3 = this.chunkDv
					.getUint16(vOff + 6, true)
					.toString(16)
					.padStart(4, '0')
				return (
					'{' +
					d1 +
					'-' +
					d2 +
					'-' +
					d3 +
					'-' +
					HEX[valueBytes[8]!]! +
					HEX[valueBytes[9]!]! +
					HEX[valueBytes[10]!]! +
					HEX[valueBytes[11]!]! +
					'-' +
					HEX[valueBytes[12]!]! +
					HEX[valueBytes[13]!]! +
					HEX[valueBytes[14]!]! +
					HEX[valueBytes[15]!]! +
					'}'
				)
			}
			case VALUE_TYPE.SIZE: {
				if (valueBytes.length === 8)
					return `0x${this.chunkDv.getBigUint64(vOff, true).toString(16).padStart(16, '0')}`
				return `0x${this.chunkDv.getUint32(vOff, true).toString(16).padStart(8, '0')}`
			}
			case VALUE_TYPE.FILETIME: {
				if (valueBytes.length < 8) return ''
				return filetimeLoHiToIso(
					this.chunkDv.getUint32(vOff, true),
					this.chunkDv.getUint32(vOff + 4, true)
				)
			}
			case VALUE_TYPE.SYSTEMTIME: {
				if (valueBytes.length < 16) return ''
				const yr = this.chunkDv.getUint16(vOff, true)
				const mo = this.chunkDv.getUint16(vOff + 2, true)
				const dy = this.chunkDv.getUint16(vOff + 6, true)
				const hr = this.chunkDv.getUint16(vOff + 8, true)
				const mn = this.chunkDv.getUint16(vOff + 10, true)
				const sc = this.chunkDv.getUint16(vOff + 12, true)
				const msVal = this.chunkDv.getUint16(vOff + 14, true)
				return `${yr}-${String(mo).padStart(2, '0')}-${String(dy).padStart(2, '0')}T${String(hr).padStart(2, '0')}:${String(mn).padStart(2, '0')}:${String(sc).padStart(2, '0')}.${String(msVal).padStart(3, '0')}Z`
			}
			case VALUE_TYPE.SID: {
				if (valueBytes.length < 8) return ''
				const rev = valueBytes[0]!
				const subCount = valueBytes[1]!
				let auth = 0
				for (let i = 2; i < 8; i++) {
					auth = auth * 256 + valueBytes[i]!
				}
				let sid = `S-${rev}-${auth}`
				for (let i = 0; i < subCount; i++) {
					if (8 + i * 4 + 4 > valueBytes.length) break
					sid += `-${this.chunkDv.getUint32(vOff + 8 + i * 4, true)}`
				}
				return sid
			}
			case VALUE_TYPE.HEX32:
				return `0x${this.chunkDv.getUint32(vOff, true).toString(16).padStart(8, '0')}`
			case VALUE_TYPE.HEX64:
				return `0x${this.chunkDv.getBigUint64(vOff, true).toString(16).padStart(16, '0')}`
			case VALUE_TYPE.BINXML: {
				const embeddedChunkBase =
					valueBytes.byteOffset - this.chunkDv.byteOffset
				return this.parseDocument(valueBytes, embeddedChunkBase)
			}
			default: {
				let hex = ''
				for (let i = 0; i < valueBytes.length; i++) {
					hex += HEX[valueBytes[i]!]!
				}
				return `<!-- unknown value type 0x${HEX[valueType] ?? '??'} -->${hex}`
			}
		}
	}

	private compileTemplate(
		tplBytes: Uint8Array,
		tplBodyStart: number
	): CompiledTemplate | null {
		const b: CompileBuilder = {
			parts: [''],
			subIds: [],
			isOptional: [],
			bail: false
		}
		const pos: ParsePosition = {offset: 0}

		// Skip fragment header if present
		if (tplBytes.length >= 4 && tplBytes[0] === TOKEN.FRAGMENT_HEADER) {
			pos.offset += 4
		}

		this.compileContent(tplBytes, pos, tplBodyStart, b)
		return b.bail
			? null
			: {parts: b.parts, subIds: b.subIds, isOptional: b.isOptional}
	}

	private compileContent(
		bytes: Uint8Array,
		pos: ParsePosition,
		binxmlChunkBase: number,
		b: CompileBuilder
	): void {
		const dvBias = bytes.byteOffset - this.chunkDv.byteOffset
		while (pos.offset < bytes.length) {
			if (b.bail) return
			const tok = bytes[pos.offset] ?? 0
			const base = tok & ~TOKEN.HAS_MORE_DATA_FLAG

			if (
				base === TOKEN.EOF ||
				base === TOKEN.CLOSE_START_ELEMENT ||
				base === TOKEN.CLOSE_EMPTY_ELEMENT ||
				base === TOKEN.END_ELEMENT ||
				base === TOKEN.ATTRIBUTE
			) {
				break
			}

			if (base === TOKEN.OPEN_START_ELEMENT) {
				this.compileElement(bytes, pos, binxmlChunkBase, b)
			} else if (base === TOKEN.VALUE) {
				pos.offset++ // consume token
				pos.offset++ // value type
				const str = this.readUnicodeTextString(bytes, pos, dvBias)
				b.parts[b.parts.length - 1] += xmlEscape(str)
			} else if (base === TOKEN.NORMAL_SUBSTITUTION) {
				pos.offset++ // consume token
				const subId = this.chunkDv.getUint16(dvBias + pos.offset, true)
				pos.offset += 2
				pos.offset++ // subValType
				b.subIds.push(subId)
				b.isOptional.push(false)
				b.parts.push('')
			} else if (base === TOKEN.OPTIONAL_SUBSTITUTION) {
				pos.offset++ // consume token
				const subId = this.chunkDv.getUint16(dvBias + pos.offset, true)
				pos.offset += 2
				pos.offset++ // subValType
				b.subIds.push(subId)
				b.isOptional.push(true)
				b.parts.push('')
			} else if (base === TOKEN.CHAR_REF) {
				pos.offset++ // consume token
				const charVal = this.chunkDv.getUint16(dvBias + pos.offset, true)
				pos.offset += 2
				b.parts[b.parts.length - 1] += `&#${charVal};`
			} else if (base === TOKEN.ENTITY_REF) {
				pos.offset++ // consume token
				const nameOff = this.chunkDv.getUint32(dvBias + pos.offset, true)
				pos.offset += 4
				const entityName = this.readName(nameOff)
				b.parts[b.parts.length - 1] += `&${entityName};`
			} else if (base === TOKEN.CDATA_SECTION) {
				pos.offset++ // consume token
				const cdataStr = this.readUnicodeTextString(bytes, pos, dvBias)
				b.parts[b.parts.length - 1] += `<![CDATA[${cdataStr}]]>`
			} else if (
				base === TOKEN.TEMPLATE_INSTANCE ||
				base === TOKEN.FRAGMENT_HEADER
			) {
				b.bail = true
				return
			} else {
				// Unknown token — bail to generic parser
				b.bail = true
				return
			}
		}
	}

	private compileElement(
		bytes: Uint8Array,
		pos: ParsePosition,
		binxmlChunkBase: number,
		b: CompileBuilder
	): void {
		const dvBias = bytes.byteOffset - this.chunkDv.byteOffset
		const tok = bytes[pos.offset] ?? 0
		const hasAttrs = Boolean(tok & TOKEN.HAS_MORE_DATA_FLAG)
		pos.offset++ // consume token

		pos.offset += 2 // depId
		pos.offset += 4 // dataSize
		const nameOffset = this.chunkDv.getUint32(dvBias + pos.offset, true)
		pos.offset += 4
		// Inline name structure present only when defined here
		if (nameOffset === binxmlChunkBase + pos.offset) {
			const elemNameChars = this.chunkDv.getUint16(
				dvBias + pos.offset + 6,
				true
			)
			pos.offset += 10 + elemNameChars * 2
		}

		const elemName = this.readName(nameOffset)
		b.parts[b.parts.length - 1] += `<${elemName}`

		// Parse attribute list if present
		if (hasAttrs) {
			const attrListSize = this.chunkDv.getUint32(dvBias + pos.offset, true)
			pos.offset += 4
			const attrEnd = pos.offset + attrListSize

			while (pos.offset < attrEnd) {
				if (b.bail) return
				const attrTok = bytes[pos.offset] ?? 0
				const attrBase = attrTok & ~TOKEN.HAS_MORE_DATA_FLAG
				if (attrBase !== TOKEN.ATTRIBUTE) break

				pos.offset++ // consume attribute token
				const attrNameOff = this.chunkDv.getUint32(dvBias + pos.offset, true)
				pos.offset += 4
				// Inline name structure present only when defined here
				if (attrNameOff === binxmlChunkBase + pos.offset) {
					const attrNameChars = this.chunkDv.getUint16(
						dvBias + pos.offset + 6,
						true
					)
					pos.offset += 10 + attrNameChars * 2
				}
				const attrName = this.readName(attrNameOff)

				b.parts[b.parts.length - 1] += ` ${attrName}="`
				this.compileContent(bytes, pos, binxmlChunkBase, b)
				if (b.bail) return
				b.parts[b.parts.length - 1] += '"'
			}
		}

		// Next token: CloseEmptyElement or CloseStartElement
		if (pos.offset >= bytes.length) {
			b.parts[b.parts.length - 1] += '/>'
			return
		}

		const closeTok = bytes[pos.offset] ?? 0
		if (closeTok === TOKEN.CLOSE_EMPTY_ELEMENT) {
			pos.offset++ // consume 0x03
			b.parts[b.parts.length - 1] += '/>'
		} else if (closeTok === TOKEN.CLOSE_START_ELEMENT) {
			pos.offset++ // consume 0x02
			b.parts[b.parts.length - 1] += '>'
			this.compileContent(bytes, pos, binxmlChunkBase, b)
			if (b.bail) return
			if (
				pos.offset < bytes.length &&
				bytes[pos.offset] === TOKEN.END_ELEMENT
			) {
				pos.offset++
			}
			b.parts[b.parts.length - 1] += `</${elemName}>`
		} else {
			b.parts[b.parts.length - 1] +=
				'><!-- UNEXPECTED close token 0x' +
				(HEX[closeTok] ?? '??') +
				' --></' +
				elemName +
				'>'
		}
	}

	private renderCompiled(
		compiled: CompiledTemplate,
		subs: SubstitutionValue[]
	): string {
		const {parts, subIds, isOptional} = compiled
		let result = parts[0]!
		for (let i = 0; i < subIds.length; i++) {
			const subId = subIds[i]!
			if (subId < subs.length) {
				const sub = subs[subId]!
				if (!isOptional[i] || (sub.type !== VALUE_TYPE.NULL && sub.size > 0)) {
					if (sub.rendered === null) {
						sub.rendered = this.renderSubstitutionValue(sub.bytes, sub.type)
					}
					result += sub.rendered
				}
			}
			result += parts[i + 1]!
		}
		return result
	}

	private parseContent(
		bytes: Uint8Array,
		pos: ParsePosition,
		subs: SubstitutionValue[] | null,
		binxmlChunkBase: number
	): string {
		const dvBias = bytes.byteOffset - this.chunkDv.byteOffset
		let result = ''

		while (pos.offset < bytes.length) {
			const tok = bytes[pos.offset] ?? 0
			const base = tok & ~TOKEN.HAS_MORE_DATA_FLAG

			if (
				base === TOKEN.EOF ||
				base === TOKEN.CLOSE_START_ELEMENT ||
				base === TOKEN.CLOSE_EMPTY_ELEMENT ||
				base === TOKEN.END_ELEMENT ||
				base === TOKEN.ATTRIBUTE
			) {
				break
			}

			if (base === TOKEN.OPEN_START_ELEMENT) {
				result += this.parseElement(bytes, pos, subs, binxmlChunkBase)
			} else if (base === TOKEN.VALUE) {
				pos.offset++ // consume token
				pos.offset++ // value type
				const str = this.readUnicodeTextString(bytes, pos, dvBias)
				result += xmlEscape(str)
			} else if (base === TOKEN.NORMAL_SUBSTITUTION) {
				pos.offset++ // consume token
				const subId = this.chunkDv.getUint16(dvBias + pos.offset, true)
				pos.offset += 2
				pos.offset++ // subValType
				if (subs && subId < subs.length) {
					const sub = subs[subId]!
					if (sub.rendered === null) {
						sub.rendered = this.renderSubstitutionValue(sub.bytes, sub.type)
					}
					result += sub.rendered
				}
			} else if (base === TOKEN.OPTIONAL_SUBSTITUTION) {
				pos.offset++ // consume token
				const subId = this.chunkDv.getUint16(dvBias + pos.offset, true)
				pos.offset += 2
				pos.offset++ // subValType
				if (subs && subId < subs.length) {
					const sub = subs[subId]!
					if (sub.type !== VALUE_TYPE.NULL && sub.size > 0) {
						if (sub.rendered === null) {
							sub.rendered = this.renderSubstitutionValue(sub.bytes, sub.type)
						}
						result += sub.rendered
					}
				}
			} else if (base === TOKEN.CHAR_REF) {
				pos.offset++ // consume token
				const charVal = this.chunkDv.getUint16(dvBias + pos.offset, true)
				pos.offset += 2
				result += `&#${charVal};`
			} else if (base === TOKEN.ENTITY_REF) {
				pos.offset++ // consume token
				const nameOff = this.chunkDv.getUint32(dvBias + pos.offset, true)
				pos.offset += 4
				const entityName = this.readName(nameOff)
				result += `&${entityName};`
			} else if (base === TOKEN.CDATA_SECTION) {
				pos.offset++ // consume token
				const cdataStr = this.readUnicodeTextString(bytes, pos, dvBias)
				result += `<![CDATA[${cdataStr}]]>`
			} else if (base === TOKEN.TEMPLATE_INSTANCE) {
				result += this.parseTemplateInstance(bytes, pos, binxmlChunkBase)
			} else if (base === TOKEN.FRAGMENT_HEADER) {
				result += this.parseFragment(bytes, pos, binxmlChunkBase)
			} else {
				result +=
					'<!-- UNEXPECTED content token 0x' +
					(HEX[tok] ?? '??') +
					' (' +
					tokenName(tok) +
					') at offset ' +
					pos.offset +
					' -->'
				pos.offset++
			}
		}

		return result
	}

	private parseElement(
		bytes: Uint8Array,
		pos: ParsePosition,
		subs: SubstitutionValue[] | null,
		binxmlChunkBase: number
	): string {
		const dvBias = bytes.byteOffset - this.chunkDv.byteOffset
		const tok = bytes[pos.offset] ?? 0
		const hasAttrs = Boolean(tok & TOKEN.HAS_MORE_DATA_FLAG)
		pos.offset++ // consume token

		pos.offset += 2 // depId
		pos.offset += 4 // dataSize
		const nameOffset = this.chunkDv.getUint32(dvBias + pos.offset, true)
		pos.offset += 4
		// Inline name structure is present only when defined here (nameOffset points to current chunk position)
		if (nameOffset === binxmlChunkBase + pos.offset) {
			const elemNameChars = this.chunkDv.getUint16(
				dvBias + pos.offset + 6,
				true
			)
			pos.offset += 10 + elemNameChars * 2
		}

		const elemName = this.readName(nameOffset)
		let xml = `<${elemName}`

		// Parse attribute list if present
		if (hasAttrs) {
			const attrListSize = this.chunkDv.getUint32(dvBias + pos.offset, true)
			pos.offset += 4
			const attrEnd = pos.offset + attrListSize

			while (pos.offset < attrEnd) {
				const attrTok = bytes[pos.offset] ?? 0
				const attrBase = attrTok & ~TOKEN.HAS_MORE_DATA_FLAG
				if (attrBase !== TOKEN.ATTRIBUTE) break

				pos.offset++ // consume attribute token
				const attrNameOff = this.chunkDv.getUint32(dvBias + pos.offset, true)
				pos.offset += 4
				// Inline name structure present only when defined here
				if (attrNameOff === binxmlChunkBase + pos.offset) {
					const attrNameChars = this.chunkDv.getUint16(
						dvBias + pos.offset + 6,
						true
					)
					pos.offset += 10 + attrNameChars * 2
				}
				const attrName = this.readName(attrNameOff)

				const attrValue = this.parseContent(bytes, pos, subs, binxmlChunkBase)
				xml += ` ${attrName}="${attrValue}"`
			}
		}

		// Next token: CloseEmptyElement or CloseStartElement
		if (pos.offset >= bytes.length) {
			return `${xml}/>`
		}

		const closeTok = bytes[pos.offset] ?? 0
		if (closeTok === TOKEN.CLOSE_EMPTY_ELEMENT) {
			pos.offset++ // consume 0x03
			return `${xml}/>`
		}
		if (closeTok === TOKEN.CLOSE_START_ELEMENT) {
			pos.offset++ // consume 0x02
			xml += '>'
			xml += this.parseContent(bytes, pos, subs, binxmlChunkBase)
			if (
				pos.offset < bytes.length &&
				bytes[pos.offset] === TOKEN.END_ELEMENT
			) {
				pos.offset++
			}
			return `${xml}</${elemName}>`
		}
		return (
			xml +
			'><!-- UNEXPECTED close token 0x' +
			(HEX[closeTok] ?? '??') +
			' --></' +
			elemName +
			'>'
		)
	}

	private parseTemplateInstance(
		bytes: Uint8Array,
		pos: ParsePosition,
		binxmlChunkBase: number
	): string {
		const dvBias = bytes.byteOffset - this.chunkDv.byteOffset
		pos.offset++ // consume 0x0C token

		// Read the always-present 9 bytes
		pos.offset++ // unknown1 (version?)
		pos.offset += 4 // unknown2 (template id?)
		const defDataOffset = this.chunkDv.getUint32(dvBias + pos.offset, true)
		pos.offset += 4

		// Determine inline vs back-reference
		const currentChunkRelOffset = binxmlChunkBase + pos.offset
		const isInline = defDataOffset === currentChunkRelOffset

		let guidStr = ''
		let dataSize = 0

		if (isInline) {
			pos.offset += 4 // next def offset
			const guidBytesArr = new Uint8Array(
				bytes.buffer,
				bytes.byteOffset + pos.offset,
				16
			)
			guidStr = formatGuid(guidBytesArr)
			pos.offset += 16
			dataSize = this.chunkDv.getUint32(dvBias + pos.offset, true)
			pos.offset += 4

			if (this.tplStats) {
				if (!this.tplStats.defsByOffset[defDataOffset]) {
					this.tplStats.defsByOffset[defDataOffset] = {
						guid: guidStr,
						defDataOffset,
						dataSize,
						firstSeenRecord: this.tplStats.currentRecordId
					}
				}
				if (!this.tplStats.definitions[guidStr]) {
					this.tplStats.definitions[guidStr] =
						this.tplStats.defsByOffset[defDataOffset]!
					this.tplStats.definitionCount++
				}
			}

			pos.offset += dataSize
		} else {
			const cachedDef = this.tplStats.defsByOffset[defDataOffset]
			if (cachedDef) {
				guidStr = cachedDef.guid
				dataSize = cachedDef.dataSize
			} else if (defDataOffset + 24 <= this.chunkDv.byteLength) {
				// Fallback: read definition header directly from chunk bytes.
				// The template pointer table may not index all definitions
				// (e.g. templates nested inside embedded BinXml payloads).
				const guidBytesArr = new Uint8Array(
					this.chunkDv.buffer,
					this.chunkDv.byteOffset + defDataOffset + 4,
					16
				)
				guidStr = formatGuid(guidBytesArr)
				dataSize = this.chunkDv.getUint32(defDataOffset + 20, true)

				this.tplStats.defsByOffset[defDataOffset] = {
					guid: guidStr,
					defDataOffset,
					dataSize,
					firstSeenRecord: this.tplStats.currentRecordId
				}
				if (!this.tplStats.definitions[guidStr]) {
					this.tplStats.definitions[guidStr] =
						this.tplStats.defsByOffset[defDataOffset]!
					this.tplStats.definitionCount++
				}
			}
		}

		// Track reference count (array not needed — only count is exported)
		if (this.tplStats) {
			this.tplStats.referenceCount++
		}

		// --- Template Instance Data ---
		const numValues = this.chunkDv.getUint32(dvBias + pos.offset, true)
		pos.offset += 4

		// Read descriptors inline (no intermediate array allocation)
		const descStart = pos.offset
		pos.offset += numValues * 4 // skip all descriptors: 2 size + 1 type + 1 padding each

		// Read value data and build subs with lazy rendering
		const subs: SubstitutionValue[] = []
		for (let i = 0; i < numValues; i++) {
			const descOff = descStart + i * 4
			const valSize = this.chunkDv.getUint16(dvBias + descOff, true)
			const valType = bytes[descOff + 2] ?? 0

			let valBytes: Uint8Array
			if (valSize > 0 && pos.offset + valSize <= bytes.length) {
				valBytes = new Uint8Array(
					bytes.buffer,
					bytes.byteOffset + pos.offset,
					valSize
				)
			} else {
				valBytes = EMPTY_BYTES
			}
			pos.offset += valSize
			subs.push({
				type: valType,
				size: valSize,
				bytes: valBytes,
				rendered: null // lazy: rendered on first access in parseContent
			})
		}

		// Parse the template definition's element tree from the chunk
		let tplFound = true
		let xml = ''
		try {
			if (dataSize === 0) {
				tplFound = false
				throw new Error(
					`no template definition found for defOffset=${hex32(defDataOffset)}`
				)
			}
			const tplBodyStart = defDataOffset + 24
			if (tplBodyStart + dataSize > this.chunkDv.byteLength) {
				tplFound = false
				throw new Error(
					`template def offset ${hex32(defDataOffset)} + size ${dataSize} exceeds chunk`
				)
			}

			const tplBytes = new Uint8Array(
				this.chunkDv.buffer,
				this.chunkDv.byteOffset + tplBodyStart,
				dataSize
			)

			// Check compiled cache (keyed by GUID, persists across chunks)
			let compiled = this.tplStats.compiled.get(guidStr)
			if (compiled === undefined) {
				compiled = this.compileTemplate(tplBytes, tplBodyStart)
				this.tplStats.compiled.set(guidStr, compiled)
			}

			if (compiled !== null) {
				xml = this.renderCompiled(compiled, subs)
			} else {
				// Fall through to generic parseContent path
				const tplPos: ParsePosition = {offset: 0}

				// Skip fragment header (4 bytes: 0x0F, major, minor, flags)
				if (tplBytes.length >= 4 && tplBytes[0] === TOKEN.FRAGMENT_HEADER) {
					tplPos.offset += 4
				}

				xml = this.parseContent(tplBytes, tplPos, subs, tplBodyStart)
			}
		} catch (e) {
			xml = `<!-- template parse error: ${e instanceof Error ? e.message : String(e)} -->`
			tplFound = false
		}

		if (this.tplStats && !tplFound) {
			this.tplStats.missingRefs.push({
				recordId: this.tplStats.currentRecordId,
				guid: guidStr || '(unknown)',
				defDataOffset
			})
			this.tplStats.missingCount++
		}

		return xml
	}

	parseDocument(binxml: Uint8Array, binxmlChunkBase: number): string {
		const pos: ParsePosition = {offset: 0}
		const dvBias = binxml.byteOffset - this.chunkDv.byteOffset
		let result = ''

		while (pos.offset < binxml.length) {
			const tok = binxml[pos.offset] ?? 0
			const base = tok & ~TOKEN.HAS_MORE_DATA_FLAG

			if (base === TOKEN.EOF) {
				break
			}
			if (base === TOKEN.FRAGMENT_HEADER) {
				result += this.parseFragment(binxml, pos, binxmlChunkBase)
			} else if (base === TOKEN.PI_TARGET) {
				pos.offset++ // consume 0x0A
				const piNameOff = this.chunkDv.getUint32(dvBias + pos.offset, true)
				pos.offset += 4
				const piName = this.readName(piNameOff)
				let pi = `<?${piName}`
				if (
					pos.offset < binxml.length &&
					binxml[pos.offset] === TOKEN.PI_DATA
				) {
					pos.offset++ // consume 0x0B
					const piText = this.readUnicodeTextString(binxml, pos, dvBias)
					if (piText) pi += ` ${piText}`
				}
				result += `${pi}?>`
			} else {
				result +=
					'<!-- UNEXPECTED document token 0x' +
					(HEX[tok] ?? '??') +
					' (' +
					tokenName(tok) +
					') at offset ' +
					pos.offset +
					' -->'
				break
			}
		}

		return result
	}

	private parseFragment(
		binxml: Uint8Array,
		pos: ParsePosition,
		binxmlChunkBase: number
	): string {
		if (pos.offset + 4 > binxml.length) {
			return `<!-- TRUNCATED fragment header at offset ${pos.offset} -->\n`
		}

		// Consume fragment header (4 bytes)
		pos.offset += 4

		if (pos.offset >= binxml.length) {
			return '<!-- TRUNCATED after fragment header -->\n'
		}

		const nextTok = binxml[pos.offset] ?? 0
		const nextBase = nextTok & ~TOKEN.HAS_MORE_DATA_FLAG

		if (nextBase === TOKEN.TEMPLATE_INSTANCE) {
			return this.parseTemplateInstance(binxml, pos, binxmlChunkBase)
		}
		if (nextBase === TOKEN.OPEN_START_ELEMENT) {
			return this.parseElement(binxml, pos, null, binxmlChunkBase)
		}
		return (
			'<!-- UNEXPECTED post-fragment token 0x' +
			(HEX[nextTok] ?? '??') +
			' (' +
			tokenName(nextTok) +
			') at offset ' +
			pos.offset +
			' -->\n'
		)
	}
}