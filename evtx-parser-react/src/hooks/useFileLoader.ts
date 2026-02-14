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

	const [data, setData] = useState<EvtxCacheData | unknown | string | null>(
		cached
	)
	const [isLoading, setIsLoading] = useState(cached === null)
	const [error, setError] = useState<string | null>(null)

	const load = useCallback(async () => {
		const _t0 = performance.now()

		// Check memory cache first — skip all loading state
		const memoryCached = getCachedContent(archiveId, fileName, fileType)
		if (memoryCached !== null) {
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
					// Always parse from blob — faster than DB deserialization of parsed records
					const _t1 = performance.now()
					const blob = await dbService.getFileBlob(fileId)
					if (!blob) throw new Error('File not found in database')

					const _t2 = performance.now()
					const buffer = await blob.arrayBuffer()

					const _t3 = performance.now()
					const {result, parseTime} = await parseFileBuffer(buffer)

					const evtxData: EvtxCacheData = {
						result,
						fileSize: buffer.byteLength,
						parseTime,
						fileName: fileName.replace(/\.evtx$/i, '')
					}

					setCachedContent(archiveId, fileName, 'evtx', evtxData)
					setData(evtxData)

					// Defer indexing only
					requestIdleCallback(() => {
						dbService.isFileIndexed(fileId).then(isIndexed => {
							if (!isIndexed) {
								dbService.getArchive(archiveId).then(archive => {
									dbService
										.indexEvtxEvents(
											fileId,
											archiveId,
											archive?.name ?? '',
											fileName,
											evtxData.result.records
										)
										.catch(() => {})
								})
							}
						})
					})
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
	return {
		data: cached ?? data,
		isLoading: cached ? false : isLoading,
		error,
		reload: load
	}
}
