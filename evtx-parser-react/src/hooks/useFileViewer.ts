import { useCallback, useEffect, useRef, useState } from 'react'
import { BlobReader, BlobWriter, ZipReader, type Entry } from '@zip.js/zip.js'
import type { EvtxParseResult } from '@/parser'
import { createPool, parseBuffer } from './useEvtxParserHelpers'
import type { ChunkWorkerPool } from '@/worker/worker-pool'

export type FileType = 'evtx' | 'json' | 'txt' | 'unknown'

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
	| { status: 'idle' }
	| { status: 'loading-zip'; fileName: string }
	| {
			status: 'zip-loaded'
			zipFileName: string
			entries: ZipFileEntry[]
			currentFile: CurrentFile | null
	  }
	| {
			status: 'viewing-file'
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
	| { status: 'error'; error: string }

interface CacheEntry<T> {
	data: T
	accessTime: number
}

const MAX_EVTX_CACHE = 3

function detectFileType(fileName: string): FileType {
	const lower = fileName.toLowerCase()
	if (lower.endsWith('.evtx')) return 'evtx'
	if (lower.endsWith('.json')) return 'json'
	if (lower.endsWith('.txt') || lower.endsWith('.log')) return 'txt'
	return 'unknown'
}

function isCancellation(e: unknown): boolean {
	return e instanceof Error && e.message === 'Cancelled'
}

export function useFileViewer() {
	const [state, setState] = useState<FileViewerState>({ status: 'idle' })
	const zipReaderRef = useRef<ZipReader<Blob> | null>(null)
	const poolRef = useRef<ChunkWorkerPool | null | undefined>(undefined)

	// Caches with access time tracking
	const evtxCacheRef = useRef<Map<string, CacheEntry<EvtxParseResult>>>(
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

				setState({
					status: 'zip-loaded',
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

	const extractEntry = useCallback(
		async (entry: Entry): Promise<ArrayBuffer> => {
			if (!entry.getData) {
				throw new Error('Entry has no getData method')
			}

			const blob = await entry.getData(new BlobWriter())
			return blob.arrayBuffer()
		},
		[]
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
				zipFileName: state.zipFileName,
				entries: state.entries,
				currentFile,
				isLoading: true,
			})

			try {
				const cacheKey = getCacheKey(state.zipFileName, entryName)

				switch (entry.type) {
					case 'evtx': {
						// Check cache first
						const cached = evtxCacheRef.current.get(cacheKey)
						if (cached) {
							// Update access time
							cached.accessTime = Date.now()
							setState({
								status: 'viewing-file',
								zipFileName: state.zipFileName,
								entries: state.entries,
								currentFile,
								isLoading: false,
							})
							return
						}

						// Extract and parse
						const buffer = await extractEntry(entry.entry)
						const { result } = await parseBuffer(buffer, getPool())

						// Store in cache with LRU eviction
						evtxCacheRef.current.set(cacheKey, {
							data: result,
							accessTime: Date.now(),
						})
						evictOldestEvtxCache()

						setState({
							status: 'viewing-file',
							zipFileName: state.zipFileName,
							entries: state.entries,
							currentFile,
							isLoading: false,
						})
						break
					}

					case 'json': {
						// Check cache first
						const cached = jsonCacheRef.current.get(cacheKey)
						if (cached) {
							cached.accessTime = Date.now()
							setState({
								status: 'viewing-file',
								zipFileName: state.zipFileName,
								entries: state.entries,
								currentFile,
								isLoading: false,
							})
							return
						}

						// Extract and parse JSON
						const buffer = await extractEntry(entry.entry)
						const text = new TextDecoder().decode(buffer)
						const json = JSON.parse(text)

						jsonCacheRef.current.set(cacheKey, {
							data: json,
							accessTime: Date.now(),
						})

						setState({
							status: 'viewing-file',
							zipFileName: state.zipFileName,
							entries: state.entries,
							currentFile,
							isLoading: false,
						})
						break
					}

					case 'txt': {
						// Check cache first
						const cached = textCacheRef.current.get(cacheKey)
						if (cached) {
							cached.accessTime = Date.now()
							setState({
								status: 'viewing-file',
								zipFileName: state.zipFileName,
								entries: state.entries,
								currentFile,
								isLoading: false,
							})
							return
						}

						// Extract text
						const buffer = await extractEntry(entry.entry)
						const text = new TextDecoder().decode(buffer)

						textCacheRef.current.set(cacheKey, {
							data: text,
							accessTime: Date.now(),
						})

						setState({
							status: 'viewing-file',
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
		[state, getCacheKey, extractEntry, getPool, evictOldestEvtxCache]
	)

	const viewStandaloneEvtx = useCallback((file: File) => {
		setState({
			status: 'standalone-evtx',
			fileName: file.name,
			file,
		})
	}, [])

	const getCachedContent = useCallback(
		(
			zipFileName: string,
			entryName: string,
			type: FileType
		): EvtxParseResult | unknown | string | null => {
			const cacheKey = getCacheKey(zipFileName, entryName)

			switch (type) {
				case 'evtx':
					return evtxCacheRef.current.get(cacheKey)?.data || null
				case 'json':
					return jsonCacheRef.current.get(cacheKey)?.data || null
				case 'txt':
					return textCacheRef.current.get(cacheKey)?.data || null
				default:
					return null
			}
		},
		[getCacheKey]
	)

	const reset = useCallback(() => {
		const pool = poolRef.current
		if (pool) pool.cancel()

		zipReaderRef.current?.close()
		zipReaderRef.current = null

		clearCaches()
		setState({ status: 'idle' })
	}, [clearCaches])

	const clearError = useCallback(() => {
		if (state.status === 'error') {
			setState({ status: 'idle' })
		}
	}, [state])

	return {
		state,
		loadZipFile,
		viewFile,
		viewStandaloneEvtx,
		getCachedContent,
		clearCaches,
		reset,
		clearError,
		cacheStats: {
			evtx: evtxCacheRef.current.size,
			json: jsonCacheRef.current.size,
			txt: textCacheRef.current.size,
		},
	}
}
