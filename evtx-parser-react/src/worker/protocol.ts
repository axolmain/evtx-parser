import type {
	ParsedEventRecord,
	TemplateDefinition,
	TemplateMissingRef,
	TemplateParseError,
	TemplateReference
} from '@/parser/types'

/** Main thread -> Worker */
export interface ChunkParseRequest {
	readonly type: 'parse-chunk'
	readonly id: number
	readonly chunkIndex: number
	readonly chunkFileOffset: number

	// SharedArrayBuffer mode (when supported)
	readonly sharedBuffer?: SharedArrayBuffer
	readonly chunkOffset: number
	readonly chunkLength: number

	// Fallback mode (transferred ArrayBuffer)
	readonly chunkBuffer?: ArrayBuffer
}

/** Mergeable subset of TemplateStats produced by one chunk */
export interface PartialStats {
	readonly definitionCount: number
	readonly definitions: Record<string, TemplateDefinition>
	readonly missingCount: number
	readonly missingRefs: TemplateMissingRef[]
	readonly parseErrors: TemplateParseError[]
	readonly referenceCount: number
	readonly references: TemplateReference[]
}

/** Worker -> Main on success */
export interface ChunkParseSuccess {
	readonly chunkIndex: number
	readonly id: number
	readonly partialStats: PartialStats
	readonly recordCount: number
	readonly recordOutputs: string[]
	readonly records: ParsedEventRecord[]
	readonly type: 'chunk-success'
	readonly warnings: string[]
}

/** Worker -> Main on error */
export interface ChunkParseError {
	readonly chunkIndex: number
	readonly error: string
	readonly id: number
	readonly type: 'chunk-error'
}

export type WorkerResponse = ChunkParseError | ChunkParseSuccess
