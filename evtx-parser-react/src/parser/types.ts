export interface FileHeader {
	readonly flags: number
	readonly headerBlockSize: number
	readonly isDirty: boolean
	readonly isFull: boolean
}

export interface ChunkHeader {
	readonly chunkEnd: number
	readonly chunkStart: number
	readonly commonStringOffsets: Uint32Array
	readonly eventRecordsChecksum: number
	readonly firstEventRecordId: number
	readonly firstEventRecordNumber: number
	readonly flags: number
	readonly freeSpaceOffset: number
	readonly headerChecksum: number
	readonly headerSize: number
	readonly lastEventRecordId: number
	readonly lastEventRecordNumber: number
	readonly lastEventRecordOffset: number
	readonly recordsStart: number
	readonly templatePointers: Uint32Array
}

export interface EvtxRecord {
	readonly binxmlBytes: Uint8Array
	readonly binxmlFirstByte: number | null
	readonly binxmlLength: number
	readonly chunkOffset: number
	readonly fileOffset: number
	readonly recordId: number
	readonly recordSize: number
	readonly size: number
	readonly sizeCopy: number
	readonly sizeMatch: boolean
	readonly timestamp: string
}

export interface ParsedChunk {
	readonly header: ChunkHeader
	readonly records: EvtxRecord[]
}

export interface TemplateDefinition {
	readonly dataSize: number
	readonly defDataOffset: number
	readonly firstSeenRecord: number
	readonly guid: string
}

export interface TemplateReference {
	readonly dataSize: number
	readonly defDataOffset: number
	readonly guid: string
	readonly isInline: boolean
	readonly recordId: number
}

export interface TemplateMissingRef {
	readonly defDataOffset: number
	readonly guid: string
	readonly recordId: number
}

export interface TemplateParseError {
	readonly error: string
	readonly recordId: number
}

export interface TemplateStats {
	currentRecordId: number
	defsByOffset: Record<number, TemplateDefinition>
	definitionCount: number
	definitions: Record<string, TemplateDefinition>
	missingCount: number
	missingRefs: TemplateMissingRef[]
	parseErrors: TemplateParseError[]
	referenceCount: number
	references: TemplateReference[]
}

export interface SubstitutionValue {
	readonly bytes: Uint8Array
	readonly rendered: string
	readonly size: number
	readonly type: number
}

export interface ParsePosition {
	offset: number
}

export interface EvtxParseResult {
	readonly numChunks: number
	readonly recordOutputs: string[]
	readonly summary: string
	readonly totalRecords: number
	readonly tplStats: TemplateStats
	readonly warnings: string[]
	readonly xml: string
}
