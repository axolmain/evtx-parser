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

export interface TemplateMissingRef {
	readonly defDataOffset: number
	readonly guid: string
	readonly recordId: number
}

export interface TemplateParseError {
	readonly error: string
	readonly recordId: number
}

export interface CompiledTemplate {
	parts: string[]       // N+1 literal text segments (like template literal quasis)
	subIds: number[]      // N substitution indices between the literal parts
	isOptional: boolean[] // N flags — true = skip if sub is NULL/empty
}

export interface TemplateStats {
	compiled: Map<string, CompiledTemplate | null>
	currentRecordId: number
	defsByOffset: Record<number, TemplateDefinition>
	definitionCount: number
	definitions: Record<string, TemplateDefinition>
	missingCount: number
	missingRefs: TemplateMissingRef[]
	parseErrors: TemplateParseError[]
	referenceCount: number
}

export interface SubstitutionValue {
	readonly bytes: Uint8Array
	rendered: string | null
	readonly size: number
	readonly type: number
}

export interface ParsePosition {
	offset: number
}

export interface ParsedEventRecord {
	readonly recordId: number
	readonly timestamp: string
	readonly xml: string
	readonly chunkIndex: number
	readonly eventId: string
	readonly level: number
	readonly levelText: string
	readonly provider: string
	readonly computer: string
	readonly channel: string
	readonly task: string
	readonly opcode: string
	readonly keywords: string
	readonly version: string
	readonly processId: string
	readonly threadId: string
	readonly securityUserId: string
	readonly activityId: string
	readonly relatedActivityId: string
	readonly eventData: string
}

export interface TemplateStatsSummary {
	readonly definitionCount: number
	readonly missingCount: number
	readonly parseErrorCount: number
	readonly referenceCount: number
}

export interface EvtxParseResult {
	readonly numChunks: number
	readonly records: ParsedEventRecord[]
	readonly totalRecords: number
	readonly tplStats: TemplateStatsSummary
	readonly warnings: string[]
}
