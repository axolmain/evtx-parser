import type {ParsedEventRecord} from '@/parser'
import {
	type Archive,
	db,
	type EvtxCachedData,
	type StoredEvent,
	type StoredFile
} from './schema'

// Generate unique IDs
export function generateArchiveId(fileName: string): string {
	return `${fileName}_${Date.now()}`
}

export function generateFileId(archiveId: string, fileName: string): string {
	return `${archiveId}::${fileName}`
}

export function generateEventId(fileId: string, recordId: number): string {
	return `${fileId}::${recordId}`
}

// ============================================================================
// Archive Operations
// ============================================================================

export async function saveArchive(
	name: string,
	totalSize: number,
	fileIds: string[]
): Promise<string> {
	const id = generateArchiveId(name)
	const archive: Archive = {
		id,
		name,
		uploadedAt: new Date(),
		totalSize,
		fileCount: fileIds.length,
		files: fileIds
	}

	await db.archives.add(archive)
	return id
}

export async function getArchive(id: string): Promise<Archive | undefined> {
	return db.archives.get(id)
}

export async function getAllArchives(): Promise<Archive[]> {
	return db.archives.orderBy('uploadedAt').reverse().toArray()
}

export async function deleteArchive(id: string): Promise<void> {
	const archive = await db.archives.get(id)
	if (!archive) return

	// Delete all associated events
	await db.events.where('archiveId').equals(id).delete()

	// Delete all associated files
	await db.files.where('archiveId').equals(id).delete()

	// Delete the archive itself
	await db.archives.delete(id)
}

export async function clearAllArchives(): Promise<void> {
	await db.transaction(
		'rw',
		[db.archives, db.files, db.events],
		async () => {
			await db.events.clear()
			await db.files.clear()
			await db.archives.clear()
		}
	)
}

// ============================================================================
// File Operations
// ============================================================================

export async function saveFile(
	archiveId: string,
	name: string,
	type: string,
	size: number,
	blob: Blob,
	parsedData?: EvtxCachedData | unknown
): Promise<string> {
	const id = generateFileId(archiveId, name)
	const file: StoredFile = {
		id,
		archiveId,
		name,
		type: type as StoredFile['type'],
		size,
		blob,
		parsedData
	}

	await db.files.add(file)
	return id
}

export async function getFile(id: string): Promise<StoredFile | undefined> {
	return db.files.get(id)
}

/** Read only the blob from a stored file — avoids deserializing parsedData */
export async function getFileBlob(id: string): Promise<Blob | undefined> {
	const file = await db.files.get(id)
	return file?.blob
}

export async function getFilesByArchive(
	archiveId: string
): Promise<StoredFile[]> {
	return db.files.where('archiveId').equals(archiveId).toArray()
}

export async function updateFileParsedData(
	fileId: string,
	parsedData: EvtxCachedData | unknown
): Promise<void> {
	await db.files.update(fileId, {parsedData})
}

// ============================================================================
// Event Operations (for EVTX search)
// ============================================================================

export async function indexEvtxEvents(
	fileId: string,
	archiveId: string,
	archiveName: string,
	fileName: string,
	events: ParsedEventRecord[]
): Promise<void> {
	const storedEvents: StoredEvent[] = events.map(event => ({
		id: generateEventId(fileId, event.recordId),
		archiveId,
		archiveName,
		fileId,
		fileName,
		recordId: event.recordId,
		eventId: event.eventId,
		provider: event.provider,
		level: event.level,
		levelText: event.levelText,
		computer: event.computer,
		channel: event.channel,
		timestamp: event.timestamp,
		eventData: event.eventData,
		task: event.task,
		opcode: event.opcode,
		keywords: event.keywords,
		xml: event.xml
	}))

	// Bulk add events
	await db.events.bulkAdd(storedEvents)

	// Mark file as indexed
	await db.files.update(fileId, {indexedAt: new Date()})
}

export async function isFileIndexed(fileId: string): Promise<boolean> {
	const file = await db.files.get(fileId)
	return file?.indexedAt !== undefined
}

// ============================================================================
// Search Operations
// ============================================================================

export interface SearchFilters {
	query?: string // Full-text search in eventData
	eventIds?: string[]
	providers?: string[]
	levels?: number[]
	computers?: string[]
	channels?: string[]
	archiveIds?: string[]
	fileIds?: string[]
	startDate?: Date
	endDate?: Date
}

export async function searchEvents(
	filters: SearchFilters,
	limit = 1000
): Promise<StoredEvent[]> {
	let collection = db.events.orderBy('timestamp').reverse()

	// Apply filters
	if (filters.archiveIds && filters.archiveIds.length > 0) {
		const ids = filters.archiveIds
		collection = collection.filter(e => ids.includes(e.archiveId)) as any
	}

	if (filters.fileIds && filters.fileIds.length > 0) {
		const ids = filters.fileIds
		collection = collection.filter(e => ids.includes(e.fileId)) as any
	}

	if (filters.levels && filters.levels.length > 0) {
		const lvls = filters.levels
		collection = collection.filter(e => lvls.includes(e.level)) as any
	}

	if (filters.eventIds && filters.eventIds.length > 0) {
		const ids = filters.eventIds
		collection = collection.filter(e => ids.includes(e.eventId)) as any
	}

	if (filters.providers && filters.providers.length > 0) {
		const provs = filters.providers
		collection = collection.filter(e =>
			provs.some(p => e.provider.toLowerCase().includes(p.toLowerCase()))
		) as any
	}

	if (filters.computers && filters.computers.length > 0) {
		const comps = filters.computers
		collection = collection.filter(e =>
			comps.some(c => e.computer.toLowerCase().includes(c.toLowerCase()))
		) as any
	}

	if (filters.channels && filters.channels.length > 0) {
		const chans = filters.channels
		collection = collection.filter(e => chans.includes(e.channel)) as any
	}

	if (filters.query) {
		const query = filters.query.toLowerCase()
		collection = collection.filter(
			e =>
				e.eventData.toLowerCase().includes(query) ||
				e.provider.toLowerCase().includes(query) ||
				e.eventId.toLowerCase().includes(query) ||
				e.computer.toLowerCase().includes(query)
		) as any
	}

	if (filters.startDate) {
		collection = collection.filter(
			e => new Date(e.timestamp) >= filters.startDate!
		) as any
	}

	if (filters.endDate) {
		collection = collection.filter(
			e => new Date(e.timestamp) <= filters.endDate!
		) as any
	}

	return collection.limit(limit).toArray()
}

// Get unique values for filter dropdowns
export async function getEventFilterOptions(archiveId?: string): Promise<{
	eventIds: string[]
	providers: string[]
	computers: string[]
	channels: string[]
}> {
	let query = db.events.toCollection()

	if (archiveId) {
		query = db.events.where('archiveId').equals(archiveId)
	}

	const events = await query.toArray()

	const eventIds = [...new Set(events.map(e => e.eventId))].sort()
	const providers = [...new Set(events.map(e => e.provider))].sort()
	const computers = [...new Set(events.map(e => e.computer))].sort()
	const channels = [...new Set(events.map(e => e.channel))].sort()

	return {eventIds, providers, computers, channels}
}

// Get event count by level (for statistics)
export async function getEventCountsByLevel(
	archiveId?: string
): Promise<Record<number, number>> {
	let query = db.events.toCollection()

	if (archiveId) {
		query = db.events.where('archiveId').equals(archiveId)
	}

	const events = await query.toArray()
	const counts: Record<number, number> = {}

	for (const event of events) {
		counts[event.level] = (counts[event.level] || 0) + 1
	}

	return counts
}
