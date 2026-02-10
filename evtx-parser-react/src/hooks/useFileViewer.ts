import { useCallback, useEffect, useRef, useState } from 'react'
import { BlobReader, BlobWriter, ZipReader, type Entry } from '@zip.js/zip.js'
import type { EvtxParseResult } from '@/parser'
import { createPool, parseBuffer } from './useEvtxParserHelpers'
import type { ChunkWorkerPool } from '@/worker/worker-pool'
import * as dbService from '@/db/service'
import type { Archive } from '@/db/schema'

export type FileType = 'evtx' | 'json' | 'txt' | 'xml' | 'unknown'

export interface ZipFileEntry {
	name: string
	size: number
	compressedSize: number
	type: FileType
	entry: Entry
}

export interface CurrentFile {
	name: string
	type: FileType
	// Content will be stored in appropriate cache
}

type FileViewerState =
	| { status: 'idle'; recentArchives: Archive[] }
	| { status: 'loading-zip'; fileName: string }
	| { status: 'loading-archive'; archiveId: string; archiveName: string }
	| {
			status: 'zip-loaded'
			archiveId: string
			zipFileName: string
			entries: ZipFileEntry[]
			currentFile: CurrentFile | null
	  }
	| {
			status: 'viewing-file'
			archiveId: string
			zipFileName: string
			entries: ZipFileEntry[]
			currentFile: CurrentFile
			isLoading: boolean
	  }
	| {
			status: 'standalone-evtx'
			fileName: string
			file: File
	  }
	| {
			status: 'standalone-text'
			fileName: string
			file: File
	  }
	| { status: 'error'; error: string }

interface CacheEntry<T> {
	data: T
	accessTime: number
}

interface EvtxCacheData {
	result: EvtxParseResult
	fileSize: number
	parseTime: number
	fileName: string
}

const MAX_EVTX_CACHE = 3

function detectFileType(fileName: string): FileType {
	const lower = fileName.toLowerCase()
	if (lower.endsWith('.evtx')) return 'evtx'
	if (lower.endsWith('.json')) return 'json'
	if (lower.endsWith('.txt') || lower.endsWith('.log')) return 'txt'
	if (lower.endsWith('.xml')) return 'xml'
	return 'unknown'
}

function isCancellation(e: unknown): boolean {
	return e instanceof Error && e.message === 'Cancelled'
}

