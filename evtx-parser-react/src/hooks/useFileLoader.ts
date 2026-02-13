import {useCallback, useEffect, useState} from 'react'
import type {EvtxCacheData} from '@/contexts/CacheContext'
import {useCache} from '@/contexts/CacheContext'
import * as dbService from '@/db/service'
import {parseFileBuffer} from '@/hooks/useEvtxParserHelpers'
import type {FileType} from '@/lib/fileTypes'

interface FileLoaderResult {
	data: EvtxCacheData | unknown | string | null
	isLoading: boolean
	error: string | null
	reload: () => void
}

export function useFileLoader(
	archiveId: string,
	fileName: string,
	fileType: FileType
): FileLoaderResult {
	const {getCachedContent, setCachedContent} = useCache()

	// Synchronous cache check during render — no loading flash for cached files
	const cached = getCachedContent(archiveId, fileName, fileType)

	const [data, setData] = useState<EvtxCacheData | unknown | string | null>(cached)
	const [isLoading, setIsLoading] = useState(cached === null)
	const [error, setError] = useState<string | null>(null)

	const load = useCallback(async () => {
		const t0 = performance.now()

		// Check memory cache first — skip all loading state
		const memoryCached = getCachedContent(archiveId, fileName, fileType)
		if (memoryCached !== null) {
			console.log(`[nav] ${fileName} cache hit: ${(performance.now() - t0).toFixed(1)}ms`)
			setData(memoryCached)
			setIsLoading(false)
			setError(null)
			return
		}

		// Not cached — show loading state
		setIsLoading(true)
		setError(null)
		setData(null)

		const fileId = dbService.generateFileId(archiveId, fileName)

		try {
			switch (fileType) {
				case 'evtx': {
					const t1 = performance.now()
					const storedFile = await dbService.getFile(fileId)
					console.log(`[nav] ${fileName} DB read: ${(performance.now() - t1).toFixed(1)}ms`)

					if (storedFile?.parsedData) {
						const parsedData = storedFile.parsedData as EvtxCacheData
						setCachedContent(archiveId, fileName, 'evtx', parsedData)
						setData(parsedData)
						setIsLoading(false)
						console.log(`[nav] ${fileName} DB cache total: ${(performance.now() - t0).toFixed(1)}ms`)
						return
					}

					if (!storedFile) throw new Error('File not found in database')

					const t2 = performance.now()
					const buffer = await storedFile.blob.arrayBuffer()
					console.log(`[nav] ${fileName} blob→buffer: ${(performance.now() - t2).toFixed(1)}ms`)

					const t3 = performance.now()
					const {result, parseTime} = await parseFileBuffer(buffer)
					console.log(`[nav] ${fileName} parse: ${(performance.now() - t3).toFixed(1)}ms (worker: ${parseTime.toFixed(1)}ms)`)

					const evtxData: EvtxCacheData = {
						result,
						fileSize: buffer.byteLength,
						parseTime,
						fileName: fileName.replace(/\.evtx$/i, '')
					}

					setCachedContent(archiveId, fileName, 'evtx', evtxData)
					setData(evtxData)

					// Defer DB write and indexing
					requestIdleCallback(() => {
						dbService.updateFileParsedData(fileId, evtxData).catch(() => {})
						dbService.isFileIndexed(fileId).then(isIndexed => {
							if (!isIndexed) {
								dbService.getArchive(archiveId).then(archive => {
									dbService
										.indexEvtxEvents(fileId, archiveId, archive?.name ?? '', fileName, evtxData.result.records)
										.catch(() => {})
								})
							}
						})
					})

					console.log(`[nav] ${fileName} total: ${(performance.now() - t0).toFixed(1)}ms`)
					break
				}

				case 'json': {
					const storedFile = await dbService.getFile(fileId)
					if (storedFile?.parsedData) {
						setCachedContent(archiveId, fileName, 'json', storedFile.parsedData)
						setData(storedFile.parsedData)
						setIsLoading(false)
						return
					}

					if (!storedFile) throw new Error('File not found in database')

					const buffer = await storedFile.blob.arrayBuffer()
					const text = new TextDecoder().decode(buffer)
					const json: unknown = JSON.parse(text)

					setCachedContent(archiveId, fileName, 'json', json)
					await dbService.updateFileParsedData(fileId, json)
					setData(json)
					break
				}

				case 'txt':
				case 'xml': {
					const storedFile = await dbService.getFile(fileId)
					if (storedFile?.parsedData) {
						setCachedContent(
							archiveId,
							fileName,
							fileType,
							storedFile.parsedData as string
						)
						setData(storedFile.parsedData as string)
						setIsLoading(false)
						return
					}

					if (!storedFile) throw new Error('File not found in database')

					const buffer = await storedFile.blob.arrayBuffer()
					const text = new TextDecoder().decode(buffer)

					setCachedContent(archiveId, fileName, fileType, text)
					await dbService.updateFileParsedData(fileId, text)
					setData(text)
					break
				}

				default:
					throw new Error(`Unsupported file type: ${fileType}`)
			}
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Failed to load file')
		} finally {
			setIsLoading(false)
		}
	}, [archiveId, fileName, fileType, getCachedContent, setCachedContent])

	useEffect(() => {
		load()
	}, [load])

	// For cache hits: `cached` is non-null on first render, `data` follows on re-render
	return {data: cached ?? data, isLoading: cached ? false : isLoading, error, reload: load}
}
