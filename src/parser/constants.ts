export const HEX: string[] = Array.from({length: 256}, (_, i) =>
	i.toString(16).padStart(2, '0').toUpperCase()
)

export const TOKEN = {
	ATTRIBUTE: 0x06,
	CDATA_SECTION: 0x07,
	CHAR_REF: 0x08,
	CLOSE_EMPTY_ELEMENT: 0x03,
	CLOSE_START_ELEMENT: 0x02,
	END_ELEMENT: 0x04,
	ENTITY_REF: 0x09,
	EOF: 0x00,
	FRAGMENT_HEADER: 0x0f,
	HAS_MORE_DATA_FLAG: 0x40,
	NORMAL_SUBSTITUTION: 0x0d,
	OPEN_START_ELEMENT: 0x01,
	OPTIONAL_SUBSTITUTION: 0x0e,
	PI_DATA: 0x0b,
	PI_TARGET: 0x0a,
	TEMPLATE_INSTANCE: 0x0c,
	VALUE: 0x05
} as const

export const TOKEN_NAMES: Record<number, string> = {
	0: 'EOF',
	1: 'OpenStartElement',
	2: 'CloseStartElement',
	3: 'CloseEmptyElement',
	4: 'EndElement',
	5: 'Value',
	6: 'Attribute',
	7: 'CDATASection',
	8: 'CharRef',
	9: 'EntityRef',
	10: 'PITarget',
	11: 'PIData',
	12: 'TemplateInstance',
	13: 'NormalSubstitution',
	14: 'OptionalSubstitution',
	15: 'FragmentHeader'
}

export const VALUE_TYPE = {
	ANSI_STRING: 0x02,
	BINARY: 0x0e,
	BINXML: 0x21,
	BOOL: 0x0d,
	DOUBLE: 0x0c,
	FILETIME: 0x11,
	FLOAT: 0x0b,
	GUID: 0x0f,
	HEX32: 0x14,
	HEX64: 0x15,
	INT16: 0x05,
	INT32: 0x07,
	INT64: 0x09,
	INT8: 0x03,
	NULL: 0x00,
	SID: 0x13,
	SIZE: 0x10,
	STRING: 0x01,
	SYSTEMTIME: 0x12,
	UINT16: 0x06,
	UINT32: 0x08,
	UINT64: 0x0a,
	UINT8: 0x04
} as const