export function useFileViewer() {
	const [state, setState] = useState<FileViewerState>({
		status: 'idle',
		recentArchives: [],
	})
	const zipReaderRef = useRef<ZipReader<Blob> | null>(null)
	const poolRef = useRef<ChunkWorkerPool | null | undefined>(undefined)
	const currentArchiveIdRef = useRef<string | null>(null)

	// Caches with access time tracking
	const evtxCacheRef = useRef<Map<string, CacheEntry<EvtxCacheData>>>(
		new Map()
	)
	const jsonCacheRef = useRef<Map<string, CacheEntry<unknown>>>(new Map())
	const textCacheRef = useRef<Map<string, CacheEntry<string>>>(new Map())

	const getPool = useCallback((): ChunkWorkerPool | null => {
		if (poolRef.current === undefined) {
			poolRef.current = createPool()
		}
		return poolRef.current
	}, [])

	// Cleanup on unmount
	useEffect(
		() => () => {
			zipReaderRef.current?.close()
			zipReaderRef.current = null
			poolRef.current?.dispose()
			poolRef.current = null
		},
		[]
	)

	// Load recent archives on mount
	useEffect(() => {
		async function loadArchives() {
			try {
				const archives = await dbService.getAllArchives()
				setState((prev) =>
					prev.status === 'idle' ? { ...prev, recentArchives: archives } : prev
				)
			} catch (error) {
				console.error('Failed to load archives:', error)
			}
		}
		loadArchives()
	}, [])

	const getCacheKey = useCallback(
		(zipFileName: string, entryName: string) => `${zipFileName}::${entryName}`,
		[]
	)

	const evictOldestEvtxCache = useCallback(() => {
		const cache = evtxCacheRef.current
		if (cache.size <= MAX_EVTX_CACHE) return

		// Find oldest entry by access time
		let oldestKey: string | null = null
		let oldestTime = Number.POSITIVE_INFINITY

		for (const [key, entry] of cache.entries()) {
			if (entry.accessTime < oldestTime) {
				oldestTime = entry.accessTime
				oldestKey = key
			}
		}

		if (oldestKey) {
			cache.delete(oldestKey)
		}
	}, [])

	const clearCaches = useCallback(() => {
		evtxCacheRef.current.clear()
		jsonCacheRef.current.clear()
		textCacheRef.current.clear()
	}, [])

	const loadZipFile = useCallback(
		async (file: File) => {
			try {
				setState({ status: 'loading-zip', fileName: file.name })

				// Clean up previous zip reader
				if (zipReaderRef.current) {
					await zipReaderRef.current.close()
					zipReaderRef.current = null
				}

				// Clear all caches when loading new zip
				clearCaches()

				// Open zip file
				const reader = new ZipReader(new BlobReader(file))
				zipReaderRef.current = reader

				// Get all entries
				const entries = await reader.getEntries()

				if (entries.length === 0) {
					setState({ status: 'error', error: 'Zip file is empty' })
					return
				}

				// Map to ZipFileEntry with type detection
				const fileEntries: ZipFileEntry[] = entries
					.filter((entry) => !entry.directory && entry.filename)
					.map((entry) => ({
						name: entry.filename,
						size: entry.uncompressedSize,
						compressedSize: entry.compressedSize || 0,
						type: detectFileType(entry.filename),
						entry,
					}))

				// Check if there are any viewable files
				const viewableCount = fileEntries.filter(
					(e) => e.type !== 'unknown'
				).length

				if (viewableCount === 0) {
					setState({
						status: 'error',
						error: `No viewable files found. Files in archive: ${fileEntries
							.map((e) => e.name)
							.join(', ')}`,
					})
					return
				}

				// Save archive to IndexedDB and extract all files
				const totalSize = fileEntries.reduce((sum, e) => sum + e.size, 0)
				const archiveId = await dbService.saveArchive(
					file.name,
					totalSize,
					[] // Will update with file IDs after extraction
				)
				currentArchiveIdRef.current = archiveId

				// Extract and save all files to IndexedDB
				const fileIds: string[] = []
				for (const entry of fileEntries) {
					try {
						// Type guard: check if entry has getData method (not a directory)
						if (!('getData' in entry.entry) || typeof entry.entry.getData !== 'function') {
							console.warn(`Skipping ${entry.name}: no getData method`)
							continue
						}

						const blob = await entry.entry.getData(new BlobWriter())
						const fileId = await dbService.saveFile(
							archiveId,
							entry.name,
							entry.type,
							entry.size,
							blob
						)
						fileIds.push(fileId)
					} catch (error) {
						console.error(`Failed to extract ${entry.name}:`, error)
					}
				}

				// Update archive with file IDs
				const archive = await dbService.getArchive(archiveId)
				if (archive) {
					archive.files = fileIds
					// Note: Dexie doesn't have a direct update for arrays, so we'll handle this in the service
				}

				// Close zip reader now that everything is extracted
				await reader.close()
				zipReaderRef.current = null

				setState({
					status: 'zip-loaded',
					archiveId,
					zipFileName: file.name,
					entries: fileEntries,
					currentFile: null,
				})
			} catch (error) {
				setState({
					status: 'error',
					error: `Failed to load zip file: ${error instanceof Error ? error.message : String(error)}`,
				})
			}
		},
		[clearCaches]
	)

	const viewFile = useCallback(
		async (entryName: string) => {
			if (state.status !== 'zip-loaded' && state.status !== 'viewing-file') {
				return
			}

			const entry = state.entries.find((e) => e.name === entryName)
			if (!entry) {
				setState({ ...state, status: 'error', error: 'File not found in archive' })
				return
			}

			const currentFile: CurrentFile = {
				name: entryName,
				type: entry.type,
			}

			setState({
				status: 'viewing-file',
				archiveId: state.archiveId,
				zipFileName: state.zipFileName,
				entries: state.entries,
				currentFile,
				isLoading: true,
			})

			try {
				const cacheKey = getCacheKey(state.zipFileName, entryName)
				const fileId = dbService.generateFileId(state.archiveId, entryName)

				switch (entry.type) {
					case 'evtx': {
						// Check memory cache first
						const cached = evtxCacheRef.current.get(cacheKey)
						if (cached) {
							// Update access time
							cached.accessTime = Date.now()
							setState({
								status: 'viewing-file',
								archiveId: state.archiveId,
								zipFileName: state.zipFileName,
								entries: state.entries,
								currentFile,
								isLoading: false,
							})
							return
						}

						// Check IndexedDB for parsed data
						const storedFile = await dbService.getFile(fileId)
						if (storedFile?.parsedData) {
							const parsedData = storedFile.parsedData as EvtxCacheData
							// Store in memory cache
							evtxCacheRef.current.set(cacheKey, {
								data: parsedData,
								accessTime: Date.now(),
							})
							evictOldestEvtxCache()

							setState({
								status: 'viewing-file',
								archiveId: state.archiveId,
								zipFileName: state.zipFileName,
								entries: state.entries,
								currentFile,
								isLoading: false,
							})
							return
						}

						// Need to parse - load blob from IndexedDB
						if (!storedFile) {
							throw new Error('File not found in database')
						}

						const buffer = await storedFile.blob.arrayBuffer()
						const { result, parseTime } = await parseBuffer(buffer, getPool())

						const evtxData: EvtxCacheData = {
							result,
							fileSize: buffer.byteLength,
							parseTime,
							fileName: entry.name.replace(/\.evtx$/i, ''),
						}

						// Store in memory cache
						evtxCacheRef.current.set(cacheKey, {
							data: evtxData,
							accessTime: Date.now(),
						})
						evictOldestEvtxCache()

						// Save parsed data to IndexedDB
						await dbService.updateFileParsedData(fileId, evtxData)

						// Index events in background (non-blocking)
						const isIndexed = await dbService.isFileIndexed(fileId)
						if (!isIndexed) {
							// Index in background
							dbService
								.indexEvtxEvents(
									fileId,
									state.archiveId,
									state.zipFileName,
									entry.name,
									result.records
								)
								.catch((error) => {
									console.error('Failed to index events:', error)
								})
						}

						setState({
							status: 'viewing-file',
							archiveId: state.archiveId,
							zipFileName: state.zipFileName,
							entries: state.entries,
							currentFile,
							isLoading: false,
						})
						break
					}

					case 'json': {
						// Check memory cache first
						const cached = jsonCacheRef.current.get(cacheKey)
						if (cached) {
							cached.accessTime = Date.now()
							setState({
								status: 'viewing-file',
								archiveId: state.archiveId,
								zipFileName: state.zipFileName,
								entries: state.entries,
								currentFile,
								isLoading: false,
							})
							return
						}

						// Check IndexedDB
						const storedFile = await dbService.getFile(fileId)
						if (storedFile?.parsedData) {
							jsonCacheRef.current.set(cacheKey, {
								data: storedFile.parsedData,
								accessTime: Date.now(),
							})

							setState({
								status: 'viewing-file',
								archiveId: state.archiveId,
								zipFileName: state.zipFileName,
								entries: state.entries,
								currentFile,
								isLoading: false,
							})
							return
						}

						// Parse from blob
						if (!storedFile) {
							throw new Error('File not found in database')
						}

						const buffer = await storedFile.blob.arrayBuffer()
						const text = new TextDecoder().decode(buffer)
						const json = JSON.parse(text)

						jsonCacheRef.current.set(cacheKey, {
							data: json,
							accessTime: Date.now(),
						})

						// Save parsed data to IndexedDB
						await dbService.updateFileParsedData(fileId, json)

						setState({
							status: 'viewing-file',
							archiveId: state.archiveId,
							zipFileName: state.zipFileName,
							entries: state.entries,
							currentFile,
							isLoading: false,
						})
						break
					}

					case 'txt':
					case 'xml': {
						// Check memory cache first
						const cached = textCacheRef.current.get(cacheKey)
						if (cached) {
							cached.accessTime = Date.now()
							setState({
								status: 'viewing-file',
								archiveId: state.archiveId,
								zipFileName: state.zipFileName,
								entries: state.entries,
								currentFile,
								isLoading: false,
							})
							return
						}

						// Check IndexedDB
						const storedFile = await dbService.getFile(fileId)
						if (storedFile?.parsedData) {
							textCacheRef.current.set(cacheKey, {
								data: storedFile.parsedData as string,
								accessTime: Date.now(),
							})

							setState({
								status: 'viewing-file',
								archiveId: state.archiveId,
								zipFileName: state.zipFileName,
								entries: state.entries,
								currentFile,
								isLoading: false,
							})
							return
						}

						// Parse from blob
						if (!storedFile) {
							throw new Error('File not found in database')
						}

						const buffer = await storedFile.blob.arrayBuffer()
						const text = new TextDecoder().decode(buffer)

						textCacheRef.current.set(cacheKey, {
							data: text,
							accessTime: Date.now(),
						})

						// Save parsed data to IndexedDB
						await dbService.updateFileParsedData(fileId, text)

						setState({
							status: 'viewing-file',
							archiveId: state.archiveId,
							zipFileName: state.zipFileName,
							entries: state.entries,
							currentFile,
							isLoading: false,
						})
						break
					}

					default:
						setState({
							...state,
							status: 'error',
							error: `Unsupported file type: ${entry.type}`,
						})
				}
			} catch (error) {
				if (isCancellation(error)) return

				setState({
					...state,
					status: 'error',
					error: `Failed to view file: ${error instanceof Error ? error.message : String(error)}`,
				})
			}
		},
		[state, getCacheKey, getPool, evictOldestEvtxCache]
	)

	const loadArchive = useCallback(async (archiveId: string) => {
		try {
			const archive = await dbService.getArchive(archiveId)
			if (!archive) {
				setState({ status: 'error', error: 'Archive not found' })
				return
			}

			setState({
				status: 'loading-archive',
				archiveId,
				archiveName: archive.name,
			})

			// Load all files from archive
			const files = await dbService.getFilesByArchive(archiveId)

			// Convert to ZipFileEntry format (without Entry objects)
			const fileEntries: ZipFileEntry[] = files.map((file) => ({
				name: file.name,
				size: file.size,
				compressedSize: file.size,
				type: file.type,
				entry: null as any, // Not needed when loading from DB
			}))

			currentArchiveIdRef.current = archiveId

			setState({
				status: 'zip-loaded',
				archiveId,
				zipFileName: archive.name,
				entries: fileEntries,
				currentFile: null,
			})
		} catch (error) {
			setState({
				status: 'error',
				error: `Failed to load archive: ${error instanceof Error ? error.message : String(error)}`,
			})
		}
	}, [])

	const viewStandaloneEvtx = useCallback((file: File) => {
		setState({
			status: 'standalone-evtx',
			fileName: file.name,
			file,
		})
	}, [])

	const viewStandaloneText = useCallback((file: File) => {
		setState({
			status: 'standalone-text',
			fileName: file.name,
			file,
		})
	}, [])

	const getCachedContent = useCallback(
		(
			zipFileName: string,
			entryName: string,
			type: FileType
		): EvtxCacheData | unknown | string | null => {
			const cacheKey = getCacheKey(zipFileName, entryName)

			switch (type) {
				case 'evtx':
					return evtxCacheRef.current.get(cacheKey)?.data || null
				case 'json':
					return jsonCacheRef.current.get(cacheKey)?.data || null
				case 'txt':
				case 'xml':
					return textCacheRef.current.get(cacheKey)?.data || null
				default:
					return null
			}
		},
		[getCacheKey]
	)

	const reset = useCallback(async () => {
		const pool = poolRef.current
		if (pool) pool.cancel()

		zipReaderRef.current?.close()
		zipReaderRef.current = null

		clearCaches()
		currentArchiveIdRef.current = null

		// Reload archives list
		const archives = await dbService.getAllArchives()
		setState({ status: 'idle', recentArchives: archives })
	}, [clearCaches])

	const clearError = useCallback(async () => {
		if (state.status === 'error') {
			const archives = await dbService.getAllArchives()
			setState({ status: 'idle', recentArchives: archives })
		}
	}, [state])

	const navigateToEvent = useCallback(async (archiveId: string, fileName: string, recordId: number) => {
		try {
			// First check if we're already viewing this archive
			if (
				(state.status === 'zip-loaded' || state.status === 'viewing-file') &&
				state.archiveId === archiveId
			) {
				// Same archive, just switch to the file
				await viewFile(fileName)
			} else {
				// Different archive, load it first
				await loadArchive(archiveId)
				// Wait a bit for state to update, then view the file
				await new Promise(resolve => setTimeout(resolve, 200))
				await viewFile(fileName)
			}

			// Scroll to event will be handled by the component via selectedRecordId
			return recordId
		} catch (error) {
			console.error('Failed to navigate to event:', error)
			throw error
		}
	}, [state, viewFile, loadArchive])

	return {
		state,
		loadZipFile,
		loadArchive,
		viewFile,
		viewStandaloneEvtx,
		viewStandaloneText,
		getCachedContent,
		clearCaches,
		reset,
		clearError,
		navigateToEvent,
		cacheStats: {
			evtx: evtxCacheRef.current.size,
			json: jsonCacheRef.current.size,
			txt: textCacheRef.current.size,
		},
	}
}
