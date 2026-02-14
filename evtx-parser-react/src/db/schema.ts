import Dexie, {type EntityTable} from 'dexie'
import type {FileType} from '@/lib/fileTypes'
import type {EvtxParseResult} from '@/parser'

// Archive metadata
export interface Archive {
	id: string // "archive_timestamp"
	name: string // Original zip filename
	uploadedAt: Date
	totalSize: number
	fileCount: number
	files: string[] // Array of file IDs
}

// File stored in archive
export interface StoredFile {
	id: string // "archiveId::filename"
	archiveId: string
	name: string
	type: FileType
	size: number
	blob: Blob // Original file data
	parsedData?: EvtxCachedData | unknown // Cached parsed result
	indexedAt?: Date // When events were indexed (EVTX only)
}

// Cached EVTX parse result with metadata
export interface EvtxCachedData {
	result: EvtxParseResult
	fileSize: number
	parseTime: number
	fileName: string
}

// Individual EVTX event (for search)
export interface StoredEvent {
	id: string // "fileId::recordId"
	archiveId: string
	archiveName: string // For display in search results
	fileId: string
	fileName: string // For display in search results
	recordId: number
	eventId: string
	provider: string
	level: number
	levelText: string
	computer: string
	channel: string
	timestamp: string
	eventData: string // For full-text search
	task: string
	opcode: string
	keywords: string
	xml: string
}

// Database schema
export class SysInfoZipDB extends Dexie {
	archives!: EntityTable<Archive, 'id'>
	files!: EntityTable<StoredFile, 'id'>
	events!: EntityTable<StoredEvent, 'id'>

	constructor() {
		super('SysInfoZipDB')

		// Version 1: Initial schema
		this.version(1).stores({
			archives: 'id, name, uploadedAt',
			files: 'id, archiveId, type, name',
			events:
				'id, archiveId, fileId, eventId, provider, level, computer, timestamp, [archiveId+level], [fileId+eventId]'
		})

		// Version 2: Remove chunks table (was used for progressive parsing)
		this.version(2).stores({
			archives: 'id, name, uploadedAt',
			files: 'id, archiveId, type, name',
			events:
				'id, archiveId, fileId, eventId, provider, level, computer, timestamp, [archiveId+level], [fileId+eventId]',
			chunks: null // Delete the chunks table
		})

		// Version 3: Strip parsedData from EVTX files — re-parsing from blob is faster
		this.version(3)
			.stores({
				archives: 'id, name, uploadedAt',
				files: 'id, archiveId, type, name',
				events:
					'id, archiveId, fileId, eventId, provider, level, computer, timestamp, [archiveId+level], [fileId+eventId]'
			})
			.upgrade(async tx => {
				await tx
					.table('files')
					.where('type')
					.equals('evtx')
					.modify(file => {
						file.parsedData = undefined
					})
			})
	}
}

// Singleton database instance
export const db = new SysInfoZipDB()

// Helper to get storage estimate
export async function getStorageEstimate(): Promise<{
	usage: number
	quota: number
	usagePercent: number
}> {
	if ('storage' in navigator && 'estimate' in navigator.storage) {
		const estimate = await navigator.storage.estimate()
		const usage = estimate.usage || 0
		const quota = estimate.quota || 0
		const usagePercent = quota > 0 ? (usage / quota) * 100 : 0

		return {usage, quota, usagePercent}
	}

	return {usage: 0, quota: 0, usagePercent: 0}
}

// Helper to format bytes
export function formatBytes(bytes: number): string {
	if (bytes === 0) return '0 B'
	const k = 1024
	const sizes = ['B', 'KB', 'MB', 'GB']
	const i = Math.floor(Math.log(bytes) / Math.log(k))
	return `${(bytes / k ** i).toFixed(2)} ${sizes[i]}`
}
