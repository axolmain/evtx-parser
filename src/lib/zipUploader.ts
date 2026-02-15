import {BlobReader, BlobWriter, type FileEntry, ZipReader} from '@zip.js/zip.js'
import * as dbService from '@/db/service'
import type {FileType} from './fileTypes'
import {detectFileType} from './fileTypes'

export interface ZipFileEntry {
	name: string
	size: number
	compressedSize: number
	type: FileType
}

const EXTRACT_CONCURRENCY = 6

export async function uploadZipFile(
	file: File,
	onProgress?: (message: string) => void
): Promise<{archiveId: string; entries: ZipFileEntry[]}> {
	onProgress?.(`Opening ${file.name}...`)

	const reader = new ZipReader(new BlobReader(file))

	try {
		const entries = await reader.getEntries()

		if (entries.length === 0) {
			throw new Error('Zip file is empty')
		}

		// Single pass: build metadata, count viewable, accumulate totalSize
		const rawEntries = entries.filter(
			(e): e is FileEntry => !e.directory && Boolean(e.filename)
		)
		const fileEntries: ZipFileEntry[] = []
		let totalSize = 0
		let viewableCount = 0

		for (const entry of rawEntries) {
			const type = detectFileType(entry.filename)
			fileEntries.push({
				name: entry.filename,
				size: entry.uncompressedSize,
				compressedSize: entry.compressedSize || 0,
				type
			})
			totalSize += entry.uncompressedSize
			if (type !== 'unknown') viewableCount++
		}

		if (viewableCount === 0) {
			throw new Error(
				`No viewable files found. Files in archive: ${fileEntries
					.map(e => e.name)
					.join(', ')}`
			)
		}

		onProgress?.('Saving archive...')
		const archiveId = await dbService.saveArchive(file.name, totalSize, [])

		// Extract and save files concurrently
		let next = 0
		async function worker() {
			while (next < rawEntries.length) {
				const i = next++
				const entry = rawEntries[i]!
				const meta = fileEntries[i]!
				try {
					onProgress?.(`Extracting ${entry.filename}...`)
					const blob = await entry.getData(new BlobWriter())
					await dbService.saveFile(
						archiveId,
						meta.name,
						meta.type,
						meta.size,
						blob
					)
				} catch {}
			}
		}

		await Promise.all(
			Array.from(
				{length: Math.min(EXTRACT_CONCURRENCY, rawEntries.length)},
				() => worker()
			)
		)

		return {archiveId, entries: fileEntries}
	} finally {
		await reader.close()
	}
}
