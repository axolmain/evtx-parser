import type { FileHeader } from './types'

export function parseFileHeader(
	buffer: ArrayBuffer | SharedArrayBuffer,
	dv: DataView | undefined
): FileHeader {
	// Single DataView instead of 3 typed array allocations
	dv ??= new DataView(buffer, 0, 124)

	// "ElfFile" magic in 3 comparisons instead of 7:
	// Big-endian reads so bytes compare in natural order


	if (dv.getBigUint64(0, false) !== 0x45_6c_66_46_69_6c_65_00n)
		if (
			dv.getUint32(0, false) !== 0x45_6c_66_46 || // "ElfF"
			dv.getUint16(4, false) !== 0x69_6c || // "il"
			dv.getUint8(6) !== 0x65 // "e"
			)
		throw new Error('Not a valid EVTX file')

	// locations found @ https://github.com/libyal/libevtx/blob/main/documentation/Windows%20XML%20Event%20Log%20(EVTX).asciidoc#2-file-header
	const headerBlockSize = dv.getUint16(40, true)
	const flags = dv.getUint32(120, true)

	return {
		headerBlockSize,
		flags,
		isDirty: (flags & 0x01) !== 0,
		isFull: (flags & 0x02) !== 0
	}
}
