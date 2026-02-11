import {BlobReader, BlobWriter, ZipReader} from '@zip.js/zip.js'
import * as dbService from '@/db/service'
import type {FileType} from './fileTypes'
import {detectFileType} from './fileTypes'

export interface ZipFileEntry {
	name: string
	size: number
	compressedSize: number
	type: FileType
}

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

		const fileEntries: ZipFileEntry[] = entries
			.filter(entry => !entry.directory && entry.filename)
			.map(entry => ({
				name: entry.filename,
				size: entry.uncompressedSize,
				compressedSize: entry.compressedSize || 0,
				type: detectFileType(entry.filename)
			}))

		const viewableCount = fileEntries.filter(e => e.type !== 'unknown').length

		if (viewableCount === 0) {
			throw new Error(
				`No viewable files found. Files in archive: ${fileEntries
					.map(e => e.name)
					.join(', ')}`
			)
		}

		onProgress?.('Saving archive...')

		const totalSize = fileEntries.reduce((sum, e) => sum + e.size, 0)
		const archiveId = await dbService.saveArchive(file.name, totalSize, [])

		// Extract and save all files to IndexedDB
		const rawEntries = entries.filter(e => !e.directory && e.filename)
		for (const entry of rawEntries) {
			try {
				if (!('getData' in entry) || typeof entry.getData !== 'function') {
					continue
				}

				onProgress?.(`Extracting ${entry.filename}...`)
				const blob = await entry.getData(new BlobWriter())
				await dbService.saveFile(
					archiveId,
					entry.filename,
					detectFileType(entry.filename),
					entry.uncompressedSize,
					blob
				)
			} catch {}
		}

		return {archiveId, entries: fileEntries}
	} finally {
		await reader.close()
	}
}
